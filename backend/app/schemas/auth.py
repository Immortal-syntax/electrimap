"""Pydantic v2 schemas for authentication and session endpoints."""

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    """Credentials payload for POST /api/v1/auth/login."""

    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=6, max_length=255)


class UserResponse(BaseModel):
    """Publicly safe user profile representation."""

    id: str
    email: str
    display_name: str
    role: str
    is_active: bool


class AuthSessionResponse(BaseModel):
    """Response returned on login or session check."""

    user: UserResponse
    csrf_token: str | None = None

