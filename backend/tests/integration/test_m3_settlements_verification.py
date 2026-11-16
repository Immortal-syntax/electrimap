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

"""Integration tests for Milestone M3: Habitation Clustering, 4-Tier Proxy Classification,
Census 2011 Reconciliation, Append-Only Verification Ledger, CSV Import, and Preliminary DPR PDF.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.settlement import VerificationRecord
from app.services.seed_service import (
    DEFAULT_PLANNER_EMAIL,
    DEFAULT_PLANNER_PASSWORD,
    DEMO_PROJECT_ID,
)


def _login_planner(client: TestClient) -> str:
    res = client.post(
        "/api/v1/auth/login",
        json={"email": DEFAULT_PLANNER_EMAIL, "password": DEFAULT_PLANNER_PASSWORD},
    )
    assert res.status_code == 200
    csrf_token: str = res.json()["csrf_token"]
    return csrf_token


def test_m3_settlement_clustering_and_census_reconciliation(client: TestClient) -> None:
    """Verify demo project auto-clustering, custom DBSCAN run, and Census 2011 reconciliation."""
    csrf = _login_planner(client)
    headers = {"X-CSRF-Token": csrf}

    # 1. GET /clusters auto-populates Koraput Demo Project clusters on first read
    res = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/clusters")
    assert res.status_code == 200
    data = res.json()
    assert data["project_id"] == DEMO_PROJECT_ID
    assert len(data["items"]) >= 1
    assert data["geojson"]["type"] == "FeatureCollection"
    assert len(data["geojson"]["features"]) == len(data["items"])

    # Verify Census 2011 reconciliation for Bheja (Census code 428914, 128 HH in 2011)
    rec = data["census_reconciliation"]
    assert rec["census2011_code"] == "428914"
    assert rec["census_2011_households"] == 128
    assert rec["projected_base_year_households"] == 158
    assert rec["satellite_detected_buildings"] > 0
    assert rec["satellite_estimated_households"] > 0

    # Verify single cluster lookup
    first_cluster = data["items"][0]
    single_res = client.get(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/clusters/{first_cluster['id']}"
    )
    assert single_res.status_code == 200
    assert single_res.json()["label"] == first_cluster["label"]
    assert single_res.json()["proxy_confidence"] in {"MEDIUM", "LOW"}

    # 2. Trigger custom DBSCAN clustering with eps_m=180m, min_samples=3
    run_res = client.post(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/clustering",
        headers=headers,
        json={
            "eps_m": 180.0,
            "min_samples": 3,
            "household_alpha": 0.95,
            "nl_electrified_min": 0.75,
            "nl_unserved_max": 0.20,
        },
    )
    assert run_res.status_code == 200
    run_body = run_res.json()
    assert run_body["job"]["status"] == "SUCCEEDED"
    assert run_body["settlements"]["params"]["eps_m"] == 180.0
    assert len(run_body["settlements"]["items"]) >= 1

    # Verify clusters vector tile endpoint
    tile_res = client.get(f"/api/v1/tiles/{DEMO_PROJECT_ID}/clusters/14/11955/7320.mvt")
    assert tile_res.status_code == 200
    assert tile_res.headers["content-type"] == "application/vnd.mapbox-vector-tile"


def test_m3_two_axis_verification_immutability_reversal_and_csv_import(
    client: TestClient, db_session: Session
) -> None:
    """Verify two-axis epistemic separation, append-only immutability, reversal, and CSV import."""
    csrf = _login_planner(client)
    headers = {"X-CSRF-Token": csrf}

    clusters_res = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/clusters")
    assert clusters_res.status_code == 200
    clusters = clusters_res.json()["items"]
    target_cluster = clusters[0]
    original_proxy_class = target_cluster["proxy_class"]
    original_hh = target_cluster["est_households"]

    # 1. Create single verification record (Axis 2) and confirm Axis-1 proxy_class is untouched
    ver_res = client.post(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/verifications",
        headers=headers,
        json={
            "target_id": target_cluster["id"],
            "verification_state": "FIELD_VERIFIED",
            "verified_class": "POTENTIALLY_UNSERVED",
            "verified_households": original_hh + 6,
            "evidence_type": "GRAM_SABHA_RESOLUTION",
            "verifier_name": "Er. R. K. Mohanty (AE TPSODL)",
            "observed_on": "2026-03-14",
            "note": "Gram Sabha resolution & physical pole count confirmed unserved status.",
        },
    )
    assert ver_res.status_code == 201
    ver_record = ver_res.json()
    assert ver_record["cluster_label"] == target_cluster["label"]
    assert ver_record["new_value"]["verification_state"] == "FIELD_VERIFIED"
    assert ver_record["new_value"]["proxy_class_preserved"] == original_proxy_class

    # Confirm cluster state updated on Axis 2 while Axis 1 proxy_class is preserved
    updated_cluster = client.get(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/clusters/{target_cluster['id']}"
    ).json()
    assert updated_cluster["proxy_class"] == original_proxy_class
    assert updated_cluster["verification_state"] == "FIELD_VERIFIED"
    assert updated_cluster["verified_class"] == "POTENTIALLY_UNSERVED"
    assert updated_cluster["est_households"] == original_hh + 6

    # 2. Verify SQLAlchemy append-only immutability blocks direct UPDATE or DELETE
    db_rec = db_session.execute(
        select(VerificationRecord).where(VerificationRecord.id == ver_record["id"])
    ).scalar_one()
    db_rec.note = "Attempted illegal mutation"
    with pytest.raises(RuntimeError, match="immutable"):
        db_session.flush()
    db_session.rollback()

    db_rec_del = db_session.execute(
        select(VerificationRecord).where(VerificationRecord.id == ver_record["id"])
    ).scalar_one()
    db_session.delete(db_rec_del)
    with pytest.raises(RuntimeError, match="append-only"):
        db_session.flush()
    db_session.rollback()

    # 3. Reverse the verification entry via append-only reversal endpoint
    rev_res = client.post(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/verifications/{ver_record['id']}/reverse",
        headers=headers,
        json={
            "verifier_name": "Er. R. K. Mohanty (AE TPSODL)",
            "note": "Reversing entry to re-enter from signed CSV batch.",
        },
    )
    assert rev_res.status_code == 201
    rev_body = rev_res.json()
    assert rev_body["reverses_id"] == ver_record["id"]
    assert rev_body["evidence_type"] == "REVERSAL"

    restored_cluster = client.get(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/clusters/{target_cluster['id']}"
    ).json()
    assert restored_cluster["verification_state"] == "UNVERIFIED"
    assert restored_cluster["est_households"] == original_hh

    # 4. Batch CSV verification import
    lbl = target_cluster["label"]
    hh_csv = original_hh + 2
    csv_content = (
        "cluster_label,verification_state,verified_class,est_households,"
        "evidence_type,verifier_name,observed_on,note\n"
        f"{lbl},UTILITY_VERIFIED,LIKELY_ELECTRIFIED,{hh_csv},"
        "UTILITY_LEDGER,TPSODL Engineer,2026-03-15,Verified on 11kV feeder\n"
        "NON_EXISTENT_99,FIELD_VERIFIED,UNSERVED,20,"
        "FIELD_SURVEY,Surveyor,2026-03-15,Unmatched test row\n"
    ).encode()
    imp_res = client.post(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/verifications/import",
        headers=headers,
        files={"file": ("koraput_survey.csv", csv_content, "text/csv")},
    )
    assert imp_res.status_code == 201
    imp_body = imp_res.json()
    assert imp_body["row_count"] == 2
    assert imp_body["matched"] == 1
    assert imp_body["unmatched"] == 1

    # Check full verification ledger
    ledger_res = client.get(f"/api/v1/projects/{DEMO_PROJECT_ID}/verifications")
    assert ledger_res.status_code == 200
    ledger = ledger_res.json()
    assert ledger["verified_clusters"] >= 1
    assert ledger["verification_coverage_pct"] > 0.0
    assert len(ledger["records"]) >= 3
    assert len(ledger["imports"]) >= 1


def test_m3_manual_building_add_patch_and_preliminary_dpr_pdf_export(
    client: TestClient,
) -> None:
    """Verify manual building footprint add/exclude and 2-page Preliminary DPR PDF export."""
    csrf = _login_planner(client)
    headers = {"X-CSRF-Token": csrf}

    # Add a manual building inside Bheja AOI
    add_res = client.post(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/buildings",
        headers=headers,
        json={
            "lon": 82.7325,
            "lat": 18.5675,
            "area_m2": 62.0,
            "size_class": "RESIDENTIAL",
        },
    )
    assert add_res.status_code == 201
    bld_id = add_res.json()["id"]
    assert add_res.json()["is_user_added"] is True

    # Patch building to exclude it
    patch_res = client.patch(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/buildings/{bld_id}",
        headers=headers,
        json={"is_excluded": True},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["is_excluded"] is True

    # Export Preliminary Settlement DPR PDF (Sections 1-5 + Cartographic Plate 1)
    pdf_res = client.get(
        f"/api/v1/projects/{DEMO_PROJECT_ID}/exports/preliminary-settlement-pdf"
    )
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert pdf_res.content.startswith(b"%PDF-")
    assert len(pdf_res.content) > 15_000
