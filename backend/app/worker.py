"""Standalone PostgreSQL/SQLite background worker process (`python -m app.worker`)."""

import logging
import time
from collections.abc import Callable
from typing import Any

from sqlalchemy.orm import Session

from app.core.logging import configure_logging
from app.db.models.ops import Job
from app.db.session import SessionLocal
from app.services.job_service import claim_next_queued_job, complete_job, fail_job

logger = logging.getLogger(__name__)

JOB_HANDLERS: dict[str, Callable[[Session, Job], dict[str, Any]]] = {}


def register_job_handler(
    job_type: str, handler: Callable[[Session, Job], dict[str, Any]]
) -> None:
    """Register a handler function for a specific job_type."""
    JOB_HANDLERS[job_type] = handler


def process_one_queued_job(worker_id: str = "worker-main") -> bool:
    """Claim and execute at most one queued job. Returns True if a job was processed."""
    with SessionLocal() as db:
        job = claim_next_queued_job(db, worker_id=worker_id)
        if job is None:
            return False
        handler = JOB_HANDLERS.get(job.job_type)
        if handler is None:
            fail_job(db, job, f"No handler registered for job_type '{job.job_type}'.")
            return True
        try:
            res = handler(db, job)
            complete_job(db, job, res)
        except Exception as exc:
            logger.exception("Job %s (%s) failed", job.id, job.job_type)
            fail_job(db, job, str(exc))
        return True


def run_worker_forever(poll_interval_s: float = 2.0) -> None:
    """Run the background job worker polling loop."""
    configure_logging("INFO")
    logger.info("ElectriMap background worker started.")
    while True:
        processed = process_one_queued_job()
        if not processed:
            time.sleep(poll_interval_s)


if __name__ == "__main__":
    run_worker_forever()

