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

"""Milestone M7 schema: project_exports table with SHA-256 hashes and preflight metadata.

Revision ID: 0008_m7_exports_and_preflight
Revises: 0007_m6_costing_boq_scenarios
Create Date: 2026-11-07
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008_m7_exports_and_preflight"
down_revision: str | None = "0007_m6_costing_boq_scenarios"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "project_exports",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("scenario_id", sa.String(length=36), nullable=False),
        sa.Column("scenario_key", sa.String(length=48), nullable=False),
        sa.Column("export_kind", sa.String(length=32), nullable=False),
        sa.Column("filename", sa.String(length=160), nullable=False),
        sa.Column("mime_type", sa.String(length=96), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("file_sha256", sa.String(length=64), nullable=False),
        sa.Column("snapshot_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "preflight_passed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "preflight_warnings_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("created_by", sa.String(length=36), nullable=True),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_project_exports_project_id",
        "project_exports",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_exports_scenario_id",
        "project_exports",
        ["scenario_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_exports_export_kind",
        "project_exports",
        ["export_kind"],
        unique=False,
    )
    op.create_index(
        "ix_project_exports_file_sha256",
        "project_exports",
        ["file_sha256"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_project_exports_file_sha256", table_name="project_exports")
    op.drop_index("ix_project_exports_export_kind", table_name="project_exports")
    op.drop_index("ix_project_exports_scenario_id", table_name="project_exports")
    op.drop_index("ix_project_exports_project_id", table_name="project_exports")
    op.drop_table("project_exports")

