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

"""SQLAlchemy ORM models for Milestone M5:
- `PlanningScenario` (`planning_scenarios`)
- `ClusterEngineeringLayout` (`cluster_engineering_layouts`)
"""

import uuid
from typing import Any

from sqlalchemy import JSON, Boolean, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.db.types import SpatialGeometry


class PlanningScenario(Base, TimestampMixin):
    """Project-level electrification scenario with aggregated engineering and layout results."""

    __tablename__ = "planning_scenarios"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    scenario_key: Mapped[str] = mapped_column(
        String(48), index=True, nullable=False
    )  # HYBRID_OPTIMAL, GRID_EXTENSION_ONLY, MINIGRID_PRIORITY, SHS_DISPERSED
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    requires_tie_in_warning: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    total_ht_length_m: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_lt_length_m: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_dt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_dt_capacity_kva: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_ht_poles: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_lt_poles: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    max_ht_vdrop_pct: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    max_lt_vdrop_pct: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    vdrop_compliance_ok: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    total_loss_mwh_yr: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    total_solar_kwp: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_bess_kwh: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_shs_kits: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    summary_payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)


class ClusterEngineeringLayout(Base, TimestampMixin):
    """Per-cluster deterministic network routing, voltage drop, loss, and off-grid sizing record."""

    __tablename__ = "cluster_engineering_layouts"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    scenario_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("planning_scenarios.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    cluster_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("clusters.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    cluster_label: Mapped[str] = mapped_column(String(32), nullable=False)
    cluster_name: Mapped[str] = mapped_column(String(160), nullable=False)
    est_households: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    modality: Mapped[str] = mapped_column(
        String(48), nullable=False
    )  # GRID_EXTENSION, SOLAR_MINIGRID, STANDALONE_SHS, GRID_AUGMENTATION
    is_manual_override: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requires_tie_in: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    peak_kw_horizon: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    peak_kva_horizon: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    energy_kwh_day_horizon: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    annual_energy_mwh_horizon: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    dt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_dt_rating_kva: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    max_dt_loading_pct: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    ht_length_m: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    ht_poles_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    lt_3ph_length_m: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    lt_1ph_length_m: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    lt_total_length_m: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    max_lt_branch_m: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    lt_poles_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    ht_drop_v: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    ht_drop_pct: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    lt_drop_v: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    lt_drop_pct: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    overall_vdrop_compliant: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    total_loss_mwh_yr: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    technical_loss_pct: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    solar_pv_kwp: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    bess_capacity_kwh: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    inverter_kva: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    shs_kits_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    ht_line_geom: Mapped[Any | None] = mapped_column(
        SpatialGeometry(geometry_type="GEOMETRY", srid=4326), nullable=True
    )
    lt_lines_geom: Mapped[Any | None] = mapped_column(
        SpatialGeometry(geometry_type="GEOMETRY", srid=4326), nullable=True
    )
    dt_points_geom: Mapped[Any | None] = mapped_column(
        SpatialGeometry(geometry_type="GEOMETRY", srid=4326), nullable=True
    )
