"""Integration tests for Milestone M1: Auth, CSRF, Project CRUD, AdminUnits, and AOI Uploads."""

import io
import json
import zipfile

import geopandas as gpd
from fastapi.testclient import TestClient
from shapely.geometry import Polygon
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.models.auth import User
from app.services.seed_service import DEFAULT_PLANNER_EMAIL, DEFAULT_PLANNER_PASSWORD


def _login_planner(client: TestClient) -> str:
    res = client.post(
        "/api/v1/auth/login",
        json={"email": DEFAULT_PLANNER_EMAIL, "password": DEFAULT_PLANNER_PASSWORD},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["email"] == DEFAULT_PLANNER_EMAIL
    csrf_token: str = body["csrf_token"]
    assert len(csrf_token) > 20
    return csrf_token


def test_auth_lifecycle_and_csrf_enforcement(client: TestClient) -> None:
    """Verify login, /me, CSRF enforcement on POST, and logout session revocation."""
    # Unauthenticated /me returns 401
    unauth = client.get("/api/v1/auth/me")
    assert unauth.status_code == 401
    assert unauth.json()["error"]["code"] == "UNAUTHENTICATED"

    # Wrong password returns 401
    bad_login = client.post(
        "/api/v1/auth/login",
        json={"email": DEFAULT_PLANNER_EMAIL, "password": "WrongPassword123"},
    )
    assert bad_login.status_code == 401

    csrf = _login_planner(client)

    # Authenticated /me returns 200
    me_res = client.get("/api/v1/auth/me")
    assert me_res.status_code == 200
    assert me_res.json()["user"]["role"] == "PLANNER"

    # Mutating request without X-CSRF-Token returns 403 CSRF_INVALID
    no_csrf = client.post(
        "/api/v1/projects",
        json={"name": "Missing CSRF Project"},
    )
    assert no_csrf.status_code == 403
    assert no_csrf.json()["error"]["code"] == "CSRF_INVALID"

    # Logout with valid CSRF revokes session
    logout_res = client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": csrf})
    assert logout_res.status_code == 200

    after_logout = client.get("/api/v1/auth/me")
    assert after_logout.status_code == 401


def test_project_crud_optimistic_concurrency_and_ownership_isolation(
    client: TestClient, db_session: Session
) -> None:
    """Verify Project CRUD, version conflict (409), duplication, and ownership check."""
    csrf = _login_planner(client)
    headers = {"X-CSRF-Token": csrf}

    # Create project
    create_res = client.post(
        "/api/v1/projects",
        headers=headers,
        json={
            "name": "Pottangi Tribal Electrification DPR",
            "description": "Pre-feasibility study for Pottangi Block",
            "scheme": "DA-JGUA / RDSS",
            "target_state": "Odisha",
            "target_district": "Koraput",
            "target_block": "Pottangi",
        },
    )
    assert create_res.status_code == 201
    proj = create_res.json()
    project_id = proj["id"]
    assert proj["version"] == 1
    assert proj["status"] == "DRAFT"

    # Update project with valid version=1 -> version becomes 2
    patch_ok = client.patch(
        f"/api/v1/projects/{project_id}",
        headers=headers,
        json={"version": 1, "name": "Pottangi Block Updated DPR", "horizon_years": 15},
    )
    assert patch_ok.status_code == 200
    assert patch_ok.json()["version"] == 2
    assert patch_ok.json()["horizon_years"] == 15

    # Stale update with version=1 -> 409 VERSION_CONFLICT
    patch_stale = client.patch(
        f"/api/v1/projects/{project_id}",
        headers=headers,
        json={"version": 1, "name": "Stale Overwrite Attempt"},
    )
    assert patch_stale.status_code == 409
    assert patch_stale.json()["error"]["code"] == "VERSION_CONFLICT"

    # Duplicate project
    dup_res = client.post(
        f"/api/v1/projects/{project_id}/duplicate",
        headers=headers,
    )
    assert dup_res.status_code == 201
    dup_proj = dup_res.json()
    assert dup_proj["id"] != project_id
    assert "(Copy)" in dup_proj["name"]

    # Create a second planner user and verify they cannot access User 1's project (returns 404)
    other_user = User(
        email="other.planner@electrimap.in",
        password_hash=hash_password("OtherPass#2026"),
        display_name="Other Planner",
        role="PLANNER",
        is_active=True,
    )
    db_session.add(other_user)
    db_session.commit()

    login_other = client.post(
        "/api/v1/auth/login",
        json={"email": "other.planner@electrimap.in", "password": "OtherPass#2026"},
    )
    assert login_other.status_code == 200
    forbidden_res = client.get(f"/api/v1/projects/{project_id}")
    assert forbidden_res.status_code == 404
    assert forbidden_res.json()["error"]["code"] == "PROJECT_NOT_FOUND"

    # Log back in as primary planner and soft-delete the duplicate
    csrf = _login_planner(client)
    del_res = client.delete(
        f"/api/v1/projects/{dup_proj['id']}",
        headers={"X-CSRF-Token": csrf},
    )
    assert del_res.status_code == 204
    assert client.get(f"/api/v1/projects/{dup_proj['id']}").status_code == 404


def test_admin_unit_cascade_search_and_boundary_fallback(client: TestClient) -> None:
    """Verify cascading AdminUnit lookup, search, harmonised boundary, and buffer fallback."""
    _login_planner(client)

    states = client.get("/api/v1/admin-units?level=STATE").json()
    assert any(s["lgd_code"] == "21" and s["name"] == "Odisha" for s in states)

    districts = client.get("/api/v1/admin-units?parent=21&level=DISTRICT").json()
    assert any(d["lgd_code"] == "360" and d["name"] == "Koraput" for d in districts)

    search_res = client.get("/api/v1/admin-units/search?q=Bheja").json()
    assert any(u["lgd_code"] == "398712" for u in search_res)

    # Harmonised village boundary (Bheja 398712)
    bheja_bound = client.get("/api/v1/admin-units/398712/boundary").json()
    assert bheja_bound["boundary_source"] == "HARMONISED"
    assert bheja_bound["census_info"]["households"] == 128

    # Approximate buffer fallback village (Maliaguda 398719)
    approx_bound = client.get("/api/v1/admin-units/398719/boundary").json()
    assert approx_bound["boundary_source"] == "APPROXIMATE_BUFFER"
    assert "APPROXIMATE_BOUNDARY_BUFFER_1500M" in approx_bound["warnings"]
    assert 6.9 < approx_bound["area_km2"] < 7.2


def test_set_aoi_and_multipart_file_uploads(client: TestClient, tmp_path) -> None:
    """Verify setting AOI via ADMIN_UNIT, USER_DRAWN, GeoJSON, KML, and Shapefile .zip."""
    csrf = _login_planner(client)
    headers = {"X-CSRF-Token": csrf}

    proj = client.post(
        "/api/v1/projects",
        headers=headers,
        json={"name": "AOI Validation Test Project"},
    ).json()
    pid = proj["id"]

    # 1. Set AOI by ADMIN_UNIT (398712 Bheja)
    put_admin = client.put(
        f"/api/v1/projects/{pid}/aoi",
        headers=headers,
        json={"mode": "ADMIN_UNIT", "lgd_code": "398712"},
    )
    assert put_admin.status_code == 200
    assert put_admin.json()["boundary_source"] == "HARMONISED"
    assert put_admin.json()["lgd_code"] == "398712"

    # 2. Set AOI by USER_DRAWN polygon
    drawn_geom = {
        "type": "Polygon",
        "coordinates": [
            [
                [82.71, 18.55],
                [82.75, 18.55],
                [82.75, 18.58],
                [82.71, 18.58],
                [82.71, 18.55],
            ]
        ],
    }
    put_drawn = client.put(
        f"/api/v1/projects/{pid}/aoi",
        headers=headers,
        json={"mode": "USER_DRAWN", "geojson_geometry": drawn_geom},
    )
    assert put_drawn.status_code == 200
    assert put_drawn.json()["boundary_source"] == "USER_DRAWN"

    # 3. Upload GeoJSON file
    geojson_bytes = json.dumps(
        {"type": "Feature", "properties": {}, "geometry": drawn_geom}
    ).encode("utf-8")
    up_geojson = client.post(
        f"/api/v1/projects/{pid}/aoi/upload",
        headers=headers,
        files={"file": ("custom_aoi.geojson", geojson_bytes, "application/geo+json")},
    )
    assert up_geojson.status_code == 200
    assert up_geojson.json()["boundary_source"] == "USER_UPLOADED"
    assert up_geojson.json()["upload_filename"] == "custom_aoi.geojson"

    # 4. Upload KML file
    kml_bytes = b"""<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2">
      <Placemark>
        <Polygon>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>
                82.71,18.55,0 82.75,18.55,0 82.75,18.58,0 82.71,18.58,0 82.71,18.55,0
              </coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>
      </Placemark>
    </kml>"""
    up_kml = client.post(
        f"/api/v1/projects/{pid}/aoi/upload",
        headers=headers,
        files={"file": ("bheja.kml", kml_bytes, "application/vnd.google-earth.kml+xml")},
    )
    assert up_kml.status_code == 200
    assert up_kml.json()["upload_filename"] == "bheja.kml"

    # 5. Upload valid Shapefile .zip in UTM 44N (EPSG:32644) -> reprojected to EPSG:4326
    shp_dir = tmp_path / "shp_valid"
    shp_dir.mkdir()
    poly_wgs84 = Polygon(
        [
            (82.71, 18.55),
            (82.75, 18.55),
            (82.75, 18.58),
            (82.71, 18.58),
            (82.71, 18.55),
        ]
    )
    gdf = gpd.GeoDataFrame({"name": ["Bheja"]}, geometry=[poly_wgs84], crs="EPSG:4326").to_crs(
        epsg=32644
    )
    shp_path = shp_dir / "aoi_utm.shp"
    gdf.to_file(shp_path)

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for part in shp_dir.iterdir():
            zf.write(part, arcname=part.name)
    up_shp = client.post(
        f"/api/v1/projects/{pid}/aoi/upload",
        headers=headers,
        files={"file": ("aoi_utm.zip", zip_buf.getvalue(), "application/zip")},
    )
    assert up_shp.status_code == 200
    assert "32644" in (up_shp.json()["original_crs"] or "")

    # 6. Reject Shapefile .zip missing .prj with 422 MISSING_CRS_PRJ
    zip_no_prj = io.BytesIO()
    with zipfile.ZipFile(zip_no_prj, "w", zipfile.ZIP_DEFLATED) as zf:
        for part in shp_dir.iterdir():
            if part.suffix.lower() != ".prj":
                zf.write(part, arcname=part.name)
    bad_shp = client.post(
        f"/api/v1/projects/{pid}/aoi/upload",
        headers=headers,
        files={"file": ("no_prj.zip", zip_no_prj.getvalue(), "application/zip")},
    )
    assert bad_shp.status_code == 422
    assert bad_shp.json()["error"]["code"] == "MISSING_CRS_PRJ"
