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

"""Pytest fixtures for ElectriMap DPR backend unit and integration tests."""

import os
import shutil
from collections.abc import Generator
from pathlib import Path

import numpy as np
import pytest
import rasterio
from fastapi.testclient import TestClient
from rasterio.transform import from_bounds
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.db.models as _models  # noqa: F401
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app as fastapi_app
from app.services.seed_service import ensure_seed_data


@pytest.fixture(scope="session", autouse=True)
def _ensure_reference_test_rasters(
    tmp_path_factory: pytest.TempPathFactory,
) -> Generator[None, None, None]:
    """Provide Koraput GeoTIFF fixtures in tmp_path when gitignored rasters are missing on CI."""
    settings = get_settings()
    orig_ref_dir = settings.data_dir / "reference"
    dem_file = orig_ref_dir / "koraput_nandapur_dem_30m.tif"
    wc_file = orig_ref_dir / "koraput_nandapur_worldcover_30m.tif"
    if dem_file.exists() and wc_file.exists():
        yield
        return

    tmp_data_dir = tmp_path_factory.mktemp("electrimap_ci_data")
    tmp_ref_dir = tmp_data_dir / "reference"
    tmp_ref_dir.mkdir(parents=True, exist_ok=True)
    if orig_ref_dir.exists():
        for src_path in orig_ref_dir.iterdir():
            if src_path.is_file() and src_path.suffix.lower() != ".tif":
                shutil.copy2(src_path, tmp_ref_dir / src_path.name)

    width, height = 360, 360
    transform = from_bounds(82.68, 18.52, 82.78, 18.61, width, height)
    yy, xx = np.mgrid[0:height, 0:width]
    dem_arr = (
        855.0
        + 0.22 * xx
        + 0.14 * yy
        + 18.0 * np.sin(xx / 18.0) * np.cos(yy / 22.0)
    ).astype(np.float32)

    wc_arr = np.full((height, width), 30, dtype=np.uint8)
    wc_arr[(xx % 40) < 12] = 10  # Tree cover bands
    wc_arr[(yy > 140) & (yy < 220) & (xx > 90) & (xx < 260)] = 40  # Cropland
    wc_arr[(yy > 165) & (yy < 195) & (xx > 155) & (xx < 205)] = 50  # Built-up village core
    wc_arr[(xx > 290) & (xx < 305)] = 80  # Permanent water / stream corridor

    with rasterio.open(
        tmp_ref_dir / "koraput_nandapur_dem_30m.tif",
        "w",
        driver="GTiff",
        height=height,
        width=width,
        count=1,
        dtype="float32",
        crs="EPSG:4326",
        transform=transform,
    ) as dst:
        dst.write(dem_arr, 1)

    with rasterio.open(
        tmp_ref_dir / "koraput_nandapur_worldcover_30m.tif",
        "w",
        driver="GTiff",
        height=height,
        width=width,
        count=1,
        dtype="uint8",
        crs="EPSG:4326",
        transform=transform,
    ) as dst:
        dst.write(wc_arr, 1)

    prev_data_dir = os.environ.get("DATA_DIR")
    os.environ["DATA_DIR"] = str(Path(tmp_data_dir))
    get_settings.cache_clear()
    try:
        yield
    finally:
        if prev_data_dir is None:
            os.environ.pop("DATA_DIR", None)
        else:
            os.environ["DATA_DIR"] = prev_data_dir
        get_settings.cache_clear()


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    """Provide an isolated in-memory database session for each test."""
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(bind=test_engine)
    testing_session_local = sessionmaker(
        bind=test_engine, autoflush=False, autocommit=False, expire_on_commit=False
    )
    session = testing_session_local()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture()
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """Provide a FastAPI TestClient wired to the isolated test database session."""
    ensure_seed_data(db_session)

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    fastapi_app.dependency_overrides[get_db] = override_get_db
    with TestClient(fastapi_app) as test_client:
        yield test_client
    fastapi_app.dependency_overrides.clear()


@pytest.fixture()
def seeded_client(
    db_session: Session,
) -> Generator[TestClient, None, None]:
    """Provide an isolated TestClient with seed users, AdminUnits, and Koraput Demo seeded."""
    ensure_seed_data(db_session)

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    fastapi_app.dependency_overrides[get_db] = override_get_db
    with TestClient(fastapi_app) as test_client:
        yield test_client
    fastapi_app.dependency_overrides.clear()

