"""Unit tests for system health, error handling envelope, and local storage safety."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.errors import AoiTooLargeError
from app.core.storage import LocalStorageService
from app.main import app


def test_liveness_health_endpoint(client: TestClient) -> None:
    """Verify GET /api/v1/health returns 200 and expected metadata."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "electrimap-backend"
    assert payload["version"] == "0.1.0"


def test_app_error_envelope() -> None:
    """Verify typed AppError serializes into the standard REST error envelope."""

    @app.get("/api/v1/_test_aoi_error")
    def trigger_aoi_error() -> None:
        raise AoiTooLargeError(area_km2=612.45, max_aoi_km2=500.0)

    with TestClient(app) as test_client:
        response = test_client.get("/api/v1/_test_aoi_error")
        assert response.status_code == 422
        body = response.json()
        assert "error" in body
        assert body["error"]["code"] == "AOI_TOO_LARGE"
        assert body["error"]["details"]["area_km2"] == 612.45
        assert body["error"]["details"]["max_aoi_km2"] == 500.0


def test_storage_service_prevents_path_traversal(tmp_path: Path) -> None:
    """Verify LocalStorageService blocks traversal outside base_dir."""
    storage = LocalStorageService(tmp_path)
    written_path, digest = storage.write_bytes("exports/sample.txt", b"electrimap-test")
    assert written_path.exists()
    assert len(digest) == 64
    assert storage.read_bytes("exports/sample.txt") == b"electrimap-test"

    with pytest.raises(ValueError, match="Unsafe storage path"):
        storage.resolve_safe_path("../../outside.txt")


def test_spike_summary_and_reference_geojson_endpoints(client: TestClient) -> None:
    """Verify GET /api/v1/spikes/summary and /api/v1/spikes/reference-geojson return 200."""
    res_summary = client.get("/api/v1/spikes/summary")
    assert res_summary.status_code == 200
    summary = res_summary.json()
    assert summary["milestone"] == "M0"
    assert "spikes" in summary

    res_geo = client.get("/api/v1/spikes/reference-geojson")
    assert res_geo.status_code == 200
    geo = res_geo.json()
    assert "villages" in geo
    assert "buildings" in geo
    assert "routes" in geo
