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

"""Milestone M2 schema: project_layers, buildings, osm_features, and solar_resource.

Revision ID: 0003_m2_layers_buildings_osm_solar
Revises: 0002_m1_auth_projects_aoi
Create Date: 2026-11-06
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.db.types import SpatialGeometry

revision: str = "0003_m2_layers_buildings_osm_solar"
down_revision: str | None = "0002_m1_auth_projects_aoi"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "project_layers",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("dataset_id", sa.String(length=36), nullable=True),
        sa.Column("layer_key", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="PENDING"),
        sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("feature_count", sa.Integer(), nullable=True),
        sa.Column("file_path", sa.String(length=500), nullable=True),
        sa.Column("bbox", sa.JSON(), nullable=True),
        sa.Column("summary_metrics", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("cache_key", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_project_layers_project_id", "project_layers", ["project_id"], unique=False
    )
    op.create_index("ix_project_layers_layer_key", "project_layers", ["layer_key"], unique=False)

    op.create_table(
        "buildings",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("dataset_id", sa.String(length=36), nullable=True),
        sa.Column("source_feature_id", sa.String(length=120), nullable=True),
        sa.Column(
            "geom",
            SpatialGeometry(geometry_type="POLYGON", srid=4326),
            nullable=False,
        ),
        sa.Column(
            "centroid",
            SpatialGeometry(geometry_type="POINT", srid=4326),
            nullable=False,
        ),
        sa.Column("area_m2", sa.Float(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0.85"),
        sa.Column("size_class", sa.String(length=32), nullable=False, server_default="RESIDENTIAL"),
        sa.Column("cluster_run_id", sa.String(length=36), nullable=True),
        sa.Column("cluster_id", sa.String(length=36), nullable=True),
        sa.Column("is_user_added", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_excluded", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_buildings_project_id", "buildings", ["project_id"], unique=False)
    op.create_index("ix_buildings_cluster_run_id", "buildings", ["cluster_run_id"], unique=False)
    op.create_index("ix_buildings_cluster_id", "buildings", ["cluster_id"], unique=False)

    op.create_table(
        "osm_features",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column(
            "geom",
            SpatialGeometry(geometry_type="GEOMETRY", srid=4326),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_osm_features_project_id", "osm_features", ["project_id"], unique=False)
    op.create_index("ix_osm_features_category", "osm_features", ["category"], unique=False)

    op.create_table(
        "solar_resource",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lon", sa.Float(), nullable=False),
        sa.Column("monthly_ghi_kwh_m2_day", sa.JSON(), nullable=False),
        sa.Column("monthly_t2m_c", sa.JSON(), nullable=False),
        sa.Column("annual_mean_ghi_kwh_m2_day", sa.Float(), nullable=False),
        sa.Column("worst_month", sa.String(length=16), nullable=False),
        sa.Column("worst_ghi_kwh_m2_day", sa.Float(), nullable=False),
        sa.Column("optimal_tilt_deg", sa.Float(), nullable=False),
        sa.Column("source_dataset_id", sa.String(length=36), nullable=True),
        sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_dataset_id"], ["datasets.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id"),
    )


def downgrade() -> None:
    op.drop_table("solar_resource")
    op.drop_index("ix_osm_features_category", table_name="osm_features")
    op.drop_index("ix_osm_features_project_id", table_name="osm_features")
    op.drop_table("osm_features")
    op.drop_index("ix_buildings_cluster_id", table_name="buildings")
    op.drop_index("ix_buildings_cluster_run_id", table_name="buildings")
    op.drop_index("ix_buildings_project_id", table_name="buildings")
    op.drop_table("buildings")
    op.drop_index("ix_project_layers_layer_key", table_name="project_layers")
    op.drop_index("ix_project_layers_project_id", table_name="project_layers")
    op.drop_table("project_layers")

