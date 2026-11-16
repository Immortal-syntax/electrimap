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

"""Authentication & session lifecycle service."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AuthenticationError, CsrfValidationError
from app.core.security import (
    generate_secure_token,
    hash_token,
    login_rate_limiter,
    verify_password,
    verify_token_hash,
)
from app.db.models.auth import User, UserSession
from app.services.seed_service import ensure_seed_data


def _ensure_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


def authenticate_and_create_session(
    db: Session,
    *,
    email: str,
    password: str,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> tuple[User, str, str]:
    """Authenticate user credentials and create a new server-side session."""
    ensure_seed_data(db)

    normalized_email = email.strip().lower()
    rate_key = f"{ip_address or 'local'}:{normalized_email}"
    login_rate_limiter.check_and_record(rate_key)

    user = db.execute(
        select(User).where(User.email == normalized_email)
    ).scalar_one_or_none()

    password_valid = verify_password(password, user.password_hash if user else None)
    if user is None or not user.is_active or not password_valid:
        raise AuthenticationError("Invalid email or password.")

    login_rate_limiter.reset(rate_key)

    settings = get_settings()
    now = datetime.now(UTC)
    raw_session_token = generate_secure_token(32)
    raw_csrf_token = generate_secure_token(32)

    session_row = UserSession(
        token_hash=hash_token(raw_session_token),
        user_id=user.id,
        csrf_token_hash=hash_token(raw_csrf_token),
        expires_at=now + timedelta(hours=settings.session_ttl_hours),
        absolute_expires_at=now + timedelta(days=settings.session_absolute_days),
        last_seen_at=now,
        ip_address=ip_address,
        user_agent=(user_agent or "")[:255] if user_agent else None,
        created_at=now,
    )
    db.add(session_row)
    db.commit()
    db.refresh(user)
    return user, raw_session_token, raw_csrf_token


def validate_session_token(
    db: Session,
    raw_session_token: str | None,
) -> tuple[User, UserSession]:
    """Validate raw session cookie token, enforce expiry, and return (User, UserSession)."""
    if not raw_session_token:
        raise AuthenticationError("Session cookie is missing. Please sign in.")

    token_digest = hash_token(raw_session_token)
    session_row = db.execute(
        select(UserSession).where(UserSession.token_hash == token_digest)
    ).scalar_one_or_none()

    if session_row is None:
        raise AuthenticationError("Invalid or expired session.")

    now = datetime.now(UTC)
    expires_at = _ensure_aware(session_row.expires_at)
    abs_expires_at = _ensure_aware(session_row.absolute_expires_at)

    if now >= expires_at or now >= abs_expires_at:
        db.delete(session_row)
        db.commit()
        raise AuthenticationError("Session has expired. Please sign in again.")

    user = db.execute(
        select(User).where(User.id == session_row.user_id)
    ).scalar_one_or_none()
    if user is None or not user.is_active:
        raise AuthenticationError("User account is inactive or missing.")

    settings = get_settings()
    sliding_target = min(abs_expires_at, now + timedelta(hours=settings.session_ttl_hours))
    session_row.last_seen_at = now
    session_row.expires_at = sliding_target
    db.commit()
    return user, session_row


def verify_csrf_for_session(session_row: UserSession, raw_csrf_token: str | None) -> None:
    """Verify the X-CSRF-Token header matches the session's stored csrf_token_hash."""
    if not raw_csrf_token:
        raise CsrfValidationError("Missing X-CSRF-Token header on state-changing request.")
    if not verify_token_hash(raw_csrf_token, session_row.csrf_token_hash):
        raise CsrfValidationError("Invalid X-CSRF-Token header.")


def revoke_session(db: Session, raw_session_token: str | None) -> None:
    """Delete a server-side session on logout."""
    if not raw_session_token:
        return
    token_digest = hash_token(raw_session_token)
    db.execute(delete(UserSession).where(UserSession.token_hash == token_digest))
    db.commit()
