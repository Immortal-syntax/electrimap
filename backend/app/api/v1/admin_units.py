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

"""Administrative hierarchy lookup and Census 2011 metadata endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.db.models.auth import User
from app.db.session import get_db
from app.schemas.admin_unit import AdminBoundaryResponse, AdminUnitResponse
from app.services.aoi_service import (
    list_admin_units,
    resolve_admin_unit_boundary,
    search_admin_units,
)

router = APIRouter(prefix="/api/v1/admin-units", tags=["Admin Units"])


@router.get("", response_model=list[AdminUnitResponse])
def get_admin_units(
    parent: str | None = Query(default=None, description="Parent LGD code"),
    level: str | None = Query(
        default=None, description="Level: STATE, DISTRICT, BLOCK, GP, VILLAGE"
    ),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AdminUnitResponse]:
    """List administrative units for cascading selection."""
    return list_admin_units(db, parent_lgd_code=parent, level=level)


@router.get("/search", response_model=list[AdminUnitResponse])
def search_units(
    q: str = Query(..., min_length=1, max_length=100),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AdminUnitResponse]:
    """Search administrative units by village/block name, LGD code, or Census 2011 code."""
    return search_admin_units(db, q)


@router.get("/{lgd_code}/boundary", response_model=AdminBoundaryResponse)
def get_unit_boundary(
    lgd_code: str,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminBoundaryResponse:
    """Resolve boundary geometry (or approximate 1.5 km buffer) and Census 2011 info."""
    return resolve_admin_unit_boundary(db, lgd_code)

