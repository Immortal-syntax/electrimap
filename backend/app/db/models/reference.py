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

"""Reference tables: Dataset provenance, EngineeringConstants, AdminUnits, CensusVillages."""

import uuid
from typing import Any

from sqlalchemy import JSON, Boolean, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.db.types import SpatialGeometry


class Dataset(Base, TimestampMixin):
    """Provenance registry record for an external or reference dataset (F-16)."""

    __tablename__ = "datasets"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    key: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    provider: Mapped[str] = mapped_column(String(200), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    licence: Mapped[str] = mapped_column(String(120), nullable=False)
    licence_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    attribution_text: Mapped[str] = mapped_column(Text, nullable=False)
    spatial_resolution: Mapped[str] = mapped_column(String(80), nullable=False)
    temporal_coverage: Mapped[str] = mapped_column(String(80), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    is_non_commercial: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class EngineeringConstant(Base, TimestampMixin):
    """Editable reference engineering constant with explicit citation and verification status."""

    __tablename__ = "engineering_constants"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(40), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    citation: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), default="PROVISIONAL", nullable=False
    )  # PROVISIONAL or SOURCE_VERIFIED
    updated_by: Mapped[str | None] = mapped_column(String(120), nullable=True)


class AdminUnit(Base, TimestampMixin):
    """Administrative hierarchy lookup (State -> District -> Block -> GP -> Village)."""

    __tablename__ = "admin_units"

    lgd_code: Mapped[str] = mapped_column(String(32), primary_key=True)
    level: Mapped[str] = mapped_column(
        String(24), index=True, nullable=False
    )  # STATE, DISTRICT, BLOCK, GP, VILLAGE
    name: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    parent_lgd_code: Mapped[str | None] = mapped_column(String(32), index=True, nullable=True)
    census2011_code: Mapped[str | None] = mapped_column(String(32), index=True, nullable=True)
    geom: Mapped[Any | None] = mapped_column(
        SpatialGeometry(geometry_type="MULTIPOLYGON", srid=4326), nullable=True
    )
    boundary_source: Mapped[str] = mapped_column(
        String(32), default="HARMONISED", nullable=False
    )  # HARMONISED or APPROXIMATE_BUFFER
    centroid_lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    centroid_lat: Mapped[float | None] = mapped_column(Float, nullable=True)


class CensusVillage(Base, TimestampMixin):
    """Census of India 2011 District Census Handbook (PCA & Village Directory) record."""

    __tablename__ = "census_villages"

    census2011_code: Mapped[str] = mapped_column(String(32), primary_key=True)
    state_code: Mapped[str] = mapped_column(String(16), nullable=False)
    district_code: Mapped[str] = mapped_column(String(16), nullable=False)
    subdistrict_code: Mapped[str] = mapped_column(String(16), nullable=False)
    name: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    total_pop: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    households: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    st_pop: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sc_pop: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    amenities: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    power_supply_2011: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
