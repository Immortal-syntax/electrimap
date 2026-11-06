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

