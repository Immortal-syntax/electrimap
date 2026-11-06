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

"""Service layer for Milestone M4:
- Existing Electrical Infrastructure & Interactive Tie-In Placement (`infrastructure_assets`)
- Terrain-Weighted Distance & Obstacle Gap Analysis Matrix (`cluster_gap_analyses`)
- Project-Level Assumptions Register (`project_settings`)
- 7-Category Parametric Electricity Demand Estimation (`project_demand_estimates`)
"""

import json
from dataclasses import asdict
from datetime import UTC, datetime
from typing import Any

from shapely.geometry import Point, mapping, shape
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.errors import AppError, UploadValidationError
from app.db.models.auth import User
from app.db.models.infrastructure import (
    ClusterGapAnalysis,
    InfrastructureAsset,
    ProjectDemandEstimate,
    ProjectSetting,
)
from app.db.models.ops import AuditEvent
from app.db.models.settlement import SettlementCluster
from app.db.models.spatial import OsmFeature
from app.domain.engineering.demand import (
    DEFAULT_PROJECT_ASSUMPTIONS,
    compute_project_demand_summary,
)
from app.domain.gis.gap_analysis import (
    ClusterGapInput,
    InfraAssetInput,
    run_project_gap_analysis,
)
from app.schemas.infrastructure import (
    CategoryDemandRowResponse,
    ClusterDemandResponse,
    ClusterGapAnalysisResponse,
    InfrastructureAssetCreateRequest,
    InfrastructureAssetPatchRequest,
    InfrastructureAssetResponse,
    InfrastructureListResponse,
    ProjectDemandSummaryResponse,
    ProjectGapAnalysisResponse,
    ProjectSettingResponse,
    ProjectSettingsListResponse,
    ProjectSettingsPatchRequest,
)
from app.services.project_service import get_owned_project_or_404
from app.services.settlement_service import execute_settlement_clustering_pipeline


def _provenance_to_quality_tag(provenance: str) -> str:
    if provenance in {"UTILITY_RECORD", "FIELD_SURVEY"}:
        return "VERIFIED"
    if provenance == "USER_ASSUMED":
        return "ASSUMED"
    return "ESTIMATED"


def _serialize_infra_asset(row: InfrastructureAsset) -> InfrastructureAssetResponse:
    geom_dict = dict(mapping(row.geom)) if row.geom is not None else {}
    return InfrastructureAssetResponse(
        id=row.id,
        project_id=row.project_id,
        asset_type=row.asset_type,
        name=row.name,
        voltage_kv=row.voltage_kv,
        rating_kva=row.rating_kva,
        provenance=row.provenance,
        quality_tag=row.quality_tag,
        dataset_id=row.dataset_id,
        source_note=row.source_note,
        attributes=row.attributes or {},
        geojson_geometry=geom_dict,
        updated_at=row.updated_at,
    )


def ensure_project_settings_seeded(db: Session, project_id: str) -> list[ProjectSetting]:
    """Ensure all 14 default engineering assumptions exist in `project_settings`."""
    existing = (
        db.execute(
            select(ProjectSetting)
            .where(ProjectSetting.project_id == project_id)
            .order_by(ProjectSetting.category.asc(), ProjectSetting.key.asc())
        )
        .scalars()
        .all()
    )
    existing_by_key = {row.key: row for row in existing}
    added = False

    for spec in DEFAULT_PROJECT_ASSUMPTIONS:
        if spec.key not in existing_by_key:
            row = ProjectSetting(
                project_id=project_id,
                key=spec.key,
                category=spec.category,
                label=spec.label,
                value=spec.default_value,
                default_value=spec.default_value,
                min_value=spec.min_value,
                max_value=spec.max_value,
                unit=spec.unit,
                quality_tag="ESTIMATED",
                citation=spec.citation,
                is_user_edited=False,
                override_note=None,
            )
            db.add(row)
            added = True

    if added:
        db.commit()
        existing = (
            db.execute(
                select(ProjectSetting)
                .where(ProjectSetting.project_id == project_id)
                .order_by(ProjectSetting.category.asc(), ProjectSetting.key.asc())
            )
            .scalars()
            .all()
        )
    return list(existing)


def _serialize_setting(row: ProjectSetting) -> ProjectSettingResponse:
    return ProjectSettingResponse(
        id=row.id,
        project_id=row.project_id,
        key=row.key,
        category=row.category,
        label=row.label,
        value=row.value,
        default_value=row.default_value,
        min_value=row.min_value,
        max_value=row.max_value,
        unit=row.unit,
        quality_tag=row.quality_tag,
        citation=row.citation,
        is_user_edited=row.is_user_edited,
        override_note=row.override_note,
        updated_at=row.updated_at,
    )


def get_project_settings_state(
    db: Session,
    *,
    project_id: str,
    user: User,
) -> ProjectSettingsListResponse:
    """Return the complete project Assumptions Register."""
    proj = get_owned_project_or_404(db, project_id, user)
    rows = ensure_project_settings_seeded(db, proj.id)
    edited_cnt = sum(1 for r in rows if r.is_user_edited)
    return ProjectSettingsListResponse(
        project_id=proj.id,
        user_edited_count=edited_cnt,
        items=[_serialize_setting(r) for r in rows],
    )


def update_project_settings_state(
    db: Session,
    *,
    project_id: str,
    req: ProjectSettingsPatchRequest,
    user: User,
) -> ProjectSettingsListResponse:
    """Update one or more engineering assumptions and tag them `USER_ENTERED`."""
    proj = get_owned_project_or_404(db, project_id, user)
    rows = ensure_project_settings_seeded(db, proj.id)
    by_key = {r.key: r for r in rows}

    diff_map: dict[str, Any] = {}
    for item in req.updates:
        target = by_key.get(item.key)
        if target is None:
            raise AppError(
                code="UNKNOWN_SETTING_KEY",
                message=f"Unknown project assumption key '{item.key}'.",
                status_code=422,
            )
        if item.value < target.min_value or item.value > target.max_value:
            raise AppError(
                code="SETTING_OUT_OF_BOUNDS",
                message=(
                    f"Value {item.value} for '{target.key}' is outside valid bounds "
                    f"[{target.min_value}, {target.max_value}] {target.unit}."
                ),
                status_code=422,
            )
        prev_val = target.value
        target.value = float(item.value)
        is_modified = abs(target.value - target.default_value) > 1e-6
        target.is_user_edited = is_modified
        target.quality_tag = "USER_ENTERED" if is_modified else "ESTIMATED"
        target.override_note = (
            item.override_note.strip()
            if item.override_note
            else ("Planner override" if is_modified else None)
        )
        target.updated_at = datetime.now(UTC)
        diff_map[target.key] = {"old": prev_val, "new": target.value}

    db.add(
        AuditEvent(
            project_id=proj.id,
            actor_id=user.id,
            event_type="PROJECT_SETTINGS_UPDATED",
            entity="project_settings",
            entity_id=proj.id,
            diff=diff_map,
        )
    )
    db.commit()
    return get_project_settings_state(db, project_id=proj.id, user=user)


def reset_project_settings_state(
    db: Session,
    *,
    project_id: str,
    user: User,
) -> ProjectSettingsListResponse:
    """Reset all project assumptions to their normative REC/CEA defaults."""
    proj = get_owned_project_or_404(db, project_id, user)
    rows = ensure_project_settings_seeded(db, proj.id)
    for r in rows:
        r.value = r.default_value
        r.is_user_edited = False
        r.quality_tag = "ESTIMATED"
        r.override_note = None
        r.updated_at = datetime.now(UTC)

    db.add(
        AuditEvent(
            project_id=proj.id,
            actor_id=user.id,
            event_type="PROJECT_SETTINGS_RESET",
            entity="project_settings",
            entity_id=proj.id,
            diff={"action": "reset_all_to_defaults"},
        )
    )
    db.commit()
    return get_project_settings_state(db, project_id=proj.id, user=user)


def list_project_infrastructure(
    db: Session,
    *,
    project_id: str,
    user: User,
) -> InfrastructureListResponse:
    """List all existing infrastructure assets and tie-in points for a project."""
    proj = get_owned_project_or_404(db, project_id, user)
    rows = (
        db.execute(
            select(InfrastructureAsset)
            .where(InfrastructureAsset.project_id == proj.id)
            .order_by(InfrastructureAsset.created_at.asc())
        )
        .scalars()
        .all()
    )
    items = [_serialize_infra_asset(r) for r in rows]
    features = [
        {
            "type": "Feature",
            "properties": {
                "id": item.id,
                "asset_type": item.asset_type,
                "name": item.name,
                "voltage_kv": item.voltage_kv,
                "rating_kva": item.rating_kva,
                "provenance": item.provenance,
                "quality_tag": item.quality_tag,
                "source_note": item.source_note,
            },
            "geometry": item.geojson_geometry,
        }
        for item in items
    ]
    return InfrastructureListResponse(
        project_id=proj.id,
        has_existing_infra=len(items) > 0,
        items=items,
        geojson={"type": "FeatureCollection", "features": features},
    )


def create_infrastructure_asset(
    db: Session,
    *,
    project_id: str,
    req: InfrastructureAssetCreateRequest,
    user: User,
) -> InfrastructureAssetResponse:
    """Create a planner-placed tie-in point, DT, or line asset."""
    proj = get_owned_project_or_404(db, project_id, user)

    if req.geojson_geometry is not None:
        geom_obj = shape(req.geojson_geometry)
    elif req.lon is not None and req.lat is not None:
        geom_obj = Point(float(req.lon), float(req.lat))
    else:
        raise AppError(
            code="INFRA_GEOMETRY_REQUIRED",
            message="Provide either (lon, lat) coordinates or geojson_geometry.",
            status_code=422,
        )

    q_tag = _provenance_to_quality_tag(req.provenance)
    asset = InfrastructureAsset(
        project_id=proj.id,
        asset_type=req.asset_type,
        name=req.name.strip(),
        voltage_kv=req.voltage_kv,
        rating_kva=req.rating_kva,
        geom=geom_obj,
        provenance=req.provenance,
        quality_tag=q_tag,
        dataset_id=None,
        source_note=req.source_note.strip(),
        attributes=req.attributes or {},
    )
    db.add(asset)
    db.add(
        AuditEvent(
            project_id=proj.id,
            actor_id=user.id,
            event_type="INFRA_ASSET_CREATED",
            entity="infrastructure_assets",
            entity_id=proj.id,
            diff={
                "asset_type": asset.asset_type,
                "name": asset.name,
                "provenance": asset.provenance,
            },
        )
    )
    db.commit()
    db.refresh(asset)

    # Recompute gap analysis automatically so cluster d_infra_m stays current
    compute_and_persist_gap_analysis(db, project_id=proj.id, user=user)
    return _serialize_infra_asset(asset)


def update_infrastructure_asset(
    db: Session,
    *,
    project_id: str,
    asset_id: str,
    req: InfrastructureAssetPatchRequest,
    user: User,
) -> InfrastructureAssetResponse:
    """Update or relocate an existing infrastructure asset."""
    proj = get_owned_project_or_404(db, project_id, user)
    asset = db.execute(
        select(InfrastructureAsset).where(
            InfrastructureAsset.id == asset_id,
            InfrastructureAsset.project_id == proj.id,
        )
    ).scalar_one_or_none()
    if asset is None:
        raise AppError(
            code="INFRA_ASSET_NOT_FOUND",
            message=f"Infrastructure asset '{asset_id}' not found.",
            status_code=404,
        )

    if req.name is not None:
        asset.name = req.name.strip()
    if req.voltage_kv is not None:
        asset.voltage_kv = req.voltage_kv
    if req.rating_kva is not None:
        asset.rating_kva = req.rating_kva
    if req.provenance is not None:
        asset.provenance = req.provenance
        asset.quality_tag = _provenance_to_quality_tag(req.provenance)
    if req.source_note is not None:
        asset.source_note = req.source_note.strip()
    if req.geojson_geometry is not None:
        asset.geom = shape(req.geojson_geometry)
    elif req.lon is not None and req.lat is not None:
        asset.geom = Point(float(req.lon), float(req.lat))

    asset.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(asset)

    compute_and_persist_gap_analysis(db, project_id=proj.id, user=user)
    return _serialize_infra_asset(asset)


def delete_infrastructure_asset(
    db: Session,
    *,
    project_id: str,
    asset_id: str,
    user: User,
) -> None:
    """Delete an infrastructure asset and recompute gap analysis."""
    proj = get_owned_project_or_404(db, project_id, user)
    asset = db.execute(
        select(InfrastructureAsset).where(
            InfrastructureAsset.id == asset_id,
            InfrastructureAsset.project_id == proj.id,
        )
    ).scalar_one_or_none()
    if asset is None:
        raise AppError(
            code="INFRA_ASSET_NOT_FOUND",
            message=f"Infrastructure asset '{asset_id}' not found.",
            status_code=404,
        )
    db.delete(asset)
    db.commit()
    compute_and_persist_gap_analysis(db, project_id=proj.id, user=user)


def upload_infrastructure_geojson(
    db: Session,
    *,
    project_id: str,
    raw_bytes: bytes,
    provenance: str,
    source_note: str,
    user: User,
) -> InfrastructureListResponse:
    """Ingest a GeoJSON FeatureCollection of utility lines, DTs, or tie-in points."""
    proj = get_owned_project_or_404(db, project_id, user)
    if len(raw_bytes) > 10 * 1024 * 1024:
        raise UploadValidationError("Infrastructure GeoJSON exceeds 10 MB limit.")

    try:
        payload = json.loads(raw_bytes.decode("utf-8-sig"))
    except Exception as exc:
        raise UploadValidationError(f"Invalid GeoJSON file: {exc}") from exc

    features = payload.get("features") if isinstance(payload, dict) else None
    if not isinstance(features, list) or len(features) == 0:
        raise UploadValidationError(
            "Uploaded infrastructure file must be a GeoJSON FeatureCollection with >= 1 feature."
        )

    eff_prov = (
        provenance
        if provenance in {"UTILITY_RECORD", "FIELD_SURVEY", "USER_ASSUMED", "OSM"}
        else "UTILITY_RECORD"
    )
    q_tag = _provenance_to_quality_tag(eff_prov)

    for idx, feat in enumerate(features):
        geom_obj = shape(feat["geometry"])
        props = feat.get("properties") or {}
        raw_type = str(
            props.get("asset_type")
            or ("HT_LINE" if geom_obj.geom_type in {"LineString", "MultiLineString"} else "DT")
        ).upper()
        if raw_type not in {"HT_LINE", "LT_LINE", "POLE", "DT", "SUBSTATION", "TIE_IN"}:
            raw_type = "TIE_IN"

        name_val = str(props.get("name") or f"Uploaded {raw_type} #{idx + 1}")
        v_kv = (
            float(props["voltage_kv"])
            if "voltage_kv" in props and props["voltage_kv"] is not None
            else 11.0
        )
        r_kva = (
            float(props["rating_kva"])
            if "rating_kva" in props and props["rating_kva"] is not None
            else None
        )

        db.add(
            InfrastructureAsset(
                project_id=proj.id,
                asset_type=raw_type,
                name=name_val[:160],
                voltage_kv=v_kv,
                rating_kva=r_kva,
                geom=geom_obj,
                provenance=eff_prov,
                quality_tag=q_tag,
                dataset_id=None,
                source_note=source_note,
                attributes=props,
            )
        )

    db.commit()
    compute_and_persist_gap_analysis(db, project_id=proj.id, user=user)
    return list_project_infrastructure(db, project_id=proj.id, user=user)


def compute_and_persist_gap_analysis(
    db: Session,
    *,
    project_id: str,
    user: User,
) -> ProjectGapAnalysisResponse:
    """Run UTM terrain-weighted distance and obstacle gap analysis and persist results."""
    proj = get_owned_project_or_404(db, project_id, user)
    settings_rows = ensure_project_settings_seeded(db, proj.id)
    settings_map = {r.key: r.value for r in settings_rows}

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
                    SettlementCluster.is_isolated_group.asc(),
                    SettlementCluster.label.asc(),
                )
            )
            .scalars()
            .all()
        )

    infra_rows = (
        db.execute(
            select(InfrastructureAsset).where(InfrastructureAsset.project_id == proj.id)
        )
        .scalars()
        .all()
    )
    water_rows = (
        db.execute(
            select(OsmFeature).where(
                OsmFeature.project_id == proj.id,
                OsmFeature.category == "WATER",
            )
        )
        .scalars()
        .all()
    )

    cluster_inputs = [
        ClusterGapInput(
            cluster_id=c.id,
            label=c.label,
            name=c.name,
            centroid_wgs84=c.centroid,
            geom_wgs84=c.geom,
            est_households=c.est_households,
            proxy_class=c.proxy_class,
            verification_state=c.verification_state,
            verified_class=c.verified_class,
            slope_mean_deg=c.slope_mean_deg,
            canopy_share=c.canopy_share,
            d_road_m=c.d_road_m,
        )
        for c in clusters
    ]
    infra_inputs = [
        InfraAssetInput(
            asset_id=a.id,
            asset_type=a.asset_type,
            name=a.name,
            geom_wgs84=a.geom,
            provenance=a.provenance,
            voltage_kv=a.voltage_kv,
            rating_kva=a.rating_kva,
        )
        for a in infra_rows
    ]
    water_geoms = [w.geom for w in water_rows if w.geom is not None]

    summary = run_project_gap_analysis(
        cluster_inputs,
        infra_assets=infra_inputs,
        waterway_geoms_wgs84=water_geoms,
        metric_epsg=proj.metric_epsg,
        grid_max_terrain_m=settings_map.get("grid_max_terrain_distance_m", 3500.0),
    )

    # Clear prior gap rows and persist fresh analysis
    db.execute(
        delete(ClusterGapAnalysis).where(ClusterGapAnalysis.project_id == proj.id)
    )
    cluster_by_id = {c.id: c for c in clusters}
    corridor_features: list[dict[str, Any]] = []
    serialized_clusters: list[ClusterGapAnalysisResponse] = []

    for res in summary.clusters:
        corridor_dict = (
            dict(mapping(res.corridor_line_wgs84))
            if res.corridor_line_wgs84 is not None
            else None
        )
        db.add(
            ClusterGapAnalysis(
                project_id=proj.id,
                cluster_id=res.cluster_id,
                nearest_asset_id=res.nearest_asset_id,
                nearest_asset_name=res.nearest_asset_name,
                nearest_asset_type=res.nearest_asset_type,
                nearest_asset_provenance=res.nearest_asset_provenance,
                d_straight_m=res.d_straight_m,
                d_terrain_m=res.d_terrain_m,
                terrain_penalty_factor=res.terrain_penalty_factor,
                slope_mean_deg=res.slope_mean_deg,
                canopy_share=res.canopy_share,
                water_crossings_count=res.water_crossings_count,
                road_distance_m=res.road_distance_m,
                recommended_modality=res.recommended_modality,
                rationale=res.rationale,
                corridor_geom=res.corridor_line_wgs84,
            )
        )
        # Keep SettlementCluster.d_infra_m synchronized
        cl_row = cluster_by_id.get(res.cluster_id)
        if cl_row is not None:
            cl_row.d_infra_m = res.d_straight_m

        if corridor_dict is not None:
            corridor_features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "cluster_id": res.cluster_id,
                        "cluster_label": res.cluster_label,
                        "d_straight_m": res.d_straight_m,
                        "d_terrain_m": res.d_terrain_m,
                        "recommended_modality": res.recommended_modality,
                    },
                    "geometry": corridor_dict,
                }
            )

        serialized_clusters.append(
            ClusterGapAnalysisResponse(
                cluster_id=res.cluster_id,
                cluster_label=res.cluster_label,
                cluster_name=res.cluster_name,
                est_households=res.est_households,
                effective_electrification_class=res.effective_electrification_class,
                nearest_asset_id=res.nearest_asset_id,
                nearest_asset_name=res.nearest_asset_name,
                nearest_asset_type=res.nearest_asset_type,
                nearest_asset_provenance=res.nearest_asset_provenance,
                d_straight_m=res.d_straight_m,
                d_terrain_m=res.d_terrain_m,
                terrain_penalty_factor=res.terrain_penalty_factor,
                slope_mean_deg=res.slope_mean_deg,
                canopy_share=res.canopy_share,
                water_crossings_count=res.water_crossings_count,
                road_distance_m=res.road_distance_m,
                recommended_modality=res.recommended_modality,
                rationale=res.rationale,
                corridor_geojson=corridor_dict,
            )
        )

    db.commit()
    return ProjectGapAnalysisResponse(
        project_id=proj.id,
        has_existing_infra=summary.has_existing_infra,
        infra_assets_count=summary.infra_assets_count,
        assumed_assets_count=summary.assumed_assets_count,
        verified_assets_count=summary.verified_assets_count,
        mean_d_straight_m=summary.mean_d_straight_m,
        mean_d_terrain_m=summary.mean_d_terrain_m,
        max_d_terrain_m=summary.max_d_terrain_m,
        grid_extension_candidates=summary.grid_extension_candidates,
        minigrid_candidates=summary.minigrid_candidates,
        shs_candidates=summary.shs_candidates,
        augmentation_candidates=summary.augmentation_candidates,
        corridors_geojson={"type": "FeatureCollection", "features": corridor_features},
        clusters=serialized_clusters,
    )


def compute_and_persist_project_demand(
    db: Session,
    *,
    project_id: str,
    user: User,
) -> ProjectDemandSummaryResponse:
    """Compute and persist 7-category parametric demand per cluster and project summary."""
    proj = get_owned_project_or_404(db, project_id, user)
    settings_rows = ensure_project_settings_seeded(db, proj.id)
    assumptions_map = {r.key: r.value for r in settings_rows}

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
                    SettlementCluster.is_isolated_group.asc(),
                    SettlementCluster.label.asc(),
                )
            )
            .scalars()
            .all()
        )

    cluster_inputs = [
        {
            "cluster_id": c.id,
            "label": c.label,
            "name": c.name,
            "est_households": c.est_households,
            "n_non_residential": c.n_non_residential,
        }
        for c in clusters
    ]

    summary = compute_project_demand_summary(
        cluster_inputs,
        horizon_years=proj.horizon_years,
        assumptions=assumptions_map,
    )

    db.execute(
        delete(ProjectDemandEstimate).where(ProjectDemandEstimate.project_id == proj.id)
    )

    cluster_responses: list[ClusterDemandResponse] = []
    for cl_res in summary.clusters:
        cat_dicts = [asdict(cat) for cat in cl_res.categories]
        db.add(
            ProjectDemandEstimate(
                project_id=proj.id,
                cluster_id=cl_res.cluster_id,
                cluster_label=cl_res.cluster_label,
                est_households=cl_res.est_households,
                total_connected_kw=cl_res.total_connected_kw,
                non_coincident_peak_kw=cl_res.non_coincident_peak_kw,
                peak_kw_base=cl_res.peak_kw_base,
                peak_kva_base=cl_res.peak_kva_base,
                energy_kwh_day_base=cl_res.energy_kwh_day_base,
                annual_energy_mwh_base=cl_res.annual_energy_mwh_base,
                horizon_years=cl_res.horizon_years,
                annual_growth_rate=cl_res.annual_growth_rate,
                peak_kw_horizon=cl_res.peak_kw_horizon,
                peak_kva_horizon=cl_res.peak_kva_horizon,
                energy_kwh_day_horizon=cl_res.energy_kwh_day_horizon,
                annual_energy_mwh_horizon=cl_res.annual_energy_mwh_horizon,
                category_breakdown=cat_dicts,
            )
        )
        cluster_responses.append(
            ClusterDemandResponse(
                cluster_id=cl_res.cluster_id,
                cluster_label=cl_res.cluster_label,
                cluster_name=cl_res.cluster_name,
                est_households=cl_res.est_households,
                categories=[
                    CategoryDemandRowResponse(**asdict(cat)) for cat in cl_res.categories
                ],
                total_connected_kw=cl_res.total_connected_kw,
                non_coincident_peak_kw=cl_res.non_coincident_peak_kw,
                coincidence_factor=cl_res.coincidence_factor,
                power_factor_cos_phi=cl_res.power_factor_cos_phi,
                peak_kw_base=cl_res.peak_kw_base,
                peak_kva_base=cl_res.peak_kva_base,
                energy_kwh_day_base=cl_res.energy_kwh_day_base,
                annual_energy_mwh_base=cl_res.annual_energy_mwh_base,
                horizon_years=cl_res.horizon_years,
                annual_growth_rate=cl_res.annual_growth_rate,
                growth_multiplier=cl_res.growth_multiplier,
                peak_kw_horizon=cl_res.peak_kw_horizon,
                peak_kva_horizon=cl_res.peak_kva_horizon,
                energy_kwh_day_horizon=cl_res.energy_kwh_day_horizon,
                annual_energy_mwh_horizon=cl_res.annual_energy_mwh_horizon,
            )
        )

    db.commit()
    return ProjectDemandSummaryResponse(
        project_id=proj.id,
        total_households=summary.total_households,
        total_connected_kw=summary.total_connected_kw,
        peak_kw_base=summary.peak_kw_base,
        peak_kva_base=summary.peak_kva_base,
        energy_kwh_day_base=summary.energy_kwh_day_base,
        annual_energy_mwh_base=summary.annual_energy_mwh_base,
        horizon_years=summary.horizon_years,
        annual_growth_rate=summary.annual_growth_rate,
        peak_kw_horizon=summary.peak_kw_horizon,
        peak_kva_horizon=summary.peak_kva_horizon,
        energy_kwh_day_horizon=summary.energy_kwh_day_horizon,
        annual_energy_mwh_horizon=summary.annual_energy_mwh_horizon,
        category_totals=[
            CategoryDemandRowResponse(**asdict(cat)) for cat in summary.category_totals
        ],
        clusters=cluster_responses,
    )
