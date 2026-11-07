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

"""Application configuration loaded from environment variables and .env."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Typed application settings for ElectriMap DPR."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: Literal["development", "test", "demo", "production"] = "development"
    app_version: str = "0.1.0"
    log_level: str = "INFO"

    backend_host: str = "127.0.0.1"
    backend_port: int = 8000
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Default to local SQLite development file when PostgreSQL daemon is not running
    database_url: str = "sqlite:///./data/electrimap_dev.db"
    test_database_url: str = "sqlite:///./data/electrimap_test.db"

    session_secret: str = Field(
        default="dev-only-session-secret-replace-in-production-64-bytes-long-0000"
    )
    session_cookie_name: str = "em_session"
    session_cookie_secure: bool | None = None
    session_ttl_hours: int = 12
    session_absolute_days: int = 7

    data_dir: Path = Path("../data")
    max_upload_mb: int = 25
    max_aoi_km2: float = 500.0
    max_jobs_per_user: int = 2

    offline_mode: bool = False
    http_user_agent: str = "ElectriMapDPR/0.1 (academic-research; contact@electrimap.local)"

    overpass_url: str = "https://overpass-api.de/api/interpreter"
    nasa_power_url: str = "https://power.larc.nasa.gov/api"
    dem_cog_base: str = "https://copernicus-dem-30m.s3.eu-central-1.amazonaws.com"
    worldcover_cog_base: str = "https://esa-worldcover.s3.eu-central-1.amazonaws.com"
    nightlights_source: str = "HREA_IND"

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        """Reject weak or default session secrets when running in production mode."""
        if self.app_env == "production":
            secret = self.session_secret.strip()
            if (
                len(secret) < 32
                or secret.startswith("dev-only-")
                or secret.startswith("replace_this_")
            ):
                raise ValueError(
                    "APP_ENV=production requires a strong custom SESSION_SECRET "
                    "(at least 32 characters, not the default placeholder)."
                )
        return self

    @property
    def effective_cookie_secure(self) -> bool:
        """Return True when session cookies must carry the Secure flag (HTTPS)."""
        if self.session_cookie_secure is not None:
            return self.session_cookie_secure
        return self.app_env == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return cached Settings instance."""
    return Settings()

