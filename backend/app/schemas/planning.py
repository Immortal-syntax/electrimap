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

"""Pydantic v2 request and response schemas for Milestone M5 (Network & Engineering Engine)."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class EngineeringConstantResponse(BaseModel):
    key: str
    value: float
    unit: str
    description: str
    citation: str
    status: str


class EngineeringConstantListResponse(BaseModel):
    count: int
    items: list[EngineeringConstantResponse]


class PlacedDtResponse(BaseModel):
    subzone_index: int
    label: str
    lon: float
    lat: float
    rating_kva: float
    allocated_peak_kva: float
    loading_pct: float
    served_buildings_count: int
    max_radial_reach_m: float
    citation: str


class ClusterEngineeringLayoutResponse(BaseModel):
    id: str
    scenario_id: str
    project_id: str
    cluster_id: str
    cluster_label: str
    cluster_name: str
    est_households: int
    modality: str
    is_manual_override: bool
    requires_tie_in: bool
    peak_kw_horizon: float
    peak_kva_horizon: float
    energy_kwh_day_horizon: float
    annual_energy_mwh_horizon: float
    dt_count: int
    total_dt_rating_kva: float
    max_dt_loading_pct: float
    placed_dts: list[PlacedDtResponse]
    ht_length_m: float
    ht_poles_count: int
    lt_3ph_length_m: float
    lt_1ph_length_m: float
    lt_total_length_m: float
    max_lt_branch_m: float
    lt_poles_count: int
    ht_current_a: float
    ht_drop_v: float
    ht_drop_pct: float
    ht_vdrop_compliant: bool
    lt_current_a: float
    lt_drop_v: float
    lt_drop_pct: float
    lt_vdrop_compliant: bool
    overall_vdrop_compliant: bool
    load_factor: float
    load_loss_factor: float
    ht_line_loss_kwh_yr: float
    lt_line_loss_kwh_yr: float
    dt_no_load_loss_kwh_yr: float
    dt_copper_loss_kwh_yr: float
    total_loss_mwh_yr: float
    technical_loss_pct: float
    solar_pv_kwp: float
    bess_capacity_kwh: float
    inverter_kva: float
    shs_kits_count: int
    engineering_notes: list[str]
    updated_at: datetime


class PlanningScenarioResponse(BaseModel):
    id: str
    project_id: str
    scenario_key: str
    name: str
    is_active: bool
    requires_tie_in_warning: bool
    total_ht_length_m: float
    total_lt_length_m: float
    total_dt_count: int
    total_dt_capacity_kva: float
    total_ht_poles: int
    total_lt_poles: int
    max_ht_vdrop_pct: float
    max_lt_vdrop_pct: float
    vdrop_compliance_ok: bool
    total_loss_mwh_yr: float
    total_solar_kwp: float
    total_bess_kwh: float
    total_shs_kits: int
    network_geojson: dict[str, Any]
    clusters: list[ClusterEngineeringLayoutResponse]
    updated_at: datetime


class PlanningScenarioListResponse(BaseModel):
    project_id: str
    active_scenario_key: str
    active_scenario: PlanningScenarioResponse
    scenarios: list[PlanningScenarioResponse]


class GenerateScenarioRequest(BaseModel):
    scenario_key: Literal[
        "HYBRID_OPTIMAL",
        "GRID_EXTENSION_ONLY",
        "MINIGRID_PRIORITY",
        "SHS_DISPERSED",
    ] = Field(default="HYBRID_OPTIMAL")
    preserve_manual_overrides: bool = Field(default=False)


class ClusterModalityOverrideRequest(BaseModel):
    modality: Literal[
        "GRID_EXTENSION",
        "SOLAR_MINIGRID",
        "STANDALONE_SHS",
        "GRID_AUGMENTATION",
    ]
