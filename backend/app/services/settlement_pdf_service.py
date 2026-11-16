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

"""Preliminary DPR PDF Skeleton Generator (Sections 1-5 + Cartographic Map Plate).

Implements Task M3-7:
- Section 1: Executive Summary & Epistemic Honesty Notice
- Section 2: Administrative & Geographic Profile
- Section 3: Geospatial Dataset Provenance Table
- Section 4: Habitation Cluster & Two-Axis Classification Inventory + Census 2011 Reconciliation
- Section 5: Verification Audit Ledger Summary
- Page 2: Full-Page UTM (EPSG:32644) Cartographic Map Plate of AOI, Buildings, and Clusters
  with Okabe-Ito color-blind-safe proxy palette, metric scale bar, north arrow, graticule, and
  preliminary engineering watermark.
"""

import html
import io
from datetime import UTC, datetime
from typing import Any

import matplotlib
import matplotlib.patches as mpatches
import matplotlib.pyplot as plt
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import (
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from shapely.geometry import (
    LineString,
    MultiLineString,
    MultiPoint,
    MultiPolygon,
    Point,
    Polygon,
    shape,
)
from shapely.geometry.base import BaseGeometry
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models.auth import User
from app.db.models.project import ProjectAoi
from app.db.models.spatial import Building
from app.domain.gis.crs import project_geometry
from app.domain.reporting.preflight import evaluate_dpr_preflight
from app.services.costing_service import (
    get_project_scenario_comparison,
    list_project_rates,
)
from app.services.data_service import list_project_layers_with_provenance
from app.services.infrastructure_service import (
    compute_and_persist_gap_analysis,
    compute_and_persist_project_demand,
    get_project_settings_state,
    list_project_infrastructure,
)
from app.services.planning_service import (
    get_project_scenarios,
    list_engineering_constants,
)
from app.services.project_service import get_owned_project_or_404
from app.services.settlement_service import (
    get_project_settlement_state,
    get_project_verification_ledger,
)

matplotlib.use("Agg")

OKABE_ITO_PROXY_COLORS: dict[str, str] = {
    "LIKELY_ELECTRIFIED": "#0072B2",
    "POTENTIALLY_UNDERSERVED": "#E69F00",
    "POTENTIALLY_UNSERVED": "#D55E00",
    "UNKNOWN": "#6C757D",
}


def _format_utm_zone_label(metric_epsg: int) -> str:
    """Format an EPSG UTM code (e.g., 32644 -> 'UTM Zone 44N') dynamically."""
    if 32601 <= metric_epsg <= 32660:
        return f"UTM Zone {metric_epsg - 32600}N"
    if 32701 <= metric_epsg <= 32760:
        return f"UTM Zone {metric_epsg - 32700}S"
    return f"EPSG:{metric_epsg}"


def _render_settlement_map_plate_png(
    *,
    project_name: str,
    aoi_geom_wgs84: BaseGeometry | None,
    buildings: list[Building],
    clusters_geojson: dict[str, Any],
    metric_epsg: int = 32644,
) -> bytes:
    """Render a high-DPI UTM cartographic map plate of AOI, buildings, and habitation clusters."""
    fig, ax = plt.subplots(figsize=(7.2, 5.2), dpi=180)
    fig.patch.set_facecolor("#F8FAFC")
    ax.set_facecolor("#F1F5F9")

    all_xs: list[float] = []
    all_ys: list[float] = []

    if aoi_geom_wgs84 is not None and not aoi_geom_wgs84.is_empty:
        aoi_utm = project_geometry(aoi_geom_wgs84, source_epsg=4326, target_epsg=metric_epsg)
        aoi_polys = (
            list(aoi_utm.geoms)
            if isinstance(aoi_utm, MultiPolygon)
            else ([aoi_utm] if isinstance(aoi_utm, Polygon) else [])
        )
        for idx_p, a_poly in enumerate(aoi_polys):
            xs, ys = a_poly.exterior.xy
            ax.plot(
                xs,
                ys,
                color="#0F172A",
                linewidth=1.8,
                linestyle="--",
                label="Project AOI" if idx_p == 0 else None,
            )
            ax.fill(xs, ys, color="#E2E8F0", alpha=0.35)
            all_xs.extend(xs)
            all_ys.extend(ys)

    # Plot cluster polygons colored by Axis-1 proxy class (with anti-overlap label nudging)
    placed_labels: list[tuple[float, float]] = []
    for _idx_f, feat in enumerate(clusters_geojson.get("features", [])):
        props = feat.get("properties", {})
        geom_dict = feat.get("geometry", {})
        coords = geom_dict.get("coordinates", [])
        if geom_dict.get("type") == "Polygon" and coords:
            ring = coords[0]
            poly_wgs = Polygon([(pt[0], pt[1]) for pt in ring])
            poly_utm = project_geometry(poly_wgs, source_epsg=4326, target_epsg=metric_epsg)
            if isinstance(poly_utm, Polygon):
                c_xs, c_ys = poly_utm.exterior.xy
                p_class = str(props.get("proxy_class", "UNKNOWN"))
                v_state = str(props.get("verification_state", "UNVERIFIED"))
                fill_hex = OKABE_ITO_PROXY_COLORS.get(p_class, "#6C757D")
                line_style = "-" if v_state != "UNVERIFIED" else ":"
                line_w = 2.0 if v_state != "UNVERIFIED" else 1.2
                ax.fill(c_xs, c_ys, color=fill_hex, alpha=0.28)
                ax.plot(c_xs, c_ys, color=fill_hex, linewidth=line_w, linestyle=line_style)
                cx, cy = poly_utm.centroid.x, poly_utm.centroid.y
                all_xs.extend(c_xs)
                all_ys.extend(c_ys)

                lbl_x, lbl_y = cx, cy
                for step_i in range(16):
                    if step_i == 0:
                        cand_x, cand_y = cx, cy
                    else:
                        ring = 1 + (step_i - 1) // 6
                        ang_idx = (step_i - 1) % 6
                        dx_opts = [0.0, 720.0, 720.0, 0.0, -720.0, -720.0]
                        dy_opts = [380.0, 260.0, -260.0, -380.0, -260.0, 260.0]
                        cand_x = cx + dx_opts[ang_idx] * ring
                        cand_y = cy + dy_opts[ang_idx] * ring
                    if all(
                        ((cand_x - ox) ** 2 + (cand_y - oy) ** 2) ** 0.5 > 560.0
                        for ox, oy in placed_labels
                    ):
                        lbl_x, lbl_y = cand_x, cand_y
                        break
                placed_labels.append((lbl_x, lbl_y))

                label_txt = f"{props.get('label', 'CL')} ({props.get('est_households', 0)} HH)"
                use_leader = abs(lbl_x - cx) > 10.0 or abs(lbl_y - cy) > 10.0
                ax.annotate(
                    label_txt,
                    xy=(cx, cy),
                    xytext=(lbl_x, lbl_y),
                    fontsize=5.8,
                    fontweight="bold",
                    ha="center",
                    va="center",
                    color="#0F172A",
                    bbox={
                        "boxstyle": "round,pad=0.18",
                        "facecolor": "#FFFFFF",
                        "edgecolor": fill_hex,
                        "alpha": 0.90,
                    },
                    arrowprops=(
                        {"arrowstyle": "-", "color": "#475569", "lw": 0.6}
                        if use_leader
                        else None
                    ),
                    zorder=6,
                )

    # Plot building centroids in UTM
    bld_xs: list[float] = []
    bld_ys: list[float] = []
    for b in buildings:
        if b.centroid is not None and not b.is_excluded:
            pt_utm = project_geometry(b.centroid, source_epsg=4326, target_epsg=metric_epsg)
            c_pt = pt_utm.centroid
            bld_xs.append(float(c_pt.x))
            bld_ys.append(float(c_pt.y))
    if bld_xs:
        ax.scatter(
            bld_xs,
            bld_ys,
            s=8,
            c="#1E293B",
            alpha=0.75,
            edgecolors="none",
            label="Building Footprints",
            zorder=4,
        )

    # Metric scale bar & North arrow
    if all_xs and all_ys:
        min_x, max_x = min(all_xs), max(all_xs)
        min_y, max_y = min(all_ys), max(all_ys)
        span_x = max(500.0, max_x - min_x)
        span_y = max(500.0, max_y - min_y)
        pad_x = span_x * 0.10
        pad_y = span_y * 0.12
        ax.set_xlim(min_x - pad_x, max_x + pad_x)
        ax.set_ylim(min_y - pad_y, max_y + pad_y)

        # 500 m scale bar in bottom-left
        sb_x0 = min_x - pad_x * 0.5
        sb_y0 = min_y - pad_y * 0.6
        ax.plot([sb_x0, sb_x0 + 500.0], [sb_y0, sb_y0], color="#0F172A", linewidth=3.0)
        ax.text(
            sb_x0 + 250.0,
            sb_y0 + span_y * 0.025,
            f"500 m ({_format_utm_zone_label(metric_epsg)})",
            fontsize=6.5,
            ha="center",
            color="#0F172A",
            fontweight="bold",
        )

        # North arrow in top-right
        na_x = max_x + pad_x * 0.45
        na_y = max_y + pad_y * 0.35
        ax.annotate(
            "N",
            xy=(na_x, na_y),
            xytext=(na_x, na_y - span_y * 0.08),
            ha="center",
            va="center",
            fontsize=9,
            fontweight="bold",
            color="#0F172A",
            arrowprops={"arrowstyle": "->", "lw": 1.8, "color": "#0F172A"},
        )

    ax.set_title(
        f"PLATE 1: CLUSTERS & CLASSIFICATION — {project_name[:32].upper()}",
        fontsize=7.6,
        fontweight="bold",
        color="#0F172A",
        pad=10,
    )
    ax.set_xlabel(f"Easting (m) — EPSG:{metric_epsg}", fontsize=7, color="#334155")
    ax.set_ylabel(f"Northing (m) — EPSG:{metric_epsg}", fontsize=7, color="#334155")
    ax.tick_params(labelsize=6.5, colors="#475569")
    ax.grid(True, linestyle=":", linewidth=0.5, color="#94A3B8", alpha=0.6)
    ax.set_aspect("equal", adjustable="datalim")

    # Legend with Okabe-Ito classes
    legend_handles = [
        mpatches.Patch(color="#0072B2", alpha=0.55, label="Likely Electrified (Proxy)"),
        mpatches.Patch(color="#E69F00", alpha=0.55, label="Potentially Underserved (Proxy)"),
        mpatches.Patch(color="#D55E00", alpha=0.55, label="Potentially Unserved (Proxy)"),
        mpatches.Patch(color="#6C757D", alpha=0.55, label="Unknown / Low Confidence"),
    ]
    ax.legend(
        handles=legend_handles,
        loc="lower right",
        fontsize=6,
        framealpha=0.92,
        facecolor="#FFFFFF",
        edgecolor="#CBD5E1",
    )

    buf = io.BytesIO()
    fig.tight_layout()
    fig.savefig(buf, format="png", dpi=180)
    plt.close(fig)
    return buf.getvalue()


def _render_network_map_plate_png(
    *,
    project_name: str,
    aoi_geom_wgs84: BaseGeometry | None,
    clusters_geojson: dict[str, Any],
    network_geojson: dict[str, Any],
    infra_assets: list[Any],
    metric_epsg: int = 32644,
    scenario_key: str = "HYBRID_OPTIMAL",
) -> bytes:
    """Render Cartographic Plate 2: proposed HT, LT MST, DTs, Mini-Grid & tie-ins."""
    fig, ax = plt.subplots(figsize=(7.2, 5.0), dpi=180)
    fig.patch.set_facecolor("#F8FAFC")
    ax.set_facecolor("#F1F5F9")

    all_xs: list[float] = []
    all_ys: list[float] = []

    if aoi_geom_wgs84 is not None and not aoi_geom_wgs84.is_empty:
        aoi_utm = project_geometry(aoi_geom_wgs84, source_epsg=4326, target_epsg=metric_epsg)
        aoi_polys = (
            list(aoi_utm.geoms)
            if isinstance(aoi_utm, MultiPolygon)
            else ([aoi_utm] if isinstance(aoi_utm, Polygon) else [])
        )
        for a_poly in aoi_polys:
            xs, ys = a_poly.exterior.xy
            ax.plot(xs, ys, color="#0F172A", linewidth=1.6, linestyle="--")
            ax.fill(xs, ys, color="#E2E8F0", alpha=0.28)
            all_xs.extend(xs)
            all_ys.extend(ys)

    for feat in clusters_geojson.get("features", []):
        geom_dict = feat.get("geometry")
        if not geom_dict:
            continue
        c_utm = project_geometry(shape(geom_dict), source_epsg=4326, target_epsg=metric_epsg)
        c_polys = (
            list(c_utm.geoms)
            if isinstance(c_utm, MultiPolygon)
            else ([c_utm] if isinstance(c_utm, Polygon) else [])
        )
        for p in c_polys:
            cxs, cys = p.exterior.xy
            ax.fill(cxs, cys, color="#CBD5E1", alpha=0.40)
            ax.plot(cxs, cys, color="#64748B", linewidth=0.9)
            all_xs.extend(cxs)
            all_ys.extend(cys)

    # Plot existing tie-in / grid assets
    for asset in infra_assets:
        geom_raw = getattr(asset, "geom", None) or getattr(asset, "geojson_geometry", None)
        if geom_raw is None:
            continue
        g_wgs = geom_raw if isinstance(geom_raw, BaseGeometry) else shape(geom_raw)
        g_utm = project_geometry(g_wgs, source_epsg=4326, target_epsg=metric_epsg)
        if isinstance(g_utm, Point):
            ax.scatter([g_utm.x], [g_utm.y], marker="^", s=70, c="#7C2D12", zorder=6)
            all_xs.append(g_utm.x)
            all_ys.append(g_utm.y)
        elif isinstance(g_utm, (LineString, MultiLineString)):
            lines = list(g_utm.geoms) if isinstance(g_utm, MultiLineString) else [g_utm]
            for ln in lines:
                lxs, lys = ln.xy
                ax.plot(lxs, lys, color="#7C2D12", linewidth=1.6, linestyle="-.", zorder=4)
                all_xs.extend(lxs)
                all_ys.extend(lys)

    # Plot proposed scenario network layers
    for feat in network_geojson.get("features", []):
        props = feat.get("properties", {})
        kind = str(props.get("feature_kind", ""))
        geom_dict = feat.get("geometry")
        if not geom_dict:
            continue
        g_utm = project_geometry(shape(geom_dict), source_epsg=4326, target_epsg=metric_epsg)
        if kind == "HT_11KV_FEEDER":
            lines = (
                list(g_utm.geoms)
                if isinstance(g_utm, MultiLineString)
                else ([g_utm] if isinstance(g_utm, LineString) else [])
            )
            for ln in lines:
                xs, ys = ln.xy
                ax.plot(xs, ys, color="#B91C1C", linewidth=2.0, zorder=5)
                all_xs.extend(xs)
                all_ys.extend(ys)
        elif kind == "LT_415V_MST":
            lines = (
                list(g_utm.geoms)
                if isinstance(g_utm, MultiLineString)
                else ([g_utm] if isinstance(g_utm, LineString) else [])
            )
            for ln in lines:
                xs, ys = ln.xy
                ax.plot(xs, ys, color="#0F766E", linewidth=1.1, zorder=4)
                all_xs.extend(xs)
                all_ys.extend(ys)
        elif kind in {"DISTRIBUTION_TRANSFORMER", "MINIGRID_HUB"}:
            pts = (
                list(g_utm.geoms)
                if isinstance(g_utm, MultiPoint)
                else ([g_utm] if isinstance(g_utm, Point) else [])
            )
            for pt in pts:
                marker = "s" if kind == "DISTRIBUTION_TRANSFORMER" else "o"
                color_hex = "#1D4ED8" if kind == "DISTRIBUTION_TRANSFORMER" else "#D97706"
                ax.scatter(
                    [pt.x],
                    [pt.y],
                    marker=marker,
                    s=36,
                    c=color_hex,
                    edgecolors="#FFFFFF",
                    linewidths=0.7,
                    zorder=6,
                )
                all_xs.append(pt.x)
                all_ys.append(pt.y)

    if all_xs and all_ys:
        min_x, max_x = min(all_xs), max(all_xs)
        min_y, max_y = min(all_ys), max(all_ys)
        span_x = max(500.0, max_x - min_x)
        span_y = max(500.0, max_y - min_y)
        pad_x = span_x * 0.10
        pad_y = span_y * 0.12
        ax.set_xlim(min_x - pad_x, max_x + pad_x)
        ax.set_ylim(min_y - pad_y, max_y + pad_y)
        sb_x0 = min_x - pad_x * 0.5
        sb_y0 = min_y - pad_y * 0.6
        ax.plot([sb_x0, sb_x0 + 500.0], [sb_y0, sb_y0], color="#0F172A", linewidth=3.0)
        ax.text(
            sb_x0 + 250.0,
            sb_y0 + span_y * 0.025,
            f"500 m ({_format_utm_zone_label(metric_epsg)})",
            fontsize=7,
            fontweight="bold",
            ha="center",
            color="#0F172A",
        )
        nx, ny = max_x + pad_x * 0.45, max_y + pad_y * 0.45
        ax.annotate(
            "N",
            xy=(nx, ny),
            xytext=(nx, ny - span_y * 0.09),
            ha="center",
            va="center",
            fontsize=9,
            fontweight="bold",
            arrowprops={"arrowstyle": "->", "lw": 1.6, "color": "#0F172A"},
        )

    ax.set_title(
        f"PLATE 2: PROPOSED NETWORK ({scenario_key}) — {project_name[:28]}",
        fontsize=7.6,
        fontweight="bold",
        color="#0F172A",
        pad=8,
    )
    ax.set_xlabel(f"Easting (m) — EPSG:{metric_epsg}", fontsize=7, color="#334155")
    ax.set_ylabel(f"Northing (m) — EPSG:{metric_epsg}", fontsize=7, color="#334155")
    ax.tick_params(labelsize=6.5, colors="#475569")
    ax.grid(True, linestyle=":", linewidth=0.5, color="#CBD5E1")

    legend_handles = [
        mpatches.Patch(color="#B91C1C", label="Proposed 11 kV HT Feeder"),
        mpatches.Patch(color="#0F766E", label="Proposed 415 V LT MST"),
        mpatches.Patch(color="#1D4ED8", label="Proposed DT Substation"),
        mpatches.Patch(color="#D97706", label="Solar PV + BESS Mini-Grid"),
        mpatches.Patch(color="#7C2D12", label="Existing Tie-In / HT Line"),
    ]
    ax.legend(
        handles=legend_handles,
        loc="lower right",
        fontsize=5.8,
        framealpha=0.92,
        facecolor="#FFFFFF",
        edgecolor="#CBD5E1",
    )

    buf = io.BytesIO()
    fig.tight_layout()
    fig.savefig(buf, format="png", dpi=180)
    plt.close(fig)
    return buf.getvalue()


def _draw_page_frame_and_watermark(
    canvas: Canvas,
    doc: SimpleDocTemplate,
    *,
    watermark_text: str = "PRELIMINARY ENGINEERING — NOT FIELD VERIFIED",
    skeleton_only: bool = False,
) -> None:
    """Draw institutional header, footer, and diagonal preliminary engineering watermark."""
    canvas.saveState()
    width, height = A4

    # Diagonal watermark
    canvas.setFont("Helvetica-Bold", 24)
    canvas.setFillColorRGB(0.82, 0.85, 0.89, alpha=0.28)
    canvas.translate(width / 2.0, height / 2.0)
    canvas.rotate(38)
    canvas.drawCentredString(0, 0, watermark_text)
    canvas.restoreState()

    canvas.saveState()
    # Top institutional rule
    canvas.setStrokeColor(colors.HexColor("#1E3A5F"))
    canvas.setLineWidth(1.2)
    canvas.line(16 * mm, height - 14 * mm, width - 16 * mm, height - 14 * mm)
    canvas.setFont("Helvetica-Bold", 7.5)
    canvas.setFillColor(colors.HexColor("#1E3A5F"))
    header_label = (
        "ELECTRIMAP DPR — STAGE 2 PRELIMINARY SETTLEMENT SKELETON (SECTIONS 1-5)"
        if skeleton_only
        else "ELECTRIMAP DPR — COMPLETE 24-SECTION PRELIMINARY DETAILED PROJECT REPORT"
    )
    canvas.drawString(
        16 * mm,
        height - 12 * mm,
        header_label,
    )
    canvas.drawRightString(
        width - 16 * mm,
        height - 12 * mm,
        f"Generated: {datetime.now(UTC).strftime('%Y-%m-%d %H:%M UTC')}",
    )

    # Bottom footer
    canvas.setStrokeColor(colors.HexColor("#CBD5E1"))
    canvas.setLineWidth(0.6)
    canvas.line(16 * mm, 14 * mm, width - 16 * mm, 14 * mm)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.HexColor("#475569"))
    canvas.drawString(
        16 * mm,
        10 * mm,
        (
            "Epistemic Notice: Proxy classifications are satellite-derived estimates "
            "and never replace utility/field verification."
        ),
    )
    canvas.drawRightString(width - 16 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


def _render_single_line_diagram_png(
    *,
    project_name: str,
    scenario: Any,
) -> tuple[bytes, int]:
    """Render a multi-row wrapped Preliminary Single-Line Diagram (<=6 clusters/row)."""
    clusters = list(scenario.clusters)
    n_cl = max(1, len(clusters))
    cols_per_row = min(6, n_cl)
    n_rows = max(1, (n_cl + cols_per_row - 1) // cols_per_row)
    row_h = 40.0
    total_h = n_rows * row_h + 10.0

    fig, ax = plt.subplots(figsize=(8.6, max(3.0, 2.35 * n_rows)), dpi=180)
    ax.set_facecolor("#FAF8F4")
    ax.set_xlim(0, 100)
    ax.set_ylim(0, total_h)
    ax.axis("off")

    has_grid = any(c.modality in {"GRID_EXTENSION", "GRID_AUGMENTATION"} for c in clusters)
    header_txt = (
        f"11 kV 3-Ph 50 Hz Bus (ACSR Rabbit) — {project_name[:28]}"
        if has_grid
        else f"OFF-GRID MINI-GRID & SHS — {project_name[:28]}"
    )
    ax.text(
        4,
        total_h - 4.2,
        header_txt,
        fontsize=7.0,
        fontweight="bold",
        color="#9B2C2C" if has_grid else "#B45309",
    )
    ax.text(
        96,
        total_h - 4.2,
        "PRELIMINARY — NOT FOR CONSTRUCTION",
        fontsize=5.8,
        fontweight="bold",
        color="#64748B",
        ha="right",
    )

    step_x = 88.0 / cols_per_row
    half_box = min(6.8, max(5.2, step_x * 0.43))

    for row_idx in range(n_rows):
        row_clusters = clusters[row_idx * cols_per_row : (row_idx + 1) * cols_per_row]
        y_top = total_h - 10.0 - row_idx * row_h
        y_bus = y_top - 2.0
        y_box_bot = y_top - 35.0
        row_has_grid = any(
            c.modality in {"GRID_EXTENSION", "GRID_AUGMENTATION"} for c in row_clusters
        )
        if row_has_grid:
            ax.plot([5, 95], [y_bus, y_bus], color="#9B2C2C", linewidth=2.2, zorder=3)

        for col_idx, cl in enumerate(row_clusters):
            cx = 6.0 + (col_idx + 0.5) * step_x
            if cl.modality in {"GRID_EXTENSION", "GRID_AUGMENTATION"}:
                ax.plot([cx, cx], [y_bus, y_box_bot + 21.0], color="#9B2C2C", linewidth=1.3)
                c1 = mpatches.Circle(
                    (cx, y_box_bot + 19.0),
                    1.8,
                    fill=False,
                    edgecolor="#1E3A5F",
                    linewidth=1.3,
                )
                c2 = mpatches.Circle(
                    (cx, y_box_bot + 16.5),
                    1.8,
                    fill=False,
                    edgecolor="#0F766E",
                    linewidth=1.3,
                )
                ax.add_patch(c1)
                ax.add_patch(c2)
                ax.plot(
                    [cx, cx],
                    [y_box_bot + 14.5, y_box_bot + 9.5],
                    color="#0F766E",
                    linewidth=1.3,
                )
                box_color = "#E0F2FE"
                title_tag = f"{cl.dt_count}x DT ({cl.total_dt_rating_kva:.0f} kVA)"
                sub_tag = f"HT {cl.ht_length_m:.0f}m | LT {cl.lt_total_length_m:.0f}m"
                v_tag = f"dV: {cl.ht_drop_pct:.1f}%/{cl.lt_drop_pct:.1f}%"
            elif cl.modality == "SOLAR_MINIGRID":
                bus_half = min(5.6, half_box * 0.85)
                ax.plot(
                    [cx - bus_half, cx + bus_half],
                    [y_box_bot + 22.0, y_box_bot + 22.0],
                    color="#D97706",
                    linewidth=2.0,
                )
                ax.text(
                    cx,
                    y_box_bot + 23.6,
                    f"PV {cl.solar_pv_kwp:.1f} kWp + {cl.bess_capacity_kwh:.0f} kWh",
                    fontsize=5.0,
                    fontweight="bold",
                    color="#B45309",
                    ha="center",
                )
                ax.plot(
                    [cx, cx],
                    [y_box_bot + 22.0, y_box_bot + 9.5],
                    color="#0F766E",
                    linewidth=1.3,
                )
                box_color = "#FEF3C7"
                title_tag = f"PCU {cl.inverter_kva:.0f} kVA MG"
                sub_tag = f"LT {cl.lt_total_length_m:.0f}m ({cl.lt_poles_count}p)"
                v_tag = f"LT dV: {cl.lt_drop_pct:.1f}%"
            else:
                box_color = "#F1F5F9"
                title_tag = f"{cl.shs_kits_count}x Standalone SHS"
                sub_tag = f"PV {cl.solar_pv_kwp:.2f} kWp | {cl.bess_capacity_kwh:.1f} kWh"
                v_tag = "Off-Grid DC/AC"

            rect = mpatches.FancyBboxPatch(
                (cx - half_box, y_box_bot),
                half_box * 2.0,
                9.5,
                boxstyle="round,pad=0.3",
                facecolor=box_color,
                edgecolor="#334155",
                linewidth=0.85,
            )
            ax.add_patch(rect)
            ax.text(
                cx,
                y_box_bot + 7.2,
                f"{cl.cluster_label} ({cl.est_households} HH)",
                fontsize=5.6,
                fontweight="bold",
                color="#0F172A",
                ha="center",
            )
            ax.text(cx, y_box_bot + 4.9, title_tag, fontsize=4.9, color="#1E293B", ha="center")
            ax.text(cx, y_box_bot + 2.8, sub_tag, fontsize=4.7, color="#334155", ha="center")
            ax.text(cx, y_box_bot + 0.9, v_tag, fontsize=4.7, color="#0F766E", ha="center")

    out = io.BytesIO()
    fig.savefig(out, format="png", bbox_inches="tight", dpi=180)
    plt.close(fig)
    return out.getvalue(), n_rows


def generate_preliminary_settlement_pdf(
    db: Session,
    *,
    project_id: str,
    user: User,
    skeleton_only: bool = False,
) -> bytes:
    """Generate the Preliminary DPR PDF (Sections 1-5 + Plate 1 when skeleton_only=True)."""
    proj = get_owned_project_or_404(db, project_id, user)
    settlements = get_project_settlement_state(db, project_id=proj.id, user=user)
    ledger = get_project_verification_ledger(db, project_id=proj.id, user=user)
    layers = list_project_layers_with_provenance(db, project_id=proj.id, user=user)

    aoi_row = db.execute(
        select(ProjectAoi).where(ProjectAoi.project_id == proj.id)
    ).scalar_one_or_none()
    buildings = (
        db.execute(select(Building).where(Building.project_id == proj.id))
        .scalars()
        .all()
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "DprTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=4,
    )
    sec_style = ParagraphStyle(
        "DprSection",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#1E3A5F"),
        spaceBefore=8,
        spaceAfter=4,
    )
    body_style = ParagraphStyle(
        "DprBody",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#1E293B"),
    )
    cell_style = ParagraphStyle(
        "DprCell",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=6.1,
        leading=7.6,
        textColor=colors.HexColor("#1E293B"),
        wordWrap="CJK",
    )
    cell_bold_style = ParagraphStyle(
        "DprCellBold",
        parent=cell_style,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#0F172A"),
    )
    cell_hdr_style = ParagraphStyle(
        "DprCellHdr",
        parent=cell_style,
        fontName="Helvetica-Bold",
        textColor=colors.white,
    )

    def _p(val: Any, *, bold: bool = False, header: bool = False) -> Paragraph:
        st = cell_hdr_style if header else (cell_bold_style if bold else cell_style)
        return Paragraph(html.escape(str(val if val is not None else "")), st)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"ElectriMap Preliminary DPR — {proj.name}",
    )

    story: list[Any] = []
    report_heading = (
        f"STAGE 2 PRELIMINARY SETTLEMENT SKELETON (SECTIONS 1-5): {proj.name.upper()}"
        if skeleton_only
        else f"COMPLETE 24-SECTION PRELIMINARY DETAILED PROJECT REPORT: {proj.name.upper()}"
    )
    story.append(Paragraph(report_heading, title_style))
    story.append(
        Paragraph(
            f"<b>State:</b> {proj.target_state or 'UNSET'} &nbsp;|&nbsp; "
            f"<b>District:</b> {proj.target_district or 'UNSET'} &nbsp;|&nbsp; "
            f"<b>Block:</b> {proj.target_block or 'UNSET'} &nbsp;|&nbsp; "
            f"<b>Metric CRS:</b> EPSG:{proj.metric_epsg} &nbsp;|&nbsp; "
            f"<b>Planning Horizon:</b> {proj.base_year} (+{proj.horizon_years} yrs)",
            body_style,
        )
    )
    story.append(Spacer(1, 3 * mm))

    # Section 1: Executive Summary
    story.append(Paragraph("1. EXECUTIVE SUMMARY & EPISTEMIC HONESTY MANDATE", sec_style))
    rec = settlements.census_reconciliation
    story.append(
        Paragraph(
            f"This preliminary engineering report documents satellite-detected footprints, "
            f"metric DBSCAN habitation clusters, and two-axis electrification classifications for "
            f"<b>{proj.name}</b>. Total clusters identified: <b>{len(settlements.items)}</b> "
            f"comprising <b>{rec.satellite_detected_buildings}</b> detected footprints and "
            f"<b>{rec.satellite_estimated_households}</b> estimated households. Current "
            f"verification coverage is <b>{settlements.verification_coverage_pct:.1f}%</b>. "
            f"All proxy classifications (Axis 1) remain strictly separated from field verification "
            f"status (Axis 2) until confirmed by physical survey.",
            body_style,
        )
    )

    # Section 2: Administrative & Geographic Profile
    story.append(Paragraph("2. ADMINISTRATIVE & GEOGRAPHIC PROFILE", sec_style))
    area_km2 = round(aoi_row.area_km2, 3) if aoi_row else 0.0
    lgd_code = aoi_row.lgd_code if aoi_row and aoi_row.lgd_code else "UNSET"
    proj_base_hh = str(rec.projected_base_year_households or "N/A")
    census_2011_hh = str(rec.census_2011_households or "N/A")
    delta_label = (
        f"{rec.delta_pct:+.1f}%"
        if rec.delta_pct is not None
        else "N/A (No Census Match)"
    )
    sec2_data = [
        [
            "Project Code / Version",
            f"{proj.id[:8]} (v{proj.version})",
            "LGD Village Code",
            lgd_code,
        ],
        [
            "AOI Area (sq. km)",
            f"{area_km2:.2f} km²",
            "Census 2011 Code",
            rec.census2011_code or "UNSET",
        ],
        [
            "Census 2011 Households",
            census_2011_hh,
            "Projected Base HH",
            proj_base_hh,
        ],
        [
            "Satellite Est. Households",
            str(rec.satellite_estimated_households),
            "Census Delta (%)",
            delta_label,
        ],
    ]
    t2 = Table(sec2_data, colWidths=[38 * mm, 48 * mm, 40 * mm, 50 * mm])
    t2.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F1F5F9")),
                ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F1F5F9")),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#0F172A")),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7.5),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                ("PADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    story.append(t2)

    # Section 3: Dataset Provenance Table
    story.append(Paragraph("3. GEOSPATIAL DATASET PROVENANCE REGISTER", sec_style))
    prov_rows = [
        [
            _p("Layer Key", header=True),
            _p("Source Dataset", header=True),
            _p("Vintage", header=True),
            _p("Resolution", header=True),
            _p("Licence", header=True),
        ]
    ]
    for lyr in layers:
        ds = lyr.dataset
        prov_rows.append(
            [
                _p(lyr.layer_key),
                _p(ds.name if ds else lyr.layer_key),
                _p(ds.temporal_coverage if ds else "2024"),
                _p(ds.spatial_resolution if ds else "-"),
                _p(ds.licence if ds else "Open"),
            ]
        )
    t3 = Table(prov_rows, colWidths=[24 * mm, 64 * mm, 24 * mm, 28 * mm, 36 * mm])
    t3.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A5F")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 6.5),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                ("PADDING", (0, 0), (-1, -1), 2.5),
            ]
        )
    )
    story.append(t3)

    # Section 4: Habitation Cluster & Two-Axis Classification Inventory
    story.append(
        Paragraph(
            "4. HABITATION CLUSTER INVENTORY &amp; TWO-AXIS CLASSIFICATION",
            sec_style,
        )
    )
    cl_rows = [
        [
            _p("Cluster", header=True),
            _p("Habitation Name", header=True),
            _p("Bldgs", header=True),
            _p("Est. HH", header=True),
            _p("Axis-1 Proxy Class", header=True),
            _p("Conf.", header=True),
            _p("Axis-2 Verification", header=True),
            _p("Slope / Canopy", header=True),
        ]
    ]
    for c in settlements.items:
        cl_rows.append(
            [
                _p(c.label, bold=True),
                _p(c.name),
                _p(str(c.n_detected)),
                _p(str(c.est_households)),
                _p(c.proxy_class),
                _p(c.proxy_confidence),
                _p(
                    f"{c.verification_state}"
                    + (f" ({c.verified_class})" if c.verified_class else "")
                ),
                _p(f"{c.slope_mean_deg:.1f}° / {c.canopy_share * 100:.0f}%"),
            ]
        )
    t4 = Table(
        cl_rows,
        colWidths=[13 * mm, 34 * mm, 11 * mm, 12 * mm, 32 * mm, 11 * mm, 41 * mm, 22 * mm],
    )
    t4.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A5F")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 6.2),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                ("PADDING", (0, 0), (-1, -1), 2.5),
            ]
        )
    )
    story.append(t4)
    story.append(Spacer(1, 1.5 * mm))
    story.append(
        Paragraph(
            f"<b>Census 2011 Reconciliation Note:</b> {html.escape(rec.reconciliation_note)}",
            body_style,
        )
    )

    # Section 5: Verification Audit Ledger Summary
    story.append(Paragraph("5. APPEND-ONLY VERIFICATION AUDIT LEDGER", sec_style))
    if not ledger.records:
        story.append(
            Paragraph(
                "No data available — reason: No field or utility verification records have "
                "been logged yet. All clusters currently carry UNVERIFIED status on Axis 2.",
                body_style,
            )
        )
    else:
        v_rows = [
            [
                _p("Cluster", header=True),
                _p("Verifier", header=True),
                _p("Observed On", header=True),
                _p("Evidence Type", header=True),
                _p("New State / Class", header=True),
                _p("Audit Note", header=True),
            ]
        ]
        for r in ledger.records:
            nv = r.new_value or {}
            v_rows.append(
                [
                    _p(r.cluster_label or r.target_id[:6], bold=True),
                    _p(r.verifier_name),
                    _p(r.observed_on),
                    _p(r.evidence_type),
                    _p(f"{nv.get('verification_state', '')} / {nv.get('verified_class', '')}"),
                    _p(r.note),
                ]
            )
        t5 = Table(v_rows, colWidths=[15 * mm, 26 * mm, 20 * mm, 26 * mm, 41 * mm, 48 * mm])
        t5.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 6.2),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                    ("PADDING", (0, 0), (-1, -1), 2.5),
                ]
            )
        )
        story.append(t5)

    # Page 2: Cartographic Map Plate + Sections 6-9 (Infrastructure, Gap Matrix & Demand)
    story.append(PageBreak())
    story.append(
        Paragraph(
            "CARTOGRAPHIC PLATE 1 — HABITATION CLUSTERS & PROXY ELECTRIFICATION ASSESSMENT",
            sec_style,
        )
    )
    map_png_bytes = _render_settlement_map_plate_png(
        project_name=proj.name,
        aoi_geom_wgs84=(
            aoi_row.geom
            if aoi_row and isinstance(aoi_row.geom, (Polygon, MultiPolygon))
            else None
        ),
        buildings=list(buildings),
        clusters_geojson=settlements.geojson,
        metric_epsg=proj.metric_epsg,
    )
    img = Image(io.BytesIO(map_png_bytes), width=174 * mm, height=118 * mm)
    story.append(img)

    if skeleton_only:
        story.append(Spacer(1, 3 * mm))
        story.append(
            Paragraph(
                "<b>Stage 2 Skeleton Scope Notice:</b> This preliminary document covers "
                "Sections 1-5 and Cartographic Plate 1 for field survey and Gram Sabha "
                "verification. Sections 6-24 (Infrastructure, Network Design, BOQ Costing, "
                "and Pre-Flight Certificate) require completing Stages 3-6.",
                body_style,
            )
        )

        def _skeleton_page_callback(canvas: Canvas, doc_obj: SimpleDocTemplate) -> None:
            _draw_page_frame_and_watermark(
                canvas,
                doc_obj,
                watermark_text="PRELIMINARY — STAGE 2 FIELD SURVEY PENDING (SECTIONS 1-5)",
                skeleton_only=True,
            )

        doc.build(
            story,
            onFirstPage=_skeleton_page_callback,
            onLaterPages=_skeleton_page_callback,
        )
        return buf.getvalue()

    infra = list_project_infrastructure(db, project_id=proj.id, user=user)
    gap = compute_and_persist_gap_analysis(db, project_id=proj.id, user=user)
    settings_state = get_project_settings_state(db, project_id=proj.id, user=user)
    demand = compute_and_persist_project_demand(db, project_id=proj.id, user=user)
    scenarios_state = get_project_scenarios(db, project_id=proj.id, user=user)
    active_scenario = scenarios_state.active_scenario

    # Section 6: Existing Electrical Infrastructure Register
    story.append(
        Paragraph(
            "6. EXISTING ELECTRICAL INFRASTRUCTURE & TIE-IN PROVENANCE",
            sec_style,
        )
    )
    if not infra.has_existing_infra:
        story.append(
            Paragraph(
                "<b>Epistemic Notice (Core Principle #4):</b> No data available — reason: "
                "No existing 11 kV / LT lines, Distribution Transformers, or tie-in points "
                "have been uploaded or placed yet (d_infra_m = UNSET). No synthetic "
                "infrastructure has been fabricated.",
                body_style,
            )
        )
    else:
        inf_rows = [
            [
                _p("Asset Type", header=True),
                _p("Name", header=True),
                _p("Voltage (kV)", header=True),
                _p("Provenance", header=True),
                _p("Quality Tag", header=True),
                _p("Source Note", header=True),
            ]
        ]
        for a in infra.items:
            inf_rows.append(
                [
                    _p(a.asset_type),
                    _p(a.name),
                    _p(f"{a.voltage_kv or '-'} kV"),
                    _p(a.provenance),
                    _p(a.quality_tag),
                    _p(a.source_note),
                ]
            )
        t6 = Table(inf_rows, colWidths=[24 * mm, 38 * mm, 18 * mm, 28 * mm, 24 * mm, 44 * mm])
        t6.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A5F")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 6.2),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                    ("PADDING", (0, 0), (-1, -1), 2.5),
                ]
            )
        )
        story.append(t6)

    # Section 7: Terrain-Weighted Distance & Obstacle Gap Matrix
    story.append(
        Paragraph(
            "7. TERRAIN-WEIGHTED DISTANCE &amp; OBSTACLE GAP ANALYSIS MATRIX",
            sec_style,
        )
    )
    gap_rows = [
        [
            _p("Cluster", header=True),
            _p("Nearest Tie-In", header=True),
            _p("d_straight (m)", header=True),
            _p("Penalty", header=True),
            _p("d_terrain (m)", header=True),
            _p("Water Crossings", header=True),
            _p("Recommended Modality", header=True),
        ]
    ]
    for g in gap.clusters:
        gap_rows.append(
            [
                _p(g.cluster_label, bold=True),
                _p(g.nearest_asset_name or "UNSET"),
                _p(f"{g.d_straight_m:.0f} m" if g.d_straight_m is not None else "UNSET"),
                _p(f"{g.terrain_penalty_factor:.2f}x"),
                _p(f"{g.d_terrain_m:.0f} m" if g.d_terrain_m is not None else "UNSET"),
                _p(str(g.water_crossings_count)),
                _p(g.recommended_modality),
            ]
        )
    t7 = Table(
        gap_rows,
        colWidths=[16 * mm, 38 * mm, 22 * mm, 16 * mm, 22 * mm, 22 * mm, 40 * mm],
    )
    t7.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A5F")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 6.2),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                ("PADDING", (0, 0), (-1, -1), 2.5),
            ]
        )
    )
    story.append(t7)

    # Section 8: Assumptions Register Summary
    story.append(
        Paragraph(
            f"8. PARAMETRIC PLANNING ASSUMPTIONS &amp; NORMATIVE OVERRIDES SUMMARY "
            f"({settings_state.user_edited_count} USER OVERRIDES)",
            sec_style,
        )
    )
    default_ref_count = len(settings_state.items) - settings_state.user_edited_count
    story.append(
        Paragraph(
            f"Total tracked engineering &amp; demand assumptions: "
            f"<b>{len(settings_state.items)}</b> "
            f"(Default Reference: <b>{default_ref_count}</b>, "
            f"Planner Overrides: <b>{settings_state.user_edited_count}</b>). Full item-by-item "
            f"audit register is presented in Section 21.",
            body_style,
        )
    )

    # Section 9: 7-Category Parametric Demand Forecast
    story.append(
        Paragraph(
            f"9. 7-CATEGORY PARAMETRIC ELECTRICITY DEMAND FORECAST "
            f"({demand.horizon_years}-YR HORIZON)",
            sec_style,
        )
    )
    coinc_setting = next(
        (s.value for s in settings_state.items if s.key == "cluster_coincidence_factor"),
        0.65,
    )
    dem_rows = [
        [
            _p("Consumer Category (Base Yr)", header=True),
            _p("Consumers", header=True),
            _p("Connected (kW)", header=True),
            _p("Demand Factor", header=True),
            _p("Max Demand (kW)", header=True),
            _p("Daily Energy (kWh/d)", header=True),
            _p("Annual Energy (MWh/yr)", header=True),
        ]
    ]
    for cat in demand.category_totals:
        dem_rows.append(
            [
                _p(cat.label),
                _p(str(cat.consumer_count)),
                _p(f"{cat.connected_kw:.2f}"),
                _p(f"{cat.demand_factor:.2f}"),
                _p(f"{cat.max_demand_kw:.2f}"),
                _p(f"{cat.energy_kwh_day:.1f}"),
                _p(f"{cat.annual_energy_mwh:.2f}"),
            ]
        )
    dem_rows.append(
        [
            _p(f"COINCIDENT BASE -> HORIZON (+{demand.horizon_years}Y)", bold=True),
            _p(f"{demand.total_households} HH", bold=True),
            _p(f"{demand.total_connected_kw:.2f} kW", bold=True),
            _p(f"Coinc. {coinc_setting:.2f}", bold=True),
            _p(f"{demand.peak_kva_base:.2f} -> {demand.peak_kva_horizon:.2f} kVA", bold=True),
            _p(
                f"{demand.energy_kwh_day_base:.1f} -> {demand.energy_kwh_day_horizon:.1f}",
                bold=True,
            ),
            _p(
                f"{demand.annual_energy_mwh_base:.2f} -> {demand.annual_energy_mwh_horizon:.2f}",
                bold=True,
            ),
        ]
    )
    t9 = Table(
        dem_rows,
        colWidths=[38 * mm, 19 * mm, 20 * mm, 20 * mm, 27 * mm, 26 * mm, 26 * mm],
    )
    t9.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A5F")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#F1F5F9")),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 6.5),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                ("PADDING", (0, 0), (-1, -1), 2.5),
            ]
        )
    )
    story.append(t9)

    # Page 3: Sections 10-14 (Network Layout Routing, Voltage Drop, Off-Grid Sizing & SLD)
    story.append(PageBreak())
    story.append(
        Paragraph(
            f"10. ELECTRIFICATION MODALITY SELECTION & SCENARIO SUMMARY "
            f"({active_scenario.scenario_key})",
            sec_style,
        )
    )
    scen_summary_rows = [
        [
            _p("Active Scenario", bold=True),
            _p(active_scenario.name),
            _p("Voltage Drop Compliance", bold=True),
            _p(
                "CEA COMPLIANT (<=5% HT, <=6% LT)"
                if active_scenario.vdrop_compliance_ok
                else "NON-COMPLIANT WARNING"
            ),
        ],
        [
            _p("11 kV HT Feeder Total", bold=True),
            _p(
                f"{active_scenario.total_ht_length_m:.1f} m "
                f"({active_scenario.total_ht_poles} poles)"
            ),
            _p("415 V LT Radial MST Total", bold=True),
            _p(
                f"{active_scenario.total_lt_length_m:.1f} m "
                f"({active_scenario.total_lt_poles} poles)"
            ),
        ],
        [
            _p("Distribution Transformers", bold=True),
            _p(
                f"{active_scenario.total_dt_count} units "
                f"({active_scenario.total_dt_capacity_kva:.0f} kVA)"
            ),
            _p("Max Voltage Drop (HT / LT)", bold=True),
            _p(
                f"{active_scenario.max_ht_vdrop_pct:.2f}% HT / "
                f"{active_scenario.max_lt_vdrop_pct:.2f}% LT"
            ),
        ],
        [
            _p("Off-Grid Solar PV + BESS", bold=True),
            _p(
                f"{active_scenario.total_solar_kwp:.2f} kWp PV / "
                f"{active_scenario.total_bess_kwh:.1f} kWh BESS"
            ),
            _p("Annual Technical Losses", bold=True),
            _p(
                f"{active_scenario.total_loss_mwh_yr:.3f} MWh/yr | "
                f"{active_scenario.total_shs_kits} SHS Kits"
            ),
        ],
    ]
    t10 = Table(scen_summary_rows, colWidths=[38 * mm, 50 * mm, 38 * mm, 50 * mm])
    t10.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F1F5F9")),
                ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F1F5F9")),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                ("PADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    story.append(t10)

    # Section 11: 11 kV HT Feeder Routing Schedule
    story.append(
        Paragraph(
            "11. 11 KV 3-PHASE HT FEEDER LEAST-COST ROUTING & POLE SCHEDULE",
            sec_style,
        )
    )
    story.append(
        Paragraph(
            f"Total 11 kV HT route length: <b>{active_scenario.total_ht_length_m:.1f} m</b> "
            f"across <b>{active_scenario.total_ht_poles}</b> 9 m PSC/RSJ supports (50 mm² ACSR "
            f"Rabbit, 65 m nominal / 45 m steep-terrain span, 1.03x sag &amp; wastage factor).",
            body_style,
        )
    )

    # Section 12: 415 V LT Radial MST Network, Voltage Drop & Technical Losses
    story.append(
        Paragraph(
            "12. 415 V LT RADIAL MST NETWORK SCHEDULE, VOLTAGE DROP & TECHNICAL LOSSES",
            sec_style,
        )
    )
    net_rows = [
        [
            "Cluster",
            "Modality",
            "DTs (kVA)",
            "11kV HT (m / poles)",
            "415V LT (m / poles)",
            "VDrop (HT / LT)",
            "Loss (MWh/yr)",
        ]
    ]
    for cl_lay in active_scenario.clusters:
        net_rows.append(
            [
                cl_lay.cluster_label,
                cl_lay.modality,
                f"{cl_lay.dt_count}x ({cl_lay.total_dt_rating_kva:.0f} kVA)"
                if cl_lay.dt_count > 0
                else "—",
                f"{cl_lay.ht_length_m:.0f} m / {cl_lay.ht_poles_count}p"
                if cl_lay.ht_length_m > 0
                else ("UNSET TIE-IN" if cl_lay.requires_tie_in else "0 m"),
                f"{cl_lay.lt_total_length_m:.0f} m / {cl_lay.lt_poles_count}p"
                if cl_lay.lt_total_length_m > 0
                else "0 m",
                f"{cl_lay.ht_drop_pct:.2f}% / {cl_lay.lt_drop_pct:.2f}%",
                f"{cl_lay.total_loss_mwh_yr:.3f} ({cl_lay.technical_loss_pct:.1f}%)",
            ]
        )
    t11 = Table(
        net_rows,
        colWidths=[16 * mm, 32 * mm, 24 * mm, 28 * mm, 28 * mm, 24 * mm, 24 * mm],
    )
    t11.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A5F")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 6.5),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                ("PADDING", (0, 0), (-1, -1), 2.5),
            ]
        )
    )
    story.append(t11)

    # Section 13: Off-Grid Solar PV, LiFePO4 BESS & Standalone SHS Sizing Schedule
    story.append(
        Paragraph(
            "13. OFF-GRID SOLAR PV, LIFEPO4 BESS & STANDALONE SHS SIZING SCHEDULE",
            sec_style,
        )
    )
    solar_rows = [
        [
            "Cluster",
            "Modality",
            "Horizon Energy (kWh/d)",
            "Solar PV (kWp)",
            "LiFePO4 BESS (kWh)",
            "Inverter (kVA)",
            "SHS Kits",
        ]
    ]
    for cl_lay in active_scenario.clusters:
        solar_rows.append(
            [
                cl_lay.cluster_label,
                cl_lay.modality,
                f"{cl_lay.energy_kwh_day_horizon:.1f} kWh/d",
                f"{cl_lay.solar_pv_kwp:.2f} kWp" if cl_lay.solar_pv_kwp > 0 else "—",
                f"{cl_lay.bess_capacity_kwh:.1f} kWh" if cl_lay.bess_capacity_kwh > 0 else "—",
                f"{cl_lay.inverter_kva:.1f} kVA" if cl_lay.inverter_kva > 0 else "—",
                str(cl_lay.shs_kits_count) if cl_lay.shs_kits_count > 0 else "—",
            ]
        )
    t13 = Table(
        solar_rows,
        colWidths=[16 * mm, 34 * mm, 30 * mm, 26 * mm, 28 * mm, 22 * mm, 20 * mm],
    )
    t13.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A5F")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 6.5),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                ("PADDING", (0, 0), (-1, -1), 2.5),
            ]
        )
    )
    story.append(t13)

    # Cartographic Plate 2: Proposed HT/LT/DT/Off-Grid Network Map
    story.append(PageBreak())
    story.append(
        Paragraph(
            f"CARTOGRAPHIC PLATE 2 — PRELIMINARY HT/LT NETWORK, DT &amp; OFF-GRID LAYOUT "
            f"({html.escape(active_scenario.scenario_key)})",
            sec_style,
        )
    )
    plate2_bytes = _render_network_map_plate_png(
        project_name=proj.name,
        aoi_geom_wgs84=(
            aoi_row.geom
            if aoi_row and isinstance(aoi_row.geom, (Polygon, MultiPolygon))
            else None
        ),
        clusters_geojson=settlements.geojson,
        network_geojson=active_scenario.network_geojson,
        infra_assets=infra.items,
        metric_epsg=proj.metric_epsg,
        scenario_key=active_scenario.scenario_key,
    )
    story.append(Image(io.BytesIO(plate2_bytes), width=174 * mm, height=116 * mm))
    story.append(Spacer(1, 2 * mm))

    # Section 14: Preliminary Single-Line Diagram (SLD) Schematic
    story.append(
        Paragraph(
            "14. PRELIMINARY SINGLE-LINE DIAGRAM (SLD) SCHEMATIC — PRELIMINARY ENGINEERING",
            sec_style,
        )
    )
    sld_png_bytes, n_sld_rows = _render_single_line_diagram_png(
        project_name=proj.name,
        scenario=active_scenario,
    )
    sld_height_mm = min(140.0, 44.0 * n_sld_rows + 14.0) * mm
    sld_img = Image(io.BytesIO(sld_png_bytes), width=174 * mm, height=sld_height_mm)
    story.append(sld_img)

    # Milestone M6 & M7: Pre-flight validation + Sections 15-24
    rates_state = list_project_rates(db, project_id, user)
    comparison = get_project_scenario_comparison(db, project_id, user)
    eng_constants = list_engineering_constants(db)

    grid_missing_tie_in = [
        cl.cluster_label
        for cl in active_scenario.clusters
        if cl.modality in {"GRID_EXTENSION", "GRID_AUGMENTATION"} and cl.requires_tie_in
    ]

    synthetic_fallback_layers = [
        lyr.layer_key
        for lyr in layers
        if lyr.layer_key != "nightlights"
        and (
            (lyr.summary_metrics or {}).get("is_synthetic_fallback") is True
            or (lyr.dataset is not None and lyr.dataset.key == "synthetic_fallback")
        )
    ]

    preflight = evaluate_dpr_preflight(
        project_id=proj.id,
        project_version=proj.version,
        scenario_key=active_scenario.scenario_key,
        clusters_count=len(settlements.items),
        unset_rate_codes=comparison.unset_item_codes,
        grid_clusters_missing_tie_in=grid_missing_tie_in,
        vdrop_compliance_ok=active_scenario.vdrop_compliance_ok,
        max_ht_vdrop_pct=active_scenario.max_ht_vdrop_pct,
        max_lt_vdrop_pct=active_scenario.max_lt_vdrop_pct,
        verification_coverage_pct=settlements.verification_coverage_pct,
        verified_records_count=len(ledger.records),
        has_existing_infra=infra.has_existing_infra,
        boundary_source=aoi_row.boundary_source if aoi_row else "UNSET",
        census_delta_pct=settlements.census_reconciliation.delta_pct,
        total_capex_inr=comparison.active_scenario_boq.total_capex_inr,
        npc_inr=comparison.active_scenario_boq.economics.npc_inr,
        lcoe_inr_kwh=comparison.active_scenario_boq.economics.lcoe_inr_kwh,
        synthetic_fallback_layers=synthetic_fallback_layers,
    )

    if synthetic_fallback_layers:
        raise AppError(
            code="SYNTHETIC_FALLBACK_BLOCK_EXPORT",
            message=(
                "DPR export is blocked because synthetic fallback placeholder layers are "
                f"active ({', '.join(synthetic_fallback_layers)}). Replace them with "
                "uploaded GeoJSON/GeoTIFF files or validated regional extracts."
            ),
            status_code=422,
            details={"synthetic_fallback_layers": synthetic_fallback_layers},
        )

    if comparison.has_unset_rates:
        raise AppError(
            code="UNSET_RATES_BLOCK_EXPORT",
            message=(
                comparison.export_blocked_reason
                or "DPR export is blocked because one or more required unit rates are UNSET."
            ),
            status_code=422,
            details={"unset_item_codes": comparison.unset_item_codes},
        )

    if grid_missing_tie_in:
        raise AppError(
            code="GRID_TIE_IN_MISSING_BLOCK_EXPORT",
            message=(
                f"DPR export is blocked because grid-selected clusters "
                f"({', '.join(grid_missing_tie_in)}) have no 11 kV tie-in point "
                f"(d_infra_m = UNSET)."
            ),
            status_code=422,
            details={"grid_clusters_missing_tie_in": grid_missing_tie_in},
        )

    active_boq = comparison.active_scenario_boq
    story.append(PageBreak())

    # Section 15: Schedule of Rates (SoR) Provenance & Costing Methodology
    story.append(
        Paragraph(
            f"15. SCHEDULE OF RATES (SOR) PROVENANCE & COSTING BASIS ({rates_state.template_key})",
            sec_style,
        )
    )
    sor_meta_rows = [
        [
            _p("Active Rate Schedule", bold=True),
            _p(rates_state.template_name),
            _p("Total Catalog Items", bold=True),
            _p(
                f"{rates_state.total_items} items "
                f"({rates_state.user_edited_count} user-edited, {rates_state.unset_count} UNSET)"
            ),
        ],
        [
            _p("Tax & Overheads", bold=True),
            _p(
                f"GST {active_boq.gst_pct:.1f}% | "
                f"Contingency {active_boq.contingency_pct:.1f}% | "
                f"PMC {active_boq.pmc_overhead_pct:.1f}%"
            ),
            _p("Life-Cycle Parameters", bold=True),
            _p(
                f"Discount Rate {active_boq.discount_rate * 100.0:.1f}% | "
                f"Horizon {active_boq.horizon_years} Yrs | "
                f"Scheme Grant {active_boq.capital_subsidy_pct:.0f}%"
            ),
        ],
    ]
    t15 = Table(sor_meta_rows, colWidths=[34 * mm, 54 * mm, 36 * mm, 52 * mm])
    t15.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F1F5F9")),
                ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F1F5F9")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                ("PADDING", (0, 0), (-1, -1), 2.5),
            ]
        )
    )
    story.append(t15)

    # Section 16: Itemized Bill of Quantities (BOQ) & Capital Cost Abstract
    story.append(
        Paragraph(
            f"16. ITEMIZED BILL OF QUANTITIES (BOQ) &amp; CAPITAL COST ABSTRACT "
            f"({html.escape(active_boq.scenario_key)})",
            sec_style,
        )
    )
    boq_rows = [
        [
            _p("Item Code", header=True),
            _p("Description", header=True),
            _p("Category", header=True),
            _p("Qty", header=True),
            _p("Unit", header=True),
            _p("Rate (INR)", header=True),
            _p("Source Tag", header=True),
            _p("Amount (INR)", header=True),
        ]
    ]
    for ln in active_boq.aggregated_lines:
        boq_rows.append(
            [
                _p(ln.item_code, bold=True),
                _p(ln.description),
                _p(ln.category),
                _p(f"{ln.quantity:.2f}"),
                _p(ln.unit),
                _p(f"{ln.rate_inr:,.2f}" if ln.rate_inr is not None else "UNSET"),
                _p(ln.rate_source_type),
                _p(f"{ln.amount_inr:,.2f}"),
            ]
        )
    boq_rows.extend(
        [
            [
                _p("SUB-A", bold=True),
                _p("Direct Equipment & Line Supply Subtotal"),
                _p("—"),
                _p("—"),
                _p("INR"),
                _p("—"),
                _p("COMPUTED"),
                _p(f"{active_boq.base_equipment_inr:,.2f}"),
            ],
            [
                _p("SUB-B", bold=True),
                _p("Difficult Hilly/Forest Terrain Erection Premium"),
                _p("—"),
                _p("—"),
                _p("INR"),
                _p("—"),
                _p("COMPUTED"),
                _p(f"{active_boq.terrain_premium_inr:,.2f}"),
            ],
            [
                _p("SUB-C", bold=True),
                _p(f"Goods & Services Tax (GST @ {active_boq.gst_pct:.1f}%)"),
                _p("—"),
                _p("—"),
                _p("INR"),
                _p("—"),
                _p("STATUTORY"),
                _p(f"{active_boq.gst_amount_inr:,.2f}"),
            ],
            [
                _p("SUB-D", bold=True),
                _p(
                    f"Contingency ({active_boq.contingency_pct:.1f}%) + "
                    f"PMC Overheads ({active_boq.pmc_overhead_pct:.1f}%)"
                ),
                _p("—"),
                _p("—"),
                _p("INR"),
                _p("—"),
                _p("NORMATIVE"),
                _p(
                    f"{active_boq.contingency_amount_inr + active_boq.pmc_overhead_amount_inr:,.2f}"
                ),
            ],
            [
                _p("TOTAL", bold=True),
                _p(
                    f"GRAND TOTAL CAPITAL OUTLAY (INR {active_boq.total_capex_lakhs:.2f} Lakhs)",
                    bold=True,
                ),
                _p("—"),
                _p("—"),
                _p("INR", bold=True),
                _p("—"),
                _p("VERIFIED_SUM", bold=True),
                _p(f"{active_boq.total_capex_inr:,.2f}", bold=True),
            ],
        ]
    )
    t16 = Table(
        boq_rows,
        colWidths=[21 * mm, 39 * mm, 24 * mm, 13 * mm, 12 * mm, 17 * mm, 28 * mm, 22 * mm],
    )
    t16.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A5F")),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#E2E8F0")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                ("PADDING", (0, 0), (-1, -1), 2.0),
            ]
        )
    )
    story.append(t16)

    # Section 17: Multi-Scenario Financial Comparison & Life-Cycle Economics (NPC & LCOE)
    story.append(
        Paragraph(
            f"17. MULTI-SCENARIO FINANCIAL COMPARISON, "
            f"{active_boq.horizon_years}-YR NPC & LCOE ABSTRACT",
            sec_style,
        )
    )
    comp_rows = [
        [
            "Scenario Key",
            "Pinned",
            "CAPEX (INR)",
            "Net Outlay (INR)",
            f"{active_boq.horizon_years}-Yr NPC (INR)",
            "LCOE (INR/kWh)",
            "Cost / HH (INR)",
        ]
    ]
    for sc in comparison.scenarios:
        comp_rows.append(
            [
                sc.scenario_key,
                "BASELINE" if sc.is_active_baseline else "ALT",
                f"{sc.total_capex_inr:,.2f}",
                f"{sc.net_utility_capex_inr:,.2f}",
                f"{sc.npc_inr:,.2f}",
                f"{sc.lcoe_inr_kwh:.2f} /kWh",
                f"{sc.cost_per_household_inr:,.0f} /HH",
            ]
        )
    t17 = Table(
        comp_rows,
        colWidths=[34 * mm, 16 * mm, 26 * mm, 26 * mm, 26 * mm, 24 * mm, 24 * mm],
    )
    t17.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A5F")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 6.5),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                ("PADDING", (0, 0), (-1, -1), 2.5),
            ]
        )
    )
    story.append(t17)
    story.append(Spacer(1, 2 * mm))

    hab_comp_rows = [
        [
            _p("Cluster", header=True),
            _p("Chosen Modality", header=True),
            _p("Grid NPC (INR)", header=True),
            _p("Mini-Grid NPC (INR)", header=True),
            _p("SHS NPC (INR)", header=True),
            _p("Least-Cost Option", header=True),
        ]
    ]
    for h_row in comparison.habitation_comparisons:
        hab_comp_rows.append(
            [
                _p(f"{h_row.cluster_label} ({h_row.est_households} HH)", bold=True),
                _p(h_row.active_modality),
                _p(
                    f"{h_row.grid_npc_inr:,.0f}"
                    + (" (No Tie-In)" if h_row.grid_requires_tie_in else "")
                ),
                _p(f"{h_row.minigrid_npc_inr:,.0f}"),
                _p(f"{h_row.shs_npc_inr:,.0f}"),
                _p(h_row.least_cost_npc_modality, bold=True),
            ]
        )
    t17_hab = Table(
        hab_comp_rows,
        colWidths=[26 * mm, 32 * mm, 32 * mm, 28 * mm, 26 * mm, 32 * mm],
    )
    t17_hab.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#334155")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                ("PADDING", (0, 0), (-1, -1), 2.2),
            ]
        )
    )
    story.append(t17_hab)

    # Page 5: Sections 18-24 (Implementation, O&M, Safeguards, Audit, Risks, Citations & Sign-Off)
    story.append(PageBreak())

    # Section 18: Implementation Schedule, Phasing & Institutional Mechanism
    story.append(
        Paragraph(
            f"18. IMPLEMENTATION SCHEDULE, PHASING & INSTITUTIONAL MECHANISM ({proj.scheme})",
            sec_style,
        )
    )
    phasing_rows = [
        ["Phase", "Timeline", "Institutional Responsibility", "Deliverables & Milestones"],
        [
            "Phase I — Joint Field Survey",
            "Month 1–2",
            "DISCOM / OREDA + Gram Sabha",
            "Physical walk-through, pole peg-marking, consumer enumeration & RoW consent.",
        ],
        [
            "Phase II — Procurement & BoM",
            "Month 3–4",
            "Project Management Cell (PMC)",
            "Turnkey EPC tendering, BIS/MNRE equipment type-test verification & dispatch.",
        ],
        [
            "Phase III — Erection & Stringing",
            "Month 5–9",
            "Turnkey Contractor / DISCOM",
            "PSC pole erection, 11 kV/LT stringing or Solar PV + LiFePO4 BESS installation.",
        ],
        [
            "Phase IV — Testing & Handover",
            "Month 10–12",
            "Electrical Inspector / VEC",
            "CEA safety inspection, service connection energization & 5-year AMC activation.",
        ],
    ]
    t18 = Table(phasing_rows, colWidths=[34 * mm, 20 * mm, 42 * mm, 80 * mm])
    t18.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A5F")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 6.2),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                ("PADDING", (0, 0), (-1, -1), 2.2),
            ]
        )
    )
    story.append(t18)

    # Section 19: Operations, Maintenance (O&M) & Asset Sustainability Framework
    story.append(
        Paragraph(
            "19. OPERATIONS, MAINTENANCE (O&amp;M) &amp; ASSET SUSTAINABILITY FRAMEWORK",
            sec_style,
        )
    )
    bess_reserve_note = (
        f"Off-grid LiFePO4 battery storage includes a scheduled Year-7 replacement reserve "
        f"(PV: <b>INR {active_boq.economics.pv_battery_replacement_inr:,.2f}</b>). "
        if active_boq.horizon_years >= 7
        else (
            f"No battery replacement reserve falls within the {active_boq.horizon_years}-Yr "
            f"horizon (Year-7 threshold not reached; PV: <b>INR "
            f"{active_boq.economics.pv_battery_replacement_inr:,.2f}</b>). "
        )
    )
    story.append(
        Paragraph(
            f"Annualized O&amp;M outlay for active scenario "
            f"<b>{html.escape(active_boq.scenario_key)}</b> is "
            f"<b>INR {active_boq.economics.annual_om_inr:,.2f}/yr</b> "
            f"({active_boq.horizon_years}-Yr PV: <b>INR "
            f"{active_boq.economics.pv_om_inr:,.2f}</b>). {bess_reserve_note}"
            f"Village Energy Committees (VECs) and local SHG micro-enterprise operators oversee "
            f"tariff collection and preventive module cleaning under a mandatory 5-year turnkey "
            f"vendor AMC.",
            body_style,
        )
    )

    # Section 20: Environmental & Forest Clearance Screening (ESA WorldCover & Waterways)
    story.append(
        Paragraph(
            "20. ENVIRONMENTAL & FOREST CLEARANCE SCREENING (ESA WORLDCOVER & WATERWAYS)",
            sec_style,
        )
    )
    max_canopy_pct = max((c.canopy_share * 100.0 for c in settlements.items), default=0.0)
    total_water_crossings = sum(g.water_crossings_count for g in gap.clusters)
    story.append(
        Paragraph(
            f"<b>Canopy & Waterway Screening:</b> Maximum cluster tree-canopy cover "
            f"(ESA WorldCover 10 m) is <b>{max_canopy_pct:.1f}%</b>; total OSM waterway "
            f"corridor crossings: <b>{total_water_crossings}</b>. Under the Forest "
            f"(Conservation) Act 1980 and MoEFCC linear project guidelines, 415 V LT AB-cable "
            f"distribution along village tracks requires zero tree felling. Estimated clean "
            f"energy avoided emissions: <b>{active_boq.economics.avoided_co2_tonnes_yr:.2f} "
            f"tCO2/yr</b>.",
            body_style,
        )
    )

    # Section 21: Complete Project Assumptions Register & Engineering Constants Audit
    story.append(
        Paragraph(
            "21. COMPLETE PROJECT ASSUMPTIONS REGISTER &amp; ENGINEERING CONSTANTS AUDIT",
            sec_style,
        )
    )
    assump_rows = [
        [
            _p("Key", header=True),
            _p("Parameter", header=True),
            _p("Value", header=True),
            _p("Unit", header=True),
            _p("Status", header=True),
            _p("Citation", header=True),
        ]
    ]
    for s_item in settings_state.items:
        assump_rows.append(
            [
                _p(s_item.key, bold=True),
                _p(s_item.label),
                _p(f"{s_item.value:.2f}"),
                _p(s_item.unit),
                _p("USER_EDITED" if s_item.is_user_edited else "DEFAULT_REF"),
                _p(s_item.citation),
            ]
        )
    for c_item in eng_constants.items:
        assump_rows.append(
            [
                _p(c_item.key, bold=True),
                _p(c_item.description),
                _p(f"{c_item.value}"),
                _p(c_item.unit),
                _p(c_item.status),
                _p(c_item.citation),
            ]
        )
    t21 = Table(
        assump_rows,
        colWidths=[34 * mm, 42 * mm, 14 * mm, 16 * mm, 24 * mm, 46 * mm],
    )
    t21.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A5F")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                ("PADDING", (0, 0), (-1, -1), 2.0),
            ]
        )
    )
    story.append(t21)

    # Section 22: Risk Register, Methodological Limitations & Pre-Survey Field Checklist
    story.append(
        Paragraph(
            "22. RISK REGISTER, METHODOLOGICAL LIMITATIONS & PRE-SURVEY FIELD CHECKLIST",
            sec_style,
        )
    )
    story.append(
        Paragraph(
            "<b>Epistemic Limitations (Core Principles #2 & #3):</b> Satellite building "
            "footprints (Google-Microsoft-OSM Open Buildings) and VIIRS night-time radiance "
            "(463 m) cannot observe household electricity meters, internal wiring, or voltage "
            "regulation. Mandatory field checklist prior to tendering: (1) Confirm household "
            "count and pucca/kutcha structure class with Gram Sabha; (2) Verify physical "
            "11 kV tapping pole & feeder capacity with DISCOM Sub-Divisional Officer; "
            "(3) Confirm shadow-free land parcel for Solar PV array.",
            body_style,
        )
    )

    # Section 23: Open Data Licensing, Third-Party Attributions & Regulatory Citations
    story.append(
        Paragraph(
            "23. OPEN DATA LICENSING, THIRD-PARTY ATTRIBUTIONS & REGULATORY CITATIONS",
            sec_style,
        )
    )
    story.append(
        Paragraph(
            "<b>Attributions:</b> Building footprints © Google Open Buildings (CC BY 4.0), "
            "Microsoft GlobalMLBuildingFootprints (ODbL), OpenStreetMap Contributors "
            "(ODbL 1.0); DEM © Copernicus GLO-30 (30 m); Landcover © ESA WorldCover 10 m v200 "
            "(CC BY 4.0); Nightlights © NOAA/NASA VIIRS DNB; Solar GHI © NASA POWER "
            "Climatology; Demographics © Census of India 2011 PCA. <b>Standards:</b> CEA "
            "(Measures Relating to Safety and Electric Supply) Regs 2023, REC Rural "
            "Electrification Specs, IS 5613, IS 3043, and MNRE Off-Grid/DDG Guidelines.",
            body_style,
        )
    )

    # Section 24: Pre-Flight Integrity Certificate, Cryptographic Snapshot Hash & Sign-Off Block
    story.append(
        Paragraph(
            "24. PRE-FLIGHT INTEGRITY CERTIFICATE, CRYPTOGRAPHIC SNAPSHOT HASH & SIGN-OFF",
            sec_style,
        )
    )
    cert_rows = [
        [
            _p("Pre-Flight Gate Status", bold=True),
            _p(
                "PASSED (0 Hard Blockers, 0 Soft Warnings)"
                if preflight.can_export and preflight.soft_warnings_count == 0
                else (
                    f"PASSED WITH WARNINGS (0 Hard Blockers, "
                    f"{preflight.soft_warnings_count} Soft Warnings)"
                    if preflight.can_export
                    else f"FAILED ({preflight.hard_blockers_failed} Hard Blockers, "
                    f"{preflight.soft_warnings_count} Soft Warnings)"
                )
            ),
            _p("Verification Watermark", bold=True),
            _p(preflight.watermark_text),
        ],
        [
            _p("Project Snapshot SHA-256", bold=True),
            _p(preflight.snapshot_hash[:32] + "..."),
            _p("Full Hash Digest (Tail)", bold=True),
            _p("..." + preflight.snapshot_hash[32:]),
        ],
        [
            _p("Prepared By (Planner)", bold=True),
            _p(f"{user.display_name} ({user.email})"),
            _p("Field Survey Sign-Off", bold=True),
            _p("_______________________ (AE/JE DISCOM & Gram Sabha)"),
        ],
    ]
    t24 = Table(cert_rows, colWidths=[34 * mm, 54 * mm, 34 * mm, 54 * mm])
    t24.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F1F5F9")),
                ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F1F5F9")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                ("PADDING", (0, 0), (-1, -1), 2.5),
            ]
        )
    )
    story.append(t24)

    def _page_callback(canvas: Canvas, doc_obj: SimpleDocTemplate) -> None:
        _draw_page_frame_and_watermark(
            canvas,
            doc_obj,
            watermark_text=preflight.watermark_text,
        )

    doc.build(
        story,
        onFirstPage=_page_callback,
        onLaterPages=_page_callback,
    )
    return buf.getvalue()
