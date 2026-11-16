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

"""Integration tests for database readiness, models, and Alembic migrations."""

from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Dataset, EngineeringConstant, Job


def test_readiness_endpoint(client: TestClient) -> None:
    """Verify GET /api/v1/health/ready reports ready status and spatial runtime."""
    response = client.get("/api/v1/health/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["database_dialect"] in ("sqlite", "postgresql")
    assert "Shapely" in data["spatial_runtime"] or "PostGIS" in data["spatial_runtime"]


def test_foundation_models_crud(db_session: Session) -> None:
    """Verify Dataset, EngineeringConstant, and Job ORM persistence."""
    dataset = Dataset(
        key="copernicus_glo30",
        name="Copernicus DEM GLO-30",
        provider="European Space Agency (ESA)",
        url="https://copernicus-dem-30m.s3.eu-central-1.amazonaws.com",
        licence="Copernicus DEM Licence",
        attribution_text="Copernicus DEM (2023) distributed by ESA",
        spatial_resolution="30 m",
        temporal_coverage="2021-2023",
        version="2023.1",
        is_non_commercial=False,
    )
    constant = EngineeringConstant(
        key="lt_voltage_drop_limit_pct",
        value=6.0,
        unit="pct",
        description="Maximum permissible LT voltage drop from DT to farthest consumer",
        citation="CEA Distribution Network Planning Criteria",
        status="PROVISIONAL",
    )
    job = Job(
        job_type="acquire_aoi_data",
        status="QUEUED",
        progress=0,
        stage="initialized",
        params={"block": "Nandapur"},
    )
    db_session.add_all([dataset, constant, job])
    db_session.commit()

    fetched_ds = db_session.query(Dataset).filter_by(key="copernicus_glo30").one()
    assert fetched_ds.spatial_resolution == "30 m"

    fetched_const = (
        db_session.query(EngineeringConstant)
        .filter_by(key="lt_voltage_drop_limit_pct")
        .one()
    )
    assert fetched_const.value == 6.0
    assert fetched_const.status == "PROVISIONAL"

    fetched_job = db_session.query(Job).filter_by(job_type="acquire_aoi_data").one()
    assert fetched_job.params == {"block": "Nandapur"}


def test_alembic_upgrade_and_downgrade(tmp_path: Path) -> None:
    """Verify Alembic migrations upgrade to head and downgrade to base cleanly."""
    backend_dir = Path(__file__).resolve().parents[2]
    alembic_cfg = Config(str(backend_dir / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(backend_dir / "migrations"))
    mig_db_path = tmp_path / "alembic_test.db"
    alembic_cfg.set_main_option("sqlalchemy.url", f"sqlite:///{mig_db_path.as_posix()}")

    command.upgrade(alembic_cfg, "head")
    assert mig_db_path.exists()
    command.downgrade(alembic_cfg, "base")
    command.upgrade(alembic_cfg, "head")

