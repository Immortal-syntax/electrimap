"""Project CRUD endpoints with optimistic concurrency locking."""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.db.models.auth import User
from app.db.session import get_db
from app.schemas.project import (
    ProjectCreateRequest,
    ProjectResponse,
    ProjectUpdateRequest,
)
from app.services.project_service import (
    create_project,
    duplicate_project,
    get_project_detail,
    list_projects_for_user,
    soft_delete_project,
    update_project_with_optimistic_lock,
)

router = APIRouter(prefix="/api/v1/projects", tags=["Projects"])


@router.get("", response_model=list[ProjectResponse])
def list_projects(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProjectResponse]:
    """List all active projects owned by the authenticated user."""
    return list_projects_for_user(db, user)


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_new_project(
    payload: ProjectCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """Create a new electrification project."""
    return create_project(db, user, payload)


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """Fetch a single project by ID (requires ownership)."""
    return get_project_detail(db, project_id, user)


@router.patch("/{project_id}", response_model=ProjectResponse)
def patch_project(
    project_id: str,
    payload: ProjectUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """Update a project using optimistic concurrency locking (`version`)."""
    return update_project_with_optimistic_lock(db, project_id, user, payload)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Soft-delete a project."""
    soft_delete_project(db, project_id, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{project_id}/duplicate",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def clone_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """Duplicate a project and its AOI under a new UUID."""
    return duplicate_project(db, project_id, user)

