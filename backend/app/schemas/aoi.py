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

"""Pydantic v2 schemas for setting and inspecting a project's Area of Interest (AOI)."""

from typing import Any

from pydantic import BaseModel, Field


class SetAoiRequest(BaseModel):
    """Request payload for PUT /api/v1/projects/{project_id}/aoi."""

    mode: str = Field(
        ...,
        description="Selection mode: 'ADMIN_UNIT' or 'USER_DRAWN'",
    )
    lgd_code: str | None = Field(
        default=None,
        description="Required when mode == 'ADMIN_UNIT'",
    )
    geojson_geometry: dict[str, Any] | None = Field(
        default=None,
        description="GeoJSON Polygon/MultiPolygon/Feature when mode == 'USER_DRAWN'",
    )
    source_crs: str = Field(default="EPSG:4326", max_length=64)


class ProjectAoiResponse(BaseModel):
    """Detailed AOI response returned by PUT/POST/GET /api/v1/projects/{project_id}/aoi."""

    project_id: str
    boundary_source: str
    area_km2: float
    metric_epsg: int
    lgd_code: str | None
    census2011_code: str | None
    upload_filename: str | None
    original_crs: str | None
    warnings: list[str]
    geojson_geometry: dict[str, Any]

