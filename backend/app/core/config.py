"""Application configuration loaded from environment variables and .env."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
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

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return cached Settings instance."""
    return Settings()
