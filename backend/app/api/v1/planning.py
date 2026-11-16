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

"""REST API endpoints for Milestone M5 (Network Layout Routing & Engineering Engine):
- `GET /api/v1/engineering-constants`
- `GET /api/v1/projects/{project_id}/scenarios`
- `POST /api/v1/projects/{project_id}/scenarios/generate`
- `PATCH /api/v1/projects/{project_id}/scenarios/{scenario_id}/clusters/{cluster_id}`
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.db.models.auth import User
from app.db.session import get_db
from app.schemas.planning import (
    ClusterModalityOverrideRequest,
    EngineeringConstantListResponse,
    GenerateScenarioRequest,
    PlanningScenarioListResponse,
    PlanningScenarioResponse,
)
from app.services.planning_service import (
    generate_or_update_scenario,
    get_project_scenarios,
    list_engineering_constants,
    override_cluster_modality,
)

router = APIRouter(prefix="/api/v1", tags=["Network Planning & Engineering Engine"])


@router.get(
    "/engineering-constants",
    response_model=EngineeringConstantListResponse,
)
def get_engineering_constants_endpoint(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EngineeringConstantListResponse:
    """Return all verified REC/IS/CEA/MNRE engineering constants."""
    return list_engineering_constants(db)


@router.get(
    "/projects/{project_id}/scenarios",
    response_model=PlanningScenarioListResponse,
)
def get_project_scenarios_endpoint(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PlanningScenarioListResponse:
    """List all planning scenarios and active network layout for a project."""
    return get_project_scenarios(db, project_id=project_id, user=user)


@router.post(
    "/projects/{project_id}/scenarios/generate",
    response_model=PlanningScenarioResponse,
)
def generate_project_scenario_endpoint(
    project_id: str,
    body: GenerateScenarioRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PlanningScenarioResponse:
    """Generate or recalculate a planning scenario (`HYBRID_OPTIMAL`, etc.)."""
    return generate_or_update_scenario(
        db,
        project_id=project_id,
        user=user,
        scenario_key=body.scenario_key,
        preserve_manual_overrides=body.preserve_manual_overrides,
    )


@router.patch(
    "/projects/{project_id}/scenarios/{scenario_id}/clusters/{cluster_id}",
    response_model=PlanningScenarioResponse,
)
def override_cluster_modality_endpoint(
    project_id: str,
    scenario_id: str,
    cluster_id: str,
    body: ClusterModalityOverrideRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PlanningScenarioResponse:
    """Override a cluster's electrification modality and synchronously recalculate the scenario."""
    return override_cluster_modality(
        db,
        project_id=project_id,
        scenario_id=scenario_id,
        cluster_id=cluster_id,
        modality=body.modality,
        user=user,
    )
