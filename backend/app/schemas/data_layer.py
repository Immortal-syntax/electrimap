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

