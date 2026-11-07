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

"""Pydantic v2 request and response schemas for Milestone M6:
- Schedule of Rates (SoR) management & CSV import/export
- Itemized Bill of Quantities (BOQ) & Financial Abstract
- Multi-Scenario Life-Cycle Economics Comparison (Grid vs. Mini-Grid vs. SHS vs. Hybrid)
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

RateSourceTypeLiteral = Literal[
    "REFERENCE_PUBLIC_DOCUMENT",
    "USER_TEMPLATE",
    "USER_EDITED",
    "UNSET",
]


class ProjectRateItemResponse(BaseModel):
    """Single Schedule of Rates (SoR) unit rate item with provenance."""

    id: str
    project_id: str
    template_key: str
    template_name: str
    item_code: str
    description: str
    category: str
    unit: str
    rate_inr: float | None
    source_type: str
    citation: str
    source_year: int
    is_user_edited: bool
    updated_at: datetime


class ProjectRateListResponse(BaseModel):
    """List of Schedule of Rates items for a project along with summary counts."""

    project_id: str
    template_key: str
    template_name: str
    total_items: int
    unset_count: int
    unset_item_codes: list[str]
    user_edited_count: int
    items: list[ProjectRateItemResponse]


class RateItemUpdateRequest(BaseModel):
    """Request payload to update a single Schedule of Rates unit price or mark it UNSET."""

    rate_inr: float | None = Field(
        default=None,
        description="Unit price in INR (> 0), or null to mark the rate as UNSET.",
    )
    citation: str | None = Field(
        default=None,
        max_length=500,
        description="Optional source note or citation for the rate override.",
    )


class CsvImportErrorItem(BaseModel):
    """Row-level error reported during Schedule of Rates CSV validation."""

    row_number: int
    item_code: str
    field: str
    message: str


class SorCsvImportRequest(BaseModel):
    """Request payload to validate and import a Schedule of Rates CSV string."""

    csv_content: str = Field(..., min_length=10)
    template_name: str = Field(
        default="Custom Uploaded State Schedule of Rates (CSV)",
        min_length=3,
        max_length=200,
    )


class SorCsvImportResponse(BaseModel):
    """Response from importing a custom Schedule of Rates CSV."""

    is_valid: bool
    imported_count: int
    unset_count: int
    unset_item_codes: list[str]
    errors: list[CsvImportErrorItem]
    rates: ProjectRateListResponse | None = None


class BoqLineItemResponse(BaseModel):
    """Single itemized Bill of Quantities (BOQ) row."""

    cluster_id: str | None
    cluster_label: str | None
    item_code: str
    description: str
    category: str
    unit: str
    quantity: float
    quantity_basis: str
    rate_inr: float | None
    rate_source_type: str
    citation: str
    is_unset: bool
    amount_inr: float


class LifecycleEconomicsResponse(BaseModel):
    """Deterministic life-cycle financial and economic metrics (CAPEX, NPC, LCOE, O&M)."""

    modality: str
    capex_inr: float
    capex_lakhs: float
    capital_subsidy_inr: float
    net_utility_capex_inr: float
    annual_om_inr: float
    annual_energy_purchase_inr: float
    pv_om_inr: float
    pv_energy_purchase_inr: float
    pv_battery_replacement_inr: float
    npc_inr: float
    npc_lakhs: float
    annual_delivered_energy_kwh: float
    pv_delivered_energy_kwh: float
    lcoe_inr_kwh: float
    annualized_cost_inr_yr: float
    cost_per_household_inr: float
    npc_per_household_inr: float
    avoided_co2_tonnes_yr: float


class ClusterBoqBreakdownResponse(BaseModel):
    """Per-habitation cluster BOQ and life-cycle financial breakdown."""

    cluster_id: str
    cluster_label: str
    cluster_name: str
    modality: str
    est_households: int
    terrain_multiplier: float
    terrain_classification: str
    base_equipment_inr: float
    terrain_premium_inr: float
    subtotal_supply_erection_inr: float
    gst_amount_inr: float
    contingency_amount_inr: float
    pmc_overhead_amount_inr: float
    total_capex_inr: float
    total_capex_lakhs: float
    has_unset_rates: bool
    unset_item_codes: list[str]
    economics: LifecycleEconomicsResponse
    lines: list[BoqLineItemResponse]


class ScenarioBoqResponse(BaseModel):
    """Complete Bill of Quantities (BOQ) and financial abstract for a planning scenario."""

    project_id: str
    scenario_id: str
    scenario_key: str
    scenario_name: str
    is_active_baseline: bool
    discount_rate: float
    horizon_years: int
    gst_pct: float
    contingency_pct: float
    pmc_overhead_pct: float
    capital_subsidy_pct: float
    base_equipment_inr: float
    terrain_premium_inr: float
    subtotal_supply_erection_inr: float
    gst_amount_inr: float
    contingency_amount_inr: float
    pmc_overhead_amount_inr: float
    total_capex_inr: float
    total_capex_lakhs: float
    has_unset_rates: bool
    unset_item_codes: list[str]
    export_blocked_reason: str | None
    economics: LifecycleEconomicsResponse
    aggregated_lines: list[BoqLineItemResponse]
    cluster_breakdowns: list[ClusterBoqBreakdownResponse]


class HabitationOptionComparisonRow(BaseModel):
    """Side-by-side comparison of Grid vs. Mini-Grid vs. SHS for a single habitation cluster."""

    cluster_id: str
    cluster_label: str
    cluster_name: str
    est_households: int
    annual_energy_mwh_horizon: float
    active_modality: str
    least_cost_npc_modality: str
    grid_capex_inr: float
    grid_npc_inr: float
    grid_lcoe_inr_kwh: float
    grid_requires_tie_in: bool
    minigrid_capex_inr: float
    minigrid_npc_inr: float
    minigrid_lcoe_inr_kwh: float
    shs_capex_inr: float
    shs_npc_inr: float
    shs_lcoe_inr_kwh: float
    rationale: str


class ScenarioComparisonCard(BaseModel):
    """Summary card comparing a full project scenario across technical & economic metrics."""

    scenario_id: str
    scenario_key: str
    scenario_name: str
    is_active_baseline: bool
    requires_tie_in_warning: bool
    vdrop_compliance_ok: bool
    total_households_served: int
    annual_delivered_energy_mwh: float
    modality_counts: dict[str, int]
    base_equipment_inr: float
    terrain_premium_inr: float
    gst_amount_inr: float
    contingency_amount_inr: float
    pmc_overhead_amount_inr: float
    total_capex_inr: float
    total_capex_lakhs: float
    capital_subsidy_inr: float
    net_utility_capex_inr: float
    annual_om_inr: float
    annual_energy_purchase_inr: float
    npc_inr: float
    npc_lakhs: float
    lcoe_inr_kwh: float
    cost_per_household_inr: float
    npc_per_household_inr: float
    avoided_co2_tonnes_yr: float
    has_unset_rates: bool
    unset_item_codes: list[str]


class ProjectScenarioComparisonResponse(BaseModel):
    """Complete side-by-side comparison of all 4 scenarios plus per-habitation option table."""

    project_id: str
    active_scenario_id: str
    active_scenario_key: str
    discount_rate: float
    horizon_years: int
    has_unset_rates: bool
    unset_item_codes: list[str]
    export_blocked_reason: str | None
    scenarios: list[ScenarioComparisonCard]
    habitation_comparisons: list[HabitationOptionComparisonRow]
    active_scenario_boq: ScenarioBoqResponse
