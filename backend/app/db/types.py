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

"""Dialect-aware SpatialGeometry column type supporting PostGIS and local SQLite WKB/WKT."""

from typing import Any

from geoalchemy2 import Geometry as PostGISGeometry
from shapely import wkb, wkt
from shapely.geometry.base import BaseGeometry
from sqlalchemy import Text
from sqlalchemy.engine import Dialect
from sqlalchemy.types import TypeDecorator


class SpatialGeometry(TypeDecorator[Any]):
    """Uses PostGIS Geometry on PostgreSQL and WKB-hex Text on SQLite for local execution."""

    impl = Text
    cache_ok = True

    def __init__(self, geometry_type: str = "GEOMETRY", srid: int = 4326) -> None:
        super().__init__()
        self.geometry_type = geometry_type
        self.srid = srid

    def load_dialect_impl(self, dialect: Dialect) -> Any:
        if dialect.name == "postgresql":
            return dialect.type_descriptor(
                PostGISGeometry(geometry_type=self.geometry_type, srid=self.srid)
            )
        return dialect.type_descriptor(Text())

    def process_bind_param(self, value: Any, dialect: Dialect) -> Any:
        if value is None:
            return None
        if dialect.name == "postgresql":
            if isinstance(value, BaseGeometry):
                return f"SRID={self.srid};{value.wkt}"
            return value
        if isinstance(value, BaseGeometry):
            return value.wkb_hex
        if isinstance(value, str):
            geom = wkt.loads(value.split(";")[-1]) if ";" in value else wkt.loads(value)
            return geom.wkb_hex
        return str(value)

    def process_result_value(self, value: Any, dialect: Dialect) -> Any:
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value
        if isinstance(value, str):
            return wkb.loads(bytes.fromhex(value))
        return value

