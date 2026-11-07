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

"""Milestone M3 schema: cluster_runs, clusters, verification_records, verification_imports.

Revision ID: 0004_m3_settlements_verification
Revises: 0003_m2_layers_buildings_osm_solar
Create Date: 2026-11-06
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.db.types import SpatialGeometry

revision: str = "0004_m3_settlements_verification"
down_revision: str | None = "0003_m2_layers_buildings_osm_solar"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "cluster_runs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("params", sa.JSON(), nullable=False),
        sa.Column("is_current", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cluster_runs_project_id", "cluster_runs", ["project_id"], unique=False)
    op.create_index("ix_cluster_runs_is_current", "cluster_runs", ["is_current"], unique=False)

    op.create_table(
        "clusters",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("cluster_run_id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("label", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
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
        sa.Column("is_isolated_group", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("n_detected", sa.Integer(), nullable=False),
        sa.Column("n_residential", sa.Integer(), nullable=False),
        sa.Column("n_non_residential", sa.Integer(), nullable=False),
        sa.Column("est_households", sa.Integer(), nullable=False),
        sa.Column("census_hh_ref", sa.Integer(), nullable=True),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("proxy_class", sa.String(length=40), nullable=False),
        sa.Column("proxy_confidence", sa.String(length=16), nullable=False),
        sa.Column(
            "verification_state",
            sa.String(length=24),
            nullable=False,
            server_default="UNVERIFIED",
        ),
        sa.Column("verified_class", sa.String(length=40), nullable=True),
        sa.Column("d_infra_m", sa.Float(), nullable=True),
        sa.Column("d_road_m", sa.Float(), nullable=True),
        sa.Column("slope_mean_deg", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("canopy_share", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["cluster_run_id"], ["cluster_runs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_clusters_cluster_run_id", "clusters", ["cluster_run_id"], unique=False)
    op.create_index("ix_clusters_project_id", "clusters", ["project_id"], unique=False)

    op.create_table(
        "verification_records",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("target_type", sa.String(length=32), nullable=False),
        sa.Column("target_id", sa.String(length=36), nullable=False),
        sa.Column("attribute", sa.String(length=64), nullable=False),
        sa.Column("previous_value", sa.JSON(), nullable=False),
        sa.Column("new_value", sa.JSON(), nullable=False),
        sa.Column("evidence_type", sa.String(length=40), nullable=False),
        sa.Column("verifier_name", sa.String(length=160), nullable=False),
        sa.Column("observed_on", sa.String(length=32), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column(
            "geom",
            SpatialGeometry(geometry_type="POINT", srid=4326),
            nullable=True,
        ),
        sa.Column("import_batch_id", sa.String(length=36), nullable=True),
        sa.Column("reverses_id", sa.String(length=36), nullable=True),
        sa.Column("created_by", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_verification_records_project_id",
        "verification_records",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_verification_records_target_id",
        "verification_records",
        ["target_id"],
        unique=False,
    )
    op.create_index(
        "ix_verification_records_import_batch_id",
        "verification_records",
        ["import_batch_id"],
        unique=False,
    )
    op.create_index(
        "ix_verification_records_reverses_id",
        "verification_records",
        ["reverses_id"],
        unique=False,
    )

    op.create_table(
        "verification_imports",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("matched", sa.Integer(), nullable=False),
        sa.Column("unmatched", sa.Integer(), nullable=False),
        sa.Column("report", sa.JSON(), nullable=False),
        sa.Column("created_by", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_verification_imports_project_id",
        "verification_imports",
        ["project_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_verification_imports_project_id", table_name="verification_imports")
    op.drop_table("verification_imports")
    op.drop_index("ix_verification_records_reverses_id", table_name="verification_records")
    op.drop_index("ix_verification_records_import_batch_id", table_name="verification_records")
    op.drop_index("ix_verification_records_target_id", table_name="verification_records")
    op.drop_index("ix_verification_records_project_id", table_name="verification_records")
    op.drop_table("verification_records")
    op.drop_index("ix_clusters_project_id", table_name="clusters")
    op.drop_index("ix_clusters_cluster_run_id", table_name="clusters")
    op.drop_table("clusters")
    op.drop_index("ix_cluster_runs_is_current", table_name="cluster_runs")
    op.drop_index("ix_cluster_runs_project_id", table_name="cluster_runs")
    op.drop_table("cluster_runs")

