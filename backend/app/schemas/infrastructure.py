"""Pydantic v2 schemas for Milestone M4:
- Existing Electrical Infrastructure & Interactive Tie-In Placement (`infrastructure_assets`)
- Terrain-Weighted Distance & Obstacle Gap Analysis Matrix (`cluster_gap_analyses`)
- Project-Level Assumptions Register (`project_settings`)
- 7-Category Parametric Electricity Demand Estimation (`project_demand_estimates`)
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class InfrastructureAssetCreateRequest(BaseModel):
    """Create a planner-placed tie-in point, DT, or line asset (`USER_ASSUMED` or `FIELD_SURVEY`).
    """

    asset_type: str = Field(
        default="TIE_IN",
        pattern="^(HT_LINE|LT_LINE|POLE|DT|SUBSTATION|TIE_IN)$",
    )
    name: str = Field(default="Assumed 11 kV Feeder Tap Point", min_length=2, max_length=160)
    voltage_kv: float | None = Field(default=11.0, ge=0.23, le=400.0)
    rating_kva: float | None = Field(default=None, ge=5.0, le=25000.0)
    provenance: str = Field(
        default="USER_ASSUMED",
        pattern="^(UTILITY_RECORD|FIELD_SURVEY|USER_ASSUMED|OSM)$",
    )
    source_note: str = Field(
        default="Explicit planner-placed assumed 11 kV tie-in point — requires utility survey.",
        min_length=3,
        max_length=1000,
    )
    lon: float | None = Field(default=None, ge=68.0, le=98.0)
    lat: float | None = Field(default=None, ge=6.0, le=38.0)
    geojson_geometry: dict[str, Any] | None = None
    attributes: dict[str, Any] = Field(default_factory=dict)


class InfrastructureAssetPatchRequest(BaseModel):
    """Update an existing infrastructure asset or move an assumed tie-in point."""

    name: str | None = Field(default=None, min_length=2, max_length=160)
    voltage_kv: float | None = Field(default=None, ge=0.23, le=400.0)
    rating_kva: float | None = Field(default=None, ge=5.0, le=25000.0)
    provenance: str | None = Field(
        default=None,
        pattern="^(UTILITY_RECORD|FIELD_SURVEY|USER_ASSUMED|OSM)$",
    )
    source_note: str | None = Field(default=None, min_length=3, max_length=1000)
    lon: float | None = Field(default=None, ge=68.0, le=98.0)
    lat: float | None = Field(default=None, ge=6.0, le=38.0)
    geojson_geometry: dict[str, Any] | None = None


class InfrastructureAssetResponse(BaseModel):
    """Serialized existing electrical infrastructure asset."""

    id: str
    project_id: str
    asset_type: str
    name: str
    voltage_kv: float | None
    rating_kva: float | None
    provenance: str
    quality_tag: str
    dataset_id: str | None
    source_note: str
    attributes: dict[str, Any]
    geojson_geometry: dict[str, Any]
    updated_at: datetime


class InfrastructureListResponse(BaseModel):
    """List and GeoJSON FeatureCollection of existing infrastructure assets."""

    project_id: str
    has_existing_infra: bool
    items: list[InfrastructureAssetResponse]
    geojson: dict[str, Any]


class ClusterGapAnalysisResponse(BaseModel):
    """Serialized per-cluster terrain-weighted gap and obstacle analysis row."""

    cluster_id: str
    cluster_label: str
    cluster_name: str
    est_households: int
    effective_electrification_class: str
    nearest_asset_id: str | None
    nearest_asset_name: str | None
    nearest_asset_type: str | None
    nearest_asset_provenance: str | None
    d_straight_m: float | None
    d_terrain_m: float | None
    terrain_penalty_factor: float
    slope_mean_deg: float
    canopy_share: float
    water_crossings_count: int
    road_distance_m: float | None
    recommended_modality: str
    rationale: str
    corridor_geojson: dict[str, Any] | None


class ProjectGapAnalysisResponse(BaseModel):
    """Project-wide gap analysis summary and per-cluster matrix."""

    project_id: str
    has_existing_infra: bool
    infra_assets_count: int
    assumed_assets_count: int
    verified_assets_count: int
    mean_d_straight_m: float | None
    mean_d_terrain_m: float | None
    max_d_terrain_m: float | None
    grid_extension_candidates: int
    minigrid_candidates: int
    shs_candidates: int
    augmentation_candidates: int
    corridors_geojson: dict[str, Any]
    clusters: list[ClusterGapAnalysisResponse]


class ProjectSettingResponse(BaseModel):
    """Single parameter in the project's Assumptions Register (`project_settings`)."""

    id: str
    project_id: str
    key: str
    category: str
    label: str
    value: float
    default_value: float
    min_value: float
    max_value: float
    unit: str
    quality_tag: str
    citation: str
    is_user_edited: bool
    override_note: str | None
    updated_at: datetime


class ProjectSettingPatchItem(BaseModel):
    """Single parameter override in a PATCH /settings request."""

    key: str
    value: float
    override_note: str | None = None


class ProjectSettingsPatchRequest(BaseModel):
    """Batch update of one or more project engineering assumptions."""

    updates: list[ProjectSettingPatchItem] = Field(..., min_length=1)


class ProjectSettingsListResponse(BaseModel):
    """Complete project Assumptions Register with edit count."""

    project_id: str
    user_edited_count: int
    items: list[ProjectSettingResponse]


class CategoryDemandRowResponse(BaseModel):
    """Serialized consumer category demand row."""

    category: str
    label: str
    consumer_count: int
    connected_kw: float
    demand_factor: float
    max_demand_kw: float
    daily_hours: float
    energy_kwh_day: float
    annual_energy_mwh: float


class ClusterDemandResponse(BaseModel):
    """Serialized per-cluster 7-category and horizon demand forecast."""

    cluster_id: str
    cluster_label: str
    cluster_name: str
    est_households: int
    categories: list[CategoryDemandRowResponse]
    total_connected_kw: float
    non_coincident_peak_kw: float
    coincidence_factor: float
    power_factor_cos_phi: float
    peak_kw_base: float
    peak_kva_base: float
    energy_kwh_day_base: float
    annual_energy_mwh_base: float
    horizon_years: int
    annual_growth_rate: float
    growth_multiplier: float
    peak_kw_horizon: float
    peak_kva_horizon: float
    energy_kwh_day_horizon: float
    annual_energy_mwh_horizon: float


class ProjectDemandSummaryResponse(BaseModel):
    """Complete project-wide and per-cluster 7-category demand forecast."""

    project_id: str
    total_households: int
    total_connected_kw: float
    peak_kw_base: float
    peak_kva_base: float
    energy_kwh_day_base: float
    annual_energy_mwh_base: float
    horizon_years: int
    annual_growth_rate: float
    peak_kw_horizon: float
    peak_kva_horizon: float
    energy_kwh_day_horizon: float
    annual_energy_mwh_horizon: float
    category_totals: list[CategoryDemandRowResponse]
    clusters: list[ClusterDemandResponse]
