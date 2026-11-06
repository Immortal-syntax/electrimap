"""Background job inspection and cancellation endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.db.models.auth import User
from app.db.session import get_db
from app.schemas.job import JobResponse
from app.services.job_service import (
    cancel_job_for_user,
    get_job_for_user,
    list_project_jobs,
    serialize_job,
)

router = APIRouter(prefix="/api/v1", tags=["Jobs"])


@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job_status(
    job_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JobResponse:
    """Retrieve status, progress, and stage of a background job."""
    job = get_job_for_user(db, job_id, user)
    return serialize_job(job)


@router.post("/jobs/{job_id}/cancel", response_model=JobResponse)
def cancel_job(
    job_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JobResponse:
    """Cancel a queued or running background job."""
    job = cancel_job_for_user(db, job_id, user)
    return serialize_job(job)


@router.get("/projects/{project_id}/jobs", response_model=list[JobResponse])
def get_jobs_for_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[JobResponse]:
    """List background jobs associated with a project."""
    return list_project_jobs(db, project_id, user)

