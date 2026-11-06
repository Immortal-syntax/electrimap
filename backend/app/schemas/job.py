"""Pydantic v2 schemas for background job queue inspection and cancellation."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class JobResponse(BaseModel):
    """Status and progress representation of a background job."""

    id: str
    project_id: str | None
    job_type: str
    status: str
    progress: int
    stage: str | None
    params: dict[str, Any] | None
    result: dict[str, Any] | None
    error: str | None
    attempts: int
    created_by: str | None
    created_at: datetime
    updated_at: datetime
    finished_at: datetime | None

