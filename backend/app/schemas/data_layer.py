"""Pydantic v2 schemas for Dataset provenance and ProjectLayer inspection."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class DatasetProvenanceResponse(BaseModel):
    """Provenance metadata for an open or user-uploaded dataset (F-16)."""

    id: str
    key: str
    name: str
    provider: str
    url: str
    licence: str
    licence_url: str | None
    attribution_text: str
    spatial_resolution: str
    temporal_coverage: str
    version: str
    is_non_commercial: bool
    notes: str | None


class ProjectLayerResponse(BaseModel):
    """Per-project layer status, feature count, bounding box, and provenance."""

    id: str
    project_id: str
    layer_key: str
    status: str
    retrieved_at: datetime | None
    feature_count: int | None
    bbox: list[float] | None
    summary_metrics: dict[str, Any]
    error_message: str | None
    cache_key: str | None
    dataset: DatasetProvenanceResponse | None = None


class RasterOverlayMetadataResponse(BaseModel):
    """Bounding box and image URL for a colorized raster overlay."""

    layer_key: str
    bbox: list[float]
    image_url: str
    summary_metrics: dict[str, Any]

