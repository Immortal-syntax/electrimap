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

"""PostgreSQL/SQLite-backed transactional job queue service (AD-02)."""

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.db.models.auth import User
from app.db.models.ops import Job
from app.schemas.job import JobResponse
from app.services.project_service import get_owned_project_or_404


def serialize_job(job: Job) -> JobResponse:
    """Convert a Job ORM record into a JobResponse schema."""
    return JobResponse(
        id=job.id,
        project_id=job.project_id,
        job_type=job.job_type,
        status=job.status,
        progress=job.progress,
        stage=job.stage,
        params=job.params,
        result=job.result,
        error=job.error,
        attempts=job.attempts,
        created_by=job.created_by,
        created_at=job.created_at,
        updated_at=job.updated_at,
        finished_at=job.finished_at,
    )


def enqueue_job(
    db: Session,
    *,
    project_id: str | None,
    job_type: str,
    params: dict[str, Any] | None,
    user: User,
) -> Job:
    """Enqueue a new background job after verifying per-user concurrent active job limits."""
    settings = get_settings()
    active_count = (
        db.execute(
            select(func.count(Job.id)).where(
                Job.created_by == user.id,
                Job.status.in_(["QUEUED", "RUNNING"]),
            )
        ).scalar_one()
        or 0
    )

    if active_count >= settings.max_jobs_per_user:
        raise AppError(
            code="CONCURRENT_JOB_LIMIT",
            message=(
                f"Maximum concurrent jobs per user ({settings.max_jobs_per_user}) reached. "
                "Wait for active jobs to complete or cancel an existing job."
            ),
            status_code=429,
            details={
                "active_jobs": active_count,
                "max_jobs_per_user": settings.max_jobs_per_user,
            },
        )

    job = Job(
        project_id=project_id,
        job_type=job_type,
        status="QUEUED",
        progress=0,
        stage="queued",
        params=params or {},
        attempts=0,
        created_by=user.id,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def claim_next_queued_job(db: Session, worker_id: str = "worker-local") -> Job | None:
    """Atomically claim the oldest QUEUED job using FOR UPDATE SKIP LOCKED on PostgreSQL."""
    dialect_name = db.bind.dialect.name if db.bind is not None else "sqlite"
    stmt = select(Job).where(Job.status == "QUEUED").order_by(Job.created_at.asc()).limit(1)
    if dialect_name == "postgresql":
        stmt = stmt.with_for_update(skip_locked=True)

    job = db.execute(stmt).scalar_one_or_none()
    if job is None:
        return None

    now = datetime.now(UTC)
    job.status = "RUNNING"
    job.locked_by = worker_id
    job.locked_at = now
    job.attempts += 1
    job.stage = "starting"
    job.updated_at = now
    db.commit()
    db.refresh(job)
    return job


def update_job_progress(
    db: Session,
    job: Job,
    *,
    progress: int,
    stage: str,
) -> None:
    """Update job progress percentage (0-100) and human-readable stage description."""
    job.progress = max(0, min(100, progress))
    job.stage = stage
    job.updated_at = datetime.now(UTC)
    db.commit()


def complete_job(db: Session, job: Job, result: dict[str, Any]) -> Job:
    """Mark a job as SUCCEEDED with progress=100 and persist result metadata."""
    now = datetime.now(UTC)
    job.status = "SUCCEEDED"
    job.progress = 100
    job.stage = "completed"
    job.result = result
    job.finished_at = now
    job.updated_at = now
    db.commit()
    db.refresh(job)
    return job


def fail_job(db: Session, job: Job, error_message: str) -> Job:
    """Mark a job as FAILED and record error details."""
    now = datetime.now(UTC)
    job.status = "FAILED"
    job.stage = "failed"
    job.error = error_message
    job.finished_at = now
    job.updated_at = now
    db.commit()
    db.refresh(job)
    return job


def execute_job_synchronously(
    db: Session,
    job: Job,
    handler: Callable[[Session, Job], dict[str, Any]],
    worker_id: str = "inline-worker",
) -> Job:
    """Transition a QUEUED job through RUNNING -> SUCCEEDED/FAILED using handler."""
    if job.status == "CANCELLED":
        return job

    now = datetime.now(UTC)
    job.status = "RUNNING"
    job.locked_by = worker_id
    job.locked_at = now
    job.attempts += 1
    job.stage = "initializing"
    job.updated_at = now
    db.commit()

    try:
        result = handler(db, job)
        return complete_job(db, job, result)
    except Exception as exc:
        return fail_job(db, job, str(exc))


def get_job_for_user(db: Session, job_id: str, user: User) -> Job:
    """Fetch a job after verifying ownership of its parent project (or job creator)."""
    job = db.execute(select(Job).where(Job.id == job_id)).scalar_one_or_none()
    if job is None:
        raise AppError(
            code="JOB_NOT_FOUND",
            message="Background job not found.",
            status_code=404,
            details={"job_id": job_id},
        )
    if job.project_id:
        get_owned_project_or_404(db, job.project_id, user)
    elif job.created_by != user.id and user.role != "ADMIN":
        raise AppError(
            code="JOB_NOT_FOUND",
            message="Background job not found.",
            status_code=404,
            details={"job_id": job_id},
        )
    return job


def cancel_job_for_user(db: Session, job_id: str, user: User) -> Job:
    """Cancel a QUEUED or RUNNING job."""
    job = get_job_for_user(db, job_id, user)
    if job.status in {"QUEUED", "RUNNING"}:
        now = datetime.now(UTC)
        job.status = "CANCELLED"
        job.stage = "cancelled_by_user"
        job.finished_at = now
        job.updated_at = now
        db.commit()
        db.refresh(job)
    return job


def list_project_jobs(db: Session, project_id: str, user: User) -> list[JobResponse]:
    """List recent jobs for a project owned by user."""
    get_owned_project_or_404(db, project_id, user)
    rows = (
        db.execute(
            select(Job)
            .where(Job.project_id == project_id)
            .order_by(Job.created_at.desc())
            .limit(30)
        )
        .scalars()
        .all()
    )
    return [serialize_job(r) for r in rows]

