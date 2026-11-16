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

"""API router for Milestone M4: Project-Level Assumptions Register (`/settings`)."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.db.models.auth import User
from app.db.session import get_db
from app.schemas.infrastructure import (
    ProjectSettingsListResponse,
    ProjectSettingsPatchRequest,
)
from app.services.infrastructure_service import (
    get_project_settings_state,
    reset_project_settings_state,
    update_project_settings_state,
)

router = APIRouter(prefix="/api/v1/projects", tags=["Assumptions Register (Settings)"])


@router.get(
    "/{project_id}/settings",
    response_model=ProjectSettingsListResponse,
)
def list_project_settings(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectSettingsListResponse:
    """Return all 14 project engineering assumptions with citations and edit flags."""
    return get_project_settings_state(db, project_id=project_id, user=user)


@router.patch(
    "/{project_id}/settings",
    response_model=ProjectSettingsListResponse,
)
def patch_project_settings(
    project_id: str,
    req: ProjectSettingsPatchRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectSettingsListResponse:
    """Override one or more project engineering assumptions (`quality_tag='USER_ENTERED'`)."""
    return update_project_settings_state(
        db, project_id=project_id, req=req, user=user
    )


@router.post(
    "/{project_id}/settings/reset",
    response_model=ProjectSettingsListResponse,
)
def reset_project_settings(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectSettingsListResponse:
    """Reset all project engineering assumptions to normative REC/CEA defaults."""
    return reset_project_settings_state(db, project_id=project_id, user=user)

