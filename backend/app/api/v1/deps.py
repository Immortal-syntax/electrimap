"""FastAPI dependencies for session authentication and CSRF enforcement."""

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models.auth import User, UserSession
from app.db.session import get_db
from app.services.auth_service import validate_session_token, verify_csrf_for_session

MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def get_current_session_and_user(
    request: Request,
    db: Session = Depends(get_db),
) -> tuple[User, UserSession]:
    """Resolve the active User and UserSession from the HttpOnly session cookie."""
    settings = get_settings()
    raw_token = request.cookies.get(settings.session_cookie_name)
    user, session_row = validate_session_token(db, raw_token)

    if request.method.upper() in MUTATING_METHODS:
        raw_csrf = request.headers.get("X-CSRF-Token")
        verify_csrf_for_session(session_row, raw_csrf)

    return user, session_row


def get_current_user(
    pair: tuple[User, UserSession] = Depends(get_current_session_and_user),
) -> User:
    """Return the authenticated User (and verify CSRF on state-changing requests)."""
    return pair[0]

