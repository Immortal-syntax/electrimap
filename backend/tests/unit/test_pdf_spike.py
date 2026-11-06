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

