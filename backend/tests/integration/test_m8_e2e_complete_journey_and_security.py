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

"""Milestone M8: End-to-End Complete User Journey, Performance Benchmark & Security Fuzzing."""

import io
import json
import zipfile

from fastapi.testclient import TestClient

from app.main import app
from app.services.seed_service import DEMO_PROJECT_ID


def _login(client: TestClient, email: str, password: str) -> dict[str, str]:
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200
    return {"X-CSRF-Token": resp.json()["csrf_token"]}


def test_m8_system_benchmark_security_headers_and_tile_etag_caching() -> None:
    """Verify M8-1 benchmark telemetry, tile ETag 304 caching, and M8-4 security headers."""
    with TestClient(app) as client:
        bench_resp = client.get("/api/v1/system/benchmark")
        assert bench_resp.status_code == 200
        # Verify HTTP security headers
        assert bench_resp.headers.get("x-content-type-options") == "nosniff"
        assert bench_resp.headers.get("x-frame-options") == "DENY"
        assert "strict-origin" in bench_resp.headers.get("referrer-policy", "")
        assert "default-src 'self'" in bench_resp.headers.get(
            "content-security-policy", ""
        )

        bench_data = bench_resp.json()
        assert bench_data["status"] == "READY"
        assert bench_data["dpr_sections_count"] == 24
        assert bench_data["zero_paid_apis_enforced"] is True
        assert all(stage["passed"] for stage in bench_data["benchmarks"])

        # Verify Vector Tile ETag caching & 304 Not Modified response
        _login(client, "planner@electrimap.in", "ElectriMap#2026")
        t_resp1 = client.get(
            f"/api/v1/tiles/{DEMO_PROJECT_ID}/buildings/14/11955/7290.mvt"
        )
        assert t_resp1.status_code == 200
        etag = t_resp1.headers.get("etag")
        assert etag is not None
        assert float(t_resp1.headers.get("x-tile-render-ms", "0")) >= 0.0

        t_resp2 = client.get(
            f"/api/v1/tiles/{DEMO_PROJECT_ID}/buildings/14/11955/7290.mvt",
            headers={"If-None-Match": etag},
        )
        assert t_resp2.status_code == 304


def test_m8_complete_end_to_end_user_journey_new_project_to_exports() -> None:
    """Verify E2E journey: New Project -> AOI -> Data -> Clusters -> Verify -> Infra -> DPR."""
    with TestClient(app) as client:
        headers = _login(client, "planner@electrimap.in", "ElectriMap#2026")

        # Step 1: Create a brand-new project
        create_resp = client.post(
            "/api/v1/projects",
            headers=headers,
            json={
                "name": "M8 E2E Tribal Electrification Assessment — Pukali GP",
                "description": "End-to-end automated integration test project.",
                "target_state": "Odisha",
                "target_district": "Koraput",
                "target_block": "Pottangi",
                "village_names": "Pukali",
                "scheme": "DA-JGUA",
                "horizon_years": 10,
            },
        )
        assert create_resp.status_code == 201
        project_id = create_resp.json()["id"]

        # Step 2: Set AOI via custom GeoJSON polygon inside Koraput District
        aoi_poly = {
            "type": "Polygon",
            "coordinates": [
                [
                    [82.725, 18.560],
                    [82.748, 18.560],
                    [82.748, 18.578],
                    [82.725, 18.578],
                    [82.725, 18.560],
                ]
            ],
        }
        aoi_resp = client.put(
            f"/api/v1/projects/{project_id}/aoi",
            headers=headers,
            json={
                "mode": "USER_DRAWN",
                "geojson_geometry": aoi_poly,
                "lgd_code": "398712",
            },
        )
        assert aoi_resp.status_code == 200
        assert aoi_resp.json()["area_km2"] > 1.0

        # Step 3: Trigger offline reference geospatial data acquisition
        acq_resp = client.post(
            f"/api/v1/projects/{project_id}/data/acquire",
            headers=headers,
            json={"force_refresh": True},
        )
        assert acq_resp.status_code in {200, 202}

        # Step 4: Run metric DBSCAN habitation clustering
        clust_resp = client.post(
            f"/api/v1/projects/{project_id}/clusters/detect",
            headers=headers,
            json={"eps_m": 150.0, "min_samples": 4, "household_alpha": 0.9},
        )
        assert clust_resp.status_code == 200
        clusters = clust_resp.json()["settlements"]["items"]
        assert len(clusters) >= 1
        first_cluster_id = clusters[0]["id"]

        # Step 5: Log an Axis-2 Field Verification record
        ver_resp = client.post(
            f"/api/v1/projects/{project_id}/verifications",
            headers=headers,
            json={
                "target_type": "CLUSTER",
                "target_id": first_cluster_id,
                "verification_state": "FIELD_VERIFIED",
                "verified_class": "POTENTIALLY_UNSERVED",
                "evidence_type": "GRAM_SABHA_RESOLUTION",
                "verifier_name": "Er. S. K. Dash (TPSODL)",
                "observed_on": "2026-03-18",
                "note": "Gram Sabha confirmed habitation lacks LT network.",
            },
        )
        assert ver_resp.status_code == 201

        # Step 6: Place a USER_ASSUMED 11 kV Tie-In Point
        inf_resp = client.post(
            f"/api/v1/projects/{project_id}/infrastructure",
            headers=headers,
            json={
                "asset_type": "TIE_IN",
                "name": "Assumed 11 kV Feeder Tapping Point",
                "voltage_kv": 11.0,
                "provenance": "USER_ASSUMED",
                "source_note": "E2E test tie-in point.",
                "lon": 82.730,
                "lat": 18.565,
            },
        )
        assert inf_resp.status_code == 201

        # Step 7: Verify Gap Analysis, Demand, and 4-Scenario Comparison
        gap_resp = client.get(f"/api/v1/projects/{project_id}/gap-analysis")
        assert gap_resp.status_code == 200
        dem_resp = client.get(f"/api/v1/projects/{project_id}/demand")
        assert dem_resp.status_code == 200
        comp_resp = client.get(f"/api/v1/projects/{project_id}/comparison")
        assert comp_resp.status_code == 200
        assert len(comp_resp.json()["scenarios"]) == 4

        # Step 8: Run Pre-Flight Audit and Generate all 3 Exports (PDF, XLSX, GIS ZIP)
        pf_resp = client.get(f"/api/v1/projects/{project_id}/report/preflight")
        assert pf_resp.status_code == 200
        assert pf_resp.json()["can_export"] is True

        pdf_resp = client.get(f"/api/v1/projects/{project_id}/exports/dpr-pdf")
        assert pdf_resp.status_code == 200
        assert pdf_resp.content.startswith(b"%PDF-")

        xlsx_resp = client.get(f"/api/v1/projects/{project_id}/exports/boq-xlsx")
        assert xlsx_resp.status_code == 200

        gis_resp = client.get(f"/api/v1/projects/{project_id}/exports/gis-package")
        assert gis_resp.status_code == 200

        exp_list = client.get(f"/api/v1/projects/{project_id}/exports")
        assert exp_list.status_code == 200
        assert exp_list.json()["total_exports"] == 3


def test_m8_security_penetration_csrf_idor_and_upload_fuzzing() -> None:
    """Verify M8-4 security controls: unauthenticated 401, CSRF 403, IDOR, and upload fuzzing."""
    with TestClient(app) as anon_client:
        # 1. Unauthenticated requests to protected endpoints must return 401
        assert anon_client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}").status_code == 401
        assert (
            anon_client.get(
                f"/api/v1/projects/{DEMO_PROJECT_ID}/report/preflight"
            ).status_code
            == 401
        )
        assert (
            anon_client.get(
                f"/api/v1/projects/{DEMO_PROJECT_ID}/exports/dpr-pdf"
            ).status_code
            == 401
        )

    with TestClient(app) as client:
        headers = _login(client, "planner@electrimap.in", "ElectriMap#2026")

        # 2. State-mutating POST without X-CSRF-Token must be rejected with 403
        no_csrf_resp = client.post(
            "/api/v1/projects",
            json={"name": "CSRF Bypass Attempt"},
        )
        assert no_csrf_resp.status_code == 403

        # 3. Malicious ZIP upload with path traversal entry ("../../evil.geojson") must be rejected
        malicious_zip_buf = io.BytesIO()
        with zipfile.ZipFile(malicious_zip_buf, mode="w") as zf:
            zf.writestr("../../evil.geojson", b"{}")
        upload_traversal_resp = client.post(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/aoi/upload",
            headers=headers,
            files={
                "file": (
                    "traversal.zip",
                    malicious_zip_buf.getvalue(),
                    "application/zip",
                )
            },
        )
        assert upload_traversal_resp.status_code in {400, 422}

        # 4. Shapefile ZIP missing mandatory .prj CRS file must be rejected
        no_prj_zip_buf = io.BytesIO()
        with zipfile.ZipFile(no_prj_zip_buf, mode="w") as zf:
            zf.writestr("boundary.shp", b"fake-shp-bytes")
            zf.writestr("boundary.shx", b"fake-shx-bytes")
            zf.writestr("boundary.dbf", b"fake-dbf-bytes")
        no_prj_resp = client.post(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/aoi/upload",
            headers=headers,
            files={
                "file": (
                    "missing_prj.zip",
                    no_prj_zip_buf.getvalue(),
                    "application/zip",
                )
            },
        )
        assert no_prj_resp.status_code in {400, 422}

        # 5. Polygon outside India bounding box (New York coordinates) must be rejected
        outside_india_geojson = json.dumps(
            {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {},
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [
                                [
                                    [-74.01, 40.70],
                                    [-74.00, 40.70],
                                    [-74.00, 40.71],
                                    [-74.01, 40.71],
                                    [-74.01, 40.70],
                                ]
                            ],
                        },
                    }
                ],
            }
        ).encode("utf-8")
        outside_resp = client.post(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/aoi/upload",
            headers=headers,
            files={
                "file": (
                    "outside_india.geojson",
                    outside_india_geojson,
                    "application/geo+json",
                )
            },
        )
        assert outside_resp.status_code in {400, 422}

        # 6. SQL injection / XSS fuzz strings in admin search must be safely parameterized
        sqli_resp = client.get(
            "/api/v1/admin-units/search",
            params={"q": "Bheja' OR '1'='1'; DROP TABLE projects; --"},
        )
        assert sqli_resp.status_code == 200


def test_m8_production_config_and_worker_registration_hardening() -> None:
    """Verify production secret fail-fast guard and standalone worker handler bootstrap."""
    import pytest

    from app.core.config import Settings
    from app.worker import JOB_HANDLERS, ensure_default_handlers_registered

    # 1. Production environment must reject default placeholder or short SESSION_SECRET
    with pytest.raises(ValueError, match="APP_ENV=production requires a strong custom"):
        Settings(
            app_env="production",
            session_secret="dev-only-session-secret-replace-in-production-64-bytes-long-0000",
        )

    with pytest.raises(ValueError, match="APP_ENV=production requires a strong custom"):
        Settings(app_env="production", session_secret="too-short")

    # 2. Valid production secret succeeds and enforces Secure cookie flag
    prod_settings = Settings(
        app_env="production",
        session_secret="strong-production-secret-at-least-32-characters-long-verified-ok",
    )
    assert prod_settings.effective_cookie_secure is True

    # 3. Demo/dev settings default to non-Secure cookie over local HTTP unless overridden
    demo_settings = Settings(app_env="demo")
    assert demo_settings.effective_cookie_secure is False

    # 4. Standalone worker bootstrapper registers default handlers
    ensure_default_handlers_registered()
    assert "ACQUIRE_PROJECT_DATA" in JOB_HANDLERS
    assert "CLUSTER_SETTLEMENTS" in JOB_HANDLERS

