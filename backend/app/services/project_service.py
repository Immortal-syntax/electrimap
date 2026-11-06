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

"""Project CRUD service with ownership checks, optimistic concurrency, and duplication."""

from datetime import UTC, datetime
from typing import Any

from shapely.geometry import mapping
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ProjectNotFoundError, VersionConflictError
from app.db.models.auth import User
from app.db.models.ops import AuditEvent
from app.db.models.project import Project, ProjectAoi
from app.schemas.project import (
    ProjectAoiSummary,
    ProjectCreateRequest,
    ProjectResponse,
    ProjectUpdateRequest,
)
from app.services.seed_service import ensure_seed_data


def _serialize_project(db: Session, proj: Project) -> ProjectResponse:
    aoi_row = db.execute(
        select(ProjectAoi).where(ProjectAoi.project_id == proj.id)
    ).scalar_one_or_none()

    aoi_summary: ProjectAoiSummary | None = None
    if aoi_row is not None and aoi_row.geom is not None:
        aoi_summary = ProjectAoiSummary(
            boundary_source=aoi_row.boundary_source,
            area_km2=aoi_row.area_km2,
            lgd_code=aoi_row.lgd_code,
            census2011_code=aoi_row.census2011_code,
            upload_filename=aoi_row.upload_filename,
            original_crs=aoi_row.original_crs,
            warnings=list(aoi_row.warnings or []),
            geojson_geometry=dict(mapping(aoi_row.geom)),
        )

    return ProjectResponse(
        id=proj.id,
        owner_id=proj.owner_id,
        name=proj.name,
        description=proj.description,
        scheme=proj.scheme,
        target_state=proj.target_state,
        target_district=proj.target_district,
        target_block=proj.target_block,
        village_names=proj.village_names,
        base_year=proj.base_year,
        horizon_years=proj.horizon_years,
        discount_rate=proj.discount_rate,
        load_tier=proj.load_tier,
        metric_epsg=proj.metric_epsg,
        status=proj.status,
        version=proj.version,
        created_at=proj.created_at,
        updated_at=proj.updated_at,
        aoi=aoi_summary,
    )


def get_owned_project_or_404(db: Session, project_id: str, user: User) -> Project:
    """Fetch a non-deleted project owned by user (or any project if ADMIN), else raise 404."""
    proj = db.execute(
        select(Project).where(Project.id == project_id, Project.deleted_at.is_(None))
    ).scalar_one_or_none()

    if proj is None:
        raise ProjectNotFoundError(project_id)
    if proj.owner_id != user.id and user.role != "ADMIN":
        raise ProjectNotFoundError(project_id)
    return proj


def list_projects_for_user(db: Session, user: User) -> list[ProjectResponse]:
    """List all active projects owned by the user (ordered by updated_at desc)."""
    ensure_seed_data(db)
    stmt = (
        select(Project)
        .where(Project.owner_id == user.id, Project.deleted_at.is_(None))
        .order_by(Project.updated_at.desc())
    )
    rows = db.execute(stmt).scalars().all()
    return [_serialize_project(db, row) for row in rows]


def create_project(
    db: Session, user: User, payload: ProjectCreateRequest
) -> ProjectResponse:
    """Create a new project in DRAFT status."""
    proj = Project(
        owner_id=user.id,
        name=payload.name.strip(),
        description=payload.description,
        scheme=payload.scheme,
        target_state=payload.target_state,
        target_district=payload.target_district,
        target_block=payload.target_block,
        village_names=payload.village_names,
        base_year=payload.base_year,
        horizon_years=payload.horizon_years,
        discount_rate=payload.discount_rate,
        load_tier=payload.load_tier,
        metric_epsg=32644,
        status="DRAFT",
        version=1,
    )
    db.add(proj)
    db.flush()

    db.add(
        AuditEvent(
            project_id=proj.id,
            actor_id=user.id,
            event_type="PROJECT_CREATED",
            entity="project",
            entity_id=proj.id,
            diff={"name": proj.name, "scheme": proj.scheme},
        )
    )
    db.commit()
    db.refresh(proj)
    return _serialize_project(db, proj)


def get_project_detail(db: Session, project_id: str, user: User) -> ProjectResponse:
    """Return full project detail including embedded AOI if configured."""
    proj = get_owned_project_or_404(db, project_id, user)
    return _serialize_project(db, proj)


def update_project_with_optimistic_lock(
    db: Session,
    project_id: str,
    user: User,
    payload: ProjectUpdateRequest,
) -> ProjectResponse:
    """Update project fields after verifying optimistic concurrency version."""
    proj = get_owned_project_or_404(db, project_id, user)
    if proj.version != payload.version:
        raise VersionConflictError(
            expected_version=payload.version, current_version=proj.version
        )

    changes: dict[str, Any] = {}
    update_fields = [
        "name",
        "description",
        "scheme",
        "target_state",
        "target_district",
        "target_block",
        "village_names",
        "base_year",
        "horizon_years",
        "discount_rate",
        "load_tier",
    ]
    for field_name in update_fields:
        new_val = getattr(payload, field_name)
        if new_val is not None:
            old_val = getattr(proj, field_name)
            if old_val != new_val:
                setattr(proj, field_name, new_val)
                changes[field_name] = {"from": old_val, "to": new_val}

    proj.version += 1
    proj.updated_at = datetime.now(UTC)

    db.add(
        AuditEvent(
            project_id=proj.id,
            actor_id=user.id,
            event_type="PROJECT_UPDATED",
            entity="project",
            entity_id=proj.id,
            diff=changes,
        )
    )
    db.commit()
    db.refresh(proj)
    return _serialize_project(db, proj)


def soft_delete_project(db: Session, project_id: str, user: User) -> None:
    """Soft-delete a project by setting deleted_at."""
    proj = get_owned_project_or_404(db, project_id, user)
    now = datetime.now(UTC)
    proj.deleted_at = now
    db.add(
        AuditEvent(
            project_id=proj.id,
            actor_id=user.id,
            event_type="PROJECT_DELETED",
            entity="project",
            entity_id=proj.id,
            diff={"deleted_at": now.isoformat()},
        )
    )
    db.commit()


def duplicate_project(db: Session, project_id: str, user: User) -> ProjectResponse:
    """Clone a project and its AOI under a new UUID."""
    source_proj = get_owned_project_or_404(db, project_id, user)
    cloned = Project(
        owner_id=user.id,
        name=f"{source_proj.name} (Copy)",
        description=source_proj.description,
        scheme=source_proj.scheme,
        target_state=source_proj.target_state,
        target_district=source_proj.target_district,
        target_block=source_proj.target_block,
        village_names=source_proj.village_names,
        base_year=source_proj.base_year,
        horizon_years=source_proj.horizon_years,
        discount_rate=source_proj.discount_rate,
        load_tier=source_proj.load_tier,
        metric_epsg=source_proj.metric_epsg,
        status=source_proj.status,
        version=1,
    )
    db.add(cloned)
    db.flush()

    source_aoi = db.execute(
        select(ProjectAoi).where(ProjectAoi.project_id == source_proj.id)
    ).scalar_one_or_none()

    if source_aoi is not None:
        db.add(
            ProjectAoi(
                project_id=cloned.id,
                geom=source_aoi.geom,
                boundary_source=source_aoi.boundary_source,
                area_km2=source_aoi.area_km2,
                lgd_code=source_aoi.lgd_code,
                census2011_code=source_aoi.census2011_code,
                upload_filename=source_aoi.upload_filename,
                original_crs=source_aoi.original_crs,
                warnings=list(source_aoi.warnings or []),
            )
        )

    db.add(
        AuditEvent(
            project_id=cloned.id,
            actor_id=user.id,
            event_type="PROJECT_DUPLICATED",
            entity="project",
            entity_id=cloned.id,
            diff={"source_project_id": source_proj.id},
        )
    )
    db.commit()
    db.refresh(cloned)
    return _serialize_project(db, cloned)
