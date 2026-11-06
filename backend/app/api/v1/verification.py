"""API router for Milestone M3: Append-Only Verification Audit Ledger & CSV Batch Import."""

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.db.models.auth import User
from app.db.session import get_db
from app.schemas.settlement import (
    VerificationCreateRequest,
    VerificationImportResponse,
    VerificationLedgerResponse,
    VerificationRecordResponse,
    VerificationReversalRequest,
)
from app.services.settlement_service import (
    create_cluster_verification,
    get_project_verification_ledger,
    import_verifications_csv,
    reverse_cluster_verification,
)

router = APIRouter(prefix="/api/v1/projects", tags=["Verification Audit Ledger"])


@router.get(
    "/{project_id}/verifications",
    response_model=VerificationLedgerResponse,
)
def list_project_verifications(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VerificationLedgerResponse:
    """Return the immutable verification audit ledger and coverage metrics for a project."""
    return get_project_verification_ledger(db, project_id=project_id, user=user)


@router.post(
    "/{project_id}/verifications",
    response_model=VerificationRecordResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_verification_entry(
    project_id: str,
    req: VerificationCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VerificationRecordResponse:
    """Record a field or utility verification for a cluster without mutating proxy_class."""
    return create_cluster_verification(
        db, project_id=project_id, req=req, user=user
    )


@router.post(
    "/{project_id}/verifications/{verification_id}/reverse",
    response_model=VerificationRecordResponse,
    status_code=status.HTTP_201_CREATED,
)
def reverse_verification_entry(
    project_id: str,
    verification_id: str,
    req: VerificationReversalRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VerificationRecordResponse:
    """Append a reversal record that restores a cluster's prior state without mutating history."""
    return reverse_cluster_verification(
        db,
        project_id=project_id,
        verification_id=verification_id,
        req=req,
        user=user,
    )


@router.post(
    "/{project_id}/verifications/import",
    response_model=VerificationImportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def import_verifications_csv_endpoint(
    project_id: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VerificationImportResponse:
    """Import a field survey CSV and append matched records to the immutable verification ledger."""
    raw_bytes = await file.read()
    return import_verifications_csv(
        db,
        project_id=project_id,
        filename=file.filename or "field_verifications.csv",
        raw_bytes=raw_bytes,
        user=user,
    )
