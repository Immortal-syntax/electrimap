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

"""Authentication and session lifecycle endpoints."""

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.config import get_settings
from app.db.models.auth import User
from app.db.session import get_db
from app.schemas.auth import AuthSessionResponse, LoginRequest, UserResponse
from app.services.auth_service import authenticate_and_create_session, revoke_session

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


def _to_user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        is_active=user.is_active,
    )


@router.post("/login", response_model=AuthSessionResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthSessionResponse:
    """Authenticate credentials, set HttpOnly session cookie, and return CSRF token."""
    settings = get_settings()
    client_ip = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("User-Agent")

    user, raw_session_token, raw_csrf_token = authenticate_and_create_session(
        db,
        email=payload.email,
        password=payload.password,
        ip_address=client_ip,
        user_agent=user_agent,
    )

    is_secure = settings.effective_cookie_secure
    response.set_cookie(
        key=settings.session_cookie_name,
        value=raw_session_token,
        httponly=True,
        secure=is_secure,
        samesite="lax",
        max_age=settings.session_absolute_days * 86400,
        path="/",
    )

    return AuthSessionResponse(
        user=_to_user_response(user),
        csrf_token=raw_csrf_token,
    )


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Revoke current server-side session and clear session cookie."""
    settings = get_settings()
    raw_token = request.cookies.get(settings.session_cookie_name)
    revoke_session(db, raw_token)
    response.delete_cookie(key=settings.session_cookie_name, path="/")
    return {"status": "logged_out"}


@router.get("/me", response_model=AuthSessionResponse)
def get_me(
    user: User = Depends(get_current_user),
) -> AuthSessionResponse:
    """Return currently authenticated user profile."""
    return AuthSessionResponse(
        user=_to_user_response(user),
        csrf_token=None,
    )
