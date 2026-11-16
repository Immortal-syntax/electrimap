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

"""Milestone M6 schema: project_rate_items and scenario_boq_lines.

Revision ID: 0007_m6_costing_boq_scenarios
Revises: 0006_m5_planning_network_layout
Create Date: 2026-11-07
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_m6_costing_boq_scenarios"
down_revision: str | None = "0006_m5_planning_network_layout"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "project_rate_items",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column(
            "template_key",
            sa.String(length=80),
            nullable=False,
            server_default="ODISHA_OPTCL_TPSODL_REC_2025",
        ),
        sa.Column(
            "template_name",
            sa.String(length=200),
            nullable=False,
            server_default="Odisha OPTCL / TPSODL & MNRE Reference Schedule of Rates (FY 2024-25)",
        ),
        sa.Column("item_code", sa.String(length=48), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=48), nullable=False),
        sa.Column("unit", sa.String(length=32), nullable=False),
        sa.Column("rate_inr", sa.Float(), nullable=True),
        sa.Column(
            "source_type",
            sa.String(length=48),
            nullable=False,
            server_default="REFERENCE_PUBLIC_DOCUMENT",
        ),
        sa.Column("citation", sa.Text(), nullable=False),
        sa.Column("source_year", sa.Integer(), nullable=False, server_default="2025"),
        sa.Column(
            "is_user_edited",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_project_rate_items_project_id",
        "project_rate_items",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_rate_items_item_code",
        "project_rate_items",
        ["item_code"],
        unique=False,
    )

    op.create_table(
        "scenario_boq_lines",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("scenario_id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("cluster_id", sa.String(length=36), nullable=True),
        sa.Column("cluster_label", sa.String(length=32), nullable=True),
        sa.Column("item_code", sa.String(length=48), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=48), nullable=False),
        sa.Column("unit", sa.String(length=32), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("quantity_basis", sa.Text(), nullable=False),
        sa.Column("rate_inr", sa.Float(), nullable=True),
        sa.Column("rate_source_type", sa.String(length=48), nullable=False),
        sa.Column("citation", sa.Text(), nullable=False),
        sa.Column(
            "is_unset",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("amount_inr", sa.Float(), nullable=False, server_default="0.0"),
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
        "ix_scenario_boq_lines_scenario_id",
        "scenario_boq_lines",
        ["scenario_id"],
        unique=False,
    )
    op.create_index(
        "ix_scenario_boq_lines_project_id",
        "scenario_boq_lines",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_scenario_boq_lines_cluster_id",
        "scenario_boq_lines",
        ["cluster_id"],
        unique=False,
    )
    op.create_index(
        "ix_scenario_boq_lines_item_code",
        "scenario_boq_lines",
        ["item_code"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_scenario_boq_lines_item_code", table_name="scenario_boq_lines")
    op.drop_index("ix_scenario_boq_lines_cluster_id", table_name="scenario_boq_lines")
    op.drop_index("ix_scenario_boq_lines_project_id", table_name="scenario_boq_lines")
    op.drop_index("ix_scenario_boq_lines_scenario_id", table_name="scenario_boq_lines")
    op.drop_table("scenario_boq_lines")

    op.drop_index("ix_project_rate_items_item_code", table_name="project_rate_items")
    op.drop_index("ix_project_rate_items_project_id", table_name="project_rate_items")
    op.drop_table("project_rate_items")
