"""Geospatial data acquisition, layer provenance, raster preview, and custom upload endpoints."""

from typing import Any

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.db.models.auth import User
from app.db.models.reference import Dataset
from app.db.session import get_db
from app.schemas.data_layer import (
    DatasetProvenanceResponse,
    ProjectLayerResponse,
)
from app.schemas.job import JobResponse
from app.services.data_service import (
    ensure_datasets_seeded,
    get_layer_raster_png_and_bounds,
    get_project_vector_layer_geojson,
    list_project_layers_with_provenance,
    trigger_project_data_acquisition,
    upload_custom_project_layer,
)
from app.services.job_service import serialize_job

router = APIRouter(prefix="/api/v1", tags=["Data & Provenance"])


@router.get("/datasets", response_model=list[DatasetProvenanceResponse])
def list_registered_datasets(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DatasetProvenanceResponse]:
    """Return the global dataset provenance registry (F-16)."""
    ensure_datasets_seeded(db)
    rows = db.execute(select(Dataset).order_by(Dataset.key.asc())).scalars().all()
    return [
        DatasetProvenanceResponse(
            id=r.id,
            key=r.key,
            name=r.name,
            provider=r.provider,
            url=r.url,
            licence=r.licence,
            licence_url=r.licence_url,
            attribution_text=r.attribution_text,
            spatial_resolution=r.spatial_resolution,
            temporal_coverage=r.temporal_coverage,
            version=r.version,
            is_non_commercial=r.is_non_commercial,
            notes=r.notes,
        )
        for r in rows
    ]


@router.post("/projects/{project_id}/data/acquire", response_model=JobResponse)
def acquire_project_data(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JobResponse:
    """Queue and execute the 6-layer open geospatial data acquisition job for a project."""
    job = trigger_project_data_acquisition(db, project_id=project_id, user=user)
    return serialize_job(job)


@router.get(
    "/projects/{project_id}/layers",
    response_model=list[ProjectLayerResponse],
)
def get_project_layers(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProjectLayerResponse]:
    """List all geospatial layers and their dataset provenance for a project."""
    return list_project_layers_with_provenance(db, project_id=project_id, user=user)


@router.get("/projects/{project_id}/layers/{layer_key}/image")
def get_layer_raster_image(
    project_id: str,
    layer_key: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Render colorized PNG overlay (`dem_slope`, `landcover`, `nightlights`)."""
    png_bytes, bbox = get_layer_raster_png_and_bounds(
        db, project_id=project_id, layer_key=layer_key, user=user
    )
    bbox_str = ",".join(str(x) for x in bbox)
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"X-Layer-BBox": bbox_str, "Cache-Control": "no-cache"},
    )


@router.get("/projects/{project_id}/layers/{layer_name}/geojson")
def get_layer_geojson(
    project_id: str,
    layer_name: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Return GeoJSON FeatureCollection for project `buildings` or `osm_features`."""
    return get_project_vector_layer_geojson(
        db, project_id=project_id, layer_name=layer_name, user=user
    )


@router.post(
    "/projects/{project_id}/layers/upload",
    response_model=ProjectLayerResponse,
)
async def upload_project_layer(
    project_id: str,
    layer_key: str = Form(default="buildings"),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectLayerResponse:
    """Upload a custom GeoJSON vector layer (`buildings` or `osm_features`)."""
    raw_bytes = await file.read()
    return upload_custom_project_layer(
        db,
        project_id=project_id,
        layer_key=layer_key,
        raw_bytes=raw_bytes,
        user=user,
    )
