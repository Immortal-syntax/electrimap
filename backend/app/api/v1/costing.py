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

"""REST API endpoints for Milestone M6 (Traceable Cost Estimation & Scenarios):
- `GET /api/v1/projects/{project_id}/rates`
- `PATCH /api/v1/projects/{project_id}/rates/{item_code}`
- `POST /api/v1/projects/{project_id}/rates/import-csv`
- `GET /api/v1/projects/{project_id}/rates/export-csv`
- `POST /api/v1/projects/{project_id}/rates/reset`
- `GET /api/v1/projects/{project_id}/scenarios/{scenario_id}/boq`
- `GET /api/v1/projects/{project_id}/comparison`
- `POST /api/v1/projects/{project_id}/scenarios/{scenario_id}/pin`
"""

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.db.models.auth import User
from app.db.session import get_db
from app.schemas.costing import (
    ProjectRateListResponse,
    ProjectScenarioComparisonResponse,
    RateItemUpdateRequest,
    ScenarioBoqResponse,
    SorCsvImportRequest,
    SorCsvImportResponse,
)
from app.services.costing_service import (
    compute_and_persist_scenario_boq,
    export_project_rates_csv,
    get_project_scenario_comparison,
    import_project_rates_csv,
    list_project_rates,
    pin_project_scenario,
    reset_project_rates,
    update_project_rate_item,
)

router = APIRouter(prefix="/api/v1", tags=["Costing, BOQ & Scenario Comparison"])


@router.get(
    "/projects/{project_id}/rates",
    response_model=ProjectRateListResponse,
)
def get_project_rates_endpoint(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectRateListResponse:
    """List all Schedule of Rates (SoR) items and provenance status for a project."""
    return list_project_rates(db, project_id=project_id, user=user)


@router.patch(
    "/projects/{project_id}/rates/{item_code}",
    response_model=ProjectRateListResponse,
)
def update_project_rate_item_endpoint(
    project_id: str,
    item_code: str,
    body: RateItemUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectRateListResponse:
    """Update a single Schedule of Rates unit price (or set to null/UNSET)."""
    return update_project_rate_item(
        db,
        project_id=project_id,
        item_code=item_code,
        payload=body,
        user=user,
    )


@router.post(
    "/projects/{project_id}/rates/import-csv",
    response_model=SorCsvImportResponse,
)
def import_project_rates_csv_endpoint(
    project_id: str,
    body: SorCsvImportRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SorCsvImportResponse:
    """Validate and import a custom Schedule of Rates CSV with row-level error reporting."""
    return import_project_rates_csv(
        db,
        project_id=project_id,
        csv_content=body.csv_content,
        template_name=body.template_name,
        user=user,
    )


@router.get(
    "/projects/{project_id}/rates/export-csv",
)
def export_project_rates_csv_endpoint(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Export the project's active Schedule of Rates as a downloadable CSV."""
    csv_text = export_project_rates_csv(db, project_id=project_id, user=user)
    return Response(
        content=csv_text.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="ElectriMap_SoR_{project_id[:8]}.csv"'
        },
    )


@router.post(
    "/projects/{project_id}/rates/reset",
    response_model=ProjectRateListResponse,
)
def reset_project_rates_endpoint(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectRateListResponse:
    """Reset the project's Schedule of Rates to the verified Odisha/REC reference template."""
    return reset_project_rates(db, project_id=project_id, user=user)


@router.get(
    "/projects/{project_id}/scenarios/{scenario_id}/boq",
    response_model=ScenarioBoqResponse,
)
def get_scenario_boq_endpoint(
    project_id: str,
    scenario_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScenarioBoqResponse:
    """Compute and return the itemized Bill of Quantities (BOQ) and financial abstract."""
    return compute_and_persist_scenario_boq(
        db,
        project_id=project_id,
        scenario_id=scenario_id,
        user=user,
    )


@router.get(
    "/projects/{project_id}/comparison",
    response_model=ProjectScenarioComparisonResponse,
)
def get_project_scenario_comparison_endpoint(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectScenarioComparisonResponse:
    """Evaluate all 4 project scenarios on identical demand inputs and return comparison."""
    return get_project_scenario_comparison(db, project_id=project_id, user=user)


@router.post(
    "/projects/{project_id}/scenarios/{scenario_id}/pin",
    response_model=ProjectScenarioComparisonResponse,
)
def pin_project_scenario_endpoint(
    project_id: str,
    scenario_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectScenarioComparisonResponse:
    """Pin the selected scenario as the active DPR baseline (`is_active = True`)."""
    return pin_project_scenario(
        db,
        project_id=project_id,
        scenario_id=scenario_id,
        user=user,
    )
