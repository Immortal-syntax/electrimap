"""Milestone M1 schema: users, sessions, admin_units, census_villages, projects, project_aoi, audit_events.

Revision ID: 0002_m1_auth_projects_aoi
Revises: 0001_initial_foundation
Create Date: 2026-11-06
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.db.types import SpatialGeometry

revision: str = "0002_m1_auth_projects_aoi"
down_revision: str | None = "0001_initial_foundation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("role", sa.String(length=24), nullable=False, server_default="PLANNER"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("csrf_token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("absolute_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sessions_token_hash", "sessions", ["token_hash"], unique=True)
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"], unique=False)

    op.create_table(
        "admin_units",
        sa.Column("lgd_code", sa.String(length=32), nullable=False),
        sa.Column("level", sa.String(length=24), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("parent_lgd_code", sa.String(length=32), nullable=True),
        sa.Column("census2011_code", sa.String(length=32), nullable=True),
        sa.Column(
            "geom",
            SpatialGeometry(geometry_type="MULTIPOLYGON", srid=4326),
            nullable=True,
        ),
        sa.Column(
            "boundary_source", sa.String(length=32), nullable=False, server_default="HARMONISED"
        ),
        sa.Column("centroid_lon", sa.Float(), nullable=True),
        sa.Column("centroid_lat", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("lgd_code"),
    )
    op.create_index("ix_admin_units_level", "admin_units", ["level"], unique=False)
    op.create_index("ix_admin_units_name", "admin_units", ["name"], unique=False)
    op.create_index(
        "ix_admin_units_parent_lgd_code", "admin_units", ["parent_lgd_code"], unique=False
    )
    op.create_index(
        "ix_admin_units_census2011_code", "admin_units", ["census2011_code"], unique=False
    )

    op.create_table(
        "census_villages",
        sa.Column("census2011_code", sa.String(length=32), nullable=False),
        sa.Column("state_code", sa.String(length=16), nullable=False),
        sa.Column("district_code", sa.String(length=16), nullable=False),
        sa.Column("subdistrict_code", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("total_pop", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("households", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("st_pop", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sc_pop", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("amenities", sa.JSON(), nullable=True),
        sa.Column("power_supply_2011", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("census2011_code"),
    )
    op.create_index("ix_census_villages_name", "census_villages", ["name"], unique=False)

    op.create_table(
        "projects",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("owner_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("scheme", sa.String(length=64), nullable=False, server_default="DA-JGUA / RDSS"),
        sa.Column("target_state", sa.String(length=100), nullable=True),
        sa.Column("target_district", sa.String(length=100), nullable=True),
        sa.Column("target_block", sa.String(length=100), nullable=True),
        sa.Column("village_names", sa.String(length=300), nullable=True),
        sa.Column("base_year", sa.Integer(), nullable=False, server_default="2026"),
        sa.Column("horizon_years", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("discount_rate", sa.Float(), nullable=False, server_default="0.08"),
        sa.Column(
            "load_tier", sa.String(length=32), nullable=False, server_default="TIER_3_STANDARD"
        ),
        sa.Column("metric_epsg", sa.Integer(), nullable=False, server_default="32644"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="DRAFT"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_projects_owner_id", "projects", ["owner_id"], unique=False)

    op.create_table(
        "project_aoi",
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column(
            "geom",
            SpatialGeometry(geometry_type="MULTIPOLYGON", srid=4326),
            nullable=False,
        ),
        sa.Column("boundary_source", sa.String(length=32), nullable=False),
        sa.Column("area_km2", sa.Float(), nullable=False),
        sa.Column("lgd_code", sa.String(length=32), nullable=True),
        sa.Column("census2011_code", sa.String(length=32), nullable=True),
        sa.Column("upload_filename", sa.String(length=255), nullable=True),
        sa.Column("original_crs", sa.String(length=64), nullable=True),
        sa.Column("warnings", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("project_id"),
    )

    op.create_table(
        "audit_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=True),
        sa.Column("actor_id", sa.String(length=36), nullable=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("entity", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=False),
        sa.Column("diff", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_events_project_id", "audit_events", ["project_id"], unique=False)
    op.create_index("ix_audit_events_actor_id", "audit_events", ["actor_id"], unique=False)
    op.create_index("ix_audit_events_event_type", "audit_events", ["event_type"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_audit_events_event_type", table_name="audit_events")
    op.drop_index("ix_audit_events_actor_id", table_name="audit_events")
    op.drop_index("ix_audit_events_project_id", table_name="audit_events")
    op.drop_table("audit_events")
    op.drop_table("project_aoi")
    op.drop_index("ix_projects_owner_id", table_name="projects")
    op.drop_table("projects")
    op.drop_index("ix_census_villages_name", table_name="census_villages")
    op.drop_table("census_villages")
    op.drop_index("ix_admin_units_census2011_code", table_name="admin_units")
    op.drop_index("ix_admin_units_parent_lgd_code", table_name="admin_units")
    op.drop_index("ix_admin_units_name", table_name="admin_units")
    op.drop_index("ix_admin_units_level", table_name="admin_units")
    op.drop_table("admin_units")
    op.drop_index("ix_sessions_user_id", table_name="sessions")
    op.drop_index("ix_sessions_token_hash", table_name="sessions")
    op.drop_table("sessions")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

