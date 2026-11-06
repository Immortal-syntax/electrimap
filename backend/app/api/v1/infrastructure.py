"""API router for Milestone M4:
- Existing Electrical Infrastructure & Interactive Tie-In Placement (`/infrastructure`)
- Terrain-Weighted Distance & Obstacle Gap Analysis Matrix (`/gap-analysis`)
- 7-Category Parametric Electricity Demand Estimation (`/demand`)
"""

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.db.models.auth import User
from app.db.session import get_db
from app.schemas.infrastructure import (
    InfrastructureAssetCreateRequest,
    InfrastructureAssetPatchRequest,
    InfrastructureAssetResponse,
    InfrastructureListResponse,
    ProjectDemandSummaryResponse,
    ProjectGapAnalysisResponse,
)
from app.services.infrastructure_service import (
    compute_and_persist_gap_analysis,
    compute_and_persist_project_demand,
    create_infrastructure_asset,
    delete_infrastructure_asset,
    list_project_infrastructure,
    update_infrastructure_asset,
    upload_infrastructure_geojson,
)

router = APIRouter(prefix="/api/v1/projects", tags=["Infrastructure, Gap Analysis & Demand"])


@router.get(
    "/{project_id}/infrastructure",
    response_model=InfrastructureListResponse,
)
def get_project_infrastructure(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InfrastructureListResponse:
    """List existing electrical infrastructure assets and tie-in points for a project."""
    return list_project_infrastructure(db, project_id=project_id, user=user)


@router.post(
    "/{project_id}/infrastructure",
    response_model=InfrastructureAssetResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_project_infrastructure_asset(
    project_id: str,
    req: InfrastructureAssetCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InfrastructureAssetResponse:
    """Place an assumed tie-in point, DT, or line asset (`USER_ASSUMED` or `FIELD_SURVEY`)."""
    return create_infrastructure_asset(
        db, project_id=project_id, req=req, user=user
    )


@router.patch(
    "/{project_id}/infrastructure/{asset_id}",
    response_model=InfrastructureAssetResponse,
)
def patch_project_infrastructure_asset(
    project_id: str,
    asset_id: str,
    req: InfrastructureAssetPatchRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InfrastructureAssetResponse:
    """Update or relocate an existing infrastructure asset or tie-in point."""
    return update_infrastructure_asset(
        db, project_id=project_id, asset_id=asset_id, req=req, user=user
    )


@router.delete(
    "/{project_id}/infrastructure/{asset_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_project_infrastructure_asset(
    project_id: str,
    asset_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Delete an infrastructure asset and recompute gap analysis."""
    delete_infrastructure_asset(
        db, project_id=project_id, asset_id=asset_id, user=user
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{project_id}/infrastructure/upload",
    response_model=InfrastructureListResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_project_infrastructure_file(
    project_id: str,
    file: UploadFile = File(...),
    provenance: str = Form(default="UTILITY_RECORD"),
    source_note: str = Form(default="Uploaded utility GIS infrastructure file"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InfrastructureListResponse:
    """Upload a GeoJSON FeatureCollection of existing 11 kV/LT lines, DTs, or substations."""
    raw_bytes = await file.read()
    return upload_infrastructure_geojson(
        db,
        project_id=project_id,
        raw_bytes=raw_bytes,
        provenance=provenance,
        source_note=source_note,
        user=user,
    )


@router.get(
    "/{project_id}/gap-analysis",
    response_model=ProjectGapAnalysisResponse,
)
@router.post(
    "/{project_id}/gap-analysis",
    response_model=ProjectGapAnalysisResponse,
)
def run_or_get_gap_analysis(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectGapAnalysisResponse:
    """Compute and return UTM terrain-weighted distance and obstacle gap analysis matrix."""
    return compute_and_persist_gap_analysis(
        db, project_id=project_id, user=user
    )


@router.get(
    "/{project_id}/demand",
    response_model=ProjectDemandSummaryResponse,
)
@router.post(
    "/{project_id}/demand/calculate",
    response_model=ProjectDemandSummaryResponse,
)
def run_or_get_project_demand(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectDemandSummaryResponse:
    """Compute and return 7-category parametric electricity demand and horizon forecast."""
    return compute_and_persist_project_demand(
        db, project_id=project_id, user=user
    )
