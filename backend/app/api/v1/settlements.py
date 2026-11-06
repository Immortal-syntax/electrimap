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

"""API router for Milestone M3: Habitation Clustering, Proxy Classification,
Census 2011 Reconciliation, Building Edits, and Preliminary DPR PDF Export.
"""

from typing import Any

from fastapi import APIRouter, Body, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.db.models.auth import User
from app.db.session import get_db
from app.schemas.settlement import (
    BuildingCreateRequest,
    BuildingPatchRequest,
    ClusteringParamsRequest,
    ClusteringRunResponse,
    ClusterListResponse,
    ClusterResponse,
)
from app.services.settlement_pdf_service import generate_preliminary_settlement_pdf
from app.services.settlement_service import (
    create_project_building,
    get_project_settlement_state,
    get_single_cluster,
    trigger_project_clustering,
    update_project_building,
)

router = APIRouter(prefix="/api/v1/projects", tags=["Settlements & Classification"])


@router.post(
    "/{project_id}/clustering",
    response_model=ClusteringRunResponse,
    status_code=status.HTTP_200_OK,
)
@router.post(
    "/{project_id}/clusters/detect",
    response_model=ClusteringRunResponse,
    status_code=status.HTTP_200_OK,
)
def run_project_clustering(
    project_id: str,
    params: ClusteringParamsRequest | None = Body(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ClusteringRunResponse:
    """Trigger UTM DBSCAN clustering and 4-tier proxy classification for a project."""
    effective_params = params or ClusteringParamsRequest()
    return trigger_project_clustering(
        db,
        project_id=project_id,
        params_req=effective_params,
        user=user,
    )


@router.get("/{project_id}/clusters", response_model=ClusterListResponse)
def list_project_clusters(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ClusterListResponse:
    """Return habitation clusters, GeoJSON hulls, and Census 2011 household reconciliation."""
    return get_project_settlement_state(db, project_id=project_id, user=user)


@router.get("/{project_id}/clusters/{cluster_id}", response_model=ClusterResponse)
def get_project_cluster_detail(
    project_id: str,
    cluster_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ClusterResponse:
    """Return a single habitation cluster with zonal statistics and proxy evidence."""
    return get_single_cluster(
        db, project_id=project_id, cluster_id=cluster_id, user=user
    )


@router.patch("/{project_id}/buildings/{building_id}")
def patch_building_footprint(
    project_id: str,
    building_id: str,
    req: BuildingPatchRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Exclude/include or reclassify an individual building footprint."""
    return update_project_building(
        db, project_id=project_id, building_id=building_id, req=req, user=user
    )


@router.post(
    "/{project_id}/buildings",
    status_code=status.HTTP_201_CREATED,
)
def add_manual_building_footprint(
    project_id: str,
    req: BuildingCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Manually add a building footprint (`is_user_added=True`) inside the project AOI."""
    return create_project_building(db, project_id=project_id, req=req, user=user)


@router.get("/{project_id}/exports/preliminary-settlement-pdf")
def export_preliminary_settlement_pdf(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Export the 2-page Preliminary DPR Skeleton (Sections 1-5 + UTM Cartographic Map Plate)."""
    pdf_bytes = generate_preliminary_settlement_pdf(
        db, project_id=project_id, user=user
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="ElectriMap_Preliminary_DPR_M3_{project_id[:8]}.pdf"'
            ),
            "Cache-Control": "no-store",
        },
    )

