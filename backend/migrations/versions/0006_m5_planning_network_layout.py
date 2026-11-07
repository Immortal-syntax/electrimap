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

"""Milestone M5 schema: planning_scenarios and cluster_engineering_layouts.

Revision ID: 0006_m5_planning_network_layout
Revises: 0005_m4_infra_assumptions_demand
Create Date: 2026-11-06
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.db.types import SpatialGeometry

revision: str = "0006_m5_planning_network_layout"
down_revision: str | None = "0005_m4_infra_assumptions_demand"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "planning_scenarios",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("scenario_key", sa.String(length=48), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "requires_tie_in_warning",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("total_ht_length_m", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("total_lt_length_m", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("total_dt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_dt_capacity_kva", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("total_ht_poles", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_lt_poles", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_ht_vdrop_pct", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("max_lt_vdrop_pct", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column(
            "vdrop_compliance_ok",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column("total_loss_mwh_yr", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("total_solar_kwp", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("total_bess_kwh", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("total_shs_kits", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("summary_payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_planning_scenarios_project_id",
        "planning_scenarios",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_planning_scenarios_scenario_key",
        "planning_scenarios",
        ["scenario_key"],
        unique=False,
    )

    op.create_table(
        "cluster_engineering_layouts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("scenario_id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("cluster_id", sa.String(length=36), nullable=False),
        sa.Column("cluster_label", sa.String(length=32), nullable=False),
        sa.Column("cluster_name", sa.String(length=160), nullable=False),
        sa.Column("est_households", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("modality", sa.String(length=48), nullable=False),
        sa.Column(
            "is_manual_override",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "requires_tie_in",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("peak_kw_horizon", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("peak_kva_horizon", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("energy_kwh_day_horizon", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("annual_energy_mwh_horizon", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("dt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_dt_rating_kva", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("max_dt_loading_pct", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("ht_length_m", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("ht_poles_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("lt_3ph_length_m", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("lt_1ph_length_m", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("lt_total_length_m", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("max_lt_branch_m", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("lt_poles_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ht_drop_v", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("ht_drop_pct", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("lt_drop_v", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("lt_drop_pct", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column(
            "overall_vdrop_compliant",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column("total_loss_mwh_yr", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("technical_loss_pct", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("solar_pv_kwp", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("bess_capacity_kwh", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("inverter_kva", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("shs_kits_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column(
            "ht_line_geom",
            SpatialGeometry(geometry_type="GEOMETRY", srid=4326),
            nullable=True,
        ),
        sa.Column(
            "lt_lines_geom",
            SpatialGeometry(geometry_type="GEOMETRY", srid=4326),
            nullable=True,
        ),
        sa.Column(
            "dt_points_geom",
            SpatialGeometry(geometry_type="GEOMETRY", srid=4326),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["cluster_id"], ["clusters.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["scenario_id"],
            ["planning_scenarios.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_cluster_engineering_layouts_scenario_id",
        "cluster_engineering_layouts",
        ["scenario_id"],
        unique=False,
    )
    op.create_index(
        "ix_cluster_engineering_layouts_project_id",
        "cluster_engineering_layouts",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_cluster_engineering_layouts_cluster_id",
        "cluster_engineering_layouts",
        ["cluster_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_cluster_engineering_layouts_cluster_id",
        table_name="cluster_engineering_layouts",
    )
    op.drop_index(
        "ix_cluster_engineering_layouts_project_id",
        table_name="cluster_engineering_layouts",
    )
    op.drop_index(
        "ix_cluster_engineering_layouts_scenario_id",
        table_name="cluster_engineering_layouts",
    )
    op.drop_table("cluster_engineering_layouts")

    op.drop_index(
        "ix_planning_scenarios_scenario_key",
        table_name="planning_scenarios",
    )
    op.drop_index(
        "ix_planning_scenarios_project_id",
        table_name="planning_scenarios",
    )
    op.drop_table("planning_scenarios")

