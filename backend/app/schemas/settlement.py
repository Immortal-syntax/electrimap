"""Pydantic v2 schemas for Milestone M3: Habitation Clustering, Proxy Classification,
Census Reconciliation, and Append-Only Verification Audit Ledger.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.job import JobResponse


class ClusteringParamsRequest(BaseModel):
    """Configurable parameters for UTM DBSCAN clustering and 4-tier proxy rules."""

    eps_m: float = Field(default=150.0, ge=25.0, le=1000.0)
    min_samples: int = Field(default=5, ge=2, le=50)
    household_alpha: float = Field(default=0.90, ge=0.40, le=2.00)
    nl_electrified_min: float = Field(default=0.75, ge=0.30, le=0.99)
    nl_unserved_max: float = Field(default=0.20, ge=0.01, le=0.50)


class ClusterResponse(BaseModel):
    """Serialized habitation cluster with two-axis classification and zonal metrics."""

    id: str
    cluster_run_id: str
    project_id: str
    label: str
    name: str
    is_isolated_group: bool
    n_detected: int
    n_residential: int
    n_non_residential: int
    est_households: int
    census_hh_ref: int | None
    proxy_class: str
    proxy_confidence: str
    verification_state: str
    verified_class: str | None
    d_infra_m: float | None
    d_road_m: float | None
    slope_mean_deg: float
    canopy_share: float
    evidence: dict[str, Any]
    centroid_lon: float
    centroid_lat: float
    geojson_geometry: dict[str, Any]
    updated_at: datetime


class CensusReconciliationResponse(BaseModel):
    """Comparison of satellite-estimated households against Census 2011 baseline."""

    census2011_code: str | None
    village_name: str | None
    census_2011_households: int | None
    projected_base_year_households: int | None
    satellite_detected_buildings: int
    satellite_residential_buildings: int
    satellite_estimated_households: int
    delta_households: int | None
    delta_pct: float | None
    divergence_exceeds_30pct: bool
    reconciliation_note: str


class ClusterListResponse(BaseModel):
    """Complete settlement assessment state for a project."""

    project_id: str
    cluster_run_id: str | None
    params: dict[str, Any]
    items: list[ClusterResponse]
    geojson: dict[str, Any]
    census_reconciliation: CensusReconciliationResponse
    verification_coverage_pct: float


class ClusteringRunResponse(BaseModel):
    """Result of triggering a habitation clustering run."""

    job: JobResponse
    settlements: ClusterListResponse


class BuildingPatchRequest(BaseModel):
    """Toggle exclusion or reclassify a building footprint."""

    is_excluded: bool | None = None
    size_class: str | None = None


class BuildingCreateRequest(BaseModel):
    """Manually add a residential or institutional building footprint."""

    lon: float = Field(..., ge=68.0, le=98.0)
    lat: float = Field(..., ge=6.0, le=38.0)
    area_m2: float = Field(default=45.0, ge=8.0, le=2500.0)
    size_class: str = Field(default="RESIDENTIAL")


class VerificationCreateRequest(BaseModel):
    """Create an immutable verification entry for a habitation cluster."""

    target_id: str
    verification_state: str = Field(
        default="FIELD_VERIFIED",
        pattern="^(FIELD_VERIFIED|UTILITY_VERIFIED)$",
    )
    verified_class: str = Field(
        ...,
        pattern="^(LIKELY_ELECTRIFIED|POTENTIALLY_UNDERSERVED|POTENTIALLY_UNSERVED|ELECTRIFIED|UNDERSERVED|UNSERVED)$",
    )
    verified_households: int | None = Field(default=None, ge=0, le=50000)
    evidence_type: str = Field(
        default="FIELD_SURVEY",
        pattern="^(FIELD_SURVEY|UTILITY_LEDGER|GRAM_SABHA_RESOLUTION|GEO_TAGGED_PHOTO)$",
    )
    verifier_name: str = Field(..., min_length=2, max_length=160)
    observed_on: str = Field(..., min_length=8, max_length=32)
    note: str = Field(..., min_length=3, max_length=2000)


class VerificationReversalRequest(BaseModel):
    """Create an append-only reversal entry for a prior verification record."""

    verifier_name: str = Field(..., min_length=2, max_length=160)
    note: str = Field(..., min_length=3, max_length=2000)


class VerificationRecordResponse(BaseModel):
    """Serialized append-only verification ledger entry."""

    id: str
    project_id: str
    target_type: str
    target_id: str
    cluster_label: str | None = None
    attribute: str
    previous_value: dict[str, Any]
    new_value: dict[str, Any]
    evidence_type: str
    verifier_name: str
    observed_on: str
    note: str
    import_batch_id: str | None
    reverses_id: str | None
    created_by: str | None
    created_at: datetime


class VerificationImportResponse(BaseModel):
    """Summary of a batch CSV field verification import."""

    id: str
    project_id: str
    filename: str
    row_count: int
    matched: int
    unmatched: int
    report: dict[str, Any]
    created_at: datetime


class VerificationLedgerResponse(BaseModel):
    """Complete verification audit ledger and coverage metrics for a project."""

    project_id: str
    total_clusters: int
    verified_clusters: int
    total_households: int
    verified_households: int
    verification_coverage_pct: float
    records: list[VerificationRecordResponse]
    imports: list[VerificationImportResponse]
