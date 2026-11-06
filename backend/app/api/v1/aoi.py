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

"""Project Area of Interest (AOI) validation, setting, and multipart upload endpoints."""

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.db.models.auth import User
from app.db.session import get_db
from app.schemas.aoi import ProjectAoiResponse, SetAoiRequest
from app.services.aoi_service import (
    get_project_aoi,
    set_project_aoi,
    upload_project_aoi_file,
)

router = APIRouter(prefix="/api/v1/projects/{project_id}/aoi", tags=["AOI"])


@router.put("", response_model=ProjectAoiResponse)
def put_project_aoi(
    project_id: str,
    payload: SetAoiRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectAoiResponse:
    """Validate, normalize, and store a project's AOI from an AdminUnit or drawn polygon."""
    return set_project_aoi(db, project_id=project_id, user=user, payload=payload)


@router.post("/upload", response_model=ProjectAoiResponse)
async def upload_aoi_boundary(
    project_id: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectAoiResponse:
    """Validate and store a boundary file (.geojson, .json, .kml, or Shapefile .zip)."""
    raw_bytes = await file.read()
    return upload_project_aoi_file(
        db,
        project_id=project_id,
        user=user,
        filename=file.filename or "boundary.geojson",
        raw_bytes=raw_bytes,
    )


@router.get("", response_model=ProjectAoiResponse)
def read_project_aoi(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectAoiResponse:
    """Retrieve a project's configured AOI."""
    return get_project_aoi(db, project_id=project_id, user=user)

