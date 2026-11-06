# Copyright 2026 Swayam Kumar
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Service layer for Milestone M3: Habitation Clustering, Proxy Classification,
Census 2011 Reconciliation, and Append-Only Verification Audit Ledger.
"""

import csv
import io
import math
from datetime import UTC, datetime
from typing import Any

from shapely.geometry import Point, Polygon, mapping
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models.auth import User
from app.db.models.ops import AuditEvent, Job
from app.db.models.project import ProjectAoi
from app.db.models.reference import AdminUnit, CensusVillage
from app.db.models.settlement import (
    ClusterRun,
    SettlementCluster,
    VerificationImport,
    VerificationRecord,
)
from app.db.models.spatial import Building, OsmFeature
from app.domain.gis.classification import (
    ClassificationThresholds,
    classify_habitation_clusters,
    reconcile_census_households,
)
from app.domain.gis.clustering import (
    BuildingFootprintInput,
    run_dbscan_habitation_clustering,
)
from app.schemas.settlement import (
    BuildingCreateRequest,
    BuildingPatchRequest,
    CensusReconciliationResponse,
    ClusteringParamsRequest,
    ClusteringRunResponse,
    ClusterListResponse,
    ClusterResponse,
    VerificationCreateRequest,
    VerificationImportResponse,
    VerificationLedgerResponse,
    VerificationRecordResponse,
    VerificationReversalRequest,
)
from app.services.data_service import run_project_data_acquisition_pipeline
from app.services.job_service import (
    enqueue_job,
    execute_job_synchronously,
    serialize_job,
    update_job_progress,
)
from app.services.project_service import get_owned_project_or_404
from app.worker import register_job_handler

DEFAULT_KORAPUT_CLUSTER_NAMES: dict[str, str] = {
    "CL-01": "Bheja Main Village Core",
    "CL-02": "Podapadar Tola (Eastern Ridge)",
    "CL-03": "Maliaguda PVTG Hamlet",
    "CL-04": "Upar Sahi Habitation",
    "ISO-01": "Dispersed Forest Homesteads (Sector A)",
    "ISO-02": "Dispersed Forest Homesteads (Sector B)",
}


def _default_cluster_name(label: str, is_isolated: bool) -> str:
    if label in DEFAULT_KORAPUT_CLUSTER_NAMES:
        return DEFAULT_KORAPUT_CLUSTER_NAMES[label]
    if is_isolated:
        return f"Dispersed Homesteads ({label})"
    return f"Habitation Cluster {label}"


def _serialize_cluster(row: SettlementCluster) -> ClusterResponse:
    pt = row.centroid
    lon = round(float(pt.x), 6) if pt is not None else 82.732
    lat = round(float(pt.y), 6) if pt is not None else 18.567
    geom_dict = dict(mapping(row.geom)) if row.geom is not None else {}
    return ClusterResponse(
        id=row.id,
        cluster_run_id=row.cluster_run_id,
        project_id=row.project_id,
        label=row.label,
        name=row.name,
        is_isolated_group=row.is_isolated_group,
        n_detected=row.n_detected,
        n_residential=row.n_residential,
        n_non_residential=row.n_non_residential,
        est_households=row.est_households,
        census_hh_ref=row.census_hh_ref,
        proxy_class=row.proxy_class,
        proxy_confidence=row.proxy_confidence,
        verification_state=row.verification_state,
        verified_class=row.verified_class,
        d_infra_m=row.d_infra_m,
        d_road_m=row.d_road_m,
        slope_mean_deg=row.slope_mean_deg,
        canopy_share=row.canopy_share,
        evidence=row.evidence or {},
        centroid_lon=lon,
        centroid_lat=lat,
        geojson_geometry=geom_dict,
        updated_at=row.updated_at,
    )


def _compute_census_reconciliation_for_project(
    db: Session,
    *,
    project_id: str,
    base_year: int,
    clusters: list[SettlementCluster],
) -> CensusReconciliationResponse:
    aoi_row = db.execute(
        select(ProjectAoi).where(ProjectAoi.project_id == project_id)
    ).scalar_one_or_none()

    census_code: str | None = aoi_row.census2011_code if aoi_row else None
    village_name: str | None = None
    census_hh: int | None = None

    if aoi_row and aoi_row.lgd_code and not census_code:
        au = db.execute(
            select(AdminUnit).where(AdminUnit.lgd_code == aoi_row.lgd_code)
        ).scalar_one_or_none()
        if au:
            census_code = au.census2011_code
            village_name = au.name

    if census_code:
        cv = db.execute(
            select(CensusVillage).where(CensusVillage.census2011_code == census_code)
        ).scalar_one_or_none()
        if cv:
            census_hh = cv.households
            village_name = cv.name

    sat_detected = sum(c.n_detected for c in clusters)
    sat_res = sum(c.n_residential for c in clusters)
    sat_est_hh = sum(c.est_households for c in clusters)

    summary = reconcile_census_households(
        satellite_detected_buildings=sat_detected,
        satellite_residential_buildings=sat_res,
        satellite_estimated_households=sat_est_hh,
        census2011_code=census_code,
        village_name=village_name,
        census_2011_households=census_hh,
        base_year=base_year,
    )
    return CensusReconciliationResponse(
        census2011_code=summary.census2011_code,
        village_name=summary.village_name,
        census_2011_households=summary.census_2011_households,
        projected_base_year_households=summary.projected_base_year_households,
        satellite_detected_buildings=summary.satellite_detected_buildings,
        satellite_residential_buildings=summary.satellite_residential_buildings,
        satellite_estimated_households=summary.satellite_estimated_households,
        delta_households=summary.delta_households,
        delta_pct=summary.delta_pct,
        divergence_exceeds_30pct=summary.divergence_exceeds_30pct,
        reconciliation_note=summary.reconciliation_note,
    )


def execute_settlement_clustering_pipeline(
    db: Session,
    *,
    project_id: str,
    params: dict[str, Any] | None = None,
    job: Job | None = None,
) -> dict[str, Any]:
    """Run metric DBSCAN clustering and 4-tier proxy classification for a project."""
    aoi_row = db.execute(
        select(ProjectAoi).where(ProjectAoi.project_id == project_id)
    ).scalar_one_or_none()
    if aoi_row is None or aoi_row.geom is None:
        raise AppError(
            code="AOI_REQUIRED_FOR_CLUSTERING",
            message="Project must have a validated AOI before running habitation clustering.",
            status_code=422,
        )

    buildings_rows = (
        db.execute(select(Building).where(Building.project_id == project_id))
        .scalars()
        .all()
    )
    if not buildings_rows:
        run_project_data_acquisition_pipeline(db, project_id, job=None)
        buildings_rows = (
            db.execute(select(Building).where(Building.project_id == project_id))
            .scalars()
            .all()
        )

    eps_m_val = float((params or {}).get("eps_m", 150.0))
    min_samples_val = int((params or {}).get("min_samples", 5))
    household_alpha_val = float((params or {}).get("household_alpha", 0.90))
    nl_electrified_min_val = float((params or {}).get("nl_electrified_min", 0.75))
    nl_unserved_max_val = float((params or {}).get("nl_unserved_max", 0.20))

    cfg_params: dict[str, Any] = {
        "eps_m": eps_m_val,
        "min_samples": min_samples_val,
        "household_alpha": household_alpha_val,
        "nl_electrified_min": nl_electrified_min_val,
        "nl_unserved_max": nl_unserved_max_val,
    }

    if job is not None:
        update_job_progress(
            db, job, progress=25, stage="Projecting building footprints to UTM EPSG:32644"
        )

    footprint_inputs: list[BuildingFootprintInput] = []
    for b in buildings_rows:
        if isinstance(b.geom, Polygon) and isinstance(b.centroid, Point):
            footprint_inputs.append(
                BuildingFootprintInput(
                    building_id=b.id,
                    geom=b.geom,
                    centroid=b.centroid,
                    area_m2=b.area_m2,
                    confidence=b.confidence,
                    size_class=b.size_class,
                    is_excluded=b.is_excluded,
                )
            )

    if job is not None:
        update_job_progress(
            db,
            job,
            progress=55,
            stage=(
                f"Running DBSCAN (eps={eps_m_val}m, "
                f"min_samples={min_samples_val})"
            ),
        )

    clustering_res = run_dbscan_habitation_clustering(
        footprint_inputs,
        metric_epsg=32644,
        eps_m=eps_m_val,
        min_samples=min_samples_val,
        household_alpha=household_alpha_val,
    )

    if job is not None:
        update_job_progress(
            db,
            job,
            progress=80,
            stage="Extracting zonal statistics & applying 4-tier proxy rules",
        )

    osm_roads = (
        db.execute(
            select(OsmFeature).where(
                OsmFeature.project_id == project_id,
                OsmFeature.category == "ROAD",
            )
        )
        .scalars()
        .all()
    )
    road_geoms = [r.geom for r in osm_roads if r.geom is not None]

    thresholds = ClassificationThresholds(
        nl_electrified_min=nl_electrified_min_val,
        nl_unserved_max=nl_unserved_max_val,
        min_buildings_for_proxy=min_samples_val,
    )
    classified_list = classify_habitation_clusters(
        clustering_res.clusters,
        aoi_geom=aoi_row.geom,
        road_geoms_wgs84=road_geoms,
        metric_epsg=32644,
        thresholds=thresholds,
    )

    # Mark prior ClusterRuns as not current and clear old unverified clusters
    db.execute(
        update(ClusterRun)
        .where(ClusterRun.project_id == project_id)
        .values(is_current=False)
    )
    db.execute(
        delete(SettlementCluster).where(SettlementCluster.project_id == project_id)
    )

    run_row = ClusterRun(
        project_id=project_id,
        params=cfg_params,
        is_current=True,
    )
    db.add(run_row)
    db.flush()

    cluster_id_by_idx: dict[int, str] = {}
    new_clusters: list[SettlementCluster] = []
    for item in classified_list:
        c = item.cluster
        sc = SettlementCluster(
            cluster_run_id=run_row.id,
            project_id=project_id,
            label=c.label,
            name=_default_cluster_name(c.label, c.is_isolated_group),
            geom=c.geom,
            centroid=c.centroid,
            is_isolated_group=c.is_isolated_group,
            n_detected=c.n_detected,
            n_residential=c.n_residential,
            n_non_residential=c.n_non_residential,
            est_households=c.est_households,
            census_hh_ref=None,
            evidence=item.evidence,
            proxy_class=item.proxy_class,
            proxy_confidence=item.proxy_confidence,
            verification_state="UNVERIFIED",
            verified_class=None,
            d_infra_m=item.d_infra_m,
            d_road_m=item.d_road_m,
            slope_mean_deg=item.slope_mean_deg,
            canopy_share=item.canopy_share,
        )
        db.add(sc)
        new_clusters.append(sc)

    db.flush()
    for sc, item in zip(new_clusters, classified_list, strict=True):
        cluster_id_by_idx[item.cluster.cluster_index] = sc.id

    # Link buildings to their assigned cluster
    for b in buildings_rows:
        c_idx = clustering_res.building_to_cluster_index.get(b.id)
        b.cluster_run_id = run_row.id
        b.cluster_id = cluster_id_by_idx.get(c_idx) if c_idx is not None else None

    db.commit()
    return {
        "cluster_run_id": run_row.id,
        "clusters_detected": len(new_clusters),
        "total_estimated_households": sum(c.est_households for c in new_clusters),
        "excluded_buildings": clustering_res.excluded_count,
    }


def _job_handler_cluster_settlements(db: Session, job: Job) -> dict[str, Any]:
    if not job.project_id:
        raise ValueError("Job is missing project_id.")
    return execute_settlement_clustering_pipeline(
        db, project_id=job.project_id, params=job.params, job=job
    )


register_job_handler("CLUSTER_SETTLEMENTS", _job_handler_cluster_settlements)


def trigger_project_clustering(
    db: Session,
    *,
    project_id: str,
    params_req: ClusteringParamsRequest,
    user: User,
) -> ClusteringRunResponse:
    """Enqueue and execute habitation clustering + classification for a project."""
    proj = get_owned_project_or_404(db, project_id, user)
    params_dict = params_req.model_dump()
    job = enqueue_job(
        db,
        project_id=proj.id,
        job_type="CLUSTER_SETTLEMENTS",
        params=params_dict,
        user=user,
    )
    job = execute_job_synchronously(db, job, _job_handler_cluster_settlements)
    if job.status == "SUCCEEDED":
        proj.version += 1
        db.add(
            AuditEvent(
                project_id=proj.id,
                actor_id=user.id,
                event_type="SETTLEMENT_CLUSTERING_COMPLETED",
                entity="clusters",
                entity_id=proj.id,
                diff=job.result,
            )
        )
        db.commit()

    settlements = get_project_settlement_state(db, project_id=proj.id, user=user)
    return ClusteringRunResponse(job=serialize_job(job), settlements=settlements)


def get_project_settlement_state(
    db: Session,
    *,
    project_id: str,
    user: User,
) -> ClusterListResponse:
    """Return all habitation clusters, GeoJSON polygons, and Census reconciliation."""
    proj = get_owned_project_or_404(db, project_id, user)

    clusters = (
        db.execute(
            select(SettlementCluster)
            .where(SettlementCluster.project_id == proj.id)
            .order_by(SettlementCluster.is_isolated_group.asc(), SettlementCluster.label.asc())
        )
        .scalars()
        .all()
    )
    if not clusters and proj.id == "00000000-0000-4000-8000-000000000001":
        execute_settlement_clustering_pipeline(db, project_id=proj.id, params=None, job=None)
        clusters = (
            db.execute(
                select(SettlementCluster)
                .where(SettlementCluster.project_id == proj.id)
                .order_by(
                    SettlementCluster.is_isolated_group.asc(), SettlementCluster.label.asc()
                )
            )
            .scalars()
            .all()
        )

    current_run = db.execute(
        select(ClusterRun)
        .where(ClusterRun.project_id == proj.id, ClusterRun.is_current.is_(True))
        .order_by(ClusterRun.created_at.desc())
    ).scalars().first()

    items = [_serialize_cluster(c) for c in clusters]
    features = [
        {
            "type": "Feature",
            "properties": {
                "id": c.id,
                "label": c.label,
                "name": c.name,
                "is_isolated_group": c.is_isolated_group,
                "n_detected": c.n_detected,
                "n_residential": c.n_residential,
                "est_households": c.est_households,
                "proxy_class": c.proxy_class,
                "proxy_confidence": c.proxy_confidence,
                "verification_state": c.verification_state,
                "verified_class": c.verified_class,
                "slope_mean_deg": c.slope_mean_deg,
                "canopy_share": c.canopy_share,
            },
            "geometry": c.geojson_geometry,
        }
        for c in items
    ]

    total_hh = sum(c.est_households for c in clusters)
    verified_hh = sum(
        c.est_households
        for c in clusters
        if c.verification_state in {"FIELD_VERIFIED", "UTILITY_VERIFIED"}
    )
    cov_pct = round((verified_hh / total_hh * 100.0), 1) if total_hh > 0 else 0.0

    census_rec = _compute_census_reconciliation_for_project(
        db,
        project_id=proj.id,
        base_year=proj.base_year,
        clusters=list(clusters),
    )

    return ClusterListResponse(
        project_id=proj.id,
        cluster_run_id=current_run.id if current_run else None,
        params=current_run.params if current_run else {
            "eps_m": 150.0,
            "min_samples": 5,
            "household_alpha": 0.90,
            "nl_electrified_min": 0.75,
            "nl_unserved_max": 0.20,
        },
        items=items,
        geojson={"type": "FeatureCollection", "features": features},
        census_reconciliation=census_rec,
        verification_coverage_pct=cov_pct,
    )


def get_single_cluster(
    db: Session,
    *,
    project_id: str,
    cluster_id: str,
    user: User,
) -> ClusterResponse:
    """Return a single habitation cluster by ID."""
    proj = get_owned_project_or_404(db, project_id, user)
    row = db.execute(
        select(SettlementCluster).where(
            SettlementCluster.id == cluster_id,
            SettlementCluster.project_id == proj.id,
        )
    ).scalar_one_or_none()
    if row is None:
        raise AppError(
            code="CLUSTER_NOT_FOUND",
            message=f"Habitation cluster '{cluster_id}' not found in project.",
            status_code=404,
        )
    return _serialize_cluster(row)


def update_project_building(
    db: Session,
    *,
    project_id: str,
    building_id: str,
    req: BuildingPatchRequest,
    user: User,
) -> dict[str, Any]:
    """Exclude/include or reclassify an individual building footprint."""
    proj = get_owned_project_or_404(db, project_id, user)
    bld = db.execute(
        select(Building).where(Building.id == building_id, Building.project_id == proj.id)
    ).scalar_one_or_none()
    if bld is None:
        raise AppError(
            code="BUILDING_NOT_FOUND",
            message=f"Building '{building_id}' not found.",
            status_code=404,
        )
    if req.is_excluded is not None:
        bld.is_excluded = req.is_excluded
    if req.size_class is not None:
        bld.size_class = req.size_class
    db.commit()
    return {
        "id": bld.id,
        "size_class": bld.size_class,
        "is_excluded": bld.is_excluded,
        "area_m2": bld.area_m2,
    }


def create_project_building(
    db: Session,
    *,
    project_id: str,
    req: BuildingCreateRequest,
    user: User,
) -> dict[str, Any]:
    """Manually add a building footprint (`is_user_added=True`)."""
    proj = get_owned_project_or_404(db, project_id, user)
    side_deg = max(0.00003, math.sqrt(req.area_m2) / 111_000.0 / 2.0)
    poly = Polygon(
        [
            (req.lon - side_deg, req.lat - side_deg),
            (req.lon + side_deg, req.lat - side_deg),
            (req.lon + side_deg, req.lat + side_deg),
            (req.lon - side_deg, req.lat + side_deg),
            (req.lon - side_deg, req.lat - side_deg),
        ]
    )
    bld = Building(
        project_id=proj.id,
        dataset_id=None,
        source_feature_id="USER-ADDED",
        geom=poly,
        centroid=Point(req.lon, req.lat),
        area_m2=req.area_m2,
        confidence=1.0,
        size_class=req.size_class,
        is_user_added=True,
        is_excluded=False,
    )
    db.add(bld)
    db.commit()
    db.refresh(bld)
    return {
        "id": bld.id,
        "size_class": bld.size_class,
        "is_user_added": bld.is_user_added,
        "area_m2": bld.area_m2,
    }


def create_cluster_verification(
    db: Session,
    *,
    project_id: str,
    req: VerificationCreateRequest,
    user: User,
) -> VerificationRecordResponse:
    """Append an immutable verification record and update Axis-2 cluster state.

    Epistemic Honesty Rule:
    - Never modifies `cluster.proxy_class` or `cluster.proxy_confidence` (Axis 1).
    - Updates `cluster.verification_state` and `cluster.verified_class` (Axis 2).
    """
    proj = get_owned_project_or_404(db, project_id, user)
    cluster = db.execute(
        select(SettlementCluster).where(
            SettlementCluster.id == req.target_id,
            SettlementCluster.project_id == proj.id,
        )
    ).scalar_one_or_none()
    if cluster is None:
        raise AppError(
            code="CLUSTER_NOT_FOUND",
            message=f"Habitation cluster '{req.target_id}' not found.",
            status_code=404,
        )

    prev_val = {
        "verification_state": cluster.verification_state,
        "verified_class": cluster.verified_class,
        "est_households": cluster.est_households,
        "proxy_class_preserved": cluster.proxy_class,
    }
    new_hh = (
        req.verified_households
        if req.verified_households is not None
        else cluster.est_households
    )
    new_val = {
        "verification_state": req.verification_state,
        "verified_class": req.verified_class,
        "est_households": new_hh,
        "proxy_class_preserved": cluster.proxy_class,
    }

    rec = VerificationRecord(
        project_id=proj.id,
        target_type="CLUSTER",
        target_id=cluster.id,
        attribute="cluster_verification",
        previous_value=prev_val,
        new_value=new_val,
        evidence_type=req.evidence_type,
        verifier_name=req.verifier_name.strip(),
        observed_on=req.observed_on.strip(),
        note=req.note.strip(),
        geom=cluster.centroid,
        import_batch_id=None,
        reverses_id=None,
        created_by=user.id,
    )
    db.add(rec)

    cluster.verification_state = req.verification_state
    cluster.verified_class = req.verified_class
    cluster.est_households = new_hh
    cluster.updated_at = datetime.now(UTC)

    db.add(
        AuditEvent(
            project_id=proj.id,
            actor_id=user.id,
            event_type="CLUSTER_VERIFIED",
            entity="verification_records",
            entity_id=cluster.id,
            diff={"cluster_label": cluster.label, "new_value": new_val},
        )
    )
    db.commit()
    db.refresh(rec)

    return VerificationRecordResponse(
        id=rec.id,
        project_id=rec.project_id,
        target_type=rec.target_type,
        target_id=rec.target_id,
        cluster_label=cluster.label,
        attribute=rec.attribute,
        previous_value=rec.previous_value,
        new_value=rec.new_value,
        evidence_type=rec.evidence_type,
        verifier_name=rec.verifier_name,
        observed_on=rec.observed_on,
        note=rec.note,
        import_batch_id=rec.import_batch_id,
        reverses_id=rec.reverses_id,
        created_by=rec.created_by,
        created_at=rec.created_at,
    )


def reverse_cluster_verification(
    db: Session,
    *,
    project_id: str,
    verification_id: str,
    req: VerificationReversalRequest,
    user: User,
) -> VerificationRecordResponse:
    """Append a reversal record that restores a cluster's prior state without mutating history."""
    proj = get_owned_project_or_404(db, project_id, user)
    orig = db.execute(
        select(VerificationRecord).where(
            VerificationRecord.id == verification_id,
            VerificationRecord.project_id == proj.id,
        )
    ).scalar_one_or_none()
    if orig is None:
        raise AppError(
            code="VERIFICATION_RECORD_NOT_FOUND",
            message=f"Verification record '{verification_id}' not found.",
            status_code=404,
        )

    cluster = db.execute(
        select(SettlementCluster).where(
            SettlementCluster.id == orig.target_id,
            SettlementCluster.project_id == proj.id,
        )
    ).scalar_one_or_none()

    current_val = {
        "verification_state": cluster.verification_state if cluster else "UNVERIFIED",
        "verified_class": cluster.verified_class if cluster else None,
        "est_households": cluster.est_households if cluster else 0,
    }
    restored_val = dict(orig.previous_value)

    rev_rec = VerificationRecord(
        project_id=proj.id,
        target_type=orig.target_type,
        target_id=orig.target_id,
        attribute="cluster_verification_reversal",
        previous_value=current_val,
        new_value=restored_val,
        evidence_type="REVERSAL",
        verifier_name=req.verifier_name.strip(),
        observed_on=datetime.now(UTC).strftime("%Y-%m-%d"),
        note=f"[Reverses {orig.id[:8]}] {req.note.strip()}",
        geom=cluster.centroid if cluster else None,
        import_batch_id=None,
        reverses_id=orig.id,
        created_by=user.id,
    )
    db.add(rev_rec)

    if cluster is not None:
        cluster.verification_state = str(
            restored_val.get("verification_state", "UNVERIFIED")
        )
        cluster.verified_class = restored_val.get("verified_class")
        if "est_households" in restored_val and restored_val["est_households"] is not None:
            cluster.est_households = int(restored_val["est_households"])
        cluster.updated_at = datetime.now(UTC)

    db.commit()
    db.refresh(rev_rec)

    return VerificationRecordResponse(
        id=rev_rec.id,
        project_id=rev_rec.project_id,
        target_type=rev_rec.target_type,
        target_id=rev_rec.target_id,
        cluster_label=cluster.label if cluster else None,
        attribute=rev_rec.attribute,
        previous_value=rev_rec.previous_value,
        new_value=rev_rec.new_value,
        evidence_type=rev_rec.evidence_type,
        verifier_name=rev_rec.verifier_name,
        observed_on=rev_rec.observed_on,
        note=rev_rec.note,
        import_batch_id=rev_rec.import_batch_id,
        reverses_id=rev_rec.reverses_id,
        created_by=rev_rec.created_by,
        created_at=rev_rec.created_at,
    )


def import_verifications_csv(
    db: Session,
    *,
    project_id: str,
    filename: str,
    raw_bytes: bytes,
    user: User,
) -> VerificationImportResponse:
    """Parse a field verification CSV and append matched records to the immutable ledger."""
    proj = get_owned_project_or_404(db, project_id, user)
    if len(raw_bytes) > 5 * 1024 * 1024:
        raise AppError(
            code="CSV_FILE_TOO_LARGE",
            message="Verification CSV exceeds 5 MB limit.",
            status_code=413,
        )

    try:
        text = raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise AppError(
            code="INVALID_CSV_ENCODING",
            message="Verification CSV must be UTF-8 encoded.",
            status_code=422,
        ) from exc

    reader = csv.DictReader(io.StringIO(text))
    clusters = (
        db.execute(
            select(SettlementCluster).where(SettlementCluster.project_id == proj.id)
        )
        .scalars()
        .all()
    )
    if not clusters and proj.id == "00000000-0000-4000-8000-000000000001":
        execute_settlement_clustering_pipeline(db, project_id=proj.id, params=None, job=None)
        clusters = (
            db.execute(
                select(SettlementCluster).where(SettlementCluster.project_id == proj.id)
            )
            .scalars()
            .all()
        )

    cluster_by_label = {c.label.upper(): c for c in clusters}

    imp = VerificationImport(
        project_id=proj.id,
        filename=filename or "verifications.csv",
        row_count=0,
        matched=0,
        unmatched=0,
        report={},
        created_by=user.id,
    )
    db.add(imp)
    db.flush()

    row_count = 0
    matched = 0
    unmatched = 0
    unmatched_labels: list[str] = []

    for row in reader:
        row_count += 1
        if row_count > 50_000:
            raise AppError(
                code="CSV_ROW_LIMIT_EXCEEDED",
                message="Verification CSV exceeds 50,000 row limit.",
                status_code=422,
            )
        label_raw = (row.get("cluster_label") or row.get("label") or "").strip().upper()
        cluster = cluster_by_label.get(label_raw)
        if cluster is None:
            unmatched += 1
            unmatched_labels.append(label_raw or f"row_{row_count}")
            continue

        v_state = (row.get("verification_state") or "FIELD_VERIFIED").strip().upper()
        if v_state not in {"FIELD_VERIFIED", "UTILITY_VERIFIED"}:
            v_state = "FIELD_VERIFIED"

        v_class = (
            row.get("verified_class") or cluster.proxy_class
        ).strip().upper()
        hh_str = (row.get("est_households") or row.get("verified_households") or "").strip()
        new_hh = int(hh_str) if hh_str.isdigit() else cluster.est_households

        ev_type = (row.get("evidence_type") or "FIELD_SURVEY").strip().upper()
        verifier = (row.get("verifier_name") or user.display_name).strip()
        obs_date = (row.get("observed_on") or datetime.now(UTC).strftime("%Y-%m-%d")).strip()
        note_str = (row.get("note") or f"Imported from {filename}").strip()

        prev_val = {
            "verification_state": cluster.verification_state,
            "verified_class": cluster.verified_class,
            "est_households": cluster.est_households,
            "proxy_class_preserved": cluster.proxy_class,
        }
        new_val = {
            "verification_state": v_state,
            "verified_class": v_class,
            "est_households": new_hh,
            "proxy_class_preserved": cluster.proxy_class,
        }

        rec = VerificationRecord(
            project_id=proj.id,
            target_type="CLUSTER",
            target_id=cluster.id,
            attribute="cluster_verification",
            previous_value=prev_val,
            new_value=new_val,
            evidence_type=ev_type,
            verifier_name=verifier,
            observed_on=obs_date,
            note=note_str,
            geom=cluster.centroid,
            import_batch_id=imp.id,
            reverses_id=None,
            created_by=user.id,
        )
        db.add(rec)

        cluster.verification_state = v_state
        cluster.verified_class = v_class
        cluster.est_households = new_hh
        cluster.updated_at = datetime.now(UTC)
        matched += 1

    imp.row_count = row_count
    imp.matched = matched
    imp.unmatched = unmatched
    imp.report = {
        "unmatched_labels": unmatched_labels[:50],
        "imported_at": datetime.now(UTC).isoformat(),
    }
    db.commit()
    db.refresh(imp)

    return VerificationImportResponse(
        id=imp.id,
        project_id=imp.project_id,
        filename=imp.filename,
        row_count=imp.row_count,
        matched=imp.matched,
        unmatched=imp.unmatched,
        report=imp.report,
        created_at=imp.created_at,
    )


def get_project_verification_ledger(
    db: Session,
    *,
    project_id: str,
    user: User,
) -> VerificationLedgerResponse:
    """Return the complete append-only verification audit ledger and coverage stats."""
    proj = get_owned_project_or_404(db, project_id, user)
    clusters = (
        db.execute(
            select(SettlementCluster).where(SettlementCluster.project_id == proj.id)
        )
        .scalars()
        .all()
    )
    label_by_id = {c.id: c.label for c in clusters}

    total_clusters = len(clusters)
    verified_clusters = sum(
        1
        for c in clusters
        if c.verification_state in {"FIELD_VERIFIED", "UTILITY_VERIFIED"}
    )
    total_hh = sum(c.est_households for c in clusters)
    verified_hh = sum(
        c.est_households
        for c in clusters
        if c.verification_state in {"FIELD_VERIFIED", "UTILITY_VERIFIED"}
    )
    cov_pct = round((verified_hh / total_hh * 100.0), 1) if total_hh > 0 else 0.0

    records = (
        db.execute(
            select(VerificationRecord)
            .where(VerificationRecord.project_id == proj.id)
            .order_by(VerificationRecord.created_at.desc())
        )
        .scalars()
        .all()
    )
    imports = (
        db.execute(
            select(VerificationImport)
            .where(VerificationImport.project_id == proj.id)
            .order_by(VerificationImport.created_at.desc())
        )
        .scalars()
        .all()
    )

    return VerificationLedgerResponse(
        project_id=proj.id,
        total_clusters=total_clusters,
        verified_clusters=verified_clusters,
        total_households=total_hh,
        verified_households=verified_hh,
        verification_coverage_pct=cov_pct,
        records=[
            VerificationRecordResponse(
                id=r.id,
                project_id=r.project_id,
                target_type=r.target_type,
                target_id=r.target_id,
                cluster_label=label_by_id.get(r.target_id),
                attribute=r.attribute,
                previous_value=r.previous_value,
                new_value=r.new_value,
                evidence_type=r.evidence_type,
                verifier_name=r.verifier_name,
                observed_on=r.observed_on,
                note=r.note,
                import_batch_id=r.import_batch_id,
                reverses_id=r.reverses_id,
                created_by=r.created_by,
                created_at=r.created_at,
            )
            for r in records
        ],
        imports=[
            VerificationImportResponse(
                id=i.id,
                project_id=i.project_id,
                filename=i.filename,
                row_count=i.row_count,
                matched=i.matched,
                unmatched=i.unmatched,
                report=i.report,
                created_at=i.created_at,
            )
            for i in imports
        ],
    )
