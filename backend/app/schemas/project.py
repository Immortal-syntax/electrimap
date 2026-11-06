"""Pydantic v2 schemas for Project CRUD and optimistic concurrency."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ProjectCreateRequest(BaseModel):
    """Request payload for creating a new electrification project."""

    name: str = Field(..., min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    scheme: str = Field(default="DA-JGUA / RDSS", max_length=64)
    target_state: str | None = Field(default="Odisha", max_length=100)
    target_district: str | None = Field(default="Koraput", max_length=100)
    target_block: str | None = Field(default="Nandapur", max_length=100)
    village_names: str | None = Field(default=None, max_length=300)
    base_year: int = Field(default=2026, ge=2020, le=2035)
    horizon_years: int = Field(default=10, ge=1, le=30)
    discount_rate: float = Field(default=0.08, ge=0.01, le=0.25)
    load_tier: str = Field(default="TIER_3_STANDARD", max_length=32)


class ProjectUpdateRequest(BaseModel):
    """Request payload for updating a project with optimistic concurrency check."""

    version: int = Field(..., ge=1, description="Current version required for optimistic lock")
    name: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    scheme: str | None = Field(default=None, max_length=64)
    target_state: str | None = Field(default=None, max_length=100)
    target_district: str | None = Field(default=None, max_length=100)
    target_block: str | None = Field(default=None, max_length=100)
    village_names: str | None = Field(default=None, max_length=300)
    base_year: int | None = Field(default=None, ge=2020, le=2035)
    horizon_years: int | None = Field(default=None, ge=1, le=30)
    discount_rate: float | None = Field(default=None, ge=0.01, le=0.25)
    load_tier: str | None = Field(default=None, max_length=32)


class ProjectAoiSummary(BaseModel):
    """Embedded AOI summary returned with a project record."""

    boundary_source: str
    area_km2: float
    lgd_code: str | None
    census2011_code: str | None
    upload_filename: str | None
    original_crs: str | None
    warnings: list[str]
    geojson_geometry: dict[str, Any]


class ProjectResponse(BaseModel):
    """Full project response payload."""

    id: str
    owner_id: str
    name: str
    description: str | None
    scheme: str
    target_state: str | None
    target_district: str | None
    target_block: str | None
    village_names: str | None
    base_year: int
    horizon_years: int
    discount_rate: float
    load_tier: str
    metric_epsg: int
    status: str
    version: int
    created_at: datetime
    updated_at: datetime
    aoi: ProjectAoiSummary | None = None

