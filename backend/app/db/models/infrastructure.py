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

"""SQLAlchemy ORM models for Milestone M4:
- `InfrastructureAsset` (`infrastructure_assets`)
- `ProjectSetting` (`project_settings` — Project Assumptions Register)
- `ClusterGapAnalysis` (`cluster_gap_analyses`)
- `ProjectDemandEstimate` (`project_demand_estimates`)
"""

import uuid
from typing import Any

from sqlalchemy import JSON, Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.db.types import SpatialGeometry


class InfrastructureAsset(Base, TimestampMixin):
    """Existing electrical infrastructure asset or explicit planner tie-in placement.

    Core Principle #4: Assets come only from uploaded GIS files (`UTILITY_RECORD`,
    `FIELD_SURVEY`) or explicit planner tie-in placements (`USER_ASSUMED`).
    """

    __tablename__ = "infrastructure_assets"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    asset_type: Mapped[str] = mapped_column(
        String(32), index=True, nullable=False
    )  # HT_LINE, LT_LINE, POLE, DT, SUBSTATION, TIE_IN
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    voltage_kv: Mapped[float | None] = mapped_column(Float, nullable=True)
    rating_kva: Mapped[float | None] = mapped_column(Float, nullable=True)
    geom: Mapped[Any] = mapped_column(
        SpatialGeometry(geometry_type="GEOMETRY", srid=4326), nullable=False
    )
    provenance: Mapped[str] = mapped_column(
        String(32), nullable=False
    )  # UTILITY_RECORD, FIELD_SURVEY, USER_ASSUMED, OSM
    quality_tag: Mapped[str] = mapped_column(
        String(32), nullable=False
    )  # VERIFIED, ESTIMATED, ASSUMED, USER_ENTERED
    dataset_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("datasets.id", ondelete="SET NULL"), nullable=True
    )
    source_note: Mapped[str] = mapped_column(Text, nullable=False)
    attributes: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)


class ProjectSetting(Base, TimestampMixin):
    """Auditable project-level engineering assumption entry (`project_settings`)."""

    __tablename__ = "project_settings"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    key: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    category: Mapped[str] = mapped_column(String(48), nullable=False)
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    default_value: Mapped[float] = mapped_column(Float, nullable=False)
    min_value: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    max_value: Mapped[float] = mapped_column(Float, default=100000.0, nullable=False)
    unit: Mapped[str] = mapped_column(String(32), nullable=False)
    quality_tag: Mapped[str] = mapped_column(
        String(32), default="ESTIMATED", nullable=False
    )  # ESTIMATED (default) or USER_ENTERED (when overridden)
    citation: Mapped[str] = mapped_column(String(300), nullable=False)
    is_user_edited: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    override_note: Mapped[str | None] = mapped_column(Text, nullable=True)


class ClusterGapAnalysis(Base, TimestampMixin):
    """Persisted terrain-weighted infrastructure gap and obstacle analysis row per cluster."""

    __tablename__ = "cluster_gap_analyses"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    cluster_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("clusters.id", ondelete="CASCADE"), index=True, nullable=False
    )
    nearest_asset_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("infrastructure_assets.id", ondelete="SET NULL"),
        nullable=True,
    )
    nearest_asset_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    nearest_asset_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    nearest_asset_provenance: Mapped[str | None] = mapped_column(String(32), nullable=True)
    d_straight_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    d_terrain_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    terrain_penalty_factor: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    slope_mean_deg: Mapped[float] = mapped_column(Float, nullable=False)
    canopy_share: Mapped[float] = mapped_column(Float, nullable=False)
    water_crossings_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    road_distance_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    recommended_modality: Mapped[str] = mapped_column(String(40), nullable=False)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    corridor_geom: Mapped[Any | None] = mapped_column(
        SpatialGeometry(geometry_type="LINESTRING", srid=4326), nullable=True
    )


class ProjectDemandEstimate(Base, TimestampMixin):
    """Persisted per-cluster 7-category and coincident demand forecast."""

    __tablename__ = "project_demand_estimates"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    cluster_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("clusters.id", ondelete="CASCADE"), index=True, nullable=False
    )
    cluster_label: Mapped[str] = mapped_column(String(32), nullable=False)
    est_households: Mapped[int] = mapped_column(Integer, nullable=False)
    total_connected_kw: Mapped[float] = mapped_column(Float, nullable=False)
    non_coincident_peak_kw: Mapped[float] = mapped_column(Float, nullable=False)
    peak_kw_base: Mapped[float] = mapped_column(Float, nullable=False)
    peak_kva_base: Mapped[float] = mapped_column(Float, nullable=False)
    energy_kwh_day_base: Mapped[float] = mapped_column(Float, nullable=False)
    annual_energy_mwh_base: Mapped[float] = mapped_column(Float, nullable=False)
    horizon_years: Mapped[int] = mapped_column(Integer, nullable=False)
    annual_growth_rate: Mapped[float] = mapped_column(Float, nullable=False)
    peak_kw_horizon: Mapped[float] = mapped_column(Float, nullable=False)
    peak_kva_horizon: Mapped[float] = mapped_column(Float, nullable=False)
    energy_kwh_day_horizon: Mapped[float] = mapped_column(Float, nullable=False)
    annual_energy_mwh_horizon: Mapped[float] = mapped_column(Float, nullable=False)
    category_breakdown: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, default=list, nullable=False
    )

