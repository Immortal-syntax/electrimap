"""Integration tests for Milestone M2: Jobs Queue, Data Acquisition, Provenance, Rasters & MVT."""

import json

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models.ops import Job
from app.services.seed_service import (
    DEFAULT_PLANNER_EMAIL,
    DEFAULT_PLANNER_PASSWORD,
    DEMO_PROJECT_ID,
)


def _login_planner(client: TestClient) -> dict[str, str]:
    res = client.post(
        "/api/v1/auth/login",
        json={"email": DEFAULT_PLANNER_EMAIL, "password": DEFAULT_PLANNER_PASSWORD},
    )
    assert res.status_code == 200
    csrf: str = res.json()["csrf_token"]
    return {"X-CSRF-Token": csrf}


def test_dataset_provenance_registry_and_demo_project_offline_layers(
    client: TestClient,
) -> None:
    """Verify /api/v1/datasets and offline auto-seeding of the Koraput demo project layers."""
    _login_planner(client)

    ds_res = client.get("/api/v1/datasets")
    assert ds_res.status_code == 200
    datasets = ds_res.json()
    keys = {d["key"] for d in datasets}
    assert {
        "open_buildings_v3",
        "copernicus_dem_glo30",
        "esa_worldcover_2021",
        "viirs_hrea_nightlights",
        "openstreetmap_overpass",
        "nasa_power_agro_re",
    }.issubset(keys)

    # Reading layers on the demo project populates all 6 layers offline automatically
    layers_res = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/layers")
    assert layers_res.status_code == 200
    layers = layers_res.json()
    assert len(layers) == 6
    for layer in layers:
        assert layer["status"] == "READY"
        assert layer["dataset"] is not None
        assert layer["dataset"]["licence"] != ""


def test_project_data_acquisition_job_raster_png_and_vector_tiles(
    client: TestClient,
) -> None:
    """Verify POST /data/acquire job lifecycle, raster PNG preview, GeoJSON, MVT, and upload."""
    headers = _login_planner(client)

    # Create project and set AOI to Village Padwa (LGD 398715)
    proj = client.post(
        "/api/v1/projects",
        headers=headers,
        json={"name": "Padwa Data Ingestion Test"},
    ).json()
    pid = proj["id"]

    aoi_res = client.put(
        f"/api/v1/projects/{pid}/aoi",
        headers=headers,
        json={"mode": "ADMIN_UNIT", "lgd_code": "398715"},
    )
    assert aoi_res.status_code == 200

    # Trigger 6-layer data acquisition job
    acq_res = client.post(
        f"/api/v1/projects/{pid}/data/acquire",
        headers=headers,
    )
    assert acq_res.status_code == 200
    job = acq_res.json()
    assert job["status"] == "SUCCEEDED"
    assert job["progress"] == 100
    assert job["result"]["layers_ready"] == 6
    assert job["result"]["buildings_detected"] > 20

    # Verify job status endpoint and project jobs list
    job_detail = client.get(f"/api/v1/jobs/{job['id']}").json()
    assert job_detail["status"] == "SUCCEEDED"

    proj_jobs = client.get(f"/api/v1/projects/{pid}/jobs").json()
    assert any(j["id"] == job["id"] for j in proj_jobs)

    # Verify project status transitioned to DATA_READY
    updated_proj = client.get(f"/api/v1/projects/{pid}").json()
    assert updated_proj["status"] == "DATA_READY"

    # Verify raster PNG preview for dem_slope, landcover, nightlights
    for r_key in ("dem_slope", "landcover", "nightlights"):
        img_res = client.get(f"/api/v1/projects/{pid}/layers/{r_key}/image")
        assert img_res.status_code == 200
        assert img_res.headers["content-type"] == "image/png"
        assert "x-layer-bbox" in img_res.headers
        assert img_res.content.startswith(b"\x89PNG")

    # Verify vector GeoJSON and MVT tile endpoints
    bld_fc = client.get(f"/api/v1/projects/{pid}/layers/buildings/geojson").json()
    assert bld_fc["type"] == "FeatureCollection"
    assert len(bld_fc["features"]) == job["result"]["buildings_detected"]

    osm_fc = client.get(f"/api/v1/projects/{pid}/layers/osm_features/geojson").json()
    assert len(osm_fc["features"]) == 6

    mvt_res = client.get(f"/api/v1/tiles/{pid}/buildings/14/11955/7322.mvt")
    assert mvt_res.status_code == 200
    assert mvt_res.headers["content-type"] == "application/vnd.mapbox-vector-tile"

    # Verify custom GeoJSON layer upload
    custom_fc = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"category": "AMENITY", "name": "Solar Water Pump"},
                "geometry": {"type": "Point", "coordinates": [82.65, 18.505]},
            }
        ],
    }
    up_res = client.post(
        f"/api/v1/projects/{pid}/layers/upload",
        headers=headers,
        data={"layer_key": "osm_features"},
        files={
            "file": (
                "custom_amenities.geojson",
                json.dumps(custom_fc).encode("utf-8"),
                "application/geo+json",
            )
        },
    )
    assert up_res.status_code == 200
    assert up_res.json()["dataset"]["key"] == "user_uploaded_gis"


def test_concurrent_job_limit_and_cancellation(
    client: TestClient, db_session: Session
) -> None:
    """Verify per-user concurrent active job limit (429) and job cancellation."""
    headers = _login_planner(client)
    me = client.get("/api/v1/auth/me").json()["user"]

    # Insert 2 active QUEUED jobs for this user
    j1 = Job(
        project_id=DEMO_PROJECT_ID,
        job_type="ACQUIRE_PROJECT_DATA",
        status="QUEUED",
        progress=0,
        created_by=me["id"],
    )
    j2 = Job(
        project_id=DEMO_PROJECT_ID,
        job_type="ACQUIRE_PROJECT_DATA",
        status="RUNNING",
        progress=30,
        created_by=me["id"],
    )
    db_session.add_all([j1, j2])
    db_session.commit()

    # Attempting a 3rd job while 2 are active raises 429 CONCURRENT_JOB_LIMIT
    limit_res = client.post(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/data/acquire",
        headers=headers,
    )
    assert limit_res.status_code == 429
    assert limit_res.json()["error"]["code"] == "CONCURRENT_JOB_LIMIT"

    # Cancel j1 and j2
    c1 = client.post(f"/api/v1/jobs/{j1.id}/cancel", headers=headers)
    assert c1.status_code == 200
    assert c1.json()["status"] == "CANCELLED"

    c2 = client.post(f"/api/v1/jobs/{j2.id}/cancel", headers=headers)
    assert c2.status_code == 200
    assert c2.json()["status"] == "CANCELLED"

