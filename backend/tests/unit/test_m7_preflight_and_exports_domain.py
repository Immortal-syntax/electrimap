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

"""Unit tests for Milestone M7 domain pre-flight audit, 24-section catalog & SHA-256 hashing."""

from app.domain.reporting.preflight import (
    DPR_24_SECTIONS,
    compute_file_sha256,
    compute_snapshot_sha256,
    evaluate_dpr_preflight,
)


def test_dpr_24_sections_sequential_order() -> None:
    """Verify the 24 DPR sections are numbered 1..24 in strict sequential order."""
    assert len(DPR_24_SECTIONS) == 24
    numbers = [s.section_number for s in DPR_24_SECTIONS]
    assert numbers == list(range(1, 25))
    keys = [s.section_key for s in DPR_24_SECTIONS]
    assert len(set(keys)) == 24


def test_evaluate_dpr_preflight_passes_when_no_hard_blockers() -> None:
    """Verify pre-flight passes when clusters exist, rates are set, and tie-in is valid."""
    report = evaluate_dpr_preflight(
        project_id="proj-101",
        project_version=2,
        scenario_key="HYBRID_OPTIMAL",
        clusters_count=2,
        unset_rate_codes=[],
        grid_clusters_missing_tie_in=[],
        vdrop_compliance_ok=True,
        max_ht_vdrop_pct=1.45,
        max_lt_vdrop_pct=3.12,
        verification_coverage_pct=48.0,
        verified_records_count=0,
        has_existing_infra=False,
        boundary_source="HARMONISED",
        census_delta_pct=-12.4,
        total_capex_inr=4536000.0,
        npc_inr=6980000.0,
        lcoe_inr_kwh=6.21,
    )
    assert report.can_export is True
    assert report.hard_blockers_failed == 0
    assert report.requires_not_field_verified_watermark is True
    assert "NOT FIELD VERIFIED" in report.watermark_text
    assert len(report.sections) == 24

    # Sections 5 and 6 should explicitly include "No data available — reason:" when unpopulated
    sec5 = next(s for s in report.sections if s.section_number == 5)
    sec6 = next(s for s in report.sections if s.section_number == 6)
    assert sec5.is_populated is False
    assert "No data available — reason:" in sec5.data_status_note
    assert sec6.is_populated is False
    assert "No data available — reason:" in sec6.data_status_note


def test_evaluate_dpr_preflight_blocks_on_unset_rates_and_missing_tie_in() -> None:
    """Verify hard blockers fail when BOQ rates are UNSET or grid clusters lack a tie-in."""
    report = evaluate_dpr_preflight(
        project_id="proj-101",
        project_version=2,
        scenario_key="GRID_EXTENSION_ONLY",
        clusters_count=2,
        unset_rate_codes=["HT-COND-ACSR-50"],
        grid_clusters_missing_tie_in=["C-001", "C-002"],
        vdrop_compliance_ok=False,
        max_ht_vdrop_pct=6.1,
        max_lt_vdrop_pct=7.2,
        verification_coverage_pct=100.0,
        verified_records_count=4,
        has_existing_infra=True,
        boundary_source="APPROXIMATE_BUFFER",
        census_delta_pct=42.5,
        total_capex_inr=0.0,
        npc_inr=0.0,
        lcoe_inr_kwh=0.0,
    )
    assert report.can_export is False
    assert report.hard_blockers_failed == 2
    assert report.requires_not_field_verified_watermark is False
    assert all(s.is_populated for s in report.sections)


def test_deterministic_sha256_snapshot_and_file_hashes() -> None:
    """Verify key-order-independent snapshot SHA-256 and file SHA-256."""
    h1 = compute_snapshot_sha256({"b": 2, "a": 1, "nested": {"y": 10, "x": 20}})
    h2 = compute_snapshot_sha256({"a": 1, "nested": {"x": 20, "y": 10}, "b": 2})
    assert len(h1) == 64
    assert h1 == h2

    f_hash = compute_file_sha256(b"ElectriMap DPR Test Bytes")
    assert len(f_hash) == 64

