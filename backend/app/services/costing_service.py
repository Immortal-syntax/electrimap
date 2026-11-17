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

"""Service layer for Milestone M6 (Traceable Cost Estimation & Scenarios).

Orchestrates:
- Schedule of Rates (SoR) seeding, single-item editing, CSV import/export, and reset (Task M6-1)
- Automated Bill of Quantities (BOQ) generation and persistence per scenario (Task M6-2)
- Side-by-side 4-Scenario Comparison & Per-Habitation Modality Economics (Task M6-3)
"""

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models.auth import User
from app.db.models.costing import ProjectRateItem, ScenarioBoqLine
from app.db.models.infrastructure import ClusterGapAnalysis, ProjectDemandEstimate
from app.db.models.planning import ClusterEngineeringLayout, PlanningScenario
from app.db.models.project import Project
from app.db.models.reference import EngineeringConstant
from app.db.models.settlement import SettlementCluster
from app.db.models.spatial import SolarResource
from app.domain.costing.boq import (
    ClusterBoqInput,
    ClusterCostBreakdown,
    ScenarioBoqSummary,
    compute_cluster_boq,
    compute_scenario_boq,
)
from app.domain.costing.rates import (
    DEFAULT_SOR_TEMPLATE_KEY,
    DEFAULT_SOR_TEMPLATE_NAME,
    STANDARD_SOR_ITEMS,
    RateItemSpec,
    export_sor_to_csv,
    parse_and_validate_sor_csv,
)
from app.domain.engineering.calculations import (
    compute_annual_technical_losses,
    compute_solar_minigrid_sizing,
    compute_standalone_shs_sizing,
)
from app.domain.engineering.constants import get_default_constants_map
from app.domain.engineering.economics import (
    EconomicParameters,
    LifecycleEconomicResult,
    resolve_scheme_grant_policy,
)
from app.schemas.costing import (
    BoqLineItemResponse,
    ClusterBoqBreakdownResponse,
    CsvImportErrorItem,
    HabitationOptionComparisonRow,
    LifecycleEconomicsResponse,
    ProjectRateItemResponse,
    ProjectRateListResponse,
    ProjectScenarioComparisonResponse,
    RateItemUpdateRequest,
    ScenarioBoqResponse,
    ScenarioComparisonCard,
    SorCsvImportResponse,
)
from app.services.concurrency import acquire_pg_xact_lock, project_lock
from app.services.planning_service import (
    SCENARIO_LABELS,
    generate_or_update_scenario,
    get_project_scenarios,
)
from app.services.project_service import get_owned_project_or_404, get_writable_project_or_404


def ensure_project_rates_seeded(db: Session, project_id: str) -> list[ProjectRateItem]:
    """Ensure the project has all 18 Schedule of Rates items seeded."""
    with project_lock(db, project_id):
        acquire_pg_xact_lock(db, f"project:{project_id}")
        return _ensure_project_rates_seeded_locked(db, project_id)


def _ensure_project_rates_seeded_locked(db: Session, project_id: str) -> list[ProjectRateItem]:
    rows = list(
        db.execute(
            select(ProjectRateItem)
            .where(ProjectRateItem.project_id == project_id)
            .order_by(ProjectRateItem.item_code.asc())
        )
        .scalars()
        .all()
    )
    existing_by_code = {r.item_code: r for r in rows}
    added = False
    for spec in STANDARD_SOR_ITEMS:
        if spec.item_code not in existing_by_code:
            item = ProjectRateItem(
                project_id=project_id,
                template_key=DEFAULT_SOR_TEMPLATE_KEY,
                template_name=DEFAULT_SOR_TEMPLATE_NAME,
                item_code=spec.item_code,
                description=spec.description,
                category=spec.category,
                unit=spec.unit,
                rate_inr=spec.rate_inr,
                source_type=spec.source_type,
                citation=spec.citation,
                source_year=spec.source_year,
                is_user_edited=False,
            )
            db.add(item)
            added = True

    if added:
        db.commit()
        rows = list(
            db.execute(
                select(ProjectRateItem)
                .where(ProjectRateItem.project_id == project_id)
                .order_by(ProjectRateItem.item_code.asc())
            )
            .scalars()
            .all()
        )
    return rows


def _serialize_rate_list(project_id: str, rows: list[ProjectRateItem]) -> ProjectRateListResponse:
    unset_codes = [
        r.item_code
        for r in rows
        if r.rate_inr is None or r.source_type == "UNSET"
    ]
    edited_cnt = sum(1 for r in rows if r.is_user_edited)
    tpl_key = rows[0].template_key if rows else DEFAULT_SOR_TEMPLATE_KEY
    tpl_name = rows[0].template_name if rows else DEFAULT_SOR_TEMPLATE_NAME

    return ProjectRateListResponse(
        project_id=project_id,
        template_key=tpl_key,
        template_name=tpl_name,
        total_items=len(rows),
        unset_count=len(unset_codes),
        unset_item_codes=unset_codes,
        user_edited_count=edited_cnt,
        items=[
            ProjectRateItemResponse(
                id=r.id,
                project_id=r.project_id,
                template_key=r.template_key,
                template_name=r.template_name,
                item_code=r.item_code,
                description=r.description,
                category=r.category,
                unit=r.unit,
                rate_inr=r.rate_inr,
                source_type=r.source_type,
                citation=r.citation,
                source_year=r.source_year,
                is_user_edited=r.is_user_edited,
                updated_at=r.updated_at,
            )
            for r in rows
        ],
    )


def list_project_rates(db: Session, project_id: str, user: User) -> ProjectRateListResponse:
    """Return all Schedule of Rates items for a project."""
    get_owned_project_or_404(db, project_id, user)
    rows = ensure_project_rates_seeded(db, project_id)
    return _serialize_rate_list(project_id, rows)


def update_project_rate_item(
    db: Session,
    project_id: str,
    item_code: str,
    payload: RateItemUpdateRequest,
    user: User,
) -> ProjectRateListResponse:
    """Update a single Schedule of Rates unit price (or set to UNSET) and recompute BOQs."""
    get_writable_project_or_404(db, project_id, user)
    ensure_project_rates_seeded(db, project_id)

    code_upper = item_code.strip().upper()
    row = db.execute(
        select(ProjectRateItem).where(
            ProjectRateItem.project_id == project_id,
            ProjectRateItem.item_code == code_upper,
        )
    ).scalar_one_or_none()
    if row is None:
        raise AppError(
            code="RATE_ITEM_NOT_FOUND",
            message=f"Schedule of Rates item '{code_upper}' was not found.",
            status_code=404,
        )

    if payload.rate_inr is not None and payload.rate_inr <= 0.0:
        raise AppError(
            code="INVALID_RATE_VALUE",
            message="Unit rate in INR must be strictly positive (> 0), or null for UNSET.",
            status_code=422,
        )

    if payload.rate_inr is None:
        row.rate_inr = None
        row.source_type = "UNSET"
    else:
        row.rate_inr = round(float(payload.rate_inr), 2)
        row.source_type = "USER_EDITED"

    if payload.citation and payload.citation.strip():
        row.citation = payload.citation.strip()
    row.is_user_edited = True
    from app.services.invalidation import invalidate_downstream_from_stage

    invalidate_downstream_from_stage(
        db,
        project_id=project_id,
        stage="boq_only",
        bump_version=True,
    )
    db.commit()

    rows = ensure_project_rates_seeded(db, project_id)
    return _serialize_rate_list(project_id, rows)


def reset_project_rates(db: Session, project_id: str, user: User) -> ProjectRateListResponse:
    """Reset all project Schedule of Rates items back to the verified public reference template."""
    get_writable_project_or_404(db, project_id, user)
    db.execute(delete(ProjectRateItem).where(ProjectRateItem.project_id == project_id))
    from app.services.invalidation import invalidate_downstream_from_stage

    invalidate_downstream_from_stage(
        db,
        project_id=project_id,
        stage="boq_only",
        bump_version=True,
    )
    db.commit()
    rows = ensure_project_rates_seeded(db, project_id)
    return _serialize_rate_list(project_id, rows)


def import_project_rates_csv(
    db: Session,
    project_id: str,
    csv_content: str,
    template_name: str,
    user: User,
) -> SorCsvImportResponse:
    """Validate and apply a custom Schedule of Rates CSV to a project."""
    get_writable_project_or_404(db, project_id, user)
    parsed = parse_and_validate_sor_csv(csv_content)
    if not parsed.is_valid:
        return SorCsvImportResponse(
            is_valid=False,
            imported_count=0,
            unset_count=len(parsed.unset_item_codes),
            unset_item_codes=parsed.unset_item_codes,
            errors=[
                CsvImportErrorItem(
                    row_number=e.row_number,
                    item_code=e.item_code,
                    field=e.field,
                    message=e.message,
                )
                for e in parsed.errors
            ],
            rates=None,
        )

    rows = ensure_project_rates_seeded(db, project_id)
    by_code = {r.item_code: r for r in rows}

    for spec in parsed.items:
        existing = by_code.get(spec.item_code)
        if existing is not None:
            existing.template_key = "USER_UPLOADED_CSV"
            existing.template_name = template_name
            existing.description = spec.description
            existing.category = spec.category
            existing.unit = spec.unit
            existing.rate_inr = spec.rate_inr
            existing.source_type = spec.source_type
            existing.citation = spec.citation
            existing.source_year = spec.source_year
            existing.is_user_edited = True
        else:
            db.add(
                ProjectRateItem(
                    project_id=project_id,
                    template_key="USER_UPLOADED_CSV",
                    template_name=template_name,
                    item_code=spec.item_code,
                    description=spec.description,
                    category=spec.category,
                    unit=spec.unit,
                    rate_inr=spec.rate_inr,
                    source_type=spec.source_type,
                    citation=spec.citation,
                    source_year=spec.source_year,
                    is_user_edited=True,
                )
            )
    from app.services.invalidation import invalidate_downstream_from_stage

    invalidate_downstream_from_stage(
        db,
        project_id=project_id,
        stage="boq_only",
        bump_version=True,
    )
    db.commit()

    updated_rows = ensure_project_rates_seeded(db, project_id)
    rate_list = _serialize_rate_list(project_id, updated_rows)
    return SorCsvImportResponse(
        is_valid=True,
        imported_count=len(parsed.items),
        unset_count=rate_list.unset_count,
        unset_item_codes=rate_list.unset_item_codes,
        errors=[],
        rates=rate_list,
    )


def export_project_rates_csv(db: Session, project_id: str, user: User) -> str:
    """Export the project's active Schedule of Rates to a canonical CSV string."""
    get_owned_project_or_404(db, project_id, user)
    rows = ensure_project_rates_seeded(db, project_id)
    specs = [
        RateItemSpec(
            item_code=r.item_code,
            description=r.description,
            category=r.category,
            unit=r.unit,
            rate_inr=r.rate_inr,
            source_type=r.source_type,
            citation=r.citation,
            source_year=r.source_year,
        )
        for r in rows
    ]
    return export_sor_to_csv(specs)


def _build_economic_params_for_project(project: Project) -> tuple[EconomicParameters, str]:
    subsidy_pct, grant_policy_note = resolve_scheme_grant_policy(project.scheme)
    params = EconomicParameters(
        discount_rate=float(project.discount_rate or 0.08),
        horizon_years=int(project.horizon_years or 10),
        gst_pct=18.0,
        contingency_pct=3.0,
        pmc_overhead_pct=5.0,
        capital_subsidy_pct=subsidy_pct,
    )
    return params, grant_policy_note


def _build_rates_map(rows: list[ProjectRateItem]) -> dict[str, RateItemSpec]:
    # Order by STANDARD_SOR_ITEMS first, then any additional rows
    by_code = {
        r.item_code: RateItemSpec(
            item_code=r.item_code,
            description=r.description,
            category=r.category,
            unit=r.unit,
            rate_inr=r.rate_inr,
            source_type=r.source_type,
            citation=r.citation,
            source_year=r.source_year,
        )
        for r in rows
    }
    ordered: dict[str, RateItemSpec] = {}
    for std in STANDARD_SOR_ITEMS:
        if std.item_code in by_code:
            ordered[std.item_code] = by_code[std.item_code]
    for code, spec in sorted(by_code.items()):
        if code not in ordered:
            ordered[code] = spec
    return ordered


def _build_cluster_boq_inputs_for_scenario(
    db: Session,
    project_id: str,
    scenario_id: str,
) -> list[ClusterBoqInput]:
    layout_rows = list(
        db.execute(
            select(ClusterEngineeringLayout)
            .where(ClusterEngineeringLayout.scenario_id == scenario_id)
            .order_by(ClusterEngineeringLayout.cluster_label.asc())
        )
        .scalars()
        .all()
    )
    cluster_rows = list(
        db.execute(
            select(SettlementCluster).where(SettlementCluster.project_id == project_id)
        )
        .scalars()
        .all()
    )
    cluster_by_id = {c.id: c for c in cluster_rows}

    gap_rows = list(
        db.execute(
            select(ClusterGapAnalysis).where(ClusterGapAnalysis.project_id == project_id)
        )
        .scalars()
        .all()
    )
    gap_by_cid = {g.cluster_id: g for g in gap_rows}
    solar_row = db.execute(
        select(SolarResource).where(SolarResource.project_id == project_id)
    ).scalar_one_or_none()
    worst_ghi = float(solar_row.worst_ghi_kwh_m2_day) if solar_row is not None else 3.82

    inputs: list[ClusterBoqInput] = []
    for row in layout_rows:
        cl_obj = cluster_by_id.get(row.cluster_id)
        gap_obj = gap_by_cid.get(row.cluster_id)
        slope_deg = (
            float(gap_obj.slope_mean_deg)
            if gap_obj is not None
            else (
                float(cl_obj.slope_mean_deg)
                if cl_obj is not None and cl_obj.slope_mean_deg is not None
                else 4.0
            )
        )
        forest_cnt = (
            1
            if (gap_obj is not None and float(gap_obj.canopy_share) >= 0.45)
            else 0
        )
        water_cnt = int(gap_obj.water_crossings_count) if gap_obj is not None else 0

        details = row.details or {}
        dt_ratings: list[int] = []
        if row.modality in {"GRID_EXTENSION", "GRID_AUGMENTATION"}:
            placed_dts = details.get("placed_dts", [])
            dt_ratings = [int(dt.get("rating_kva", 25)) for dt in placed_dts]
            if not dt_ratings and row.dt_count > 0:
                avg_kva = max(16, int(round(row.total_dt_rating_kva / max(1, row.dt_count))))
                dt_ratings = [avg_kva] * row.dt_count

        inst_packs = int(details.get("institutional_packs_count", 0))
        if inst_packs == 0 and row.modality == "STANDALONE_SHS" and cl_obj is not None:
            inst_packs = max(0, min(5, cl_obj.n_non_residential))

        inputs.append(
            ClusterBoqInput(
                cluster_id=row.cluster_id,
                cluster_label=row.cluster_label,
                cluster_name=row.cluster_name,
                modality=row.modality,
                est_households=row.est_households,
                slope_mean_deg=slope_deg,
                forest_crossings=forest_cnt,
                water_crossings=water_cnt,
                ht_length_m=row.ht_length_m,
                ht_poles_count=row.ht_poles_count,
                dt_ratings_kva=dt_ratings,
                lt_3ph_length_m=row.lt_3ph_length_m,
                lt_1ph_length_m=row.lt_1ph_length_m,
                lt_poles_count=row.lt_poles_count,
                solar_pv_kwp=row.solar_pv_kwp,
                bess_capacity_kwh=row.bess_capacity_kwh,
                inverter_kva=row.inverter_kva,
                shs_kits_count=row.shs_kits_count,
                annual_energy_mwh_horizon=row.annual_energy_mwh_horizon,
                total_loss_mwh_yr=row.total_loss_mwh_yr,
                institutional_packs_count=inst_packs,
                worst_ghi_kwh_m2_day=worst_ghi,
            )
        )
    return inputs


def _serialize_economics(econ: LifecycleEconomicResult) -> LifecycleEconomicsResponse:
    return LifecycleEconomicsResponse(
        modality=econ.modality,
        capex_inr=econ.capex_inr,
        capex_lakhs=econ.capex_lakhs,
        capital_subsidy_inr=econ.capital_subsidy_inr,
        net_utility_capex_inr=econ.net_utility_capex_inr,
        annual_om_inr=econ.annual_om_inr,
        annual_energy_purchase_inr=econ.annual_energy_purchase_inr,
        pv_om_inr=econ.pv_om_inr,
        pv_energy_purchase_inr=econ.pv_energy_purchase_inr,
        pv_battery_replacement_inr=econ.pv_battery_replacement_inr,
        npc_inr=econ.npc_inr,
        npc_lakhs=econ.npc_lakhs,
        annual_delivered_energy_kwh=econ.annual_delivered_energy_kwh,
        pv_delivered_energy_kwh=econ.pv_delivered_energy_kwh,
        lcoe_inr_kwh=econ.lcoe_inr_kwh,
        annualized_cost_inr_yr=econ.annualized_cost_inr_yr,
        cost_per_household_inr=econ.cost_per_household_inr,
        npc_per_household_inr=econ.npc_per_household_inr,
        avoided_co2_tonnes_yr=econ.avoided_co2_tonnes_yr,
    )


def _serialize_cluster_breakdown(cb: ClusterCostBreakdown) -> ClusterBoqBreakdownResponse:
    return ClusterBoqBreakdownResponse(
        cluster_id=cb.cluster_id,
        cluster_label=cb.cluster_label,
        cluster_name=cb.cluster_name,
        modality=cb.modality,
        est_households=cb.est_households,
        terrain_multiplier=cb.terrain_multiplier,
        terrain_classification=cb.terrain_classification,
        base_equipment_inr=cb.base_equipment_inr,
        terrain_premium_inr=cb.terrain_premium_inr,
        subtotal_supply_erection_inr=cb.subtotal_supply_erection_inr,
        gst_amount_inr=cb.gst_amount_inr,
        contingency_amount_inr=cb.contingency_amount_inr,
        pmc_overhead_amount_inr=cb.pmc_overhead_amount_inr,
        total_capex_inr=cb.total_capex_inr,
        total_capex_lakhs=cb.total_capex_lakhs,
        has_unset_rates=cb.has_unset_rates,
        unset_item_codes=cb.unset_item_codes,
        totals_withheld=cb.totals_withheld,
        economics=_serialize_economics(cb.economics),
        lines=[
            BoqLineItemResponse(
                cluster_id=ln.cluster_id,
                cluster_label=ln.cluster_label,
                item_code=ln.item_code,
                description=ln.description,
                category=ln.category,
                unit=ln.unit,
                quantity=ln.quantity,
                quantity_basis=ln.quantity_basis,
                rate_inr=ln.rate_inr,
                rate_source_type=ln.rate_source_type,
                citation=ln.citation,
                is_unset=ln.is_unset,
                amount_inr=ln.amount_inr,
            )
            for ln in cb.lines
        ],
    )


def _persist_scenario_boq_lines(
    db: Session,
    project_id: str,
    scenario_id: str,
    summary: ScenarioBoqSummary,
) -> None:
    db.execute(delete(ScenarioBoqLine).where(ScenarioBoqLine.scenario_id == scenario_id))
    for ln in summary.aggregated_lines:
        db.add(
            ScenarioBoqLine(
                scenario_id=scenario_id,
                project_id=project_id,
                cluster_id=None,
                cluster_label="ALL",
                item_code=ln.item_code,
                description=ln.description,
                category=ln.category,
                unit=ln.unit,
                quantity=ln.quantity,
                quantity_basis=ln.quantity_basis,
                rate_inr=ln.rate_inr,
                rate_source_type=ln.rate_source_type,
                citation=ln.citation,
                is_unset=ln.is_unset,
                amount_inr=ln.amount_inr,
            )
        )


def compute_and_persist_scenario_boq(
    db: Session,
    project_id: str,
    scenario_id: str,
    user: User,
) -> ScenarioBoqResponse:
    """Compute, persist, and return the itemized BOQ and financial abstract for a scenario."""
    with project_lock(db, project_id):
        acquire_pg_xact_lock(db, f"project:{project_id}")
        return _compute_and_persist_scenario_boq_locked(
            db, project_id=project_id, scenario_id=scenario_id, user=user
        )


def _compute_and_persist_scenario_boq_locked(
    db: Session,
    project_id: str,
    scenario_id: str,
    user: User,
) -> ScenarioBoqResponse:
    project = get_owned_project_or_404(db, project_id, user)
    scenario = db.execute(
        select(PlanningScenario).where(
            PlanningScenario.id == scenario_id,
            PlanningScenario.project_id == project_id,
        )
    ).scalar_one_or_none()

    if scenario is None:
        get_project_scenarios(db, project_id=project_id, user=user)
        scenario = db.execute(
            select(PlanningScenario).where(
                PlanningScenario.id == scenario_id,
                PlanningScenario.project_id == project_id,
            )
        ).scalar_one_or_none()
        if scenario is None:
            raise AppError(
                code="SCENARIO_NOT_FOUND",
                message=f"Scenario '{scenario_id}' was not found.",
                status_code=404,
            )

    rate_rows = ensure_project_rates_seeded(db, project_id)
    acquire_pg_xact_lock(db, f"project:{project_id}")
    rates_map = _build_rates_map(rate_rows)
    econ_params, grant_policy_note = _build_economic_params_for_project(project)
    cluster_inputs = _build_cluster_boq_inputs_for_scenario(db, project_id, scenario.id)

    summary = compute_scenario_boq(
        scenario_key=scenario.scenario_key,
        clusters=cluster_inputs,
        rates_map=rates_map,
        econ_params=econ_params,
    )
    _persist_scenario_boq_lines(db, project_id, scenario.id, summary)
    db.commit()

    return ScenarioBoqResponse(
        project_id=project_id,
        scenario_id=scenario.id,
        scenario_key=scenario.scenario_key,
        scenario_name=scenario.name,
        is_active_baseline=scenario.is_active,
        discount_rate=econ_params.discount_rate,
        horizon_years=econ_params.horizon_years,
        gst_pct=summary.gst_pct,
        contingency_pct=summary.contingency_pct,
        pmc_overhead_pct=summary.pmc_overhead_pct,
        capital_subsidy_pct=econ_params.capital_subsidy_pct,
        base_equipment_inr=summary.base_equipment_inr,
        terrain_premium_inr=summary.terrain_premium_inr,
        subtotal_supply_erection_inr=summary.subtotal_supply_erection_inr,
        gst_amount_inr=summary.gst_amount_inr,
        contingency_amount_inr=summary.contingency_amount_inr,
        pmc_overhead_amount_inr=summary.pmc_overhead_amount_inr,
        total_capex_inr=summary.total_capex_inr,
        total_capex_lakhs=summary.total_capex_lakhs,
        has_unset_rates=summary.has_unset_rates,
        unset_item_codes=summary.unset_item_codes,
        totals_withheld=summary.totals_withheld,
        grant_policy_note=grant_policy_note,
        export_blocked_reason=summary.export_blocked_reason,
        economics=_serialize_economics(summary.economics),
        aggregated_lines=[
            BoqLineItemResponse(
                cluster_id=ln.cluster_id,
                cluster_label=ln.cluster_label,
                item_code=ln.item_code,
                description=ln.description,
                category=ln.category,
                unit=ln.unit,
                quantity=ln.quantity,
                quantity_basis=ln.quantity_basis,
                rate_inr=ln.rate_inr,
                rate_source_type=ln.rate_source_type,
                citation=ln.citation,
                is_unset=ln.is_unset,
                amount_inr=ln.amount_inr,
            )
            for ln in summary.aggregated_lines
        ],
        cluster_breakdowns=[
            _serialize_cluster_breakdown(cb) for cb in summary.cluster_breakdowns
        ],
    )


def get_project_scenario_comparison(
    db: Session,
    project_id: str,
    user: User,
) -> ProjectScenarioComparisonResponse:
    """Evaluate all 4 project scenarios on identical demand inputs and return comparison."""
    with project_lock(db, project_id):
        acquire_pg_xact_lock(db, f"project:{project_id}")
        return _get_project_scenario_comparison_locked(
            db, project_id=project_id, user=user
        )


def _get_project_scenario_comparison_locked(
    db: Session,
    project_id: str,
    user: User,
) -> ProjectScenarioComparisonResponse:
    project = get_owned_project_or_404(db, project_id, user)
    scenarios = list(
        db.execute(
            select(PlanningScenario)
            .where(PlanningScenario.project_id == project_id)
            .order_by(PlanningScenario.created_at.asc())
        )
        .scalars()
        .all()
    )
    prior_active_key = next(
        (s.scenario_key for s in scenarios if s.is_active), "HYBRID_OPTIMAL"
    )
    existing_keys = {s.scenario_key for s in scenarios}
    missing_keys = [k for k in SCENARIO_LABELS if k not in existing_keys]
    if missing_keys:
        for key in missing_keys:
            generate_or_update_scenario(
                db,
                project_id=project_id,
                user=user,
                scenario_key=key,
                preserve_manual_overrides=True,
                allow_shared_read_backfill=True,
            )
        scenarios = list(
            db.execute(
                select(PlanningScenario)
                .where(PlanningScenario.project_id == project_id)
                .order_by(PlanningScenario.created_at.asc())
            )
            .scalars()
            .all()
        )
        for s in scenarios:
            s.is_active = s.scenario_key == prior_active_key
        acquire_pg_xact_lock(db, f"project:{project_id}")
        db.commit()

    acquire_pg_xact_lock(db, f"project:{project_id}")
    rate_rows = ensure_project_rates_seeded(db, project_id)
    acquire_pg_xact_lock(db, f"project:{project_id}")
    rates_map = _build_rates_map(rate_rows)
    econ_params, grant_policy_note = _build_economic_params_for_project(project)

    scenario_cards: list[ScenarioComparisonCard] = []
    summaries_by_key: dict[str, tuple[PlanningScenario, ScenarioBoqSummary]] = {}
    active_scen = next((s for s in scenarios if s.is_active), scenarios[0])

    for scen in scenarios:
        cl_inputs = _build_cluster_boq_inputs_for_scenario(db, project_id, scen.id)
        summary = compute_scenario_boq(
            scenario_key=scen.scenario_key,
            clusters=cl_inputs,
            rates_map=rates_map,
            econ_params=econ_params,
        )
        _persist_scenario_boq_lines(db, project_id, scen.id, summary)
        summaries_by_key[scen.scenario_key] = (scen, summary)

        mod_counts = (scen.summary_payload or {}).get("modality_counts") or {}
        if not mod_counts:
            for c_in in cl_inputs:
                mod_counts[c_in.modality] = mod_counts.get(c_in.modality, 0) + 1
        total_hh = sum(c.est_households for c in cl_inputs)
        total_energy_mwh = round(sum(c.annual_energy_mwh_horizon for c in cl_inputs), 3)

        scenario_cards.append(
            ScenarioComparisonCard(
                scenario_id=scen.id,
                scenario_key=scen.scenario_key,
                scenario_name=scen.name,
                is_active_baseline=scen.is_active,
                requires_tie_in_warning=scen.requires_tie_in_warning,
                vdrop_compliance_ok=scen.vdrop_compliance_ok,
                total_households_served=total_hh,
                annual_delivered_energy_mwh=total_energy_mwh,
                modality_counts=mod_counts,
                base_equipment_inr=summary.base_equipment_inr,
                terrain_premium_inr=summary.terrain_premium_inr,
                gst_amount_inr=summary.gst_amount_inr,
                contingency_amount_inr=summary.contingency_amount_inr,
                pmc_overhead_amount_inr=summary.pmc_overhead_amount_inr,
                total_capex_inr=summary.total_capex_inr,
                total_capex_lakhs=summary.total_capex_lakhs,
                capital_subsidy_inr=summary.economics.capital_subsidy_inr,
                net_utility_capex_inr=summary.economics.net_utility_capex_inr,
                annual_om_inr=summary.economics.annual_om_inr,
                annual_energy_purchase_inr=summary.economics.annual_energy_purchase_inr,
                npc_inr=summary.economics.npc_inr,
                npc_lakhs=summary.economics.npc_lakhs,
                lcoe_inr_kwh=summary.economics.lcoe_inr_kwh,
                cost_per_household_inr=summary.economics.cost_per_household_inr,
                npc_per_household_inr=summary.economics.npc_per_household_inr,
                avoided_co2_tonnes_yr=summary.economics.avoided_co2_tonnes_yr,
                has_unset_rates=summary.has_unset_rates,
                unset_item_codes=summary.unset_item_codes,
                totals_withheld=summary.totals_withheld,
            )
        )

    db.commit()

    # Build per-habitation side-by-side comparison across Grid, Mini-Grid, and SHS options
    # using the cluster breakdowns from GRID_EXTENSION_ONLY, MINIGRID_PRIORITY, and SHS_DISPERSED
    active_tuple = summaries_by_key.get(
        active_scen.scenario_key, next(iter(summaries_by_key.values()))
    )
    _, active_summary = active_tuple

    grid_summary = summaries_by_key.get("GRID_EXTENSION_ONLY", active_tuple)[1]
    mg_summary = summaries_by_key.get("MINIGRID_PRIORITY", active_tuple)[1]
    shs_summary = summaries_by_key.get("SHS_DISPERSED", active_tuple)[1]

    grid_by_cid = {cb.cluster_id: cb for cb in grid_summary.cluster_breakdowns}
    mg_by_cid = {cb.cluster_id: cb for cb in mg_summary.cluster_breakdowns}
    shs_by_cid = {cb.cluster_id: cb for cb in shs_summary.cluster_breakdowns}

    # Check if grid scenarios require tie-in per cluster and prepare counterfactual option inputs
    grid_scen_id = summaries_by_key.get("GRID_EXTENSION_ONLY", active_tuple)[0].id
    grid_layouts = {
        r.cluster_id: r
        for r in db.execute(
            select(ClusterEngineeringLayout).where(
                ClusterEngineeringLayout.scenario_id == grid_scen_id
            )
        )
        .scalars()
        .all()
    }
    cluster_rows_by_id = {
        c.id: c
        for c in db.execute(
            select(SettlementCluster).where(SettlementCluster.project_id == project_id)
        )
        .scalars()
        .all()
    }
    gap_rows_by_cid = {
        g.cluster_id: g
        for g in db.execute(
            select(ClusterGapAnalysis).where(ClusterGapAnalysis.project_id == project_id)
        )
        .scalars()
        .all()
    }
    demand_rows_by_cid = {
        d.cluster_id: d
        for d in db.execute(
            select(ProjectDemandEstimate).where(
                ProjectDemandEstimate.project_id == project_id,
                ProjectDemandEstimate.cluster_id.is_not(None),
            )
        )
        .scalars()
        .all()
    }
    solar_res = db.execute(
        select(SolarResource).where(SolarResource.project_id == project_id)
    ).scalar_one_or_none()
    worst_ghi = (
        float(solar_res.worst_ghi_kwh_m2_day)
        if solar_res is not None and solar_res.worst_ghi_kwh_m2_day is not None
        else 3.82
    )
    consts_map = {**get_default_constants_map()}
    for c_row in db.execute(select(EngineeringConstant)).scalars().all():
        consts_map[c_row.key] = float(c_row.value)

    def _counterfactual_option_boq(
        *,
        target_modality: str,
        cluster_id: str,
        fallback_cb: ClusterCostBreakdown,
    ) -> ClusterCostBreakdown:
        if fallback_cb.modality == target_modality:
            return fallback_cb
        cl_obj = cluster_rows_by_id.get(cluster_id)
        gap_obj = gap_rows_by_cid.get(cluster_id)
        dem_obj = demand_rows_by_cid.get(cluster_id)
        g_lay = grid_layouts.get(cluster_id)

        est_hh = cl_obj.est_households if cl_obj is not None else fallback_cb.est_households
        n_non_res = cl_obj.n_non_residential if cl_obj is not None else 0
        slope_deg = (
            float(gap_obj.slope_mean_deg)
            if gap_obj is not None
            else (
                float(cl_obj.slope_mean_deg)
                if cl_obj is not None and cl_obj.slope_mean_deg is not None
                else 4.0
            )
        )
        forest_cnt = 1 if (gap_obj is not None and float(gap_obj.canopy_share) >= 0.45) else 0
        water_cnt = int(gap_obj.water_crossings_count) if gap_obj is not None else 0

        peak_kw_hor = float(dem_obj.peak_kw_horizon) if dem_obj is not None else 15.0
        peak_kva_hor = float(dem_obj.peak_kva_horizon) if dem_obj is not None else 17.65
        energy_day_hor = float(dem_obj.energy_kwh_day_horizon) if dem_obj is not None else 85.0
        annual_mwh_hor = float(dem_obj.annual_energy_mwh_horizon) if dem_obj is not None else 31.0

        if target_modality == "SOLAR_MINIGRID":
            mg = compute_solar_minigrid_sizing(
                peak_kva_horizon=peak_kva_hor,
                energy_kwh_day_horizon=energy_day_hor,
                worst_ghi_kwh_m2_day=worst_ghi,
                constants=consts_map,
            )
            lt_3ph = float(g_lay.lt_3ph_length_m) if g_lay is not None else 0.0
            lt_1ph = float(g_lay.lt_1ph_length_m) if g_lay is not None else 0.0
            lt_poles = int(g_lay.lt_poles_count) if g_lay is not None else 0
            max_branch = float(g_lay.max_lt_branch_m) if g_lay is not None else 0.0
            losses = compute_annual_technical_losses(
                peak_kw_horizon=peak_kw_hor,
                peak_kva_horizon=peak_kva_hor,
                energy_kwh_day_horizon=energy_day_hor,
                annual_energy_mwh_horizon=annual_mwh_hor,
                ht_length_m=0.0,
                max_lt_branch_m=max_branch,
                placed_dts=[],
                constants=consts_map,
                lt_3ph_length_m=lt_3ph,
                lt_1ph_length_m=lt_1ph,
                lt_feeder_count=1,
            )
            opt_in = ClusterBoqInput(
                cluster_id=cluster_id,
                cluster_label=fallback_cb.cluster_label,
                cluster_name=fallback_cb.cluster_name,
                modality="SOLAR_MINIGRID",
                est_households=est_hh,
                slope_mean_deg=slope_deg,
                forest_crossings=forest_cnt,
                water_crossings=water_cnt,
                ht_length_m=0.0,
                ht_poles_count=0,
                dt_ratings_kva=[],
                lt_3ph_length_m=lt_3ph,
                lt_1ph_length_m=lt_1ph,
                lt_poles_count=lt_poles,
                solar_pv_kwp=mg.solar_pv_kwp,
                bess_capacity_kwh=mg.bess_capacity_kwh,
                inverter_kva=mg.inverter_kva,
                shs_kits_count=0,
                annual_energy_mwh_horizon=annual_mwh_hor,
                total_loss_mwh_yr=losses.total_loss_mwh_yr,
                worst_ghi_kwh_m2_day=worst_ghi,
            )
            return compute_cluster_boq(opt_in, rates_map, econ_params)

        # STANDALONE_SHS option with energy bounded in evaluate_lifecycle_economics
        shs = compute_standalone_shs_sizing(
            est_households=est_hh,
            n_non_residential=n_non_res,
            constants=consts_map,
        )
        opt_in = ClusterBoqInput(
            cluster_id=cluster_id,
            cluster_label=fallback_cb.cluster_label,
            cluster_name=fallback_cb.cluster_name,
            modality="STANDALONE_SHS",
            est_households=est_hh,
            slope_mean_deg=slope_deg,
            forest_crossings=forest_cnt,
            water_crossings=water_cnt,
            ht_length_m=0.0,
            ht_poles_count=0,
            dt_ratings_kva=[],
            lt_3ph_length_m=0.0,
            lt_1ph_length_m=0.0,
            lt_poles_count=0,
            solar_pv_kwp=shs.total_pv_kwp,
            bess_capacity_kwh=0.0,
            inverter_kva=0.0,
            shs_kits_count=shs.shs_kits_count,
            annual_energy_mwh_horizon=annual_mwh_hor,
            total_loss_mwh_yr=0.0,
            institutional_packs_count=shs.institutional_packs_count,
            worst_ghi_kwh_m2_day=worst_ghi,
        )
        return compute_cluster_boq(opt_in, rates_map, econ_params)

    habitation_rows: list[HabitationOptionComparisonRow] = []
    for cb in active_summary.cluster_breakdowns:
        cid = cb.cluster_id
        g_cb = grid_by_cid.get(cid, cb)
        m_cb = _counterfactual_option_boq(
            target_modality="SOLAR_MINIGRID",
            cluster_id=cid,
            fallback_cb=mg_by_cid.get(cid, cb),
        )
        s_cb = _counterfactual_option_boq(
            target_modality="STANDALONE_SHS",
            cluster_id=cid,
            fallback_cb=shs_by_cid.get(cid, cb),
        )
        g_layout = grid_layouts.get(cid)
        grid_req_tie_in = bool(g_layout.requires_tie_in) if g_layout else False

        if (
            m_cb.has_unset_rates
            or s_cb.has_unset_rates
            or (not grid_req_tie_in and g_cb.has_unset_rates)
        ):
            best_mod = "UNSET_RATES_REQUIRED"
        else:
            options_npc: list[tuple[str, float]] = [
                ("STANDALONE_SHS", s_cb.economics.npc_inr),
                ("SOLAR_MINIGRID", m_cb.economics.npc_inr),
            ]
            if not grid_req_tie_in:
                options_npc.append((g_cb.modality, g_cb.economics.npc_inr))
            best_mod, _ = min(options_npc, key=lambda item: item[1])

        if best_mod == "UNSET_RATES_REQUIRED":
            rationale = (
                "Option life-cycle comparison withheld until UNSET Schedule of Rates item(s) "
                "are priced."
            )
        elif (
            grid_req_tie_in
            and best_mod != cb.modality
            and cb.modality in {"GRID_EXTENSION", "GRID_AUGMENTATION"}
        ):
            rationale = (
                "11 kV Tie-In UNSET (HT length = 0 m); place a verified/assumed tie-in "
                f"point for grid costing, or compare least-cost off-grid option ({best_mod})."
            )
        elif best_mod == "GRID_AUGMENTATION":
            rationale = (
                "Existing settlement proximity allows LT network & DT augmentation at "
                f"lowest 10-yr NPC (₹{g_cb.economics.npc_lakhs:.2f} L)."
            )
        elif best_mod == "SOLAR_MINIGRID":
            rationale = (
                f"Solar PV + LiFePO4 Mini-Grid minimizes 10-yr NPC "
                f"(₹{m_cb.economics.npc_lakhs:.2f} L, ₹{m_cb.economics.lcoe_inr_kwh:.2f}/kWh LCOE)."
            )
        elif best_mod == "STANDALONE_SHS":
            rationale = (
                "Standalone 200 Wp SHS kits minimize 10-yr life-cycle NPC "
                f"(₹{s_cb.economics.npc_lakhs:.2f} L, ₹{s_cb.economics.lcoe_inr_kwh:.2f}/kWh LCOE)."
            )
        else:
            rationale = (
                f"11 kV Grid Extension + LT AB-cable radial network yields lowest 10-yr NPC "
                f"(₹{g_cb.economics.npc_lakhs:.2f} L, ₹{g_cb.economics.lcoe_inr_kwh:.2f}/kWh LCOE)."
            )

        habitation_rows.append(
            HabitationOptionComparisonRow(
                cluster_id=cid,
                cluster_label=cb.cluster_label,
                cluster_name=cb.cluster_name,
                est_households=cb.est_households,
                annual_energy_mwh_horizon=round(
                    cb.economics.annual_delivered_energy_kwh / 1000.0, 3
                ),
                active_modality=cb.modality,
                least_cost_npc_modality=best_mod,
                grid_capex_inr=g_cb.total_capex_inr,
                grid_npc_inr=g_cb.economics.npc_inr,
                grid_lcoe_inr_kwh=g_cb.economics.lcoe_inr_kwh,
                grid_requires_tie_in=grid_req_tie_in,
                minigrid_capex_inr=m_cb.total_capex_inr,
                minigrid_npc_inr=m_cb.economics.npc_inr,
                minigrid_lcoe_inr_kwh=m_cb.economics.lcoe_inr_kwh,
                shs_capex_inr=s_cb.total_capex_inr,
                shs_npc_inr=s_cb.economics.npc_inr,
                shs_lcoe_inr_kwh=s_cb.economics.lcoe_inr_kwh,
                rationale=rationale,
            )
        )

    active_boq_resp = ScenarioBoqResponse(
        project_id=project_id,
        scenario_id=active_scen.id,
        scenario_key=active_scen.scenario_key,
        scenario_name=active_scen.name,
        is_active_baseline=active_scen.is_active,
        discount_rate=econ_params.discount_rate,
        horizon_years=econ_params.horizon_years,
        gst_pct=active_summary.gst_pct,
        contingency_pct=active_summary.contingency_pct,
        pmc_overhead_pct=active_summary.pmc_overhead_pct,
        capital_subsidy_pct=econ_params.capital_subsidy_pct,
        base_equipment_inr=active_summary.base_equipment_inr,
        terrain_premium_inr=active_summary.terrain_premium_inr,
        subtotal_supply_erection_inr=active_summary.subtotal_supply_erection_inr,
        gst_amount_inr=active_summary.gst_amount_inr,
        contingency_amount_inr=active_summary.contingency_amount_inr,
        pmc_overhead_amount_inr=active_summary.pmc_overhead_amount_inr,
        total_capex_inr=active_summary.total_capex_inr,
        total_capex_lakhs=active_summary.total_capex_lakhs,
        has_unset_rates=active_summary.has_unset_rates,
        unset_item_codes=active_summary.unset_item_codes,
        totals_withheld=active_summary.totals_withheld,
        grant_policy_note=grant_policy_note,
        export_blocked_reason=active_summary.export_blocked_reason,
        economics=_serialize_economics(active_summary.economics),
        aggregated_lines=[
            BoqLineItemResponse(
                cluster_id=ln.cluster_id,
                cluster_label=ln.cluster_label,
                item_code=ln.item_code,
                description=ln.description,
                category=ln.category,
                unit=ln.unit,
                quantity=ln.quantity,
                quantity_basis=ln.quantity_basis,
                rate_inr=ln.rate_inr,
                rate_source_type=ln.rate_source_type,
                citation=ln.citation,
                is_unset=ln.is_unset,
                amount_inr=ln.amount_inr,
            )
            for ln in active_summary.aggregated_lines
        ],
        cluster_breakdowns=[
            _serialize_cluster_breakdown(cb) for cb in active_summary.cluster_breakdowns
        ],
    )

    return ProjectScenarioComparisonResponse(
        project_id=project_id,
        active_scenario_id=active_scen.id,
        active_scenario_key=active_scen.scenario_key,
        discount_rate=econ_params.discount_rate,
        horizon_years=econ_params.horizon_years,
        has_unset_rates=active_summary.has_unset_rates,
        unset_item_codes=active_summary.unset_item_codes,
        totals_withheld=active_summary.totals_withheld,
        export_blocked_reason=active_summary.export_blocked_reason,
        scenarios=scenario_cards,
        habitation_comparisons=habitation_rows,
        active_scenario_boq=active_boq_resp,
    )


def pin_project_scenario(
    db: Session,
    project_id: str,
    scenario_id: str,
    user: User,
) -> ProjectScenarioComparisonResponse:
    """Pin the selected scenario as the active DPR baseline (`is_active = True`)."""
    get_writable_project_or_404(db, project_id, user)
    scenarios = list(
        db.execute(
            select(PlanningScenario).where(PlanningScenario.project_id == project_id)
        )
        .scalars()
        .all()
    )
    target = next((s for s in scenarios if s.id == scenario_id), None)
    if target is None:
        raise AppError(
            code="SCENARIO_NOT_FOUND",
            message=f"Scenario '{scenario_id}' was not found in project.",
            status_code=404,
        )

    for s in scenarios:
        s.is_active = s.id == scenario_id
    db.commit()
    return get_project_scenario_comparison(db, project_id, user)
