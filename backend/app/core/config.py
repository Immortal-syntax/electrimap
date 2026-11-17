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

import os
import tempfile
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_REPO_ROOT = Path(__file__).resolve().parents[3]
_DEFAULT_DATA_DIR = _REPO_ROOT / "data"
_BUNDLED_REFERENCE_DIR = _BACKEND_ROOT / "reference_data"
_DEFAULT_SQLITE_URL = "sqlite:///./data/electrimap_dev.db"

if os.environ.get("VERCEL") and "MPLCONFIGDIR" not in os.environ:
    _mpl_dir = Path(tempfile.gettempdir()) / "matplotlib"
    _mpl_dir.mkdir(parents=True, exist_ok=True)
    os.environ["MPLCONFIGDIR"] = str(_mpl_dir)


def normalize_database_url(url: str) -> str:
    """Normalize PostgreSQL URLs to use psycopg v3 when no explicit driver is present."""
    stripped = url.strip()
    if stripped.startswith("postgres://"):
        return "postgresql+psycopg://" + stripped[len("postgres://") :]
    if stripped.startswith("postgresql://"):
        return "postgresql+psycopg://" + stripped[len("postgresql://") :]
    return stripped


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
    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,https://electrimap-india.vercel.app"
    )

    # Default to local SQLite development file when PostgreSQL daemon is not running
    database_url: str = "sqlite:///./data/electrimap_dev.db"
    test_database_url: str = "sqlite:///./data/electrimap_test.db"

    session_secret: str = Field(
        default="dev-only-session-secret-replace-in-production-64-bytes-long-0000"
    )
    session_cookie_name: str = "em_session"
    session_cookie_secure: bool | None = None
    session_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    session_ttl_hours: int = 12
    session_absolute_days: int = 7

    production_admin_email: str | None = None
    production_admin_password: str | None = None
    production_admin_display_name: str = "System Administrator"

    data_dir: Path = _DEFAULT_DATA_DIR
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
        """Resolve data_dir/database URLs across hosts and reject weak production secrets."""
        if self.database_url == _DEFAULT_SQLITE_URL:
            for env_key in ("POSTGRES_URL", "POSTGRES_URL_NON_POOLING", "NEON_DATABASE_URL"):
                env_val = os.environ.get(env_key, "").strip()
                if env_val:
                    self.database_url = env_val
                    break
            else:
                if os.environ.get("VERCEL"):
                    tmp_db = (Path(tempfile.gettempdir()) / "electrimap_dev.db").as_posix()
                    self.database_url = f"sqlite:///{tmp_db}"

        self.database_url = normalize_database_url(self.database_url)
        self.test_database_url = normalize_database_url(self.test_database_url)

        if (
            not (self.data_dir / "reference").exists()
            and (_DEFAULT_DATA_DIR / "reference").exists()
        ):
            self.data_dir = _DEFAULT_DATA_DIR
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
        if self.session_cookie_samesite == "none" and self.session_cookie_secure is False:
            raise ValueError(
                "SESSION_COOKIE_SAMESITE=none requires SESSION_COOKIE_SECURE=true (HTTPS)."
            )
        return self

    @property
    def reference_dir(self) -> Path:
        """Return reference dataset directory, falling back to backend/reference_data."""
        candidate = self.data_dir / "reference"
        if candidate.exists():
            return candidate
        if (_DEFAULT_DATA_DIR / "reference").exists():
            return _DEFAULT_DATA_DIR / "reference"
        if _BUNDLED_REFERENCE_DIR.exists():
            return _BUNDLED_REFERENCE_DIR
        return candidate

    @property
    def effective_cookie_secure(self) -> bool:
        """Return True when session cookies must carry the Secure flag (HTTPS)."""
        if self.session_cookie_samesite == "none":
            return True
        if self.session_cookie_secure is not None:
            return self.session_cookie_secure
        return self.app_env == "production" or bool(os.environ.get("VERCEL"))

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
        for env_key in ("VERCEL_URL", "VERCEL_BRANCH_URL", "VERCEL_PROJECT_PRODUCTION_URL"):
            host = os.environ.get(env_key, "").strip().removeprefix("https://").rstrip("/")
            if host:
                origin = f"https://{host}"
                if origin not in origins:
                    origins.append(origin)
        return origins


@lru_cache
def get_settings() -> Settings:
    """Return cached Settings instance."""
    return Settings()

