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

"""Integration tests for production safety, auth isolation, versioning, PDF, and export SHA."""

import base64
import io
import json
import re
import zipfile
import zlib

import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models.auth import User
from app.services.seed_service import (
    DEFAULT_PLANNER_EMAIL,
    DEFAULT_PLANNER_PASSWORD,
    DEMO_PROJECT_ID,
    SUMIT_EMAIL,
    SUMIT_PASSWORD,
    SWAYAM_EMAIL,
    ensure_seed_data,
)


def _login_headers(client: TestClient, email: str, password: str) -> dict[str, str]:
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200
    return {"X-CSRF-Token": str(resp.json()["csrf_token"])}


def _extract_pdf_text_streams(pdf_bytes: bytes) -> list[str]:
    """Decode ASCII85 + FlateDecode ReportLab streams into latin-1 text chunks."""
    streams: list[str] = []
    for match in re.finditer(rb"stream\r?\n(.*?)endstream", pdf_bytes, flags=re.DOTALL):
        raw_stream = match.group(1).strip()
        if raw_stream.endswith(b"~>"):
            raw_stream = base64.a85decode(raw_stream.removesuffix(b"~>"), adobe=False)
        try:
            decoded = zlib.decompressobj().decompress(raw_stream).decode(
                "latin-1", errors="replace"
            )
        except zlib.error:
            decoded = raw_stream.decode("latin-1", errors="replace")
        streams.append(decoded)
    return streams


def test_non_owner_cannot_mutate_demo_project_and_can_duplicate(
    seeded_client: TestClient,
) -> None:
    """Verify secondary planner gets 403 DEMO_PROJECT_READ_ONLY on Demo mutations,
    while read-only access and project duplication continue to work cleanly.
    """
    client = seeded_client
    sumit_headers = _login_headers(client, SUMIT_EMAIL, SUMIT_PASSWORD)

    read_resp = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}")
    assert read_resp.status_code == 200

    blocked_calls = [
        client.patch(
            f"/api/v1/projects/{DEMO_PROJECT_ID}",
            headers=sumit_headers,
            json={"name": "Unauthorized Rename", "version": read_resp.json()["version"]},
        ),
        client.post(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/rates/reset",
            headers=sumit_headers,
        ),
        client.post(
            f"/api/v1/projects/{DEMO_PROJECT_ID}/clustering",
            headers=sumit_headers,
        ),
        client.delete(
            f"/api/v1/projects/{DEMO_PROJECT_ID}",
            headers=sumit_headers,
        ),
    ]
    for resp in blocked_calls:
        assert resp.status_code == 403
        assert resp.json()["error"]["code"] == "DEMO_PROJECT_READ_ONLY"

    dup_resp = client.post(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/duplicate",
        headers=sumit_headers,
    )
    assert dup_resp.status_code == 201
    own_id = str(dup_resp.json()["id"])
    own_version = int(dup_resp.json()["version"])

    rename_own = client.patch(
        f"/api/v1/projects/{own_id}",
        headers=sumit_headers,
        json={"name": "Sumit Own Copy", "version": own_version},
    )
    assert rename_own.status_code == 200
    assert rename_own.json()["name"] == "Sumit Own Copy"


def test_production_seed_skips_weak_default_accounts(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Verify APP_ENV=production skips weak passwords and enforces >=12 char admin password."""
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv(
        "SESSION_SECRET",
        "strong-production-secret-at-least-32-characters-long-verified-ok",
    )
    monkeypatch.setenv("PRODUCTION_ADMIN_EMAIL", "chief.planner@gov.in")
    monkeypatch.setenv("PRODUCTION_ADMIN_PASSWORD", "Short123")
    get_settings.cache_clear()

    try:
        ensure_seed_data(db_session)
        emails = {u.email for u in db_session.execute(select(User)).scalars().all()}
        assert DEFAULT_PLANNER_EMAIL not in emails
        assert SUMIT_EMAIL not in emails
        assert SWAYAM_EMAIL not in emails
        assert "chief.planner@gov.in" not in emails

        monkeypatch.setenv("PRODUCTION_ADMIN_PASSWORD", "StrongAdminPassword#2026")
        get_settings.cache_clear()
        ensure_seed_data(db_session)

        prod_admin = db_session.execute(
            select(User).where(User.email == "chief.planner@gov.in")
        ).scalar_one_or_none()
        assert prod_admin is not None
        assert prod_admin.role == "ADMIN"
        assert prod_admin.is_active is True

        all_emails = {u.email for u in db_session.execute(select(User)).scalars().all()}
        assert DEFAULT_PLANNER_EMAIL not in all_emails
        assert SUMIT_EMAIL not in all_emails
    finally:
        get_settings.cache_clear()


def test_version_bumps_xml_escaping_pdf_streams_and_unified_export_sha(
    seeded_client: TestClient,
) -> None:
    """Verify mutations bump project.version, special XML chars render cleanly in PDF,
    PDF streams avoid VERIFIED_SUM/SOURCE_VERIFIE splits/blank pages, and SHA-256 aligns.
    """
    client = seeded_client
    headers = _login_headers(client, DEFAULT_PLANNER_EMAIL, DEFAULT_PLANNER_PASSWORD)

    create_resp = client.post(
        "/api/v1/projects",
        headers=headers,
        json={
            "name": "Koraput & Malkangiri <Block-A>",
            "description": "Tests ampersand & angle bracket escaping <v1>.",
            "target_state": "Odisha",
            "target_district": "Koraput",
            "target_block": "Nandapur",
            "village_names": "Bheja",
            "scheme": "PM-JANMAN",
            "horizon_years": 10,
            "load_tier": "TIER_3_STANDARD",
        },
    )
    assert create_resp.status_code == 201
    proj_id = str(create_resp.json()["id"])
    v0 = int(create_resp.json()["version"])

    # Step 1a: AOI mutation bumps version
    aoi_resp = client.put(
        f"/api/v1/projects/{proj_id}/aoi",
        headers=headers,
        json={
            "mode": "USER_DRAWN",
            "geojson_geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [82.720, 18.555],
                        [82.748, 18.555],
                        [82.748, 18.575],
                        [82.720, 18.575],
                        [82.720, 18.555],
                    ]
                ],
            },
        },
    )
    assert aoi_resp.status_code == 200
    v1 = int(client.get(f"/api/v1/projects/{proj_id}").json()["version"])
    assert v1 > v0

    # Step 1b: Data acquisition bumps version
    acq_resp = client.post(f"/api/v1/projects/{proj_id}/data/acquire", headers=headers)
    assert acq_resp.status_code == 200
    v2 = int(client.get(f"/api/v1/projects/{proj_id}").json()["version"])
    assert v2 > v1

    # Step 2: Clustering bumps version
    cl_resp = client.post(
        f"/api/v1/projects/{proj_id}/clustering",
        headers=headers,
        json={"eps_m": 150.0, "min_samples": 3, "household_alpha": 0.9},
    )
    assert cl_resp.status_code == 200
    v3 = int(client.get(f"/api/v1/projects/{proj_id}").json()["version"])
    assert v3 > v2

    # Step 3-5: Explicit Tie-In, Gap Analysis, Demand, Scenario & Rates
    tie_resp = client.post(
        f"/api/v1/projects/{proj_id}/infrastructure",
        headers=headers,
        json={
            "asset_type": "TIE_IN",
            "name": "Nandapur & Bheja <Tap-1>",
            "voltage_kv": 11.0,
            "provenance": "USER_ASSUMED",
            "source_note": "Assumed 11 kV tap point for regression verification.",
            "lon": 82.728,
            "lat": 18.565,
        },
    )
    assert tie_resp.status_code == 201
    gap_resp = client.post(f"/api/v1/projects/{proj_id}/gap-analysis", headers=headers)
    assert gap_resp.status_code == 200
    assert (
        client.post(f"/api/v1/projects/{proj_id}/demand/calculate", headers=headers).status_code
        == 200
    )
    assert (
        client.post(
            f"/api/v1/projects/{proj_id}/scenarios/generate",
            headers=headers,
            json={"scenario_key": "HYBRID_OPTIMAL", "preserve_manual_overrides": False},
        ).status_code
        == 200
    )
    reset_resp = client.post(f"/api/v1/projects/{proj_id}/rates/reset", headers=headers)
    assert reset_resp.status_code == 200

    pf_resp = client.get(f"/api/v1/projects/{proj_id}/report/preflight")
    assert pf_resp.status_code == 200
    pf_data = pf_resp.json()
    assert pf_data["can_export"] is True
    snap_sha = str(pf_data["snapshot_hash"])
    assert len(snap_sha) == 64

    pdf_resp = client.get(f"/api/v1/projects/{proj_id}/exports/dpr-pdf")
    assert pdf_resp.status_code == 200
    assert pdf_resp.content.startswith(b"%PDF-")
    assert pdf_resp.headers.get("x-snapshot-sha256") == snap_sha

    page_count = len(re.findall(rb"/Type\s*/Page\b", pdf_resp.content))
    assert page_count >= 8
    streams = _extract_pdf_text_streams(pdf_resp.content)
    assert len(streams) >= page_count
    assert all(len(s.strip()) > 30 for s in streams)
    joined_streams = "\n".join(streams)
    assert "VERIFIED_SUM" not in joined_streams
    assert "CALCULATED_SUM" in joined_streams
    assert "SOURCE_VERIFIE\n" not in joined_streams

    xlsx_resp = client.get(f"/api/v1/projects/{proj_id}/exports/boq-xlsx")
    assert xlsx_resp.status_code == 200
    assert xlsx_resp.headers.get("x-snapshot-sha256") == snap_sha
    wb = load_workbook(io.BytesIO(xlsx_resp.content), data_only=False)
    ws_boq = wb["BOQ & Rates"]
    boq_values = [
        str(cell.value)
        for row in ws_boq.iter_rows(values_only=False)
        for cell in row
        if cell.value is not None
    ]
    assert "Calculated Amount (INR)" in boq_values
    assert "RECONCILED_TOTAL" in boq_values
    assert "Verified Amount (INR)" not in boq_values
    assert "VERIFIED_RECONCILED_TOTAL" not in boq_values

    ws_sum = wb["Summary"]
    sum_values = [
        str(cell.value)
        for row in ws_sum.iter_rows(values_only=False)
        for cell in row
        if cell.value is not None
    ]
    assert snap_sha in sum_values

    gis_resp = client.get(f"/api/v1/projects/{proj_id}/exports/gis-package")
    assert gis_resp.status_code == 200
    with zipfile.ZipFile(io.BytesIO(gis_resp.content), mode="r") as zf:
        manifest = json.loads(zf.read("provenance_manifest.json").decode("utf-8"))
        assert manifest["snapshot_sha256"] == snap_sha
