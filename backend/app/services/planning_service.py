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

"""Service layer for Milestone M5 (Network Layout Routing & Engineering Engine).

Orchestrates:
- REC/IS/CEA Engineering Constants lookup (`list_engineering_constants`)
- Deterministic Scenario Generation (`HYBRID_OPTIMAL`, `GRID_EXTENSION_ONLY`, etc.)
- Synchronous Per-Cluster Modality Override & Recalculation (`override_cluster_modality`)
"""

from typing import Any

from shapely.geometry import mapping
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models.auth import User
from app.db.models.infrastructure import (
    ClusterGapAnalysis,
    InfrastructureAsset,
    ProjectDemandEstimate,
)
from app.db.models.planning import ClusterEngineeringLayout, PlanningScenario
from app.db.models.reference import EngineeringConstant
from app.db.models.settlement import SettlementCluster
from app.db.models.spatial import Building, SolarResource
from app.domain.engineering.calculations import evaluate_cluster_engineering_layout
from app.domain.engineering.constants import (
    STANDARD_ENGINEERING_CONSTANTS,
    get_default_constants_map,
)
from app.schemas.planning import (
    ClusterEngineeringLayoutResponse,
    EngineeringConstantListResponse,
    EngineeringConstantResponse,
    PlacedDtResponse,
    PlanningScenarioListResponse,
    PlanningScenarioResponse,
)
from app.services.infrastructure_service import (
    compute_and_persist_gap_analysis,
    compute_and_persist_project_demand,
    ensure_project_settings_seeded,
)
from app.services.project_service import get_owned_project_or_404

SCENARIO_LABELS: dict[str, str] = {
    "HYBRID_OPTIMAL": "Hybrid Least-Cost Optimal (Grid + Solar Mini-Grid + SHS)",
    "GRID_EXTENSION_ONLY": "100% Grid Extension / Augmentation Scenario",
    "MINIGRID_PRIORITY": "Decentralized Solar PV + LiFePO4 Mini-Grid Priority",
    "SHS_DISPERSED": "Standalone Solar Home System (SHS) Priority",
}


def list_engineering_constants(db: Session) -> EngineeringConstantListResponse:
    """Return all REC/IS/CEA engineering constants from the database (seeding if empty)."""
    rows = (
        db.execute(select(EngineeringConstant).order_by(EngineeringConstant.key.asc()))
        .scalars()
        .all()
    )
    if not rows:
        for spec in STANDARD_ENGINEERING_CONSTANTS:
            db.add(
                EngineeringConstant(
                    key=spec.key,
                    value=spec.value,
                    unit=spec.unit,
                    description=spec.description,
                    citation=spec.citation,
                    status=spec.status,
                    updated_by="system_seed",
                )
            )
        db.commit()
        rows = (
            db.execute(
                select(EngineeringConstant).order_by(EngineeringConstant.key.asc())
            )
            .scalars()
            .all()
        )

    return EngineeringConstantListResponse(
        count=len(rows),
        items=[
            EngineeringConstantResponse(
                key=r.key,
                value=r.value,
                unit=r.unit,
                description=r.description,
                citation=r.citation,
                status=r.status,
            )
            for r in rows
        ],
    )


def _resolve_default_modality_for_scenario(
    scenario_key: str,
    gap_recommended_modality: str,
    effective_class: str,
    est_households: int,
    d_terrain_m: float | None,
    minigrid_min_hh: int = 25,
) -> str:
    """Resolve the target electrification modality for a cluster under a given scenario."""
    if scenario_key == "GRID_EXTENSION_ONLY":
        if effective_class in {"LIKELY_ELECTRIFIED", "POTENTIALLY_UNDERSERVED"}:
            return "GRID_AUGMENTATION"
        return "GRID_EXTENSION"

    if scenario_key == "MINIGRID_PRIORITY":
        if effective_class in {"LIKELY_ELECTRIFIED", "POTENTIALLY_UNDERSERVED"}:
            return "GRID_AUGMENTATION"
        if est_households >= max(10, minigrid_min_hh // 2):
            return "SOLAR_MINIGRID"
        return "STANDALONE_SHS"

    if scenario_key == "SHS_DISPERSED":
        if effective_class in {"LIKELY_ELECTRIFIED", "POTENTIALLY_UNDERSERVED"}:
            return "GRID_AUGMENTATION"
        return "STANDALONE_SHS"

    # HYBRID_OPTIMAL
    if gap_recommended_modality in {
        "GRID_EXTENSION",
        "SOLAR_MINIGRID",
        "STANDALONE_SHS",
        "GRID_AUGMENTATION",
    }:
        return gap_recommended_modality

    # When infrastructure is UNSET (`UNSET_INFRA_REQUIRED`), select optimal modality based on
    # settlement size and electrification status while preserving `requires_tie_in` for Grid
    if effective_class in {"LIKELY_ELECTRIFIED", "POTENTIALLY_UNDERSERVED"}:
        return "GRID_AUGMENTATION"
    if d_terrain_m is None:
        return "SOLAR_MINIGRID" if est_households >= minigrid_min_hh else "STANDALONE_SHS"
    return "GRID_EXTENSION"


def _extract_tie_in_point_for_cluster(
    cluster: SettlementCluster,
    gap_row: ClusterGapAnalysis | None,
    infra_by_id: dict[str, InfrastructureAsset],
    all_infra: list[InfrastructureAsset],
) -> tuple[float, float] | None:
    """Find the nearest point (lon, lat) on the closest infrastructure asset for 11 kV routing."""
    if not all_infra:
        return None

    target_asset: InfrastructureAsset | None = None
    if gap_row and gap_row.nearest_asset_id and gap_row.nearest_asset_id in infra_by_id:
        target_asset = infra_by_id[gap_row.nearest_asset_id]
    else:
        target_asset = all_infra[0]

    geom = target_asset.geom
    if geom is None:
        return None
    if geom.geom_type == "Point":
        return (float(geom.x), float(geom.y))

    c_pt = cluster.centroid
    if c_pt is not None:
        # Project cluster centroid onto line geometry to get nearest tap point
        proj_dist = geom.project(c_pt)
        snap_pt = geom.interpolate(proj_dist)
        return (float(snap_pt.x), float(snap_pt.y))

    rep = geom.representative_point()
    return (float(rep.x), float(rep.y))


def _serialize_cluster_layout(
    row: ClusterEngineeringLayout,
) -> ClusterEngineeringLayoutResponse:
    details = row.details or {}
    placed_dts_raw = details.get("placed_dts", [])
    vdrop_raw = details.get("vdrop", {})
    losses_raw = details.get("losses", {})
    notes_raw = details.get("engineering_notes", [])

    return ClusterEngineeringLayoutResponse(
        id=row.id,
        scenario_id=row.scenario_id,
        project_id=row.project_id,
        cluster_id=row.cluster_id,
        cluster_label=row.cluster_label,
        cluster_name=row.cluster_name,
        est_households=row.est_households,
        modality=row.modality,
        is_manual_override=row.is_manual_override,
        requires_tie_in=row.requires_tie_in,
        peak_kw_horizon=row.peak_kw_horizon,
        peak_kva_horizon=row.peak_kva_horizon,
        energy_kwh_day_horizon=row.energy_kwh_day_horizon,
        annual_energy_mwh_horizon=row.annual_energy_mwh_horizon,
        dt_count=row.dt_count,
        total_dt_rating_kva=row.total_dt_rating_kva,
        max_dt_loading_pct=row.max_dt_loading_pct,
        placed_dts=[PlacedDtResponse(**dt_item) for dt_item in placed_dts_raw],
        ht_length_m=row.ht_length_m,
        ht_poles_count=row.ht_poles_count,
        lt_3ph_length_m=row.lt_3ph_length_m,
        lt_1ph_length_m=row.lt_1ph_length_m,
        lt_total_length_m=row.lt_total_length_m,
        max_lt_branch_m=row.max_lt_branch_m,
        lt_poles_count=row.lt_poles_count,
        ht_current_a=float(vdrop_raw.get("ht_current_a", 0.0)),
        ht_drop_v=row.ht_drop_v,
        ht_drop_pct=row.ht_drop_pct,
        ht_vdrop_compliant=bool(vdrop_raw.get("ht_vdrop_compliant", True)),
        lt_current_a=float(vdrop_raw.get("lt_current_a", 0.0)),
        lt_drop_v=row.lt_drop_v,
        lt_drop_pct=row.lt_drop_pct,
        lt_vdrop_compliant=bool(vdrop_raw.get("lt_vdrop_compliant", True)),
        overall_vdrop_compliant=row.overall_vdrop_compliant,
        load_factor=float(losses_raw.get("load_factor", 0.0)),
        load_loss_factor=float(losses_raw.get("load_loss_factor", 0.0)),
        ht_line_loss_kwh_yr=float(losses_raw.get("ht_line_loss_kwh_yr", 0.0)),
        lt_line_loss_kwh_yr=float(losses_raw.get("lt_line_loss_kwh_yr", 0.0)),
        dt_no_load_loss_kwh_yr=float(losses_raw.get("dt_no_load_loss_kwh_yr", 0.0)),
        dt_copper_loss_kwh_yr=float(losses_raw.get("dt_copper_loss_kwh_yr", 0.0)),
        total_loss_mwh_yr=row.total_loss_mwh_yr,
        technical_loss_pct=row.technical_loss_pct,
        solar_pv_kwp=row.solar_pv_kwp,
        bess_capacity_kwh=row.bess_capacity_kwh,
        inverter_kva=row.inverter_kva,
        shs_kits_count=row.shs_kits_count,
        engineering_notes=[str(n) for n in notes_raw],
        updated_at=row.updated_at,
    )


def _serialize_scenario(
    db: Session,
    scenario: PlanningScenario,
) -> PlanningScenarioResponse:
    layout_rows = (
        db.execute(
            select(ClusterEngineeringLayout)
            .where(ClusterEngineeringLayout.scenario_id == scenario.id)
            .order_by(ClusterEngineeringLayout.cluster_label.asc())
        )
        .scalars()
        .all()
    )
    features: list[dict[str, Any]] = []
    for row in layout_rows:
        if row.ht_line_geom is not None:
            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "feature_kind": "HT_11KV_FEEDER",
                        "cluster_id": row.cluster_id,
                        "cluster_label": row.cluster_label,
                        "modality": row.modality,
                        "length_m": row.ht_length_m,
                        "poles_count": row.ht_poles_count,
                        "vdrop_pct": row.ht_drop_pct,
                    },
                    "geometry": dict(mapping(row.ht_line_geom)),
                }
            )
        if row.lt_lines_geom is not None:
            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "feature_kind": "LT_415V_MST",
                        "cluster_id": row.cluster_id,
                        "cluster_label": row.cluster_label,
                        "modality": row.modality,
                        "length_m": row.lt_total_length_m,
                        "poles_count": row.lt_poles_count,
                        "vdrop_pct": row.lt_drop_pct,
                    },
                    "geometry": dict(mapping(row.lt_lines_geom)),
                }
            )
        if row.dt_points_geom is not None:
            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "feature_kind": (
                            "MINIGRID_HUB"
                            if row.modality == "SOLAR_MINIGRID"
                            else "DISTRIBUTION_TRANSFORMER"
                        ),
                        "cluster_id": row.cluster_id,
                        "cluster_label": row.cluster_label,
                        "modality": row.modality,
                        "dt_count": row.dt_count,
                        "total_dt_rating_kva": row.total_dt_rating_kva,
                        "solar_pv_kwp": row.solar_pv_kwp,
                        "bess_capacity_kwh": row.bess_capacity_kwh,
                    },
                    "geometry": dict(mapping(row.dt_points_geom)),
                }
            )

    return PlanningScenarioResponse(
        id=scenario.id,
        project_id=scenario.project_id,
        scenario_key=scenario.scenario_key,
        name=scenario.name,
        is_active=scenario.is_active,
        requires_tie_in_warning=scenario.requires_tie_in_warning,
        total_ht_length_m=scenario.total_ht_length_m,
        total_lt_length_m=scenario.total_lt_length_m,
        total_dt_count=scenario.total_dt_count,
        total_dt_capacity_kva=scenario.total_dt_capacity_kva,
        total_ht_poles=scenario.total_ht_poles,
        total_lt_poles=scenario.total_lt_poles,
        max_ht_vdrop_pct=scenario.max_ht_vdrop_pct,
        max_lt_vdrop_pct=scenario.max_lt_vdrop_pct,
        vdrop_compliance_ok=scenario.vdrop_compliance_ok,
        total_loss_mwh_yr=scenario.total_loss_mwh_yr,
        total_solar_kwp=scenario.total_solar_kwp,
        total_bess_kwh=scenario.total_bess_kwh,
        total_shs_kits=scenario.total_shs_kits,
        network_geojson={"type": "FeatureCollection", "features": features},
        clusters=[_serialize_cluster_layout(r) for r in layout_rows],
        updated_at=scenario.updated_at,
    )


def generate_or_update_scenario(
    db: Session,
    *,
    project_id: str,
    user: User,
    scenario_key: str = "HYBRID_OPTIMAL",
    preserve_manual_overrides: bool = False,
) -> PlanningScenarioResponse:
    """Generate or recalculate a planning scenario and persist all cluster engineering layouts."""
    proj = get_owned_project_or_404(db, project_id, user)
    settings_rows = ensure_project_settings_seeded(db, proj.id)
    settings_map = {r.key: r.value for r in settings_rows}

    # Ensure gap analysis and demand estimates exist
    gap_rows = (
        db.execute(
            select(ClusterGapAnalysis).where(ClusterGapAnalysis.project_id == proj.id)
        )
        .scalars()
        .all()
    )
    if not gap_rows:
        compute_and_persist_gap_analysis(db, project_id=proj.id, user=user)
        gap_rows = (
            db.execute(
                select(ClusterGapAnalysis).where(
                    ClusterGapAnalysis.project_id == proj.id
                )
            )
            .scalars()
            .all()
        )

    demand_rows = (
        db.execute(
            select(ProjectDemandEstimate).where(
                ProjectDemandEstimate.project_id == proj.id
            )
        )
        .scalars()
        .all()
    )
    if not demand_rows:
        compute_and_persist_project_demand(db, project_id=proj.id, user=user)
        demand_rows = (
            db.execute(
                select(ProjectDemandEstimate).where(
                    ProjectDemandEstimate.project_id == proj.id
                )
            )
            .scalars()
            .all()
        )

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
    infra_by_id = {a.id: a for a in infra_rows}
    gap_by_cid = {g.cluster_id: g for g in gap_rows}
    demand_by_cid = {d.cluster_id: d for d in demand_rows}

    buildings = (
        db.execute(
            select(Building).where(
                Building.project_id == proj.id,
                Building.size_class.in_(["RESIDENTIAL", "NON_RESIDENTIAL"]),
                Building.is_excluded.is_(False),
            )
        )
        .scalars()
        .all()
    )

    solar_row = db.execute(
        select(SolarResource).where(SolarResource.project_id == proj.id)
    ).scalar_one_or_none()
    worst_ghi = float(solar_row.worst_ghi_kwh_m2_day) if solar_row is not None else 3.82

    const_resp = list_engineering_constants(db)
    consts_map = {
        **get_default_constants_map(),
        **{c.key: c.value for c in const_resp.items},
    }

    # Check if scenario already exists
    scenario = db.execute(
        select(PlanningScenario).where(
            PlanningScenario.project_id == proj.id,
            PlanningScenario.scenario_key == scenario_key,
        )
    ).scalar_one_or_none()

    manual_overrides_by_cid: dict[str, str] = {}
    if scenario is not None and preserve_manual_overrides:
        prior_layouts = (
            db.execute(
                select(ClusterEngineeringLayout).where(
                    ClusterEngineeringLayout.scenario_id == scenario.id,
                    ClusterEngineeringLayout.is_manual_override.is_(True),
                )
            )
            .scalars()
            .all()
        )
        for p in prior_layouts:
            manual_overrides_by_cid[p.cluster_id] = p.modality

    # Mark all project scenarios inactive, then set this one active
    all_scen = (
        db.execute(
            select(PlanningScenario).where(PlanningScenario.project_id == proj.id)
        )
        .scalars()
        .all()
    )
    for s in all_scen:
        s.is_active = False

    if scenario is None:
        scenario = PlanningScenario(
            project_id=proj.id,
            scenario_key=scenario_key,
            name=SCENARIO_LABELS.get(scenario_key, scenario_key),
            is_active=True,
            summary_payload={},
        )
        db.add(scenario)
        db.flush()
    else:
        scenario.is_active = True
        db.execute(
            delete(ClusterEngineeringLayout).where(
                ClusterEngineeringLayout.scenario_id == scenario.id
            )
        )
        db.flush()

    _recompute_scenario_clusters(
        db=db,
        scenario=scenario,
        clusters=list(clusters),
        buildings=list(buildings),
        gap_by_cid=gap_by_cid,
        demand_by_cid=demand_by_cid,
        infra_by_id=infra_by_id,
        all_infra=list(infra_rows),
        manual_overrides_by_cid=manual_overrides_by_cid,
        worst_ghi=worst_ghi,
        power_factor_cos_phi=settings_map.get("power_factor_cos_phi", 0.85),
        minigrid_min_hh=int(settings_map.get("minigrid_min_households", 25.0)),
        consts_map=consts_map,
        metric_epsg=proj.metric_epsg,
    )

    db.commit()
    db.refresh(scenario)
    return _serialize_scenario(db, scenario)


def _recompute_scenario_clusters(
    *,
    db: Session,
    scenario: PlanningScenario,
    clusters: list[SettlementCluster],
    buildings: list[Building],
    gap_by_cid: dict[str, ClusterGapAnalysis],
    demand_by_cid: dict[str, ProjectDemandEstimate],
    infra_by_id: dict[str, InfrastructureAsset],
    all_infra: list[InfrastructureAsset],
    manual_overrides_by_cid: dict[str, str],
    worst_ghi: float,
    power_factor_cos_phi: float,
    minigrid_min_hh: int,
    consts_map: dict[str, float],
    metric_epsg: int,
) -> None:
    """Run pure engineering evaluation for every cluster and update scenario aggregates."""
    total_ht_m = 0.0
    total_lt_m = 0.0
    total_dts = 0
    total_dt_kva = 0.0
    total_ht_poles = 0
    total_lt_poles = 0
    max_ht_vdrop = 0.0
    max_lt_vdrop = 0.0
    vdrop_all_ok = True
    requires_tie_in_any = False
    total_loss_mwh = 0.0
    total_pv_kwp = 0.0
    total_bess_kwh = 0.0
    total_shs_kits = 0

    for cl in clusters:
        gap_row = gap_by_cid.get(cl.id)
        dem_row = demand_by_cid.get(cl.id)

        eff_class = (
            cl.verified_class
            if cl.verification_state in {"FIELD_VERIFIED", "UTILITY_VERIFIED"}
            and cl.verified_class
            else cl.proxy_class
        )
        if cl.id in manual_overrides_by_cid:
            modality = manual_overrides_by_cid[cl.id]
            is_manual = True
        else:
            modality = _resolve_default_modality_for_scenario(
                scenario_key=scenario.scenario_key,
                gap_recommended_modality=(
                    gap_row.recommended_modality if gap_row else "UNSET_INFRA_REQUIRED"
                ),
                effective_class=eff_class,
                est_households=cl.est_households,
                d_terrain_m=gap_row.d_terrain_m if gap_row else None,
                minigrid_min_hh=minigrid_min_hh,
            )
            is_manual = False

        # Collect residential/institutional building points inside or near this cluster polygon
        b_pts: list[tuple[float, float]] = []
        if cl.geom is not None:
            buffered_poly = cl.geom.buffer(0.0005)
            for b in buildings:
                if b.centroid is not None and buffered_poly.contains(b.centroid):
                    b_pts.append((float(b.centroid.x), float(b.centroid.y)))

        c_lon = float(cl.centroid.x) if cl.centroid is not None else 82.732
        c_lat = float(cl.centroid.y) if cl.centroid is not None else 18.567

        tie_in_pt = _extract_tie_in_point_for_cluster(
            cluster=cl,
            gap_row=gap_row,
            infra_by_id=infra_by_id,
            all_infra=all_infra,
        )

        peak_kw_hor = float(dem_row.peak_kw_horizon) if dem_row else 15.0
        peak_kva_hor = float(dem_row.peak_kva_horizon) if dem_row else 17.65
        energy_day_hor = float(dem_row.energy_kwh_day_horizon) if dem_row else 85.0
        annual_mwh_hor = float(dem_row.annual_energy_mwh_horizon) if dem_row else 31.0

        eval_res = evaluate_cluster_engineering_layout(
            cluster_id=cl.id,
            cluster_label=cl.label,
            cluster_name=cl.name,
            est_households=cl.est_households,
            n_non_residential=cl.n_non_residential,
            cluster_centroid_wgs84=(c_lon, c_lat),
            building_points_wgs84=b_pts,
            modality=modality,
            is_manual_override=is_manual,
            tie_in_wgs84=tie_in_pt,
            slope_mean_deg=cl.slope_mean_deg,
            canopy_share=cl.canopy_share,
            water_crossings_count=(gap_row.water_crossings_count if gap_row else 0),
            peak_kw_horizon=peak_kw_hor,
            peak_kva_horizon=peak_kva_hor,
            energy_kwh_day_horizon=energy_day_hor,
            annual_energy_mwh_horizon=annual_mwh_hor,
            worst_ghi_kwh_m2_day=worst_ghi,
            power_factor_cos_phi=power_factor_cos_phi,
            constants=consts_map,
            metric_epsg=metric_epsg,
        )

        pv_kwp = (
            eval_res.solar_minigrid.solar_pv_kwp
            if eval_res.solar_minigrid
            else (
                eval_res.standalone_shs.total_pv_kwp
                if eval_res.standalone_shs
                else 0.0
            )
        )
        bess_kwh = (
            eval_res.solar_minigrid.bess_capacity_kwh
            if eval_res.solar_minigrid
            else (
                eval_res.standalone_shs.total_bess_kwh
                if eval_res.standalone_shs
                else 0.0
            )
        )
        inv_kva = (
            eval_res.solar_minigrid.inverter_kva if eval_res.solar_minigrid else 0.0
        )
        shs_kits = (
            eval_res.standalone_shs.shs_kits_count if eval_res.standalone_shs else 0
        )

        details_dict: dict[str, Any] = {
            "placed_dts": [
                {
                    "subzone_index": dt.subzone_index,
                    "label": dt.label,
                    "lon": dt.lon,
                    "lat": dt.lat,
                    "rating_kva": dt.rating_kva,
                    "allocated_peak_kva": dt.allocated_peak_kva,
                    "loading_pct": dt.loading_pct,
                    "served_buildings_count": dt.served_buildings_count,
                    "max_radial_reach_m": dt.max_radial_reach_m,
                    "citation": dt.spec.citation,
                }
                for dt in eval_res.placed_dts
            ],
            "vdrop": {
                "ht_current_a": eval_res.vdrop.ht_current_a,
                "ht_drop_v": eval_res.vdrop.ht_drop_v,
                "ht_drop_pct": eval_res.vdrop.ht_drop_pct,
                "ht_vdrop_compliant": eval_res.vdrop.ht_vdrop_compliant,
                "lt_current_a": eval_res.vdrop.lt_current_a,
                "lt_drop_v": eval_res.vdrop.lt_drop_v,
                "lt_drop_pct": eval_res.vdrop.lt_drop_pct,
                "lt_vdrop_compliant": eval_res.vdrop.lt_vdrop_compliant,
                "overall_vdrop_compliant": eval_res.vdrop.overall_vdrop_compliant,
            },
            "losses": {
                "load_factor": eval_res.losses.load_factor,
                "load_loss_factor": eval_res.losses.load_loss_factor,
                "ht_line_loss_kwh_yr": eval_res.losses.ht_line_loss_kwh_yr,
                "lt_line_loss_kwh_yr": eval_res.losses.lt_line_loss_kwh_yr,
                "dt_no_load_loss_kwh_yr": eval_res.losses.dt_no_load_loss_kwh_yr,
                "dt_copper_loss_kwh_yr": eval_res.losses.dt_copper_loss_kwh_yr,
                "total_loss_mwh_yr": eval_res.losses.total_loss_mwh_yr,
                "technical_loss_pct": eval_res.losses.technical_loss_pct,
            },
            "engineering_notes": eval_res.engineering_notes,
        }

        db.add(
            ClusterEngineeringLayout(
                scenario_id=scenario.id,
                project_id=scenario.project_id,
                cluster_id=cl.id,
                cluster_label=cl.label,
                cluster_name=cl.name,
                est_households=cl.est_households,
                modality=eval_res.modality,
                is_manual_override=eval_res.is_manual_override,
                requires_tie_in=eval_res.requires_tie_in,
                peak_kw_horizon=eval_res.peak_kw_horizon,
                peak_kva_horizon=eval_res.peak_kva_horizon,
                energy_kwh_day_horizon=eval_res.energy_kwh_day_horizon,
                annual_energy_mwh_horizon=eval_res.annual_energy_mwh_horizon,
                dt_count=eval_res.dt_count,
                total_dt_rating_kva=eval_res.total_dt_rating_kva,
                max_dt_loading_pct=eval_res.max_dt_loading_pct,
                ht_length_m=eval_res.ht_length_m,
                ht_poles_count=eval_res.ht_poles_count,
                lt_3ph_length_m=eval_res.lt_3ph_length_m,
                lt_1ph_length_m=eval_res.lt_1ph_length_m,
                lt_total_length_m=eval_res.lt_total_length_m,
                max_lt_branch_m=eval_res.max_lt_branch_m,
                lt_poles_count=eval_res.lt_poles_count,
                ht_drop_v=eval_res.vdrop.ht_drop_v,
                ht_drop_pct=eval_res.vdrop.ht_drop_pct,
                lt_drop_v=eval_res.vdrop.lt_drop_v,
                lt_drop_pct=eval_res.vdrop.lt_drop_pct,
                overall_vdrop_compliant=eval_res.vdrop.overall_vdrop_compliant,
                total_loss_mwh_yr=eval_res.losses.total_loss_mwh_yr,
                technical_loss_pct=eval_res.losses.technical_loss_pct,
                solar_pv_kwp=pv_kwp,
                bess_capacity_kwh=bess_kwh,
                inverter_kva=inv_kva,
                shs_kits_count=shs_kits,
                details=details_dict,
                ht_line_geom=eval_res.ht_line_wgs84,
                lt_lines_geom=eval_res.lt_lines_wgs84,
                dt_points_geom=eval_res.dt_points_wgs84,
            )
        )

        total_ht_m += eval_res.ht_length_m
        total_lt_m += eval_res.lt_total_length_m
        total_dts += eval_res.dt_count
        total_dt_kva += eval_res.total_dt_rating_kva
        total_ht_poles += eval_res.ht_poles_count
        total_lt_poles += eval_res.lt_poles_count
        max_ht_vdrop = max(max_ht_vdrop, eval_res.vdrop.ht_drop_pct)
        max_lt_vdrop = max(max_lt_vdrop, eval_res.vdrop.lt_drop_pct)
        if not eval_res.vdrop.overall_vdrop_compliant:
            vdrop_all_ok = False
        if eval_res.requires_tie_in:
            requires_tie_in_any = True
        total_loss_mwh += eval_res.losses.total_loss_mwh_yr
        total_pv_kwp += pv_kwp
        total_bess_kwh += bess_kwh
        total_shs_kits += shs_kits

    scenario.requires_tie_in_warning = requires_tie_in_any
    scenario.total_ht_length_m = round(total_ht_m, 1)
    scenario.total_lt_length_m = round(total_lt_m, 1)
    scenario.total_dt_count = total_dts
    scenario.total_dt_capacity_kva = round(total_dt_kva, 1)
    scenario.total_ht_poles = total_ht_poles
    scenario.total_lt_poles = total_lt_poles
    scenario.max_ht_vdrop_pct = round(max_ht_vdrop, 2)
    scenario.max_lt_vdrop_pct = round(max_lt_vdrop, 2)
    scenario.vdrop_compliance_ok = vdrop_all_ok
    scenario.total_loss_mwh_yr = round(total_loss_mwh, 3)
    scenario.total_solar_kwp = round(total_pv_kwp, 2)
    scenario.total_bess_kwh = round(total_bess_kwh, 2)
    scenario.total_shs_kits = total_shs_kits


def get_project_scenarios(
    db: Session,
    *,
    project_id: str,
    user: User,
) -> PlanningScenarioListResponse:
    """Return all planning scenarios for a project, generating `HYBRID_OPTIMAL` if none exist."""
    proj = get_owned_project_or_404(db, project_id, user)
    scenarios = (
        db.execute(
            select(PlanningScenario)
            .where(PlanningScenario.project_id == proj.id)
            .order_by(PlanningScenario.created_at.asc())
        )
        .scalars()
        .all()
    )
    if not scenarios:
        generate_or_update_scenario(
            db,
            project_id=proj.id,
            user=user,
            scenario_key="HYBRID_OPTIMAL",
            preserve_manual_overrides=False,
        )
        scenarios = (
            db.execute(
                select(PlanningScenario)
                .where(PlanningScenario.project_id == proj.id)
                .order_by(PlanningScenario.created_at.asc())
            )
            .scalars()
            .all()
        )

    serialized = [_serialize_scenario(db, s) for s in scenarios]
    active_scen = next((s for s in serialized if s.is_active), serialized[0])
    return PlanningScenarioListResponse(
        project_id=proj.id,
        active_scenario_key=active_scen.scenario_key,
        active_scenario=active_scen,
        scenarios=serialized,
    )


def override_cluster_modality(
    db: Session,
    *,
    project_id: str,
    scenario_id: str,
    cluster_id: str,
    modality: str,
    user: User,
) -> PlanningScenarioResponse:
    """Override a cluster's electrification modality and synchronously recalculate the scenario."""
    proj = get_owned_project_or_404(db, project_id, user)
    scenario = db.execute(
        select(PlanningScenario).where(
            PlanningScenario.id == scenario_id,
            PlanningScenario.project_id == proj.id,
        )
    ).scalar_one_or_none()
    if scenario is None:
        raise AppError(
            code="SCENARIO_NOT_FOUND",
            message=f"Planning scenario '{scenario_id}' not found.",
            status_code=404,
        )

    layout_row = db.execute(
        select(ClusterEngineeringLayout).where(
            ClusterEngineeringLayout.scenario_id == scenario.id,
            ClusterEngineeringLayout.cluster_id == cluster_id,
        )
    ).scalar_one_or_none()
    if layout_row is None:
        raise AppError(
            code="CLUSTER_LAYOUT_NOT_FOUND",
            message=f"Cluster '{cluster_id}' not found in scenario '{scenario_id}'.",
            status_code=404,
        )

    layout_row.modality = modality
    layout_row.is_manual_override = True
    db.commit()

    return generate_or_update_scenario(
        db,
        project_id=proj.id,
        user=user,
        scenario_key=scenario.scenario_key,
        preserve_manual_overrides=True,
    )
