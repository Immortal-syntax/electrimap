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

"""Pydantic v2 schemas for administrative units and Census 2011 village lookups."""

from typing import Any

from pydantic import BaseModel


class CensusInfoResponse(BaseModel):
    """Census 2011 demographic and amenity metadata linked to a village."""

    census2011_code: str
    name: str
    total_pop: int
    households: int
    st_pop: int
    sc_pop: int
    amenities: dict[str, Any]
    power_supply_2011: dict[str, Any]


class AdminUnitResponse(BaseModel):
    """Administrative unit record for cascading selection or search."""

    lgd_code: str
    level: str
    name: str
    parent_lgd_code: str | None
    census2011_code: str | None
    boundary_source: str
    has_polygon_geometry: bool
    centroid_lon: float | None
    centroid_lat: float | None
    census_info: CensusInfoResponse | None = None


class AdminBoundaryResponse(BaseModel):
    """Resolved boundary geometry and metadata for an administrative unit."""

    lgd_code: str
    name: str
    level: str
    census2011_code: str | None
    boundary_source: str
    area_km2: float
    metric_epsg: int
    warnings: list[str]
    geojson_geometry: dict[str, Any]
    census_info: CensusInfoResponse | None = None

