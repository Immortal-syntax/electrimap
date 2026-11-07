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

"""Milestone M4 schema: infrastructure_assets, project_settings, cluster_gap_analyses,
and project_demand_estimates.

Revision ID: 0005_m4_infra_assumptions_demand
Revises: 0004_m3_settlements_verification
Create Date: 2026-11-06
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.db.types import SpatialGeometry

revision: str = "0005_m4_infra_assumptions_demand"
down_revision: str | None = "0004_m3_settlements_verification"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "infrastructure_assets",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("asset_type", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("voltage_kv", sa.Float(), nullable=True),
        sa.Column("rating_kva", sa.Float(), nullable=True),
        sa.Column(
            "geom",
            SpatialGeometry(geometry_type="GEOMETRY", srid=4326),
            nullable=False,
        ),
        sa.Column("provenance", sa.String(length=32), nullable=False),
        sa.Column("quality_tag", sa.String(length=32), nullable=False),
        sa.Column("dataset_id", sa.String(length=36), nullable=True),
        sa.Column("source_note", sa.Text(), nullable=False),
        sa.Column("attributes", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_infrastructure_assets_project_id",
        "infrastructure_assets",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_infrastructure_assets_asset_type",
        "infrastructure_assets",
        ["asset_type"],
        unique=False,
    )

    op.create_table(
        "project_settings",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("key", sa.String(length=80), nullable=False),
        sa.Column("category", sa.String(length=48), nullable=False),
        sa.Column("label", sa.String(length=160), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("default_value", sa.Float(), nullable=False),
        sa.Column("min_value", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("max_value", sa.Float(), nullable=False, server_default="100000.0"),
        sa.Column("unit", sa.String(length=32), nullable=False),
        sa.Column("quality_tag", sa.String(length=32), nullable=False),
        sa.Column("citation", sa.String(length=300), nullable=False),
        sa.Column(
            "is_user_edited",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("override_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_project_settings_project_id",
        "project_settings",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_settings_key",
        "project_settings",
        ["key"],
        unique=False,
    )

    op.create_table(
        "cluster_gap_analyses",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("cluster_id", sa.String(length=36), nullable=False),
        sa.Column("nearest_asset_id", sa.String(length=36), nullable=True),
        sa.Column("nearest_asset_name", sa.String(length=160), nullable=True),
        sa.Column("nearest_asset_type", sa.String(length=32), nullable=True),
        sa.Column("nearest_asset_provenance", sa.String(length=32), nullable=True),
        sa.Column("d_straight_m", sa.Float(), nullable=True),
        sa.Column("d_terrain_m", sa.Float(), nullable=True),
        sa.Column(
            "terrain_penalty_factor",
            sa.Float(),
            nullable=False,
            server_default="1.0",
        ),
        sa.Column("slope_mean_deg", sa.Float(), nullable=False),
        sa.Column("canopy_share", sa.Float(), nullable=False),
        sa.Column(
            "water_crossings_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("road_distance_m", sa.Float(), nullable=True),
        sa.Column("recommended_modality", sa.String(length=40), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column(
            "corridor_geom",
            SpatialGeometry(geometry_type="LINESTRING", srid=4326),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["cluster_id"], ["clusters.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["nearest_asset_id"],
            ["infrastructure_assets.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_cluster_gap_analyses_project_id",
        "cluster_gap_analyses",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_cluster_gap_analyses_cluster_id",
        "cluster_gap_analyses",
        ["cluster_id"],
        unique=False,
    )

    op.create_table(
        "project_demand_estimates",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("cluster_id", sa.String(length=36), nullable=False),
        sa.Column("cluster_label", sa.String(length=32), nullable=False),
        sa.Column("est_households", sa.Integer(), nullable=False),
        sa.Column("total_connected_kw", sa.Float(), nullable=False),
        sa.Column("non_coincident_peak_kw", sa.Float(), nullable=False),
        sa.Column("peak_kw_base", sa.Float(), nullable=False),
        sa.Column("peak_kva_base", sa.Float(), nullable=False),
        sa.Column("energy_kwh_day_base", sa.Float(), nullable=False),
        sa.Column("annual_energy_mwh_base", sa.Float(), nullable=False),
        sa.Column("horizon_years", sa.Integer(), nullable=False),
        sa.Column("annual_growth_rate", sa.Float(), nullable=False),
        sa.Column("peak_kw_horizon", sa.Float(), nullable=False),
        sa.Column("peak_kva_horizon", sa.Float(), nullable=False),
        sa.Column("energy_kwh_day_horizon", sa.Float(), nullable=False),
        sa.Column("annual_energy_mwh_horizon", sa.Float(), nullable=False),
        sa.Column("category_breakdown", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["cluster_id"], ["clusters.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_project_demand_estimates_project_id",
        "project_demand_estimates",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_demand_estimates_cluster_id",
        "project_demand_estimates",
        ["cluster_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_project_demand_estimates_cluster_id",
        table_name="project_demand_estimates",
    )
    op.drop_index(
        "ix_project_demand_estimates_project_id",
        table_name="project_demand_estimates",
    )
    op.drop_table("project_demand_estimates")

    op.drop_index(
        "ix_cluster_gap_analyses_cluster_id",
        table_name="cluster_gap_analyses",
    )
    op.drop_index(
        "ix_cluster_gap_analyses_project_id",
        table_name="cluster_gap_analyses",
    )
    op.drop_table("cluster_gap_analyses")

    op.drop_index("ix_project_settings_key", table_name="project_settings")
    op.drop_index("ix_project_settings_project_id", table_name="project_settings")
    op.drop_table("project_settings")

    op.drop_index(
        "ix_infrastructure_assets_asset_type",
        table_name="infrastructure_assets",
    )
    op.drop_index(
        "ix_infrastructure_assets_project_id",
        table_name="infrastructure_assets",
    )
    op.drop_table("infrastructure_assets")

