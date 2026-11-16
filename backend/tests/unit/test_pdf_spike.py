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

"""Unit tests for Technical Spike S3: ReportLab + Matplotlib cartographic PDF generation."""

from pathlib import Path

from scripts.spikes.s3_pdf_spike import (
    compute_scale_bar_length_m,
    generate_spike_pdf,
    render_cartographic_map_png,
)


def test_scale_bar_metric_accuracy() -> None:
    """Verify programmatic scale bar length matches metric coordinate span within 1%."""
    bar_m, label = compute_scale_bar_length_m(8000.0)
    assert bar_m == 2000.0
    assert label == "2 km"

    png_bytes, metrics = render_cartographic_map_png(map_width_m=8000.0)
    assert png_bytes.startswith(b"\x89PNG")
    assert metrics["scale_bar_accuracy_error_pct"] < 1.0
    assert metrics["crs"] == "EPSG:32644"


def test_generate_spike_pdf_produces_multi_page_document(tmp_path: Path) -> None:
    """Verify ReportLab generates a valid >=2 page PDF with non-zero bytes."""
    pdf_file = tmp_path / "test_dpr_spike.pdf"
    summary = generate_spike_pdf(pdf_file)
    assert pdf_file.exists()
    raw = pdf_file.read_bytes()
    assert raw.startswith(b"%PDF-")
    assert summary["file_size_bytes"] > 15_000
    assert summary["page_count"] >= 2

