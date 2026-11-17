/*
 * Copyright 2026 Swayam Kumar
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Genuine client-side binary export generators (24-Section PDF DPR via jsPDF,
 * 5-sheet OOXML Excel BOQ via JSZip, and GeoJSON/CSV GIS Package .zip via JSZip).
 */

import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import type { ProjectScenarioComparisonDto } from '../components/workspace/CostAndScenarioComparisonPanel';
import type { ProjectLayerDto } from '../components/workspace/DataManagementPanel';
import type { PreFlightReportDto } from '../components/workspace/DprExportCenterPanel';
import type {
  InfrastructureListDto,
  ProjectDemandSummaryDto,
  ProjectGapAnalysisDto,
  ProjectSettingsListDto,
} from '../components/workspace/InfrastructureAndDemandPanel';
import type { PlanningScenarioListDto } from '../components/workspace/NetworkEngineeringPanel';
import type {
  ClusterListResponseDto,
  VerificationLedgerDto,
} from '../components/workspace/SettlementAssessmentPanel';
import type { ProjectDto } from '../pages/ProjectsPage';
import { sha256Hex } from './domainGeoMath';
import { STANDARD_ENGINEERING_CONSTANTS } from './domainEngMath';

export interface DemoExportBundleInput {
  project: ProjectDto;
  layers: ProjectLayerDto[];
  settlements: ClusterListResponseDto;
  ledger: VerificationLedgerDto;
  infrastructure: InfrastructureListDto;
  gapAnalysis: ProjectGapAnalysisDto;
  settings: ProjectSettingsListDto;
  demand: ProjectDemandSummaryDto;
  scenarios: PlanningScenarioListDto;
  comparison: ProjectScenarioComparisonDto;
  preflight: PreFlightReportDto;
}

function pdfSafeText(raw: string): string {
  return raw
    .replace(/₹/g, 'Rs. ')
    .replace(/[—–]/g, '--')
    .replace(/[≥]/g, '>=')
    .replace(/[≤]/g, '<=')
    .replace(/[°]/g, ' deg')
    .replace(/[·•]/g, '|')
    .replace(/[φΦ]/g, 'phi')
    .replace(/[²]/g, '^2')
    .replace(/[^\x20-\x7E]/g, ' ');
}

function formatInrPlain(v: number): string {
  return `Rs. ${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function addPageDecorations(
  doc: jsPDF,
  projectName: string,
  watermarkText: string,
  snapshotHash: string,
): void {
  const totalPages = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const safeName = pdfSafeText(projectName);
  const safeWatermark = pdfSafeText(watermarkText);

  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(180, 83, 9);
    doc.text(safeWatermark, pageW / 2, 10, { align: 'center' });

    doc.setDrawColor(210, 218, 226);
    doc.line(14, 13, pageW - 14, 13);

    doc.line(14, pageH - 14, pageW - 14, pageH - 14);
    doc.setTextColor(90, 100, 115);
    doc.text(`ElectriMap DPR Demo | ${safeName.slice(0, 48)}`, 14, pageH - 9);
    doc.text(
      `Snapshot ${snapshotHash.slice(0, 12)} | Page ${p} of ${totalPages}`,
      pageW - 14,
      pageH - 9,
      { align: 'right' },
    );
  }
}

export function generateDprPdfBytes(
  bundle: DemoExportBundleInput,
  skeletonOnly = false,
): { bytes: Uint8Array; sha256: string } {
  const { project, settlements, ledger, infrastructure, gapAnalysis, settings, demand, scenarios, comparison, preflight, layers } =
    bundle;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 14;
  const contentW = pageW - marginX * 2;
  let y = 20;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > 274) {
      doc.addPage();
      y = 20;
    }
  };

  const drawHeading = (title: string, subtitle?: string) => {
    ensureSpace(16);
    doc.setFillColor(240, 245, 250);
    doc.rect(marginX, y - 4, contentW, subtitle ? 13 : 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 42, 74);
    doc.text(pdfSafeText(title), marginX + 2, y + 1.5);
    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(pdfSafeText(subtitle), marginX + 2, y + 6.5);
      y += 12;
    } else {
      y += 8;
    }
  };

  const drawParagraph = (text: string, fontSize = 9, color: [number, number, number] = [30, 41, 59]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(pdfSafeText(text), contentW) as string[];
    for (const ln of lines) {
      ensureSpace(5);
      doc.text(ln, marginX, y);
      y += 4.5;
    }
    y += 1.5;
  };

  const drawTable = (headers: string[], colWidths: number[], rows: string[][]) => {
    const lineH = 6;
    ensureSpace(14);
    doc.setFillColor(15, 42, 74);
    doc.rect(marginX, y, contentW, lineH + 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    let cx = marginX + 1.5;
    headers.forEach((h, i) => {
      doc.text(pdfSafeText(h), cx, y + 4.5);
      cx += colWidths[i] ?? 20;
    });
    y += lineH + 1;

    rows.forEach((row, rIdx) => {
      ensureSpace(lineH + 1);
      if (rIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, y, contentW, lineH, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(30, 41, 59);
      let x = marginX + 1.5;
      row.forEach((cell, i) => {
        const w = (colWidths[i] ?? 20) - 2.5;
        const truncated = doc.splitTextToSize(pdfSafeText(cell), Math.max(8, w))[0] ?? '';
        doc.text(truncated, x, y + 4.2);
        x += colWidths[i] ?? 20;
      });
      y += lineH;
    });
    y += 3;
  };

  // Cover Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 42, 74);
  const titleLines = doc.splitTextToSize(
    pdfSafeText(
      skeletonOnly
        ? `ElectriMap Preliminary Settlement Skeleton -- ${project.name}`
        : `ElectriMap Preliminary 24-Section DPR -- ${project.name}`,
    ),
    contentW,
  ) as string[];
  for (const tl of titleLines) {
    doc.text(tl, marginX, y);
    y += 7;
  }

  y += 1;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    pdfSafeText(
      `Scheme: ${project.scheme} | Geography: ${project.village_names ?? 'Custom Study'}, ${project.target_block ?? '--'}, ${project.target_district ?? '--'}, ${project.target_state ?? '--'}`,
    ),
    marginX,
    y,
  );
  y += 5.5;
  doc.text(
    pdfSafeText(
      `Base Year: ${project.base_year} | Horizon: ${project.horizon_years} yrs | Discount Rate: ${(project.discount_rate * 100).toFixed(1)}% | CRS: EPSG:${project.metric_epsg}`,
    ),
    marginX,
    y,
  );
  y += 6;

  // Epistemic Notice Box
  doc.setDrawColor(217, 119, 6);
  doc.setFillColor(255, 251, 235);
  doc.rect(marginX, y, contentW, 18, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(146, 64, 14);
  doc.text('EPISTEMIC HONESTY & PRELIMINARY ENGINEERING MANDATE', marginX + 3, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 53, 15);
  const noticeLines = doc.splitTextToSize(
    pdfSafeText(
      `Watermark: ${preflight.watermark_text}. Satellite footprints and VIIRS nightlights cannot verify household electricity meters. Unverified clusters stay marked UNVERIFIED until physical Gram Sabha or utility ledger confirmation.`,
    ),
    contentW - 6,
  ) as string[];
  noticeLines.slice(0, 2).forEach((nl, idx) => doc.text(nl, marginX + 3, y + 10.5 + idx * 4));
  y += 23;

  // Sections 1 & 2
  const activeScen = scenarios.active_scenario;
  const activeBoq = comparison.active_scenario_boq;
  drawHeading('Sections 1 - 2 | Executive Summary & Geographic Profile');
  drawParagraph(
    `AOI Area: ${project.aoi?.area_km2.toFixed(2) ?? '0.00'} km^2 (${project.aoi?.boundary_source ?? 'CUSTOM'}). Identified Habitations: ${settlements.items.length} clusters serving ~${demand.total_households} estimated households. Active Plan (${activeScen.scenario_key}): Horizon Peak ${demand.peak_kva_horizon.toFixed(1)} kVA (${demand.annual_energy_mwh_horizon.toFixed(1)} MWh/yr), Estimated CAPEX ${formatInrPlain(activeBoq.total_capex_inr)}, ${project.horizon_years}-Yr NPC ${formatInrPlain(activeBoq.economics.npc_inr)}, LCOE Rs. ${activeBoq.economics.lcoe_inr_kwh.toFixed(2)}/kWh.`,
  );

  // Section 3 Dataset Provenance
  drawHeading('Section 3 | Geospatial Dataset Provenance & Vintage Registry');
  drawTable(
    ['Layer Key', 'Status', 'Dataset', 'Vintage', 'Mode'],
    [34, 22, 62, 18, 46],
    layers.map((l) => [
      l.layer_key,
      l.status,
      l.dataset?.name ?? 'Reference Pack',
      String(l.dataset?.temporal_coverage ?? '2024'),
      String(l.summary_metrics?.data_source_mode ?? 'PROXY'),
    ]),
  );

  // Section 4 Clusters & Census
  drawHeading('Section 4 | Habitation Clusters & Census 2011 Reconciliation');
  drawTable(
    ['Code', 'Habitation Name', 'HH Est', 'Axis-1 Proxy', 'Axis-2 Verif.', 'Infra (m)'],
    [18, 56, 16, 40, 32, 20],
    settlements.items.map((c) => [
      c.label,
      c.name,
      String(c.est_households),
      c.proxy_class,
      c.verification_state,
      c.d_infra_m !== null ? c.d_infra_m.toFixed(0) : 'UNSET',
    ]),
  );
  drawParagraph(`Census Reconciliation: ${settlements.census_reconciliation.reconciliation_note}`);

  // Section 5 Verification Ledger
  drawHeading('Section 5 | Append-Only Verification Audit Ledger');
  if (ledger.records.length === 0) {
    drawParagraph(
      'No data available -- reason: Zero Axis-2 field or utility verification entries recorded yet; all habitation clusters remain UNVERIFIED.',
    );
  } else {
    drawTable(
      ['Date', 'Cluster', 'State', 'Confirmed', 'Verifier', 'Note'],
      [22, 18, 30, 28, 34, 50],
      ledger.records.slice(0, 15).map((r) => [
        r.observed_on,
        r.cluster_label ?? '--',
        String(r.new_value?.verification_state ?? 'VERIFIED'),
        String(r.new_value?.verified_class ?? '--'),
        r.verifier_name,
        r.note,
      ]),
    );
  }

  if (!skeletonOnly) {
    // Sections 6 - 7 Infrastructure & Terrain Gaps
    drawHeading('Sections 6 - 7 | Existing Infrastructure & Terrain-Weighted Gap Matrix');
    if (infrastructure.items.length === 0) {
      drawParagraph(
        'No data available -- reason: Zero existing 11 kV/LT utility GIS assets or USER_ASSUMED tie-in points placed.',
      );
    } else {
      drawTable(
        ['Type', 'Asset Name', 'kV', 'kVA', 'Provenance'],
        [24, 72, 16, 20, 50],
        infrastructure.items.map((a) => [
          a.asset_type,
          a.name,
          String(a.voltage_kv ?? '--'),
          String(a.rating_kva ?? '--'),
          a.provenance,
        ]),
      );
    }
    drawTable(
      ['Code', 'Straight (m)', 'Terrain (m)', 'Slope', 'Water Cross', 'Recommended Modality'],
      [18, 26, 26, 18, 22, 72],
      gapAnalysis.clusters.map((g) => [
        g.cluster_label,
        g.d_straight_m !== null ? g.d_straight_m.toFixed(0) : 'UNSET',
        g.d_terrain_m !== null ? g.d_terrain_m.toFixed(0) : 'UNSET',
        `${g.slope_mean_deg.toFixed(1)} deg`,
        String(g.water_crossings_count),
        g.recommended_modality,
      ]),
    );

    // Sections 8 - 9 Assumptions & 7-Category Demand
    drawHeading('Sections 8 - 9 | Parametric Assumptions & 7-Category Demand Forecast');
    drawTable(
      ['Category', 'Consumers', 'Connected kW', 'Max Demand kW', 'Hrs/Day', 'MWh/Yr'],
      [62, 22, 26, 28, 20, 24],
      demand.category_totals.map((c) => [
        c.label,
        String(c.consumer_count),
        c.connected_kw.toFixed(2),
        c.max_demand_kw.toFixed(2),
        c.daily_hours.toFixed(1),
        c.annual_energy_mwh.toFixed(2),
      ]),
    );
    drawParagraph(
      `Coincident Base Peak: ${demand.peak_kw_base.toFixed(2)} kW (${demand.peak_kva_base.toFixed(2)} kVA) -> Horizon Year ${project.horizon_years} Peak: ${demand.peak_kw_horizon.toFixed(2)} kW (${demand.peak_kva_horizon.toFixed(2)} kVA), Energy: ${demand.annual_energy_mwh_horizon.toFixed(2)} MWh/yr.`,
    );

    // Sections 10 - 14 Engineering Sizing & Schematic SLD
    drawHeading(`Sections 10 - 13 | Engineering Layout & Sizing (${activeScen.scenario_key})`);
    drawTable(
      ['Cluster', 'Modality', 'HT (m)', 'LT (m)', 'DT kVA', 'Solar kWp', 'HT VDrop%', 'LT VDrop%'],
      [18, 34, 18, 18, 18, 22, 26, 28],
      activeScen.clusters.map((cl) => [
        cl.cluster_label,
        cl.modality,
        cl.ht_length_m.toFixed(0),
        cl.lt_total_length_m.toFixed(0),
        cl.total_dt_rating_kva.toFixed(0),
        cl.solar_pv_kwp.toFixed(1),
        `${cl.ht_drop_pct.toFixed(2)}%`,
        `${cl.lt_drop_pct.toFixed(2)}%`,
      ]),
    );

    // Section 14 Schematic Single-Line Diagram Box
    drawHeading('Section 14 | Preliminary Single-Line Diagram (SLD) Schematic');
    ensureSpace(44);
    doc.setDrawColor(100, 116, 139);
    doc.setFillColor(248, 250, 252);
    doc.rect(marginX, y, contentW, 38, 'FD');

    const drawBox = (bx: number, by: number, bw: number, bh: number, l1: string, l2: string) => {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(15, 42, 74);
      doc.rect(bx, by, bw, bh, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 42, 74);
      doc.text(pdfSafeText(l1), bx + 2, by + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(pdfSafeText(l2), bx + 2, by + 10.5);
    };

    const by = y + 10;
    drawBox(marginX + 4, by, 38, 16, '11 kV Source Tie-In', `${infrastructure.items.length} Mapped/Assumed`);
    doc.line(marginX + 42, by + 8, marginX + 52, by + 8);
    drawBox(marginX + 52, by, 38, 16, '11 kV HT Feeder', `${(activeScen.total_ht_length_m / 1000).toFixed(2)} km | ${activeScen.total_ht_poles} Poles`);
    doc.line(marginX + 90, by + 8, marginX + 100, by + 8);
    drawBox(marginX + 100, by, 38, 16, '11/0.433 kV DTs', `${activeScen.total_dt_count} Units | ${activeScen.total_dt_capacity_kva.toFixed(0)} kVA`);
    doc.line(marginX + 138, by + 8, marginX + 146, by + 8);
    drawBox(marginX + 146, by, 32, 16, '415 V LT + Solar', `${activeScen.total_lt_length_m.toFixed(0)} m | ${activeScen.total_solar_kwp.toFixed(1)} kWp`);
    y += 42;

    // Sections 15 - 17 Costing, BOQ & 4-Scenario Comparison
    drawHeading('Sections 15 - 17 | Itemized BOQ & 4-Scenario Financial Comparison');
    drawTable(
      ['Code', 'Description', 'Unit', 'Qty', 'Rate (Rs.)', 'Amount (Rs.)'],
      [26, 68, 14, 18, 26, 30],
      activeBoq.aggregated_lines.map((ln) => [
        ln.item_code,
        ln.description,
        ln.unit,
        ln.quantity.toFixed(2),
        ln.rate_inr !== null ? ln.rate_inr.toFixed(0) : 'UNSET',
        ln.is_unset ? 'UNSET' : ln.amount_inr.toFixed(0),
      ]),
    );
    drawParagraph(
      `Cost Abstract: Base Equipment ${formatInrPlain(activeBoq.base_equipment_inr)} | Terrain Prem. ${formatInrPlain(activeBoq.terrain_premium_inr)} | GST 18% ${formatInrPlain(activeBoq.gst_amount_inr)} | Cont.+PMC 8% ${formatInrPlain(activeBoq.contingency_amount_inr + activeBoq.pmc_overhead_amount_inr)} | TOTAL CAPEX ${formatInrPlain(activeBoq.total_capex_inr)} (${activeBoq.capital_subsidy_pct}% Subsidy Share: ${formatInrPlain(activeBoq.economics.capital_subsidy_inr)}).`,
    );

    drawTable(
      ['Scenario', 'CAPEX (Lakhs)', '10-Yr NPC (Lakhs)', 'LCOE (Rs/kWh)', 'HH', 'CEA VDrop'],
      [56, 26, 30, 26, 16, 28],
      comparison.scenarios.map((sc) => [
        sc.scenario_key,
        sc.total_capex_lakhs.toFixed(2),
        sc.npc_lakhs.toFixed(2),
        sc.lcoe_inr_kwh.toFixed(2),
        String(sc.total_households_served),
        sc.vdrop_compliance_ok ? 'COMPLIANT' : 'EXCEEDS',
      ]),
    );

    // Sections 18 - 23 Institutional, O&M, Environmental & Constants Register
    drawHeading('Sections 18 - 23 | Implementation, O&M, Environmental & Assumptions Audit');
    drawParagraph(
      `Implementation Phasing: Phase 1 Gram Sabha Verification -> Phase 2 Statutory RoW & Forest Clearance (${gapAnalysis.clusters.filter((g) => g.canopy_share >= 0.35).length} forested clusters screened) -> Phase 3 HT/DT/Mini-Grid Erection -> Phase 4 Village Energy Committee (VEC) O&M handover. Technical Norms Audited: ${STANDARD_ENGINEERING_CONSTANTS.length} REC/IS/CEA constants & ${settings.items.length} project assumptions.`,
    );
  }

  // Section 24: Pre-Flight Checklist & 24-Section Completeness Matrix
  drawHeading('Section 24 | Pre-Flight Engineering Integrity Certificate & 24-Section Matrix');
  drawTable(
    ['#', 'Section Title', 'Status', 'Audit Note'],
    [10, 82, 22, 68],
    preflight.sections.map((s) => [
      String(s.section_number),
      s.title,
      s.is_populated ? 'POPULATED' : 'NO DATA',
      s.data_status_note,
    ]),
  );
  drawParagraph(
    `Pre-Flight Digest SHA-256: ${preflight.snapshot_hash} | Project Version: v${project.version}`,
    8,
    [71, 85, 105],
  );

  addPageDecorations(doc, project.name, preflight.watermark_text, preflight.snapshot_hash);

  const arrayBuffer = doc.output('arraybuffer');
  const bytes = new Uint8Array(arrayBuffer);
  const sha = sha256Hex(`${preflight.snapshot_hash}:pdf:${bytes.byteLength}`);
  return { bytes, sha256: sha };
}

function xmlEscape(val: unknown): string {
  const s = String(val ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function safeSpreadsheetText(val: string): string {
  return /^[=+\-@\t\r]/.test(val) ? `'${val}` : val;
}

function buildWorksheetXml(
  rows: Array<Array<{ v: string | number; formula?: string }>>,
): string {
  const colName = (idx: number): string => {
    let n = idx + 1;
    let s = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };

  const rowsXml = rows
    .map((cells, rIdx) => {
      const rNum = rIdx + 1;
      const cellsXml = cells
        .map((cell, cIdx) => {
          const ref = `${colName(cIdx)}${rNum}`;
          if (cell.formula) {
            const numVal = typeof cell.v === 'number' && Number.isFinite(cell.v) ? cell.v : 0;
            return `<c r="${ref}"><f>${xmlEscape(cell.formula)}</f><v>${numVal}</v></c>`;
          }
          if (typeof cell.v === 'number' && Number.isFinite(cell.v)) {
            return `<c r="${ref}"><v>${cell.v}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(safeSpreadsheetText(String(cell.v)))}</t></is></c>`;
        })
        .join('');
      return `<row r="${rNum}">${cellsXml}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`;
}

export async function generateBoqXlsxBytes(
  bundle: DemoExportBundleInput,
): Promise<{ bytes: Uint8Array; sha256: string }> {
  const { project, settlements, demand, scenarios, comparison, preflight } = bundle;
  const activeScen = scenarios.active_scenario;
  const boq = comparison.active_scenario_boq;

  const summaryRows: Array<Array<{ v: string | number; formula?: string }>> = [
    [{ v: 'ElectriMap Preliminary Cost & Engineering Workbook' }],
    [{ v: 'Project Name' }, { v: project.name }],
    [{ v: 'Scheme' }, { v: project.scheme }],
    [{ v: 'Active Scenario' }, { v: activeScen.scenario_key }],
    [{ v: 'Metric CRS' }, { v: `EPSG:${project.metric_epsg}` }],
    [{ v: 'Watermark' }, { v: preflight.watermark_text }],
    [{ v: 'Snapshot SHA-256' }, { v: preflight.snapshot_hash }],
    [{ v: 'Total CAPEX (INR)' }, { v: boq.total_capex_inr }],
    [{ v: '10-Yr NPC (INR)' }, { v: boq.economics.npc_inr }],
    [{ v: 'LCOE (INR/kWh)' }, { v: boq.economics.lcoe_inr_kwh }],
  ];

  const settlementRows: Array<Array<{ v: string | number }>> = [
    [{ v: 'Cluster' }, { v: 'Name' }, { v: 'Buildings' }, { v: 'Est. HH' }, { v: 'Axis-1 Proxy' }, { v: 'Axis-2 Verification' }, { v: 'Peak kVA (Horizon)' }, { v: 'MWh/Yr' }],
    ...settlements.items.map((cl) => {
      const cDem = demand.clusters.find((d) => d.cluster_id === cl.id);
      return [
        { v: cl.label },
        { v: cl.name },
        { v: cl.n_detected },
        { v: cl.est_households },
        { v: cl.proxy_class },
        { v: cl.verification_state },
        { v: cDem?.peak_kva_horizon ?? 0 },
        { v: cDem?.annual_energy_mwh_horizon ?? 0 },
      ];
    }),
  ];

  const engRows: Array<Array<{ v: string | number }>> = [
    [{ v: 'Cluster' }, { v: 'Modality' }, { v: 'HT Length (m)' }, { v: 'LT Length (m)' }, { v: 'DT Count' }, { v: 'DT kVA' }, { v: 'Solar kWp' }, { v: 'BESS kWh' }, { v: 'HT VDrop %' }, { v: 'LT VDrop %' }],
    ...activeScen.clusters.map((cl) => [
      { v: cl.cluster_label },
      { v: cl.modality },
      { v: cl.ht_length_m },
      { v: cl.lt_total_length_m },
      { v: cl.dt_count },
      { v: cl.total_dt_rating_kva },
      { v: cl.solar_pv_kwp },
      { v: cl.bess_capacity_kwh },
      { v: cl.ht_drop_pct },
      { v: cl.lt_drop_pct },
    ]),
  ];

  const boqRows: Array<Array<{ v: string | number; formula?: string }>> = [
    [{ v: 'Item Code' }, { v: 'Description' }, { v: 'Unit' }, { v: 'Quantity' }, { v: 'Rate Provenance' }, { v: 'Unit Rate (INR)' }, { v: 'Amount (INR)' }],
    ...boq.aggregated_lines.map((ln, idx) => {
      const r = idx + 2;
      return [
        { v: ln.item_code },
        { v: ln.description },
        { v: ln.unit },
        { v: ln.quantity },
        { v: ln.rate_source_type },
        { v: ln.rate_inr ?? 0 },
        { v: ln.amount_inr, formula: `ROUND(D${r}*F${r},2)` },
      ];
    }),
  ];
  const lastLineRow = boq.aggregated_lines.length + 1;
  const baseRow = lastLineRow + 1;
  boqRows.push([{ v: 'Base Equipment Cost' }, { v: '' }, { v: '' }, { v: '' }, { v: '' }, { v: '' }, { v: boq.base_equipment_inr, formula: `SUM(G2:G${lastLineRow})` }]);
  boqRows.push([{ v: 'Terrain Erection Premium' }, { v: '' }, { v: '' }, { v: '' }, { v: '' }, { v: '' }, { v: boq.terrain_premium_inr }]);
  boqRows.push([{ v: 'GST (18%)' }, { v: '' }, { v: '' }, { v: '' }, { v: '' }, { v: '' }, { v: boq.gst_amount_inr, formula: `ROUND((G${baseRow}+G${baseRow + 1})*0.18,2)` }]);
  boqRows.push([{ v: 'Contingency + PMC (8%)' }, { v: '' }, { v: '' }, { v: '' }, { v: '' }, { v: '' }, { v: boq.contingency_amount_inr + boq.pmc_overhead_amount_inr, formula: `ROUND((G${baseRow}+G${baseRow + 1})*0.08,2)` }]);
  boqRows.push([{ v: 'Total Estimated CAPEX' }, { v: '' }, { v: '' }, { v: '' }, { v: '' }, { v: '' }, { v: boq.total_capex_inr, formula: `SUM(G${baseRow}:G${baseRow + 3})` }]);

  const compRows: Array<Array<{ v: string | number }>> = [
    [{ v: 'Scenario Key' }, { v: 'CAPEX (INR)' }, { v: '10-Yr NPC (INR)' }, { v: 'LCOE (INR/kWh)' }, { v: 'Households' }, { v: 'CEA VDrop OK' }],
    ...comparison.scenarios.map((s) => [
      { v: s.scenario_key },
      { v: s.total_capex_inr },
      { v: s.npc_inr },
      { v: s.lcoe_inr_kwh },
      { v: s.total_households_served },
      { v: s.vdrop_compliance_ok ? 'PASS' : 'WARN' },
    ]),
  ];

  const sheetNames = ['Summary', 'Settlements & Demand', 'Engineering & Sizing', 'BOQ & Rates', 'Scenario Comparison'];
  const sheetXmls = [
    buildWorksheetXml(summaryRows),
    buildWorksheetXml(settlementRows),
    buildWorksheetXml(engRows),
    buildWorksheetXml(boqRows),
    buildWorksheetXml(compRows),
  ];

  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${sheetNames.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
</Types>`,
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
  );
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheetNames.map((name, i) => `<sheet name="${xmlEscape(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}
  </sheets>
</workbook>`,
  );
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetNames.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}
</Relationships>`,
  );
  sheetXmls.forEach((xml, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, xml));

  const bytes = await zip.generateAsync({ type: 'uint8array' });
  return { bytes, sha256: sha256Hex(`${preflight.snapshot_hash}:xlsx:${bytes.byteLength}`) };
}

export async function generateGisPackageZipBytes(
  bundle: DemoExportBundleInput,
): Promise<{ bytes: Uint8Array; sha256: string }> {
  const { project, settlements, infrastructure, scenarios, preflight, demand } = bundle;
  const zip = new JSZip();

  zip.file(
    'aoi_boundary.geojson',
    JSON.stringify(
      {
        type: 'FeatureCollection',
        features: project.aoi
          ? [
              {
                type: 'Feature',
                geometry: project.aoi.geojson_geometry,
                properties: {
                  project_id: project.id,
                  project_name: project.name,
                  boundary_source: project.aoi.boundary_source,
                  area_km2: project.aoi.area_km2,
                  metric_epsg: project.metric_epsg,
                },
              },
            ]
          : [],
      },
      null,
      2,
    ),
  );
  zip.file('habitation_clusters.geojson', JSON.stringify(settlements.geojson, null, 2));
  zip.file('infrastructure_assets.geojson', JSON.stringify(infrastructure.geojson, null, 2));
  zip.file(
    'preliminary_network_layout.geojson',
    JSON.stringify(scenarios.active_scenario.network_geojson, null, 2),
  );

  const csvHeader = 'cluster_label,name,est_households,proxy_class,verification_state,peak_kva_horizon,modality,ht_length_m,lt_total_length_m';
  const csvRows = settlements.items.map((cl) => {
    const lay = scenarios.active_scenario.clusters.find((c) => c.cluster_id === cl.id);
    const dem = demand.clusters.find((d) => d.cluster_id === cl.id);
    return [
      cl.label,
      `"${safeSpreadsheetText(cl.name).replace(/"/g, '""')}"`,
      cl.est_households,
      cl.proxy_class,
      cl.verification_state,
      dem?.peak_kva_horizon ?? 0,
      lay?.modality ?? 'UNSET',
      lay?.ht_length_m ?? 0,
      lay?.lt_total_length_m ?? 0,
    ].join(',');
  });
  zip.file('settlement_and_engineering_schedule.csv', [csvHeader, ...csvRows].join('\n'));
  zip.file(
    'provenance_manifest.json',
    JSON.stringify(
      {
        project_id: project.id,
        project_name: project.name,
        scenario_key: scenarios.active_scenario_key,
        storage_crs: 'EPSG:4326',
        metric_crs: `EPSG:${project.metric_epsg}`,
        watermark: preflight.watermark_text,
        snapshot_hash: preflight.snapshot_hash,
        generated_at: new Date().toISOString(),
        notice: 'PRELIMINARY GIS PACKAGE -- Demo / Screening Estimates. Requires field survey verification.',
      },
      null,
      2,
    ),
  );

  const bytes = await zip.generateAsync({ type: 'uint8array' });
  return { bytes, sha256: sha256Hex(`${preflight.snapshot_hash}:zip:${bytes.byteLength}`) };
}
