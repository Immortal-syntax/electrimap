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
 * Pure client-side electrical engineering, 7-category demand forecasting,
 * 4-scenario distribution network sizing, Schedule of Rates BOQ/LCOE costing,
 * and 24-section Pre-Flight audit calculations.
 */

import type {
  BoqLineItemDto,
  ClusterBoqBreakdownDto,
  CsvImportErrorDto,
  HabitationOptionComparisonRowDto,
  LifecycleEconomicsDto,
  ProjectRateItemDto,
  ProjectRateListDto,
  ProjectScenarioComparisonDto,
  ScenarioBoqDto,
  ScenarioComparisonCardDto,
  SorCsvImportResponseDto,
} from '../components/workspace/CostAndScenarioComparisonPanel';
import type {
  DprSectionStatusItemDto,
  PreFlightCheckItemDto,
  PreFlightReportDto,
} from '../components/workspace/DprExportCenterPanel';
import type {
  CategoryDemandRowDto,
  ClusterDemandDto,
  InfrastructureAssetDto,
  ProjectDemandSummaryDto,
  ProjectGapAnalysisDto,
  ProjectSettingDto,
} from '../components/workspace/InfrastructureAndDemandPanel';
import type {
  ClusterEngineeringLayoutDto,
  EngineeringConstantDto,
  PlacedDtDto,
  PlanningScenarioDto,
} from '../components/workspace/NetworkEngineeringPanel';
import type { ClusterDto } from '../components/workspace/SettlementAssessmentPanel';
import {
  computeMetricDistanceM,
  nearestPointOnGeometryM,
  sha256Hex,
  utmToWgs84,
  wgs84ToUtm,
  type UtmPoint,
} from './domainGeoMath';

// ---------------------------------------------------------------------------
// Normative REC / IS / CEA Engineering Constants & DT Specifications
// ---------------------------------------------------------------------------

export interface DtRatingSpec {
  rating_kva: number;
  no_load_loss_w: number;
  full_load_loss_w: number;
  citation: string;
}

export const STANDARD_DT_SPECS: readonly DtRatingSpec[] = [
  { rating_kva: 16, no_load_loss_w: 65, full_load_loss_w: 440, citation: 'IS 1180 (Part 1):2014 Outdoor 3-Phase 11/0.433 kV 16 kVA Level-2' },
  { rating_kva: 25, no_load_loss_w: 85, full_load_loss_w: 635, citation: 'IS 1180 (Part 1):2014 Outdoor 3-Phase 11/0.433 kV 25 kVA Level-2' },
  { rating_kva: 63, no_load_loss_w: 160, full_load_loss_w: 1150, citation: 'IS 1180 (Part 1):2014 Outdoor 3-Phase 11/0.433 kV 63 kVA Level-2' },
  { rating_kva: 100, no_load_loss_w: 230, full_load_loss_w: 1650, citation: 'IS 1180 (Part 1):2014 Outdoor 3-Phase 11/0.433 kV 100 kVA Level-2' },
  { rating_kva: 200, no_load_loss_w: 410, full_load_loss_w: 2600, citation: 'IS 1180 (Part 1):2014 Outdoor 3-Phase 11/0.433 kV 200 kVA Level-2' },
];

export const STANDARD_ENGINEERING_CONSTANTS: readonly EngineeringConstantDto[] = [
  { key: 'ht_11kv_r_ohm_per_km', value: 0.5426, unit: 'ohm/km', description: '11 kV 3-phase overhead ACSR Rabbit (50 mm² Al Eq.) AC resistance at 20°C', citation: 'IS 398 (Part 2):1996 / REC Construction Standard F-1', status: 'SOURCE_VERIFIED' },
  { key: 'ht_11kv_x_ohm_per_km', value: 0.355, unit: 'ohm/km', description: '11 kV 3-phase overhead ACSR Rabbit inductive reactance at 50 Hz (1070 mm spacing)', citation: 'REC Construction Standard F-1 / CEA Distribution Planning Manual', status: 'SOURCE_VERIFIED' },
  { key: 'lt_415v_3ph_r_ohm_per_km', value: 0.641, unit: 'ohm/km', description: '415 V 3-phase LT XLPE Aerial Bunched (AB) Cable (3x50+1x16+1x35 mm²) resistance', citation: 'IS 14255:1995 / REC 1.1 kV LT AB Cable Specification', status: 'SOURCE_VERIFIED' },
  { key: 'lt_415v_3ph_x_ohm_per_km', value: 0.085, unit: 'ohm/km', description: '415 V 3-phase LT XLPE Aerial Bunched (AB) Cable reactance at 50 Hz', citation: 'IS 14255:1995 / REC 1.1 kV LT AB Cable Specification', status: 'SOURCE_VERIFIED' },
  { key: 'lt_240v_1ph_r_ohm_per_km', value: 1.2, unit: 'ohm/km', description: '240 V 1-phase LT XLPE Aerial Bunched (AB) Cable resistance', citation: 'IS 14255:1995 / REC Rural Single-Phase Laterals Standard', status: 'SOURCE_VERIFIED' },
  { key: 'lt_240v_1ph_x_ohm_per_km', value: 0.092, unit: 'ohm/km', description: '240 V 1-phase LT XLPE Aerial Bunched (AB) Cable reactance at 50 Hz', citation: 'IS 14255:1995 / REC Rural Single-Phase Laterals Standard', status: 'SOURCE_VERIFIED' },
  { key: 'ht_max_vdrop_pct', value: 5.0, unit: '%', description: 'Maximum permissible voltage regulation on 11 kV rural distribution feeders', citation: 'CEA (Technical Standards for Construction of Electrical Plants and Lines) Reg. 2022', status: 'SOURCE_VERIFIED' },
  { key: 'lt_max_vdrop_pct', value: 6.0, unit: '%', description: 'Maximum permissible voltage drop on 415 V LT distribution mains to tail-end consumer', citation: 'CEA Distribution Planning Guidelines / REC RDSS Technical Manual', status: 'SOURCE_VERIFIED' },
  { key: 'ht_standard_span_m', value: 65.0, unit: 'm', description: 'Standard 11 kV overhead line pole span using 9 m PSC poles in normal terrain', citation: 'REC Construction Standard A-3', status: 'SOURCE_VERIFIED' },
  { key: 'ht_steep_span_m', value: 45.0, unit: 'm', description: 'Reduced 11 kV overhead line pole span on steep slopes (>15°) or water crossings', citation: 'REC Construction Standard A-3 / Hilly Terrain Addendum', status: 'SOURCE_VERIFIED' },
  { key: 'lt_standard_span_m', value: 45.0, unit: 'm', description: 'Standard 415 V LT AB cable pole span using 8 m PSC poles', citation: 'REC Construction Standard B-1', status: 'SOURCE_VERIFIED' },
  { key: 'dt_max_loading_ratio', value: 0.8, unit: 'ratio', description: 'Maximum permissible horizon peak kVA loading ratio on Distribution Transformers', citation: 'MoP RDSS & REC Distribution Transformer Sizing Guidelines', status: 'SOURCE_VERIFIED' },
  { key: 'lt_max_radial_reach_m', value: 800.0, unit: 'm', description: 'Maximum 415 V LT radial feeder reach from a single DT before sub-zone splitting', citation: 'CEA Rural Distribution Planning Norms (Short-LT Principle)', status: 'SOURCE_VERIFIED' },
  { key: 'solar_pr_ratio', value: 0.75, unit: 'ratio', description: 'Design Performance Ratio (PR) for crystalline-Si rural solar PV mini-grid', citation: 'MNRE Off-Grid Solar PV Benchmark / IEC 61724', status: 'SOURCE_VERIFIED' },
  { key: 'bess_autonomy_days', value: 1.5, unit: 'days', description: 'Battery Energy Storage System (LiFePO4) monsoon autonomy reserve days', citation: 'MNRE / REC Decentralized Renewable Energy (DRE) Mini-Grid Guidelines', status: 'SOURCE_VERIFIED' },
  { key: 'bess_dod_ratio', value: 0.8, unit: 'ratio', description: 'Maximum usable Depth of Discharge (DoD) for LiFePO4 battery bank', citation: 'IS 16270 / MNRE LiFePO4 Storage Specification', status: 'SOURCE_VERIFIED' },
  { key: 'bess_roundtrip_eff', value: 0.9, unit: 'ratio', description: 'Round-trip DC-AC-DC efficiency of LiFePO4 battery bank and PCU', citation: 'MNRE / IEC 62619 Mini-Grid PCU Benchmark', status: 'SOURCE_VERIFIED' },
  { key: 'shs_kit_pv_wp', value: 200.0, unit: 'Wp/HH', description: 'Standalone Solar Home System (SHS) PV module wattage per remote household', citation: 'MoP New Solar Power Scheme (PM-JANMAN / DA-JGUA)', status: 'SOURCE_VERIFIED' },
  { key: 'shs_kit_bess_wh', value: 1280.0, unit: 'Wh/HH', description: 'Standalone SHS LiFePO4 battery capacity per household (12.8 V 100 Ah)', citation: 'MoP New Solar Power Scheme (PM-JANMAN / DA-JGUA)', status: 'SOURCE_VERIFIED' },
];

export function getDefaultConstantsMap(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of STANDARD_ENGINEERING_CONSTANTS) {
    out[c.key] = c.value;
  }
  return out;
}

export function selectStandardDtSpec(requiredPeakKva: number, maxLoadingRatio = 0.8): DtRatingSpec {
  const safeRatio = Math.max(0.4, Math.min(1.0, maxLoadingRatio));
  for (const spec of STANDARD_DT_SPECS) {
    if (requiredPeakKva <= spec.rating_kva * safeRatio) {
      return spec;
    }
  }
  return STANDARD_DT_SPECS[STANDARD_DT_SPECS.length - 1]!;
}

// ---------------------------------------------------------------------------
// Project Assumptions & 7-Category Parametric Demand Engine
// ---------------------------------------------------------------------------

export interface AssumptionSpec {
  key: string;
  category: 'DEMAND' | 'GROWTH' | 'NETWORK';
  label: string;
  default_value: number;
  unit: string;
  citation: string;
  min_value: number;
  max_value: number;
}

export const DEFAULT_PROJECT_ASSUMPTIONS: readonly AssumptionSpec[] = [
  { key: 'bpl_household_share', category: 'DEMAND', label: 'BPL / Kutir Jyoti Share of Households', default_value: 0.6, unit: 'ratio', citation: 'DDUGJY / RDSS Tribal Sub-Plan Normative BPL Ratio (60%)', min_value: 0.0, max_value: 1.0 },
  { key: 'bpl_connected_load_kw', category: 'DEMAND', label: 'Connected Load per BPL Household', default_value: 0.25, unit: 'kW/HH', citation: 'ESMAP MTF Tier 2-3 / REC Kutir Jyoti Norm (250 W)', min_value: 0.05, max_value: 2.0 },
  { key: 'apl_connected_load_kw', category: 'DEMAND', label: 'Connected Load per APL Household', default_value: 0.75, unit: 'kW/HH', citation: 'CEA / REC Standard Rural Domestic Load Norm (750 W)', min_value: 0.2, max_value: 5.0 },
  { key: 'domestic_demand_factor', category: 'DEMAND', label: 'Domestic Maximum Demand Factor', default_value: 0.6, unit: 'ratio', citation: 'REC Rural Distribution Manual (DF = 0.60)', min_value: 0.2, max_value: 1.0 },
  { key: 'domestic_hours_per_day', category: 'DEMAND', label: 'Domestic Equivalent Full-Load Hours per Day', default_value: 5.0, unit: 'h/day', citation: 'CEA Rural Evening + Morning Load Curve (5.0 h/day)', min_value: 1.0, max_value: 16.0 },
  { key: 'institutional_load_kw_per_50hh', category: 'DEMAND', label: 'Community Institutional Load per 50 Households', default_value: 1.5, unit: 'kW/50HH', citation: 'DA-JGUA School + Anganwadi + Health Sub-Centre Norm', min_value: 0.0, max_value: 10.0 },
  { key: 'streetlight_w_per_10hh', category: 'DEMAND', label: 'LED Street Lighting Load per 10 Households', default_value: 40.0, unit: 'W/10HH', citation: 'BIS IS 16107 / EESL 40W LED Luminaire per 10 HH (11 h/night)', min_value: 0.0, max_value: 250.0 },
  { key: 'water_pump_kw_per_cluster', category: 'DEMAND', label: 'Drinking Water Supply Pump per Habitation (>= 15 HH)', default_value: 2.2, unit: 'kW/cluster', citation: 'Jal Jeevan Mission (JJM) 3 HP (2.2 kW) Community Submersible Pump', min_value: 0.0, max_value: 15.0 },
  { key: 'agri_pumps_per_25hh', category: 'DEMAND', label: 'Agricultural Irrigation Pumpsets per 25 Households', default_value: 1.0, unit: 'pumps/25HH', citation: 'PM-KUSUM / Minor Irrigation Norm (3 HP = 2.2 kW per 25 HH)', min_value: 0.0, max_value: 10.0 },
  { key: 'micro_enterprise_kw_per_40hh', category: 'DEMAND', label: 'Rural Micro-Enterprise / Agro-Processing Load per 40 HH', default_value: 3.7, unit: 'kW/40HH', citation: '5 HP (3.7 kW) Grain Mill / Van Dhan Processing Unit per 40 HH', min_value: 0.0, max_value: 25.0 },
  { key: 'cluster_coincidence_factor', category: 'DEMAND', label: 'Cluster Inter-Category Coincidence Factor', default_value: 0.65, unit: 'ratio', citation: 'REC / IEEE Rural Feeder Coincidence Factor (0.65)', min_value: 0.3, max_value: 1.0 },
  { key: 'power_factor_cos_phi', category: 'NETWORK', label: 'Design Lagging Power Factor (cos φ)', default_value: 0.85, unit: 'ratio', citation: 'CEA Technical Standards / REC DT Sizing Standard (0.85 lag)', min_value: 0.7, max_value: 0.98 },
  { key: 'annual_demand_growth_rate', category: 'GROWTH', label: 'Annual Compound Electricity Demand Growth Rate', default_value: 0.045, unit: 'ratio/yr', citation: 'CEA 20th Electric Power Survey Rural Growth (4.5%/yr)', min_value: 0.0, max_value: 0.15 },
  { key: 'grid_max_terrain_distance_m', category: 'NETWORK', label: 'Maximum Terrain-Weighted Distance for 11 kV Grid Extension', default_value: 3500.0, unit: 'm', citation: 'RDSS / REC Techno-Economic Threshold for 11 kV Spur (3.5 km)', min_value: 500.0, max_value: 15000.0 },
];

const LOAD_TIER_PRESETS: Record<string, Record<string, number>> = {
  TIER_2_SUBSISTENCE: { bpl_connected_load_kw: 0.15, apl_connected_load_kw: 0.4, domestic_hours_per_day: 4.0, micro_enterprise_kw_per_40hh: 1.85 },
  TIER_3_STANDARD: { bpl_connected_load_kw: 0.25, apl_connected_load_kw: 0.75, domestic_hours_per_day: 5.0, micro_enterprise_kw_per_40hh: 3.7 },
  TIER_4_PRODUCTIVE: { bpl_connected_load_kw: 0.5, apl_connected_load_kw: 1.5, domestic_hours_per_day: 8.0, micro_enterprise_kw_per_40hh: 7.5 },
};

export function createDefaultSettingsForProject(
  projectId: string,
  loadTier: string,
): ProjectSettingDto[] {
  const tierNorm = loadTier.trim().toUpperCase();
  const preset = tierNorm.startsWith('TIER_2')
    ? LOAD_TIER_PRESETS.TIER_2_SUBSISTENCE!
    : tierNorm.startsWith('TIER_4')
      ? LOAD_TIER_PRESETS.TIER_4_PRODUCTIVE!
      : LOAD_TIER_PRESETS.TIER_3_STANDARD!;
  const nowIso = new Date().toISOString();

  return DEFAULT_PROJECT_ASSUMPTIONS.map((spec) => {
    const tierDefault = preset[spec.key] ?? spec.default_value;
    return {
      id: `set-${projectId.slice(0, 8)}-${spec.key}`,
      project_id: projectId,
      key: spec.key,
      category: spec.category,
      label: spec.label,
      value: tierDefault,
      default_value: tierDefault,
      min_value: spec.min_value,
      max_value: spec.max_value,
      unit: spec.unit,
      quality_tag: 'ESTIMATED',
      citation: spec.citation,
      is_user_edited: false,
      override_note: null,
      updated_at: nowIso,
    };
  });
}

function roundN(v: number, digits = 3): number {
  const f = Math.pow(10, digits);
  return Math.round(v * f) / f;
}

export function computeClusterDemand(params: {
  cluster: ClusterDto;
  horizonYears: number;
  assumptions: Record<string, number>;
}): ClusterDemandDto {
  const { cluster, horizonYears, assumptions } = params;
  const hh = Math.max(0, cluster.est_households);
  const bplShare = Math.max(0, Math.min(1, assumptions.bpl_household_share ?? 0.6));
  const bplHh = Math.round(hh * bplShare);
  const aplHh = Math.max(0, hh - bplHh);
  const domDf = assumptions.domestic_demand_factor ?? 0.6;
  const domHours = assumptions.domestic_hours_per_day ?? 5.0;

  const bplConn = roundN(bplHh * (assumptions.bpl_connected_load_kw ?? 0.25));
  const bplMax = roundN(bplConn * domDf);
  const bplKwh = roundN(bplMax * domHours);

  const aplConn = roundN(aplHh * (assumptions.apl_connected_load_kw ?? 0.75));
  const aplMax = roundN(aplConn * domDf);
  const aplKwh = roundN(aplMax * domHours);

  const instUnits =
    hh >= 5
      ? Math.max(hh >= 12 ? 1 : 0, Math.ceil(hh / 50) + (cluster.n_non_residential > 0 ? 1 : 0))
      : hh >= 3 && cluster.n_non_residential > 0
        ? 1
        : 0;
  const instConn = hh > 0 ? roundN(instUnits * (assumptions.institutional_load_kw_per_50hh ?? 1.5)) : 0;
  const instMax = roundN(instConn * 0.7);
  const instKwh = roundN(instMax * 6.0);

  const slLuminaires = hh > 0 ? Math.ceil(hh / 10) : 0;
  const slConn = roundN(slLuminaires * ((assumptions.streetlight_w_per_10hh ?? 40) / 1000));
  const slMax = roundN(slConn * 1.0);
  const slKwh = roundN(slMax * 11.0);

  const wpUnits = hh >= 15 ? 1 : 0;
  const wpConn = roundN(wpUnits * (assumptions.water_pump_kw_per_cluster ?? 2.2));
  const wpMax = roundN(wpConn * 0.85);
  const wpKwh = roundN(wpMax * 4.0);

  const agriUnits = hh >= 15 ? Math.round((hh / 25) * (assumptions.agri_pumps_per_25hh ?? 1.0)) : 0;
  const agriConn = roundN(agriUnits * 2.2);
  const agriMax = roundN(agriConn * 0.65);
  const agriKwh = roundN(agriMax * 4.5);

  const meUnits = hh >= 20 ? Math.ceil(hh / 40) : 0;
  const meConn = roundN(meUnits * (assumptions.micro_enterprise_kw_per_40hh ?? 3.7));
  const meMax = roundN(meConn * 0.6);
  const meKwh = roundN(meMax * 4.0);

  const rawRows: Array<[string, string, number, number, number, number, number, number]> = [
    ['DOMESTIC_BPL', 'Domestic BPL / Kutir Jyoti', bplHh, bplConn, domDf, bplMax, domHours, bplKwh],
    ['DOMESTIC_APL', 'Domestic APL / Standard', aplHh, aplConn, domDf, aplMax, domHours, aplKwh],
    ['INSTITUTIONAL', 'Community & Public Institutions', instUnits, instConn, 0.7, instMax, 6.0, instKwh],
    ['STREET_LIGHTING', 'Public LED Street Lighting', slLuminaires, slConn, 1.0, slMax, 11.0, slKwh],
    ['WATER_PUMPING', 'Drinking Water Supply Pumping', wpUnits, wpConn, 0.85, wpMax, 4.0, wpKwh],
    ['AGRICULTURAL_IRRIGATION', 'Agricultural Irrigation Pumpsets', agriUnits, agriConn, 0.65, agriMax, 4.5, agriKwh],
    ['MICRO_ENTERPRISE', 'Rural Micro-Enterprise / Processing', meUnits, meConn, 0.6, meMax, 4.0, meKwh],
  ];

  const categories: CategoryDemandRowDto[] = rawRows.map(([cat, lbl, cnt, cKw, df, mKw, hrs, eDay]) => ({
    category: cat,
    label: lbl,
    consumer_count: cnt,
    connected_kw: cKw,
    demand_factor: df,
    max_demand_kw: mKw,
    daily_hours: hrs,
    energy_kwh_day: eDay,
    annual_energy_mwh: roundN((eDay * 365) / 1000),
  }));

  const totalConnectedKw = roundN(categories.reduce((s, r) => s + r.connected_kw, 0));
  const nonCoincPeakKw = roundN(categories.reduce((s, r) => s + r.max_demand_kw, 0));
  const coincFactor = Math.max(0.3, Math.min(1, assumptions.cluster_coincidence_factor ?? 0.65));
  const cosPhi = Math.max(0.7, Math.min(0.99, assumptions.power_factor_cos_phi ?? 0.85));

  const peakKwBase = roundN(nonCoincPeakKw * coincFactor);
  const peakKvaBase = roundN(peakKwBase / cosPhi);
  const energyDayBase = roundN(categories.reduce((s, r) => s + r.energy_kwh_day, 0));
  const annualMwhBase = roundN((energyDayBase * 365) / 1000);

  const gRate = Math.max(0, Math.min(0.2, assumptions.annual_demand_growth_rate ?? 0.045));
  const hYears = Math.max(1, horizonYears);
  const growthMult = roundN(Math.pow(1 + gRate, hYears), 4);

  const peakKwHorizon = roundN(peakKwBase * growthMult);
  const peakKvaHorizon = roundN(peakKwHorizon / cosPhi);
  const energyDayHorizon = roundN(energyDayBase * growthMult);
  const annualMwhHorizon = roundN((energyDayHorizon * 365) / 1000);

  return {
    cluster_id: cluster.id,
    cluster_label: cluster.label,
    cluster_name: cluster.name,
    est_households: hh,
    categories,
    total_connected_kw: totalConnectedKw,
    non_coincident_peak_kw: nonCoincPeakKw,
    coincidence_factor: coincFactor,
    power_factor_cos_phi: cosPhi,
    peak_kw_base: peakKwBase,
    peak_kva_base: peakKvaBase,
    energy_kwh_day_base: energyDayBase,
    annual_energy_mwh_base: annualMwhBase,
    horizon_years: hYears,
    annual_growth_rate: gRate,
    growth_multiplier: growthMult,
    peak_kw_horizon: peakKwHorizon,
    peak_kva_horizon: peakKvaHorizon,
    energy_kwh_day_horizon: energyDayHorizon,
    annual_energy_mwh_horizon: annualMwhHorizon,
  };
}

export function computeProjectDemandSummary(params: {
  projectId: string;
  clusters: ClusterDto[];
  horizonYears: number;
  settings: ProjectSettingDto[];
}): ProjectDemandSummaryDto {
  const { projectId, clusters, horizonYears, settings } = params;
  const assumptions: Record<string, number> = {};
  for (const s of settings) assumptions[s.key] = s.value;

  const clusterDemands = clusters.map((c) => computeClusterDemand({ cluster: c, horizonYears, assumptions }));
  const totalHh = clusterDemands.reduce((s, c) => s + c.est_households, 0);
  const totalConnKw = roundN(clusterDemands.reduce((s, c) => s + c.total_connected_kw, 0));
  const peakKwBase = roundN(clusterDemands.reduce((s, c) => s + c.peak_kw_base, 0));
  const peakKvaBase = roundN(clusterDemands.reduce((s, c) => s + c.peak_kva_base, 0));
  const energyDayBase = roundN(clusterDemands.reduce((s, c) => s + c.energy_kwh_day_base, 0));
  const annualMwhBase = roundN(clusterDemands.reduce((s, c) => s + c.annual_energy_mwh_base, 0));
  const peakKwHorizon = roundN(clusterDemands.reduce((s, c) => s + c.peak_kw_horizon, 0));
  const peakKvaHorizon = roundN(clusterDemands.reduce((s, c) => s + c.peak_kva_horizon, 0));
  const energyDayHorizon = roundN(clusterDemands.reduce((s, c) => s + c.energy_kwh_day_horizon, 0));
  const annualMwhHorizon = roundN(clusterDemands.reduce((s, c) => s + c.annual_energy_mwh_horizon, 0));

  const categoryTotals: CategoryDemandRowDto[] = [];
  if (clusterDemands.length > 0) {
    const firstCats = clusterDemands[0]!.categories;
    for (let idx = 0; idx < firstCats.length; idx += 1) {
      const ref = firstCats[idx]!;
      const cCount = clusterDemands.reduce((s, cd) => s + cd.categories[idx]!.consumer_count, 0);
      const cKw = roundN(clusterDemands.reduce((s, cd) => s + cd.categories[idx]!.connected_kw, 0));
      const mKw = roundN(clusterDemands.reduce((s, cd) => s + cd.categories[idx]!.max_demand_kw, 0));
      const eDay = roundN(clusterDemands.reduce((s, cd) => s + cd.categories[idx]!.energy_kwh_day, 0));
      categoryTotals.push({
        category: ref.category,
        label: ref.label,
        consumer_count: cCount,
        connected_kw: cKw,
        demand_factor: cKw > 0 ? roundN(mKw / cKw, 2) : ref.demand_factor,
        max_demand_kw: mKw,
        daily_hours: ref.daily_hours,
        energy_kwh_day: eDay,
        annual_energy_mwh: roundN((eDay * 365) / 1000),
      });
    }
  }

  return {
    project_id: projectId,
    horizon_years: horizonYears,
    annual_growth_rate: assumptions.annual_demand_growth_rate ?? 0.045,
    total_households: totalHh,
    total_connected_kw: totalConnKw,
    peak_kw_base: peakKwBase,
    peak_kva_base: peakKvaBase,
    energy_kwh_day_base: energyDayBase,
    annual_energy_mwh_base: annualMwhBase,
    peak_kw_horizon: peakKwHorizon,
    peak_kva_horizon: peakKvaHorizon,
    energy_kwh_day_horizon: energyDayHorizon,
    annual_energy_mwh_horizon: annualMwhHorizon,
    category_totals: categoryTotals,
    clusters: clusterDemands,
  };
}

// ---------------------------------------------------------------------------
// Network Sizing, Voltage Drop, Technical Losses & 4-Scenario Generator
// ---------------------------------------------------------------------------

function buildLtMstAndDts(params: {
  cluster: ClusterDto;
  buildingCoords: Array<[number, number]>;
  peakKvaHorizon: number;
  consts: Record<string, number>;
  metricEpsg: number;
}): {
  placedDts: PlacedDtDto[];
  lt3phM: number;
  lt1phM: number;
  ltTotalM: number;
  maxLtBranchM: number;
  ltPoles: number;
  ltFeatures: GeoJSON.Feature[];
} {
  const { cluster, buildingCoords, peakKvaHorizon, consts, metricEpsg } = params;
  const maxLoadRatio = consts.dt_max_loading_ratio ?? 0.8;
  const maxReachM = consts.lt_max_radial_reach_m ?? 800;
  const ltSpanM = consts.lt_standard_span_m ?? 45;

  let ptsUtm: UtmPoint[];
  if (buildingCoords.length > 0) {
    ptsUtm = buildingCoords.map(([lon, lat]) => wgs84ToUtm(lon, lat, metricEpsg));
  } else {
    const cUtm = wgs84ToUtm(cluster.centroid_lon, cluster.centroid_lat, metricEpsg);
    const nSynth = Math.max(4, Math.min(20, Math.round(cluster.est_households / 5) || 4));
    ptsUtm = Array.from({ length: nSynth }, (_, i) => {
      const ang = (2 * Math.PI * i) / nSynth;
      const rad = 45 + 30 * (i % 3);
      return { x_m: cUtm.x_m + rad * Math.cos(ang), y_m: cUtm.y_m + rad * Math.sin(ang) };
    });
  }

  // Sub-zone DT split by max unit kVA and radial distance
  const meanX = ptsUtm.reduce((s, p) => s + p.x_m, 0) / ptsUtm.length;
  const meanY = ptsUtm.reduce((s, p) => s + p.y_m, 0) / ptsUtm.length;
  const maxInitRad = Math.max(...ptsUtm.map((p) => Math.hypot(p.x_m - meanX, p.y_m - meanY)), 0);
  const kByReach = Math.max(1, Math.ceil(maxInitRad / Math.max(100, maxReachM)));
  const kByLoad = Math.max(1, Math.ceil(peakKvaHorizon / (100 * maxLoadRatio)));
  const kCount = Math.min(ptsUtm.length, Math.max(kByReach, kByLoad));

  const sortedPts = [...ptsUtm].sort((a, b) => a.x_m - b.x_m);
  const groups: UtmPoint[][] = Array.from({ length: kCount }, () => []);
  sortedPts.forEach((p, idx) => {
    const gIdx = Math.min(kCount - 1, Math.floor((idx * kCount) / sortedPts.length));
    groups[gIdx]!.push(p);
  });

  const nonEmptyGroups = groups.filter((g) => g.length > 0);
  const totalPts = Math.max(1, ptsUtm.length);
  const placedDts: PlacedDtDto[] = nonEmptyGroups.map((grp, i) => {
    const gx = grp.reduce((s, p) => s + p.x_m, 0) / grp.length;
    const gy = grp.reduce((s, p) => s + p.y_m, 0) / grp.length;
    const [lon, lat] = utmToWgs84(gx, gy, metricEpsg);
    const subKva = Math.max(2, roundN(peakKvaHorizon * (grp.length / totalPts), 2));
    const spec = selectStandardDtSpec(subKva, maxLoadRatio);
    const reachM = Math.max(...grp.map((p) => Math.hypot(p.x_m - gx, p.y_m - gy)), 0);
    return {
      subzone_index: i + 1,
      label: `${cluster.label}-DT${String(i + 1).padStart(2, '0')}`,
      lon,
      lat,
      rating_kva: spec.rating_kva,
      allocated_peak_kva: subKva,
      loading_pct: roundN((subKva / spec.rating_kva) * 100, 1),
      served_buildings_count: grp.length,
      max_radial_reach_m: roundN(reachM, 1),
      citation: spec.citation,
    };
  });

  // Prim's MST per DT subzone over downsampled service poles (~30m merge)
  const ltLines: number[][][] = [];
  let total3ph = 0;
  let total1ph = 0;
  let maxBranch = 0;

  for (const dt of placedDts) {
    const dtUtm = wgs84ToUtm(dt.lon, dt.lat, metricEpsg);
    const mergedPoles: UtmPoint[] = [];
    for (const p of ptsUtm) {
      if (!mergedPoles.some((m) => Math.hypot(m.x_m - p.x_m, m.y_m - p.y_m) < 28)) {
        mergedPoles.push(p);
      }
    }
    const subPoles = mergedPoles.filter((p) => {
      const closestDt = placedDts.reduce((best, cand) => {
        const cUtm = wgs84ToUtm(cand.lon, cand.lat, metricEpsg);
        const bUtm = wgs84ToUtm(best.lon, best.lat, metricEpsg);
        return Math.hypot(p.x_m - cUtm.x_m, p.y_m - cUtm.y_m) < Math.hypot(p.x_m - bUtm.x_m, p.y_m - bUtm.y_m)
          ? cand
          : best;
      });
      return closestDt.label === dt.label;
    });
    if (subPoles.length === 0) continue;

    const vertices = [dtUtm, ...subPoles.slice(0, 35)];
    const nV = vertices.length;
    const inTree = new Array<boolean>(nV).fill(false);
    const parent = new Array<number>(nV).fill(-1);
    const minW = new Array<number>(nV).fill(Infinity);
    minW[0] = 0;

    for (let step = 0; step < nV; step += 1) {
      let u = -1;
      for (let i = 0; i < nV; i += 1) {
        if (!inTree[i] && (u === -1 || minW[i]! < minW[u]!)) u = i;
      }
      if (u === -1) break;
      inTree[u] = true;
      for (let v = 0; v < nV; v += 1) {
        if (!inTree[v]) {
          const d = Math.hypot(vertices[u]!.x_m - vertices[v]!.x_m, vertices[u]!.y_m - vertices[v]!.y_m);
          if (d < minW[v]!) {
            minW[v] = d;
            parent[v] = u;
          }
        }
      }
    }

    const adj: Array<Array<{ to: number; w: number }>> = Array.from({ length: nV }, () => []);
    for (let v = 1; v < nV; v += 1) {
      const u = parent[v]!;
      if (u < 0) continue;
      const w = Math.hypot(vertices[u]!.x_m - vertices[v]!.x_m, vertices[u]!.y_m - vertices[v]!.y_m);
      if (w <= 0.1) continue;
      adj[u]!.push({ to: v, w });
      adj[v]!.push({ to: u, w });
      ltLines.push([
        utmToWgs84(vertices[u]!.x_m, vertices[u]!.y_m, metricEpsg),
        utmToWgs84(vertices[v]!.x_m, vertices[v]!.y_m, metricEpsg),
      ]);
    }

    const visited = new Set<number>([0]);
    const queue: Array<[number, number]> = [[0, 0]];
    while (queue.length > 0) {
      const [u, dist] = queue.shift()!;
      if (dist > maxBranch) maxBranch = dist;
      for (const edge of adj[u]!) {
        if (visited.has(edge.to)) continue;
        visited.add(edge.to);
        queue.push([edge.to, dist + edge.w]);
        const isLeaf = adj[edge.to]!.length <= 1;
        if (isLeaf && u !== 0) {
          total1ph += edge.w;
        } else {
          total3ph += edge.w;
        }
      }
    }
  }

  const ltTotalM = roundN(total3ph + total1ph, 1);
  const ltPoles = ltTotalM > 0 ? Math.ceil(ltTotalM / Math.max(20, ltSpanM)) + placedDts.length : 0;

  const ltFeatures: GeoJSON.Feature[] =
    ltLines.length > 0
      ? [
          {
            type: 'Feature',
            properties: {
              layer_type: 'LT_415V',
              cluster_label: cluster.label,
              name: `${cluster.label} · Proposed 415 V LT AB Network`,
              length_m: ltTotalM,
            },
            geometry: { type: 'MultiLineString', coordinates: ltLines },
          },
        ]
      : [];

  return {
    placedDts,
    lt3phM: roundN(total3ph, 1),
    lt1phM: roundN(total1ph, 1),
    ltTotalM,
    maxLtBranchM: roundN(maxBranch, 1),
    ltPoles,
    ltFeatures,
  };
}

export function buildAllScenariosForProject(params: {
  projectId: string;
  clusters: ClusterDto[];
  buildingCoordsByClusterId: Record<string, Array<[number, number]>>;
  demand: ProjectDemandSummaryDto;
  gapAnalysis: ProjectGapAnalysisDto;
  infraAssets: InfrastructureAssetDto[];
  worstGhiKwhM2Day: number;
  metricEpsg: number;
  activeScenarioKey: string;
  manualOverridesByClusterLabel: Record<string, string>;
}): { active_scenario_key: string; active_scenario: PlanningScenarioDto; scenarios: PlanningScenarioDto[] } {
  const {
    projectId,
    clusters,
    buildingCoordsByClusterId,
    demand,
    gapAnalysis,
    infraAssets,
    worstGhiKwhM2Day,
    metricEpsg,
    activeScenarioKey,
    manualOverridesByClusterLabel,
  } = params;

  const consts = getDefaultConstantsMap();
  const demandById = new Map(demand.clusters.map((d) => [d.cluster_id, d]));
  const gapById = new Map(gapAnalysis.clusters.map((g) => [g.cluster_id, g]));
  const infraById = new Map(infraAssets.map((a) => [a.id, a]));
  const nowIso = new Date().toISOString();

  const scenarioDefs: Array<{ key: string; name: string }> = [
    { key: 'HYBRID_OPTIMAL', name: 'Hybrid Least-Cost Optimal (Grid + Solar Mini-Grid + SHS)' },
    { key: 'GRID_EXTENSION_ONLY', name: '100% Grid Extension / Augmentation Scenario' },
    { key: 'MINIGRID_PRIORITY', name: 'Decentralized Solar PV + LiFePO4 Mini-Grid Priority' },
    { key: 'SHS_DISPERSED', name: 'Standalone Solar Home System (SHS) Priority' },
  ];

  const resolveModality = (scenarioKey: string, cl: ClusterDto, gapRec: string, dTerrain: number | null): string => {
    const eff =
      (cl.verification_state === 'FIELD_VERIFIED' || cl.verification_state === 'UTILITY_VERIFIED') &&
      cl.verified_class
        ? cl.verified_class
        : cl.proxy_class;
    const hasElec = ['LIKELY_ELECTRIFIED', 'ELECTRIFIED', 'GRID_CONNECTED'].includes(eff);
    const hasUnder = ['POTENTIALLY_UNDERSERVED', 'UNDERSERVED'].includes(eff);
    if (scenarioKey === 'GRID_EXTENSION_ONLY') return hasElec || hasUnder ? 'GRID_AUGMENTATION' : 'GRID_EXTENSION';
    if (scenarioKey === 'MINIGRID_PRIORITY') return hasElec ? 'GRID_AUGMENTATION' : cl.est_households >= 10 ? 'SOLAR_MINIGRID' : 'STANDALONE_SHS';
    if (scenarioKey === 'SHS_DISPERSED') return hasElec ? 'GRID_AUGMENTATION' : 'STANDALONE_SHS';
    if (dTerrain === null && (hasElec || hasUnder)) return 'GRID_AUGMENTATION';
    return gapRec;
  };

  const scenarios: PlanningScenarioDto[] = scenarioDefs.map((sDef) => {
    const scenarioId = `sc-${sha256Hex(`${projectId}:${sDef.key}`).slice(0, 10)}`;
    const isActive = sDef.key === activeScenarioKey;
    const features: GeoJSON.Feature[] = [];
    const clusterLayouts: ClusterEngineeringLayoutDto[] = [];

    for (const cl of clusters) {
      const cDem = demandById.get(cl.id);
      const cGap = gapById.get(cl.id);
      const peakKw = cDem?.peak_kw_horizon ?? 10;
      const peakKva = cDem?.peak_kva_horizon ?? 11.8;
      const energyDay = cDem?.energy_kwh_day_horizon ?? 40;
      const annualMwh = cDem?.annual_energy_mwh_horizon ?? 14.6;
      const cosPhi = cDem?.power_factor_cos_phi ?? 0.85;

      const defaultMod = resolveModality(
        sDef.key,
        cl,
        cGap?.recommended_modality ?? 'SOLAR_MINIGRID',
        cGap?.d_terrain_m ?? null,
      );
      const manualMod = isActive ? manualOverridesByClusterLabel[cl.label] : undefined;
      const modality = manualMod ?? defaultMod;
      const isManual = Boolean(manualMod && manualMod !== defaultMod);

      if (modality === 'STANDALONE_SHS') {
        const hhCnt = Math.max(1, cl.est_households);
        const instPacks = Math.max(0, Math.min(5, cl.n_non_residential));
        const totalPvKwp = roundN((hhCnt * consts.shs_kit_pv_wp!) / 1000 + instPacks * 1.0, 2);
        const totalBessKwh = roundN((hhCnt * consts.shs_kit_bess_wh!) / 1000 + instPacks * 3.2, 2);

        clusterLayouts.push({
          id: `lay-${scenarioId}-${cl.label}`,
          scenario_id: scenarioId,
          project_id: projectId,
          cluster_id: cl.id,
          cluster_label: cl.label,
          cluster_name: cl.name,
          est_households: cl.est_households,
          modality,
          is_manual_override: isManual,
          requires_tie_in: false,
          peak_kw_horizon: peakKw,
          peak_kva_horizon: peakKva,
          energy_kwh_day_horizon: energyDay,
          annual_energy_mwh_horizon: annualMwh,
          dt_count: 0,
          total_dt_rating_kva: 0,
          max_dt_loading_pct: 0,
          placed_dts: [],
          ht_length_m: 0,
          ht_poles_count: 0,
          lt_3ph_length_m: 0,
          lt_1ph_length_m: 0,
          lt_total_length_m: 0,
          max_lt_branch_m: 0,
          lt_poles_count: 0,
          ht_current_a: 0,
          ht_drop_v: 0,
          ht_drop_pct: 0,
          ht_vdrop_compliant: true,
          lt_current_a: 0,
          lt_drop_v: 0,
          lt_drop_pct: 0,
          lt_vdrop_compliant: true,
          overall_vdrop_compliant: true,
          load_factor: 0,
          load_loss_factor: 0,
          ht_line_loss_kwh_yr: 0,
          lt_line_loss_kwh_yr: 0,
          dt_no_load_loss_kwh_yr: 0,
          dt_copper_loss_kwh_yr: 0,
          total_loss_mwh_yr: 0,
          technical_loss_pct: 0,
          solar_pv_kwp: totalPvKwp,
          bess_capacity_kwh: totalBessKwh,
          inverter_kva: 0,
          shs_kits_count: hhCnt,
          engineering_notes: [
            `Standalone SHS: ${hhCnt} household kits (${totalPvKwp} kWp PV, ${totalBessKwh} kWh LiFePO4).`,
          ],
          updated_at: nowIso,
        });
        continue;
      }

      const ltMst = buildLtMstAndDts({
        cluster: cl,
        buildingCoords: buildingCoordsByClusterId[cl.id] ?? [],
        peakKvaHorizon: peakKva,
        consts,
        metricEpsg,
      });

      let htLengthM = 0;
      let htPoles = 0;
      let requiresTieIn = false;
      let dtCount = 0;
      let dtTotalKva = 0;
      let maxDtLoadingPct = 0;
      let placedDts: PlacedDtDto[] = [];
      let solarKwp = 0;
      let bessKwh = 0;
      let inverterKva = 0;
      const notes: string[] = [];

      if (modality === 'SOLAR_MINIGRID') {
        const pr = consts.solar_pr_ratio ?? 0.75;
        const safeGhi = Math.max(2.2, worstGhiKwhM2Day);
        solarKwp = Math.max(5.0, Math.ceil(((energyDay * 1.08) / (safeGhi * pr)) / 2.5) * 2.5);
        const usableBess = energyDay * 0.65 * (consts.bess_autonomy_days ?? 1.5);
        bessKwh = Math.max(10.0, Math.ceil(usableBess / ((consts.bess_dod_ratio ?? 0.8) * (consts.bess_roundtrip_eff ?? 0.9)) / 5) * 5);
        inverterKva = Math.max(5.0, Math.ceil((peakKva * 1.25) / 5) * 5);
        notes.push(`Solar PV + LiFePO4 Mini-Grid (${solarKwp} kWp PV, ${bessKwh} kWh BESS) for worst-month GHI ${safeGhi.toFixed(2)} kWh/m²/d.`);
        features.push(...ltMst.ltFeatures);
        features.push({
          type: 'Feature',
          properties: {
            layer_type: 'SOLAR_MINIGRID',
            cluster_label: cl.label,
            name: `${cl.label} · ${solarKwp} kWp Solar Mini-Grid Hub`,
            solar_pv_kwp: solarKwp,
            bess_capacity_kwh: bessKwh,
          },
          geometry: { type: 'Point', coordinates: [cl.centroid_lon, cl.centroid_lat] },
        });
      } else {
        placedDts = ltMst.placedDts;
        dtCount = placedDts.length;
        dtTotalKva = placedDts.reduce((s, d) => s + d.rating_kva, 0);
        maxDtLoadingPct = Math.max(...placedDts.map((d) => d.loading_pct), 0);

        const targetAsset =
          (cGap?.nearest_asset_id ? infraById.get(cGap.nearest_asset_id) : undefined) ?? infraAssets[0];
        if (!targetAsset) {
          requiresTieIn = true;
          notes.push('Existing 11 kV tie-in point is UNSET. Place a tie-in point on the map.');
        } else {
          const hit = nearestPointOnGeometryM(
            [cl.centroid_lon, cl.centroid_lat],
            targetAsset.geojson_geometry,
            metricEpsg,
          );
          const firstDt = placedDts[0];
          const dtCoord: [number, number] = firstDt ? [firstDt.lon, firstDt.lat] : [cl.centroid_lon, cl.centroid_lat];
          const straightM = computeMetricDistanceM([hit.lon, hit.lat], dtCoord, metricEpsg);
          const terrainFactor = cl.slope_mean_deg > 12 ? 1.18 : cl.slope_mean_deg > 6 ? 1.12 : 1.05;
          htLengthM = straightM > 150 ? roundN(straightM * terrainFactor, 1) : 0;
          const spanM = cl.slope_mean_deg > 15 ? consts.ht_steep_span_m! : consts.ht_standard_span_m!;
          htPoles = htLengthM > 0 ? Math.ceil(htLengthM / spanM) + 1 : 0;

          if (htLengthM > 0) {
            const midLon = Number(((hit.lon + dtCoord[0]) / 2 + 0.0012).toFixed(6));
            const midLat = Number(((hit.lat + dtCoord[1]) / 2 + 0.0008).toFixed(6));
            features.push({
              type: 'Feature',
              properties: {
                layer_type: 'HT_11KV',
                cluster_label: cl.label,
                name: `${cl.label} · Proposed 11 kV Feeder Spur (${(htLengthM / 1000).toFixed(2)} km)`,
                length_m: htLengthM,
              },
              geometry: { type: 'LineString', coordinates: [[hit.lon, hit.lat], [midLon, midLat], dtCoord] },
            });
          }
          for (const dt of placedDts) {
            features.push({
              type: 'Feature',
              properties: {
                layer_type: 'DT_SUBSTATION',
                cluster_label: cl.label,
                name: `${dt.label} (${dt.rating_kva} kVA)`,
                rating_kva: dt.rating_kva,
              },
              geometry: { type: 'Point', coordinates: [dt.lon, dt.lat] },
            });
          }
          features.push(...ltMst.ltFeatures);
          notes.push(`Grid feeder: ${(htLengthM / 1000).toFixed(2)} km 11 kV HT + ${dtCount} DT (${dtTotalKva} kVA).`);
        }
      }

      // Voltage drop & technical losses
      const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
      const iHtA = htLengthM > 0 && peakKva > 0 ? peakKva / (Math.sqrt(3) * 11) : 0;
      const zEffHt = consts.ht_11kv_r_ohm_per_km! * cosPhi + consts.ht_11kv_x_ohm_per_km! * sinPhi;
      const htDropV = Math.sqrt(3) * iHtA * (htLengthM / 1000) * zEffHt;
      const htDropPct = (htDropV / 11000) * 100;

      const effectiveZones = modality === 'SOLAR_MINIGRID' ? 1 : Math.max(0, dtCount);
      const kvaPerZone = effectiveZones > 0 ? peakKva / effectiveZones : peakKva;
      const iLtA = ltMst.maxLtBranchM > 0 && kvaPerZone > 0 ? kvaPerZone / (Math.sqrt(3) * 0.415) : 0;
      const zEffLt = consts.lt_415v_3ph_r_ohm_per_km! * cosPhi + consts.lt_415v_3ph_x_ohm_per_km! * sinPhi;
      const ltDropV = Math.sqrt(3) * iLtA * (ltMst.maxLtBranchM / 1000) * 0.65 * zEffLt;
      const ltDropPct = (ltDropV / 415) * 100;
      const htOk = htDropPct <= consts.ht_max_vdrop_pct!;
      const ltOk = ltDropPct <= consts.lt_max_vdrop_pct!;

      const lf = peakKw > 0 ? Math.max(0.08, Math.min(0.85, energyDay / (24 * peakKw))) : 0;
      const llf = 0.3 * lf + 0.7 * lf * lf;
      const htLossKwh = htLengthM > 0 ? ((3 * iHtA * iHtA * consts.ht_11kv_r_ohm_per_km! * (htLengthM / 1000)) / 1000) * llf * 8760 : 0;
      const ltLossKwh = effectiveZones > 0 ? effectiveZones * ((3 * iLtA * iLtA * consts.lt_415v_3ph_r_ohm_per_km! * (ltMst.maxLtBranchM / 1000) * 0.5) / 1000) * llf * 8760 : 0;
      let dtNoLoadKwh = 0;
      let dtCopperKwh = 0;
      for (const dt of placedDts) {
        const spec = STANDARD_DT_SPECS.find((s) => s.rating_kva === dt.rating_kva) ?? STANDARD_DT_SPECS[1]!;
        const ratio = dt.allocated_peak_kva / dt.rating_kva;
        dtNoLoadKwh += (spec.no_load_loss_w / 1000) * 8760;
        dtCopperKwh += (spec.full_load_loss_w / 1000) * ratio * ratio * llf * 8760;
      }
      const totalLossMwh = (htLossKwh + ltLossKwh + dtNoLoadKwh + dtCopperKwh) / 1000;
      const lossPct = annualMwh > 0 ? (totalLossMwh / (annualMwh + totalLossMwh)) * 100 : 0;

      clusterLayouts.push({
        id: `lay-${scenarioId}-${cl.label}`,
        scenario_id: scenarioId,
        project_id: projectId,
        cluster_id: cl.id,
        cluster_label: cl.label,
        cluster_name: cl.name,
        est_households: cl.est_households,
        modality,
        is_manual_override: isManual,
        requires_tie_in: requiresTieIn,
        peak_kw_horizon: peakKw,
        peak_kva_horizon: peakKva,
        energy_kwh_day_horizon: energyDay,
        annual_energy_mwh_horizon: annualMwh,
        dt_count: dtCount,
        total_dt_rating_kva: dtTotalKva,
        max_dt_loading_pct: maxDtLoadingPct,
        placed_dts: placedDts,
        ht_length_m: htLengthM,
        ht_poles_count: htPoles,
        lt_3ph_length_m: ltMst.lt3phM,
        lt_1ph_length_m: ltMst.lt1phM,
        lt_total_length_m: ltMst.ltTotalM,
        max_lt_branch_m: ltMst.maxLtBranchM,
        lt_poles_count: ltMst.ltPoles,
        ht_current_a: roundN(iHtA, 2),
        ht_drop_v: roundN(htDropV, 2),
        ht_drop_pct: roundN(htDropPct, 2),
        ht_vdrop_compliant: htOk,
        lt_current_a: roundN(iLtA, 2),
        lt_drop_v: roundN(ltDropV, 2),
        lt_drop_pct: roundN(ltDropPct, 2),
        lt_vdrop_compliant: ltOk,
        overall_vdrop_compliant: htOk && ltOk,
        load_factor: roundN(lf, 3),
        load_loss_factor: roundN(llf, 3),
        ht_line_loss_kwh_yr: roundN(htLossKwh, 1),
        lt_line_loss_kwh_yr: roundN(ltLossKwh, 1),
        dt_no_load_loss_kwh_yr: roundN(dtNoLoadKwh, 1),
        dt_copper_loss_kwh_yr: roundN(dtCopperKwh, 1),
        total_loss_mwh_yr: roundN(totalLossMwh, 3),
        technical_loss_pct: roundN(lossPct, 2),
        solar_pv_kwp: solarKwp,
        bess_capacity_kwh: bessKwh,
        inverter_kva: inverterKva,
        shs_kits_count: 0,
        engineering_notes: notes,
        updated_at: nowIso,
      });
    }

    return {
      id: scenarioId,
      project_id: projectId,
      scenario_key: sDef.key,
      name: sDef.name,
      is_active: isActive,
      requires_tie_in_warning: clusterLayouts.some((c) => c.requires_tie_in),
      total_ht_length_m: roundN(clusterLayouts.reduce((s, c) => s + c.ht_length_m, 0), 1),
      total_lt_length_m: roundN(clusterLayouts.reduce((s, c) => s + c.lt_total_length_m, 0), 1),
      total_dt_count: clusterLayouts.reduce((s, c) => s + c.dt_count, 0),
      total_dt_capacity_kva: roundN(clusterLayouts.reduce((s, c) => s + c.total_dt_rating_kva, 0), 1),
      total_ht_poles: clusterLayouts.reduce((s, c) => s + c.ht_poles_count, 0),
      total_lt_poles: clusterLayouts.reduce((s, c) => s + c.lt_poles_count, 0),
      max_ht_vdrop_pct: roundN(Math.max(...clusterLayouts.map((c) => c.ht_drop_pct), 0), 2),
      max_lt_vdrop_pct: roundN(Math.max(...clusterLayouts.map((c) => c.lt_drop_pct), 0), 2),
      vdrop_compliance_ok: clusterLayouts.every((c) => c.overall_vdrop_compliant),
      total_loss_mwh_yr: roundN(clusterLayouts.reduce((s, c) => s + c.total_loss_mwh_yr, 0), 3),
      total_solar_kwp: roundN(clusterLayouts.reduce((s, c) => s + c.solar_pv_kwp, 0), 2),
      total_bess_kwh: roundN(clusterLayouts.reduce((s, c) => s + c.bess_capacity_kwh, 0), 2),
      total_shs_kits: clusterLayouts.reduce((s, c) => s + c.shs_kits_count, 0),
      network_geojson: { type: 'FeatureCollection', features },
      clusters: clusterLayouts,
      updated_at: nowIso,
    };
  });

  const activeScen = scenarios.find((s) => s.is_active) ?? scenarios[0]!;
  return {
    active_scenario_key: activeScen.scenario_key,
    active_scenario: activeScen,
    scenarios,
  };
}

// ---------------------------------------------------------------------------
// Schedule of Rates (SoR), CSV Import/Export, BOQ & Lifecycle Economics
// ---------------------------------------------------------------------------

export const DEFAULT_SOR_TEMPLATE_KEY = 'ODISHA_OPTCL_TPSODL_REC_2025';
export const DEFAULT_SOR_TEMPLATE_NAME =
  'Odisha OPTCL / TPSODL & MNRE Reference Schedule of Rates (FY 2024-25)';

interface StandardSorDef {
  item_code: string;
  description: string;
  category: string;
  unit: string;
  rate_inr: number;
  citation: string;
  source_year: number;
}

export const STANDARD_SOR_ITEMS: readonly StandardSorDef[] = [
  { item_code: 'HT-COND-ACSR-50', description: '11 kV 3-Phase Overhead Line with ACSR Rabbit (50 mm2) Conductor', category: 'HT_11KV', unit: 'km', rate_inr: 185000, citation: 'OPTCL / Odisha DISCOM Unified SoR & REC RDSS Cost Norms', source_year: 2025 },
  { item_code: 'HT-POLE-PSC-9M', description: '9.0 m 300 kg PSC Pole for 11 kV Feeder with V-Cross Arm, Insulators & Stay', category: 'HT_11KV', unit: 'No.', rate_inr: 14500, citation: 'REC Standard 11 kV Construction Drawing A-1/A-2 & Odisha SoR', source_year: 2025 },
  { item_code: 'DT-11-04-16KVA', description: '16 kVA, 11/0.433 kV 3-Phase Outdoor Distribution Transformer (IS 1180 L-2)', category: 'DT_SUBSTATION', unit: 'No.', rate_inr: 78000, citation: 'IS 1180 (Part 1):2014 & REC RDSS Cost Data Book', source_year: 2025 },
  { item_code: 'DT-11-04-25KVA', description: '25 kVA, 11/0.433 kV 3-Phase Outdoor Distribution Transformer (IS 1180 L-2)', category: 'DT_SUBSTATION', unit: 'No.', rate_inr: 96000, citation: 'IS 1180 (Part 1):2014 & REC RDSS Cost Data Book', source_year: 2025 },
  { item_code: 'DT-11-04-63KVA', description: '63 kVA, 11/0.433 kV 3-Phase Double-Pole DT (IS 1180 L-2)', category: 'DT_SUBSTATION', unit: 'No.', rate_inr: 162000, citation: 'IS 1180 (Part 1):2014 & REC RDSS Cost Data Book', source_year: 2025 },
  { item_code: 'DT-11-04-100KVA', description: '100 kVA, 11/0.433 kV 3-Phase Plinth DT (IS 1180 L-2)', category: 'DT_SUBSTATION', unit: 'No.', rate_inr: 225000, citation: 'IS 1180 (Part 1):2014 & REC RDSS Cost Data Book', source_year: 2025 },
  { item_code: 'DT-11-04-200KVA', description: '200 kVA, 11/0.433 kV 3-Phase Plinth DT (IS 1180 L-2)', category: 'DT_SUBSTATION', unit: 'No.', rate_inr: 365000, citation: 'IS 1180 (Part 1):2014 & REC RDSS Cost Data Book', source_year: 2025 },
  { item_code: 'DT-PROT-HG-AB', description: '11 kV 200 A AB Switch, HG Fuse Unit, 9 kV LA & LT MCCB Distribution Box', category: 'DT_SUBSTATION', unit: 'Set', rate_inr: 34000, citation: 'REC Standard 11/0.4 kV Substation Protection Schedule', source_year: 2025 },
  { item_code: 'LT-COND-AB-3PH', description: '415 V 3-Phase Aerial Bunched (AB) XLPE Cable (3x50+1x16+1x35 mm2)', category: 'LT_415V', unit: 'km', rate_inr: 210000, citation: 'IS 14255 & REC Tribal/Forest AB-Cable Norms', source_year: 2025 },
  { item_code: 'LT-COND-AB-1PH', description: '240 V 1-Phase Aerial Bunched (AB) XLPE Cable Lateral (1x35+1x25 mm2)', category: 'LT_415V', unit: 'km', rate_inr: 128000, citation: 'IS 14255 & REC Tribal/Forest AB-Cable Norms', source_year: 2025 },
  { item_code: 'LT-POLE-PSC-8M', description: '8.0 m 200 kg PSC Pole for 415 V LT Line with Clamps & Stay Set', category: 'LT_415V', unit: 'No.', rate_inr: 9800, citation: 'REC Standard 8.0 m 200 kg PSC Specification', source_year: 2025 },
  { item_code: 'SVC-CONN-BPL-1PH', description: 'Last-Mile Household Service Connection Kit with Meter, MCB & Service Cable', category: 'SERVICE_CONNECTIONS', unit: 'Household', rate_inr: 3850, citation: 'MoP RDSS / Saubhagya Last-Mile Service Norm', source_year: 2025 },
  { item_code: 'MG-SOLAR-PV-KW', description: 'Decentralized Solar PV Array (Mono-PERC >= 540 Wp, MMS, AJBs & DC Cabling)', category: 'SOLAR_MINIGRID', unit: 'kWp', rate_inr: 42000, citation: 'MNRE Off-Grid Solar PV Benchmark Cost Norms (Hilly/Tribal)', source_year: 2025 },
  { item_code: 'MG-BESS-LFP-KWH', description: 'LiFePO4 Battery Energy Storage System (BESS) with BMS & Racks', category: 'SOLAR_MINIGRID', unit: 'kWh', rate_inr: 16500, citation: 'MNRE / NITI Aayog Mini-Grid BESS Benchmark', source_year: 2025 },
  { item_code: 'MG-PCU-INV-KVA', description: 'Bi-Directional Hybrid Solar Power Conditioning Unit (PCU) with RMS Telemetry', category: 'SOLAR_MINIGRID', unit: 'kVA', rate_inr: 11500, citation: 'MNRE Technical Specification for Mini-Grid PCU', source_year: 2025 },
  { item_code: 'MG-CIV-CTRL-ROOM', description: 'Mini-Grid Control Room Civil Works, Fencing, Borewell & Lightning Arrester', category: 'SOLAR_MINIGRID', unit: 'Cluster', rate_inr: 185000, citation: 'MNRE / OREDA Remote Tribal Mini-Grid Civil Norm', source_year: 2025 },
  { item_code: 'SHS-KIT-200WP', description: 'Standalone Solar Home System (200 Wp PV + 1.28 kWh LiFePO4 + 5-Yr AMC)', category: 'STANDALONE_SHS', unit: 'Kit', rate_inr: 24500, citation: 'MNRE PM-JANMAN / DA-JGUA SHS Sanction Norm', source_year: 2025 },
  { item_code: 'CIV-EARTH-PIPE', description: '40 mm Dia 3.0 m Perforated GI Pipe Earthing Electrode Set (IS 3043)', category: 'CIVIL_EARTHING', unit: 'Set', rate_inr: 4200, citation: 'IS 3043 Code of Practice for Earthing', source_year: 2025 },
];

export function createDefaultRatesList(projectId: string): ProjectRateListDto {
  const nowIso = new Date().toISOString();
  const items: ProjectRateItemDto[] = STANDARD_SOR_ITEMS.map((s) => ({
    id: `rate-${projectId.slice(0, 8)}-${s.item_code}`,
    project_id: projectId,
    template_key: DEFAULT_SOR_TEMPLATE_KEY,
    template_name: DEFAULT_SOR_TEMPLATE_NAME,
    item_code: s.item_code,
    description: s.description,
    category: s.category,
    unit: s.unit,
    rate_inr: s.rate_inr,
    source_type: 'REFERENCE_PUBLIC_DOCUMENT',
    citation: s.citation,
    source_year: s.source_year,
    is_user_edited: false,
    updated_at: nowIso,
  }));
  return {
    project_id: projectId,
    template_key: DEFAULT_SOR_TEMPLATE_KEY,
    template_name: DEFAULT_SOR_TEMPLATE_NAME,
    total_items: items.length,
    unset_count: 0,
    unset_item_codes: [],
    user_edited_count: 0,
    items,
  };
}

export function generateSorCsvContent(rates: ProjectRateListDto): string {
  const header = 'item_code,description,category,unit,rate_inr,source_type,citation,source_year';
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = rates.items.map((r) =>
    [
      esc(r.item_code),
      esc(r.description),
      esc(r.category),
      esc(r.unit),
      r.rate_inr === null ? 'UNSET' : String(r.rate_inr),
      esc(r.source_type),
      esc(r.citation),
      String(r.source_year),
    ].join(','),
  );
  return [header, ...rows].join('\n');
}

function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let curr = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"' && inQuotes && line[i + 1] === '"') {
      curr += '"';
      i += 1;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      out.push(curr.trim());
      curr = '';
    } else {
      curr += ch;
    }
  }
  out.push(curr.trim());
  return out;
}

export function parseAndValidateSorCsv(
  projectId: string,
  csvContent: string,
  templateName: string,
): SorCsvImportResponseDto {
  const lines = csvContent
    .replace(/^\ufeff/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return {
      is_valid: false,
      imported_count: 0,
      unset_count: 0,
      unset_item_codes: [],
      errors: [{ row_number: 1, item_code: 'CSV', field: 'file', message: 'CSV must include header and at least one rate row.' }],
      rates: null,
    };
  }

  const headers = splitCsvRow(lines[0]!).map((h) => h.toLowerCase());
  const codeIdx = headers.indexOf('item_code');
  const descIdx = headers.indexOf('description');
  const catIdx = headers.indexOf('category');
  const unitIdx = headers.indexOf('unit');
  const rateIdx = headers.indexOf('rate_inr');
  const citIdx = headers.indexOf('citation');

  if (codeIdx < 0 || descIdx < 0 || catIdx < 0 || unitIdx < 0 || rateIdx < 0) {
    return {
      is_valid: false,
      imported_count: 0,
      unset_count: 0,
      unset_item_codes: [],
      errors: [{ row_number: 1, item_code: 'HEADER', field: 'columns', message: 'Missing required columns: item_code,description,category,unit,rate_inr.' }],
      rates: null,
    };
  }

  const errors: CsvImportErrorDto[] = [];
  const parsed: ProjectRateItemDto[] = [];
  const unsetCodes: string[] = [];
  const nowIso = new Date().toISOString();

  for (let r = 1; r < lines.length; r += 1) {
    const cols = splitCsvRow(lines[r]!);
    const code = (cols[codeIdx] ?? '').toUpperCase();
    const desc = cols[descIdx] ?? '';
    const cat = (cols[catIdx] ?? '').toUpperCase();
    const unit = cols[unitIdx] ?? '';
    const rawRate = (cols[rateIdx] ?? '').trim();
    const citation = (citIdx >= 0 ? cols[citIdx] : '') || templateName;

    if (!code || !desc || !unit) {
      errors.push({ row_number: r + 1, item_code: code || `ROW-${r + 1}`, field: 'required', message: 'item_code, description, and unit are required.' });
      continue;
    }

    let rateVal: number | null = null;
    if (!rawRate || rawRate.toUpperCase() === 'UNSET') {
      unsetCodes.push(code);
    } else {
      const n = Number(rawRate);
      if (!Number.isFinite(n) || n <= 0) {
        errors.push({ row_number: r + 1, item_code: code, field: 'rate_inr', message: `Invalid rate '${rawRate}'. Must be positive INR or UNSET.` });
        continue;
      }
      rateVal = n;
    }

    parsed.push({
      id: `rate-${projectId.slice(0, 8)}-${code}`,
      project_id: projectId,
      template_key: 'CUSTOM_CSV_TEMPLATE',
      template_name: templateName,
      item_code: code,
      description: desc,
      category: cat,
      unit,
      rate_inr: rateVal,
      source_type: rateVal === null ? 'UNSET' : 'USER_TEMPLATE',
      citation,
      source_year: 2025,
      is_user_edited: true,
      updated_at: nowIso,
    });
  }

  if (errors.length > 0) {
    return { is_valid: false, imported_count: 0, unset_count: unsetCodes.length, unset_item_codes: unsetCodes, errors, rates: null };
  }

  const rates: ProjectRateListDto = {
    project_id: projectId,
    template_key: 'CUSTOM_CSV_TEMPLATE',
    template_name: templateName,
    total_items: parsed.length,
    unset_count: unsetCodes.length,
    unset_item_codes: unsetCodes,
    user_edited_count: parsed.length,
    items: parsed,
  };
  return { is_valid: true, imported_count: parsed.length, unset_count: unsetCodes.length, unset_item_codes: unsetCodes, errors: [], rates };
}

export function resolveSchemeGrantPolicy(scheme: string | null | undefined): { pct: number; note: string } {
  const up = (scheme ?? '').toUpperCase();
  if (up.includes('PM-JANMAN') || up.includes('JANMAN')) {
    return { pct: 90, note: 'PM-JANMAN PVTG Special Central Grant Policy (90% Capital Subsidy)' };
  }
  if (up.includes('DA-JGUA') || up.includes('JUGA')) {
    return { pct: 90, note: 'DA-JGUA Tribal Habitation Grant Norm (90% Capital Subsidy)' };
  }
  if (up.includes('RDSS')) {
    return { pct: 60, note: 'RDSS Loss-Reduction & Distribution Grant Norm (60% Capital Subsidy)' };
  }
  return { pct: 60, note: 'Default Central Electrification Grant Norm (60% Capital Subsidy)' };
}

function evaluateLifecycleEconomics(params: {
  modality: string;
  capexInr: number;
  bessCapexInr: number;
  estHouseholds: number;
  annualDeliveredMwh: number;
  annualLossMwh: number;
  discountRate: number;
  horizonYears: number;
  grantPct: number;
}): LifecycleEconomicsDto {
  const r = Math.max(0, params.discountRate);
  const n = Math.max(1, params.horizonYears);
  const factor = Math.pow(1 + r, n);
  const pwf = r < 1e-6 ? n : (factor - 1) / (r * factor);
  const crf = r < 1e-6 ? 1 / n : (r * factor) / (factor - 1);

  const omPct =
    params.modality === 'SOLAR_MINIGRID'
      ? 3.0
      : params.modality === 'STANDALONE_SHS'
        ? 3.5
        : 2.5;
  const annualOm = roundN(params.capexInr * (omPct / 100), 2);
  const pvOm = roundN(annualOm * pwf, 2);

  const annualEnergyPurchase =
    params.modality === 'GRID_EXTENSION' || params.modality === 'GRID_AUGMENTATION'
      ? roundN((params.annualDeliveredMwh + params.annualLossMwh) * 1000 * 4.2, 2)
      : 0;
  const pvEnergyPurchase = roundN(annualEnergyPurchase * pwf, 2);

  const pvBattRep =
    params.bessCapexInr > 0 && n >= 7
      ? roundN((params.bessCapexInr * 0.7) / Math.pow(1 + r, 7), 2)
      : 0;

  const npc = roundN(params.capexInr + pvOm + pvEnergyPurchase + pvBattRep, 2);
  const annualDeliveredKwh = roundN(Math.max(1, params.annualDeliveredMwh * 1000), 2);
  const pvDeliveredKwh = roundN(annualDeliveredKwh * pwf, 2);
  const lcoe = roundN(npc / Math.max(1, pvDeliveredKwh), 2);
  const subsidyInr = roundN(params.capexInr * (params.grantPct / 100), 2);
  const netCapex = roundN(Math.max(0, params.capexInr - subsidyInr), 2);
  const hhDiv = Math.max(1, params.estHouseholds);
  const avoidedCo2 =
    params.modality === 'SOLAR_MINIGRID' || params.modality === 'STANDALONE_SHS'
      ? roundN(params.annualDeliveredMwh * 0.716, 2)
      : 0;

  return {
    modality: params.modality,
    capex_inr: roundN(params.capexInr, 2),
    capex_lakhs: roundN(params.capexInr / 100000, 2),
    capital_subsidy_inr: subsidyInr,
    net_utility_capex_inr: netCapex,
    annual_om_inr: annualOm,
    annual_energy_purchase_inr: annualEnergyPurchase,
    pv_om_inr: pvOm,
    pv_energy_purchase_inr: pvEnergyPurchase,
    pv_battery_replacement_inr: pvBattRep,
    npc_inr: npc,
    npc_lakhs: roundN(npc / 100000, 2),
    annual_delivered_energy_kwh: annualDeliveredKwh,
    pv_delivered_energy_kwh: pvDeliveredKwh,
    lcoe_inr_kwh: lcoe,
    annualized_cost_inr_yr: roundN(npc * crf, 2),
    cost_per_household_inr: roundN(params.capexInr / hhDiv, 2),
    npc_per_household_inr: roundN(npc / hhDiv, 2),
    avoided_co2_tonnes_yr: avoidedCo2,
  };
}

function dtRatingToCode(ratingKva: number): string {
  if (ratingKva <= 16) return 'DT-11-04-16KVA';
  if (ratingKva <= 25) return 'DT-11-04-25KVA';
  if (ratingKva <= 63) return 'DT-11-04-63KVA';
  if (ratingKva <= 100) return 'DT-11-04-100KVA';
  return 'DT-11-04-200KVA';
}

function computeClusterBoqBreakdown(params: {
  layout: ClusterEngineeringLayoutDto;
  clusterMeta: ClusterDto | undefined;
  ratesMap: Map<string, ProjectRateItemDto>;
  discountRate: number;
  horizonYears: number;
  grantPct: number;
}): { breakdown: ClusterBoqBreakdownDto; bessBatteryCapexInr: number } {
  const { layout, clusterMeta, ratesMap, discountRate, horizonYears, grantPct } = params;
  const lines: BoqLineItemDto[] = [];
  let bessCapex = 0;

  const pushLine = (code: string, qty: number, basis: string) => {
    const spec = ratesMap.get(code);
    const qR = roundN(qty, 3);
    if (!spec) {
      lines.push({
        cluster_id: layout.cluster_id,
        cluster_label: layout.cluster_label,
        item_code: code,
        description: `Missing Schedule of Rates Entry (${code})`,
        category: 'CIVIL_EARTHING',
        unit: 'Unit',
        quantity: qR,
        quantity_basis: basis,
        rate_inr: null,
        rate_source_type: 'UNSET',
        citation: 'Missing from active Schedule of Rates',
        is_unset: true,
        amount_inr: 0,
      });
      return null;
    }
    const isUnset = spec.rate_inr === null || spec.source_type === 'UNSET';
    const amt = spec.rate_inr === null ? 0 : roundN(qR * spec.rate_inr, 2);
    const ln: BoqLineItemDto = {
      cluster_id: layout.cluster_id,
      cluster_label: layout.cluster_label,
      item_code: spec.item_code,
      description: spec.description,
      category: spec.category,
      unit: spec.unit,
      quantity: qR,
      quantity_basis: basis,
      rate_inr: spec.rate_inr,
      rate_source_type: isUnset ? 'UNSET' : spec.source_type,
      citation: spec.citation,
      is_unset: isUnset,
      amount_inr: amt,
    };
    lines.push(ln);
    return ln;
  };

  if (layout.ht_length_m > 0) {
    pushLine('HT-COND-ACSR-50', (layout.ht_length_m / 1000) * 1.03, `${layout.ht_length_m.toFixed(1)} m route x 1.03 sag`);
  }
  if (layout.ht_poles_count > 0) {
    pushLine('HT-POLE-PSC-9M', layout.ht_poles_count, `${layout.ht_poles_count} nos. 9 m PSC supports`);
  }

  if (layout.placed_dts.length > 0 && (layout.modality === 'GRID_EXTENSION' || layout.modality === 'GRID_AUGMENTATION')) {
    const dtGroups = new Map<string, { cnt: number; rating: number }>();
    for (const dt of layout.placed_dts) {
      const code = dtRatingToCode(dt.rating_kva);
      const prev = dtGroups.get(code) ?? { cnt: 0, rating: dt.rating_kva };
      dtGroups.set(code, { cnt: prev.cnt + 1, rating: dt.rating_kva });
    }
    for (const [code, info] of dtGroups.entries()) {
      pushLine(code, info.cnt, `${info.cnt} x ${info.rating} kVA IS-1180 L-2 DT`);
    }
    pushLine('DT-PROT-HG-AB', layout.placed_dts.length, `Protection & MCCB kit for ${layout.placed_dts.length} DT(s)`);
  }

  const ltScale = layout.modality === 'GRID_AUGMENTATION' ? 0.5 : 1.0;
  const lt3M = layout.lt_3ph_length_m * ltScale;
  const lt1M = layout.lt_1ph_length_m * ltScale;
  const ltPolesEff = layout.lt_poles_count > 0 ? Math.max(1, Math.ceil(layout.lt_poles_count * ltScale)) : 0;
  if (lt3M > 0) pushLine('LT-COND-AB-3PH', (lt3M / 1000) * 1.03, `${lt3M.toFixed(1)} m 3-ph trunk x 1.03 sag`);
  if (lt1M > 0) pushLine('LT-COND-AB-1PH', (lt1M / 1000) * 1.03, `${lt1M.toFixed(1)} m 1-ph lateral x 1.03 sag`);
  if (ltPolesEff > 0) pushLine('LT-POLE-PSC-8M', ltPolesEff, `${ltPolesEff} nos. 8 m PSC poles`);

  if (['GRID_EXTENSION', 'SOLAR_MINIGRID', 'GRID_AUGMENTATION'].includes(layout.modality)) {
    const connHh = layout.modality === 'GRID_AUGMENTATION' ? Math.max(1, Math.round(layout.est_households * 0.35)) : Math.max(1, layout.est_households);
    pushLine('SVC-CONN-BPL-1PH', connHh, `Service connection kits for ${connHh} HH`);
  }

  if (layout.modality === 'SOLAR_MINIGRID') {
    if (layout.solar_pv_kwp > 0) pushLine('MG-SOLAR-PV-KW', layout.solar_pv_kwp, `${layout.solar_pv_kwp} kWp Mono-PERC array`);
    if (layout.bess_capacity_kwh > 0) {
      const bLn = pushLine('MG-BESS-LFP-KWH', layout.bess_capacity_kwh, `${layout.bess_capacity_kwh} kWh LiFePO4 BESS bank`);
      if (bLn) bessCapex += bLn.amount_inr;
    }
    if (layout.inverter_kva > 0) pushLine('MG-PCU-INV-KVA', layout.inverter_kva, `${layout.inverter_kva} kVA bidirectional PCU`);
    pushLine('MG-CIV-CTRL-ROOM', 1, '1 mini-grid control room, fencing & earthing');
  }

  if (layout.modality === 'STANDALONE_SHS' && layout.shs_kits_count > 0) {
    const sLn = pushLine('SHS-KIT-200WP', layout.shs_kits_count, `${layout.shs_kits_count} x 200 Wp + 1.28 kWh SHS kits`);
    if (sLn) bessCapex += roundN(sLn.amount_inr * 0.32, 2);
  }

  const totalPoles = layout.ht_poles_count + ltPolesEff;
  const earthSets = 2 * layout.placed_dts.length + Math.ceil(totalPoles / 3) + (layout.modality === 'SOLAR_MINIGRID' ? 2 : 0);
  if (earthSets > 0) {
    pushLine('CIV-EARTH-PIPE', earthSets, `${earthSets} GI pipe earthing sets (IS 3043)`);
  }

  const unsetCodes = Array.from(new Set(lines.filter((l) => l.is_unset).map((l) => l.item_code))).sort();
  const hasUnset = unsetCodes.length > 0;
  const slope = clusterMeta?.slope_mean_deg ?? 4.0;
  const terrainMult = slope > 15 ? 1.25 : slope > 8 ? 1.12 : 1.0;
  const terrainLabel =
    terrainMult > 1.2
      ? 'Steep Hilly / Forest Terrain (1.25x Erection Factor)'
      : terrainMult > 1.05
        ? 'Rolling Hilly / Riverine Terrain (1.12x Erection Factor)'
        : 'Plain / Accessible Terrain (1.00x Base Factor)';

  const baseEq = hasUnset ? 0 : roundN(lines.reduce((s, l) => s + l.amount_inr, 0), 2);
  const terrainEligible = hasUnset
    ? 0
    : roundN(
        lines
          .filter((l) => ['HT_11KV', 'LT_415V', 'CIVIL_EARTHING'].includes(l.category) || l.item_code === 'MG-CIV-CTRL-ROOM')
          .reduce((s, l) => s + l.amount_inr, 0),
        2,
      );
  const terrainPrem = hasUnset ? 0 : roundN(terrainEligible * (terrainMult - 1), 2);
  const subtotal = roundN(baseEq + terrainPrem, 2);
  const gst = hasUnset ? 0 : roundN(subtotal * 0.18, 2);
  const cont = hasUnset ? 0 : roundN(subtotal * 0.03, 2);
  const pmc = hasUnset ? 0 : roundN(subtotal * 0.05, 2);
  const capex = roundN(subtotal + gst + cont + pmc, 2);

  const econ = hasUnset
    ? {
        modality: layout.modality,
        capex_inr: 0,
        capex_lakhs: 0,
        capital_subsidy_inr: 0,
        net_utility_capex_inr: 0,
        annual_om_inr: 0,
        annual_energy_purchase_inr: 0,
        pv_om_inr: 0,
        pv_energy_purchase_inr: 0,
        pv_battery_replacement_inr: 0,
        npc_inr: 0,
        npc_lakhs: 0,
        annual_delivered_energy_kwh: roundN(layout.annual_energy_mwh_horizon * 1000, 2),
        pv_delivered_energy_kwh: roundN(layout.annual_energy_mwh_horizon * 1000 * horizonYears, 2),
        lcoe_inr_kwh: 0,
        annualized_cost_inr_yr: 0,
        cost_per_household_inr: 0,
        npc_per_household_inr: 0,
        avoided_co2_tonnes_yr: 0,
      }
    : evaluateLifecycleEconomics({
        modality: layout.modality,
        capexInr: capex,
        bessCapexInr: bessCapex,
        estHouseholds: layout.est_households,
        annualDeliveredMwh: layout.annual_energy_mwh_horizon,
        annualLossMwh: layout.total_loss_mwh_yr,
        discountRate,
        horizonYears,
        grantPct,
      });

  return {
    bessBatteryCapexInr: hasUnset ? 0 : bessCapex,
    breakdown: {
      cluster_id: layout.cluster_id,
      cluster_label: layout.cluster_label,
      cluster_name: layout.cluster_name,
      modality: layout.modality,
      est_households: layout.est_households,
      terrain_multiplier: terrainMult,
      terrain_classification: terrainLabel,
      base_equipment_inr: baseEq,
      terrain_premium_inr: terrainPrem,
      subtotal_supply_erection_inr: subtotal,
      gst_amount_inr: gst,
      contingency_amount_inr: cont,
      pmc_overhead_amount_inr: pmc,
      total_capex_inr: capex,
      total_capex_lakhs: roundN(capex / 100000, 2),
      has_unset_rates: hasUnset,
      unset_item_codes: unsetCodes,
      economics: econ,
      lines,
    },
  };
}

function buildScenarioBoq(params: {
  projectId: string;
  scenario: PlanningScenarioDto;
  clusterById: Map<string, ClusterDto>;
  ratesMap: Map<string, ProjectRateItemDto>;
  discountRate: number;
  horizonYears: number;
  grantPct: number;
  grantNote: string;
}): ScenarioBoqDto {
  const { projectId, scenario, clusterById, ratesMap, discountRate, horizonYears, grantPct, grantNote } = params;
  const cbPairs = scenario.clusters.map((lay) =>
    computeClusterBoqBreakdown({
      layout: lay,
      clusterMeta: clusterById.get(lay.cluster_id),
      ratesMap,
      discountRate,
      horizonYears,
      grantPct,
    }),
  );
  const clusterBreakdowns = cbPairs.map((p) => p.breakdown);
  const unsetCodes = Array.from(new Set(clusterBreakdowns.flatMap((c) => c.unset_item_codes))).sort();
  const hasUnset = unsetCodes.length > 0;

  const groupedQty = new Map<string, { qty: number; clusters: Set<string>; sampleLine: BoqLineItemDto }>();
  for (const cb of clusterBreakdowns) {
    for (const ln of cb.lines) {
      const prev = groupedQty.get(ln.item_code);
      if (prev) {
        prev.qty += ln.quantity;
        prev.clusters.add(cb.cluster_label);
      } else {
        groupedQty.set(ln.item_code, { qty: ln.quantity, clusters: new Set([cb.cluster_label]), sampleLine: ln });
      }
    }
  }

  const aggregatedLines: BoqLineItemDto[] = Array.from(groupedQty.entries()).map(([code, g]) => {
    const qR = roundN(g.qty, 3);
    const rate = g.sampleLine.rate_inr;
    return {
      ...g.sampleLine,
      cluster_id: null,
      cluster_label: 'ALL',
      item_code: code,
      quantity: qR,
      quantity_basis: `Aggregated across ${Array.from(g.clusters).sort().join(', ')}`,
      amount_inr: rate === null ? 0 : roundN(qR * rate, 2),
    };
  });

  const baseEq = hasUnset ? 0 : roundN(clusterBreakdowns.reduce((s, c) => s + c.base_equipment_inr, 0), 2);
  const terrainPrem = hasUnset ? 0 : roundN(clusterBreakdowns.reduce((s, c) => s + c.terrain_premium_inr, 0), 2);
  const subtotal = roundN(baseEq + terrainPrem, 2);
  const gst = hasUnset ? 0 : roundN(subtotal * 0.18, 2);
  const cont = hasUnset ? 0 : roundN(subtotal * 0.03, 2);
  const pmc = hasUnset ? 0 : roundN(subtotal * 0.05, 2);
  const totalCapex = roundN(subtotal + gst + cont + pmc, 2);
  const totalHh = clusterBreakdowns.reduce((s, c) => s + c.est_households, 0);
  const totalBess = cbPairs.reduce((s, p) => s + p.bessBatteryCapexInr, 0);
  const totalDeliveredMwh = scenario.clusters.reduce((s, c) => s + c.annual_energy_mwh_horizon, 0);

  const econ = hasUnset
    ? {
        modality: scenario.scenario_key,
        capex_inr: 0,
        capex_lakhs: 0,
        capital_subsidy_inr: 0,
        net_utility_capex_inr: 0,
        annual_om_inr: 0,
        annual_energy_purchase_inr: 0,
        pv_om_inr: 0,
        pv_energy_purchase_inr: 0,
        pv_battery_replacement_inr: 0,
        npc_inr: 0,
        npc_lakhs: 0,
        annual_delivered_energy_kwh: roundN(totalDeliveredMwh * 1000, 2),
        pv_delivered_energy_kwh: roundN(totalDeliveredMwh * 1000 * horizonYears, 2),
        lcoe_inr_kwh: 0,
        annualized_cost_inr_yr: 0,
        cost_per_household_inr: 0,
        npc_per_household_inr: 0,
        avoided_co2_tonnes_yr: roundN(clusterBreakdowns.reduce((s, c) => s + c.economics.avoided_co2_tonnes_yr, 0), 2),
      }
    : (() => {
        const pvOm = roundN(clusterBreakdowns.reduce((s, c) => s + c.economics.pv_om_inr, 0), 2);
        const pvEnergy = roundN(clusterBreakdowns.reduce((s, c) => s + c.economics.pv_energy_purchase_inr, 0), 2);
        const pvBatt = roundN(clusterBreakdowns.reduce((s, c) => s + c.economics.pv_battery_replacement_inr, 0), 2);
        const npc = roundN(totalCapex + pvOm + pvEnergy + pvBatt, 2);
        const pvKwh = roundN(Math.max(1, clusterBreakdowns.reduce((s, c) => s + c.economics.pv_delivered_energy_kwh, 0)), 2);
        const factor = Math.pow(1 + discountRate, horizonYears);
        const crf = discountRate < 1e-6 ? 1 / horizonYears : (discountRate * factor) / (factor - 1);
        const subsidy = roundN(totalCapex * (grantPct / 100), 2);
        return {
          modality: scenario.scenario_key,
          capex_inr: totalCapex,
          capex_lakhs: roundN(totalCapex / 100000, 2),
          capital_subsidy_inr: subsidy,
          net_utility_capex_inr: roundN(Math.max(0, totalCapex - subsidy), 2),
          annual_om_inr: roundN(clusterBreakdowns.reduce((s, c) => s + c.economics.annual_om_inr, 0), 2),
          annual_energy_purchase_inr: roundN(clusterBreakdowns.reduce((s, c) => s + c.economics.annual_energy_purchase_inr, 0), 2),
          pv_om_inr: pvOm,
          pv_energy_purchase_inr: pvEnergy,
          pv_battery_replacement_inr: pvBatt,
          npc_inr: npc,
          npc_lakhs: roundN(npc / 100000, 2),
          annual_delivered_energy_kwh: roundN(totalDeliveredMwh * 1000, 2),
          pv_delivered_energy_kwh: pvKwh,
          lcoe_inr_kwh: roundN(npc / pvKwh, 2),
          annualized_cost_inr_yr: roundN(npc * crf, 2),
          cost_per_household_inr: roundN(totalCapex / Math.max(1, totalHh), 2),
          npc_per_household_inr: roundN(npc / Math.max(1, totalHh), 2),
          avoided_co2_tonnes_yr: roundN(clusterBreakdowns.reduce((s, c) => s + c.economics.avoided_co2_tonnes_yr, 0), 2),
        };
      })();

  void totalBess;

  return {
    project_id: projectId,
    scenario_id: scenario.id,
    scenario_key: scenario.scenario_key,
    scenario_name: scenario.name,
    is_active_baseline: scenario.is_active,
    discount_rate: discountRate,
    horizon_years: horizonYears,
    gst_pct: 18,
    contingency_pct: 3,
    pmc_overhead_pct: 5,
    capital_subsidy_pct: grantPct,
    base_equipment_inr: baseEq,
    terrain_premium_inr: terrainPrem,
    subtotal_supply_erection_inr: subtotal,
    gst_amount_inr: gst,
    contingency_amount_inr: cont,
    pmc_overhead_amount_inr: pmc,
    total_capex_inr: totalCapex,
    total_capex_lakhs: roundN(totalCapex / 100000, 2),
    has_unset_rates: hasUnset,
    unset_item_codes: unsetCodes,
    totals_withheld: hasUnset,
    grant_policy_note: grantNote,
    export_blocked_reason: hasUnset
      ? `DPR export is blocked because ${unsetCodes.length} Schedule of Rates item(s) are UNSET: ${unsetCodes.join(', ')}.`
      : null,
    economics: econ,
    aggregated_lines: aggregatedLines,
    cluster_breakdowns: clusterBreakdowns,
  };
}

export function buildProjectScenarioComparison(params: {
  projectId: string;
  scheme: string;
  discountRate: number;
  horizonYears: number;
  clusters: ClusterDto[];
  scenarios: PlanningScenarioDto[];
  activeScenario: PlanningScenarioDto;
  rates: ProjectRateListDto;
}): ProjectScenarioComparisonDto {
  const { projectId, scheme, discountRate, horizonYears, clusters, scenarios, activeScenario, rates } = params;
  const clusterById = new Map(clusters.map((c) => [c.id, c]));
  const ratesMap = new Map(rates.items.map((r) => [r.item_code, r]));
  const { pct: grantPct, note: grantNote } = resolveSchemeGrantPolicy(scheme);

  const boqs = scenarios.map((sc) =>
    buildScenarioBoq({ projectId, scenario: sc, clusterById, ratesMap, discountRate, horizonYears, grantPct, grantNote }),
  );
  const activeBoq = boqs.find((b) => b.scenario_id === activeScenario.id) ?? boqs[0]!;

  const cards: ScenarioComparisonCardDto[] = scenarios.map((sc, idx) => {
    const boq = boqs[idx]!;
    const modCounts: Record<string, number> = {};
    for (const c of sc.clusters) modCounts[c.modality] = (modCounts[c.modality] ?? 0) + 1;
    return {
      scenario_id: sc.id,
      scenario_key: sc.scenario_key,
      scenario_name: sc.name,
      is_active_baseline: sc.is_active,
      requires_tie_in_warning: sc.requires_tie_in_warning,
      vdrop_compliance_ok: sc.vdrop_compliance_ok,
      total_households_served: sc.clusters.reduce((s, c) => s + c.est_households, 0),
      annual_delivered_energy_mwh: roundN(boq.economics.annual_delivered_energy_kwh / 1000, 2),
      modality_counts: modCounts,
      base_equipment_inr: boq.base_equipment_inr,
      terrain_premium_inr: boq.terrain_premium_inr,
      gst_amount_inr: boq.gst_amount_inr,
      contingency_amount_inr: boq.contingency_amount_inr,
      pmc_overhead_amount_inr: boq.pmc_overhead_amount_inr,
      total_capex_inr: boq.total_capex_inr,
      total_capex_lakhs: boq.total_capex_lakhs,
      capital_subsidy_inr: boq.economics.capital_subsidy_inr,
      net_utility_capex_inr: boq.economics.net_utility_capex_inr,
      annual_om_inr: boq.economics.annual_om_inr,
      annual_energy_purchase_inr: boq.economics.annual_energy_purchase_inr,
      npc_inr: boq.economics.npc_inr,
      npc_lakhs: boq.economics.npc_lakhs,
      lcoe_inr_kwh: boq.economics.lcoe_inr_kwh,
      cost_per_household_inr: boq.economics.cost_per_household_inr,
      npc_per_household_inr: boq.economics.npc_per_household_inr,
      avoided_co2_tonnes_yr: boq.economics.avoided_co2_tonnes_yr,
      has_unset_rates: boq.has_unset_rates,
      totals_withheld: boq.totals_withheld,
      unset_item_codes: boq.unset_item_codes,
    };
  });

  const gridBoq = boqs.find((b) => b.scenario_key === 'GRID_EXTENSION_ONLY');
  const mgBoq = boqs.find((b) => b.scenario_key === 'MINIGRID_PRIORITY');
  const shsBoq = boqs.find((b) => b.scenario_key === 'SHS_DISPERSED');
  const gridScen = scenarios.find((s) => s.scenario_key === 'GRID_EXTENSION_ONLY');

  const habitationRows: HabitationOptionComparisonRowDto[] = activeScenario.clusters.map((ac) => {
    const gCb = gridBoq?.cluster_breakdowns.find((c) => c.cluster_id === ac.cluster_id);
    const mCb = mgBoq?.cluster_breakdowns.find((c) => c.cluster_id === ac.cluster_id);
    const sCb = shsBoq?.cluster_breakdowns.find((c) => c.cluster_id === ac.cluster_id);
    const gReq = gridScen?.clusters.find((c) => c.cluster_id === ac.cluster_id)?.requires_tie_in ?? false;

    const options: Array<[string, number]> = [
      ['GRID_EXTENSION', gCb?.economics.npc_inr || Infinity],
      ['SOLAR_MINIGRID', mCb?.economics.npc_inr || Infinity],
      ['STANDALONE_SHS', sCb?.economics.npc_inr || Infinity],
    ];
    const leastMod = options.sort((a, b) => a[1] - b[1])[0]?.[0] ?? ac.modality;

    return {
      cluster_id: ac.cluster_id,
      cluster_label: ac.cluster_label,
      cluster_name: ac.cluster_name,
      est_households: ac.est_households,
      annual_energy_mwh_horizon: ac.annual_energy_mwh_horizon,
      active_modality: ac.modality,
      least_cost_npc_modality: leastMod,
      grid_capex_inr: gCb?.total_capex_inr ?? 0,
      grid_npc_inr: gCb?.economics.npc_inr ?? 0,
      grid_lcoe_inr_kwh: gCb?.economics.lcoe_inr_kwh ?? 0,
      grid_requires_tie_in: gReq,
      minigrid_capex_inr: mCb?.total_capex_inr ?? 0,
      minigrid_npc_inr: mCb?.economics.npc_inr ?? 0,
      minigrid_lcoe_inr_kwh: mCb?.economics.lcoe_inr_kwh ?? 0,
      shs_capex_inr: sCb?.total_capex_inr ?? 0,
      shs_npc_inr: sCb?.economics.npc_inr ?? 0,
      shs_lcoe_inr_kwh: sCb?.economics.lcoe_inr_kwh ?? 0,
      rationale: `Lowest 10-year NPC option: ${leastMod.replace(/_/g, ' ')}.`,
    };
  });

  return {
    project_id: projectId,
    active_scenario_id: activeScenario.id,
    active_scenario_key: activeScenario.scenario_key,
    discount_rate: discountRate,
    horizon_years: horizonYears,
    has_unset_rates: activeBoq.has_unset_rates,
    unset_item_codes: activeBoq.unset_item_codes,
    totals_withheld: activeBoq.totals_withheld,
    grant_policy_note: grantNote,
    export_blocked_reason: activeBoq.export_blocked_reason,
    scenarios: cards,
    habitation_comparisons: habitationRows,
    active_scenario_boq: activeBoq,
  };
}

// ---------------------------------------------------------------------------
// 24-Section Pre-Flight Engineering Audit & Integrity Snapshot
// ---------------------------------------------------------------------------

export const DPR_24_SECTIONS: ReadonlyArray<{
  section_number: number;
  section_key: string;
  title: string;
  group: string;
}> = [
  { section_number: 1, section_key: 'SEC_01_EXECUTIVE_SUMMARY', title: 'Executive Summary & Epistemic Honesty Mandate', group: 'Part I — Project Profile & Provenance' },
  { section_number: 2, section_key: 'SEC_02_ADMIN_GEO_PROFILE', title: 'Administrative, Geographic & Demographic Profile', group: 'Part I — Project Profile & Provenance' },
  { section_number: 3, section_key: 'SEC_03_DATASET_PROVENANCE', title: 'Geospatial Dataset Provenance & Vintage Registry', group: 'Part I — Project Profile & Provenance' },
  { section_number: 4, section_key: 'SEC_04_HABITATION_INVENTORY', title: 'Habitation Cluster Inventory, Two-Axis Classification & Census Reconciliation', group: 'Part II — Settlement & Verification Audit' },
  { section_number: 5, section_key: 'SEC_05_VERIFICATION_LEDGER', title: 'Append-Only Field & Utility Verification Audit Ledger', group: 'Part II — Settlement & Verification Audit' },
  { section_number: 6, section_key: 'SEC_06_EXISTING_INFRASTRUCTURE', title: 'Existing Electrical Infrastructure & Tie-In Provenance Register', group: 'Part III — Infrastructure Gap & Demand' },
  { section_number: 7, section_key: 'SEC_07_TERRAIN_GAP_MATRIX', title: 'Terrain-Weighted Distance & Obstacle Gap Analysis Matrix', group: 'Part III — Infrastructure Gap & Demand' },
  { section_number: 8, section_key: 'SEC_08_ASSUMPTIONS_SUMMARY', title: 'Parametric Planning Assumptions & Normative Overrides Summary', group: 'Part III — Infrastructure Gap & Demand' },
  { section_number: 9, section_key: 'SEC_09_DEMAND_FORECAST', title: '7-Category Parametric Electricity Demand & Horizon Growth Forecast', group: 'Part III — Infrastructure Gap & Demand' },
  { section_number: 10, section_key: 'SEC_10_MODALITY_DECISION', title: 'Electrification Modality Decision Framework & Active Scenario Summary', group: 'Part IV — Network Routing & Off-Grid Engineering' },
  { section_number: 11, section_key: 'SEC_11_HT_FEEDER_ROUTING', title: '11 kV 3-Phase HT Feeder Least-Cost Routing & Pole Schedule', group: 'Part IV — Network Routing & Off-Grid Engineering' },
  { section_number: 12, section_key: 'SEC_12_LT_MST_VDROP_LOSSES', title: '415 V LT Radial MST Network, Voltage Drop & Technical Loss Schedule', group: 'Part IV — Network Routing & Off-Grid Engineering' },
  { section_number: 13, section_key: 'SEC_13_OFFGRID_SOLAR_BESS_SHS', title: 'Off-Grid Solar PV, LiFePO4 BESS & Standalone SHS Sizing Schedule', group: 'Part IV — Network Routing & Off-Grid Engineering' },
  { section_number: 14, section_key: 'SEC_14_SINGLE_LINE_DIAGRAM', title: 'Preliminary Single-Line Diagram (SLD) & Protection Schematic', group: 'Part IV — Network Routing & Off-Grid Engineering' },
  { section_number: 15, section_key: 'SEC_15_SOR_COSTING_BASIS', title: 'Schedule of Rates (SoR) Provenance, Taxes & Costing Methodology', group: 'Part V — Costing, BOQ & Financial Comparison' },
  { section_number: 16, section_key: 'SEC_16_ITEMIZED_BOQ', title: 'Itemized Bill of Quantities (BOQ) & Capital Cost Abstract', group: 'Part V — Costing, BOQ & Financial Comparison' },
  { section_number: 17, section_key: 'SEC_17_SCENARIO_COMPARISON', title: 'Multi-Scenario Financial Comparison, 10-Yr NPC & LCOE Matrix', group: 'Part V — Costing, BOQ & Financial Comparison' },
  { section_number: 18, section_key: 'SEC_18_IMPLEMENTATION_PHASING', title: 'Implementation Schedule, Phasing & Institutional Mechanism', group: 'Part VI — Implementation, O&M, Safeguards & Sign-Off' },
  { section_number: 19, section_key: 'SEC_19_OM_SUSTAINABILITY', title: 'Operations, Maintenance (O&M) & Asset Sustainability Framework', group: 'Part VI — Implementation, O&M, Safeguards & Sign-Off' },
  { section_number: 20, section_key: 'SEC_20_ENVIRONMENTAL_SCREENING', title: 'Environmental & Forest Clearance Screening (WorldCover & Waterways)', group: 'Part VI — Implementation, O&M, Safeguards & Sign-Off' },
  { section_number: 21, section_key: 'SEC_21_COMPLETE_ASSUMPTIONS_AUDIT', title: 'Complete Project Assumptions Register & Engineering Constants Audit', group: 'Part VI — Implementation, O&M, Safeguards & Sign-Off' },
  { section_number: 22, section_key: 'SEC_22_RISK_AND_FIELD_CHECKLIST', title: 'Risk Register, Methodological Limitations & Pre-Survey Checklist', group: 'Part VI — Implementation, O&M, Safeguards & Sign-Off' },
  { section_number: 23, section_key: 'SEC_23_LICENSING_AND_CITATIONS', title: 'Open Data Licensing, Third-Party Attributions & Citations', group: 'Part VI — Implementation, O&M, Safeguards & Sign-Off' },
  { section_number: 24, section_key: 'SEC_24_PREFLIGHT_CERTIFICATE', title: 'Pre-Flight Integrity Certificate, Cryptographic Snapshot Hash & Sign-Off', group: 'Part VI — Implementation, O&M, Safeguards & Sign-Off' },
];

export function evaluateDprPreflight(params: {
  projectId: string;
  projectVersion: number;
  activeScenario: PlanningScenarioDto;
  comparison: ProjectScenarioComparisonDto;
  clustersCount: number;
  verificationCoveragePct: number;
  verifiedRecordsCount: number;
  hasExistingInfra: boolean;
  boundarySource: string;
  censusDeltaPct: number | null;
  hasSampleDemoGeometry?: boolean;
}): PreFlightReportDto {
  const {
    projectId,
    projectVersion,
    activeScenario,
    comparison,
    clustersCount,
    verificationCoveragePct,
    verifiedRecordsCount,
    hasExistingInfra,
    boundarySource,
    censusDeltaPct,
    hasSampleDemoGeometry = false,
  } = params;

  const unsetCodes = comparison.unset_item_codes;
  const missingTieIn = activeScenario.clusters
    .filter((c) => (c.modality === 'GRID_EXTENSION' || c.modality === 'GRID_AUGMENTATION') && c.requires_tie_in)
    .map((c) => c.cluster_label);

  const checks: PreFlightCheckItemDto[] = [
    {
      check_code: 'GEOSPATIAL_LAYER_PROVENANCE',
      title: 'Geospatial Input Provenance & Demo Transparency',
      category: hasSampleDemoGeometry ? 'SOFT_WARNING' : 'HARD_BLOCKER',
      status: hasSampleDemoGeometry ? 'WARN' : 'PASS',
      detail: hasSampleDemoGeometry
        ? 'Custom study area outside Koraput uses illustrative sample demo building footprints for screening. Upload surveyed GeoJSON before field sanction.'
        : 'Active vector and solar inputs derive from the Koraput reference extract or user-uploaded GIS files.',
      remediation: hasSampleDemoGeometry
        ? 'Upload surveyed village building footprints in Step 1 for formal tender submission.'
        : 'None required.',
    },
    clustersCount > 0
      ? {
          check_code: 'CLUSTERS_IDENTIFIED',
          title: 'Habitation Clusters & Footprints Populated',
          category: 'HARD_BLOCKER',
          status: 'PASS',
          detail: `${clustersCount} habitation clusters identified and classified.`,
          remediation: 'None required.',
        }
      : {
          check_code: 'CLUSTERS_IDENTIFIED',
          title: 'Habitation Clusters & Footprints Populated',
          category: 'HARD_BLOCKER',
          status: 'FAIL',
          detail: 'Zero habitation clusters exist in the project.',
          remediation: 'Run DBSCAN settlement clustering in Step 2 before exporting a DPR.',
        },
    unsetCodes.length === 0
      ? {
          check_code: 'NO_UNSET_BOQ_RATES',
          title: 'All Required BOQ Schedule of Rates Populated',
          category: 'HARD_BLOCKER',
          status: 'PASS',
          detail: 'All active BOQ line items have non-null INR unit rates with citations.',
          remediation: 'None required.',
        }
      : {
          check_code: 'NO_UNSET_BOQ_RATES',
          title: 'All Required BOQ Schedule of Rates Populated',
          category: 'HARD_BLOCKER',
          status: 'FAIL',
          detail: `Required BOQ items have UNSET unit rates: ${unsetCodes.join(', ')}.`,
          remediation: 'Enter INR unit rates or reset the Schedule of Rates catalog in Step 5.',
        },
    missingTieIn.length === 0
      ? {
          check_code: 'GRID_TIE_IN_PRESENT',
          title: '11 kV Tie-In Point Defined for Grid-Connected Clusters',
          category: 'HARD_BLOCKER',
          status: 'PASS',
          detail: 'Every grid-connected cluster has a valid tie-in source.',
          remediation: 'None required.',
        }
      : {
          check_code: 'GRID_TIE_IN_PRESENT',
          title: '11 kV Tie-In Point Defined for Grid-Connected Clusters',
          category: 'HARD_BLOCKER',
          status: 'FAIL',
          detail: `Grid-selected clusters lack an 11 kV tie-in point: ${missingTieIn.join(', ')}.`,
          remediation: 'Place a USER_ASSUMED tie-in point in Step 3 or choose Solar Mini-Grid / SHS in Step 4.',
        },
    activeScenario.vdrop_compliance_ok
      ? {
          check_code: 'CEA_VOLTAGE_REGULATION',
          title: 'CEA Voltage Drop Limits (<= 5.0% HT, <= 6.0% LT)',
          category: 'SOFT_WARNING',
          status: 'PASS',
          detail: `Peak voltage drop within statutory limits (Max HT: ${activeScenario.max_ht_vdrop_pct.toFixed(2)}%, Max LT: ${activeScenario.max_lt_vdrop_pct.toFixed(2)}%).`,
          remediation: 'None required.',
        }
      : {
          check_code: 'CEA_VOLTAGE_REGULATION',
          title: 'CEA Voltage Drop Limits (<= 5.0% HT, <= 6.0% LT)',
          category: 'SOFT_WARNING',
          status: 'WARN',
          detail: `Peak voltage drop exceeds target (Max HT: ${activeScenario.max_ht_vdrop_pct.toFixed(2)}%, Max LT: ${activeScenario.max_lt_vdrop_pct.toFixed(2)}%).`,
          remediation: 'Split LT feeders or check conductor sizing during detailed field survey.',
        },
  ];

  const requiresWatermark = verificationCoveragePct < 99.99;
  checks.push(
    !requiresWatermark
      ? {
          check_code: 'AXIS_2_FIELD_VERIFICATION',
          title: 'Axis-2 Field / Utility Verification Coverage',
          category: 'SOFT_WARNING',
          status: 'PASS',
          detail: '100.0% of estimated households are backed by verification records.',
          remediation: 'None required.',
        }
      : {
          check_code: 'AXIS_2_FIELD_VERIFICATION',
          title: 'Axis-2 Field / Utility Verification Coverage',
          category: 'SOFT_WARNING',
          status: 'WARN',
          detail: `Verification coverage is ${verificationCoveragePct.toFixed(1)}% (< 100%). Exported PDF carries the mandatory 'PRELIMINARY ENGINEERING — NOT FIELD VERIFIED' watermark.`,
          remediation: 'Record Gram Sabha / DISCOM verifications in Step 2.',
        },
  );

  checks.push({
    check_code: 'AOI_BOUNDARY_PROVENANCE',
    title: 'Administrative Boundary Polygon Provenance',
    category: 'SOFT_WARNING',
    status: boundarySource === 'APPROXIMATE_BUFFER' || boundarySource === 'UNSET' ? 'WARN' : 'PASS',
    detail:
      boundarySource === 'APPROXIMATE_BUFFER'
        ? 'AOI uses a 1.5 km metric circular buffer (APPROXIMATE_BUFFER).'
        : `AOI boundary uses validated polygon geometry (${boundarySource}).`,
    remediation:
      boundarySource === 'APPROXIMATE_BUFFER'
        ? 'Upload official revenue cadastral boundary when available.'
        : 'None required.',
  });

  checks.push({
    check_code: 'CENSUS_RECONCILIATION_DELTA',
    title: 'Census 2011 Household Reconciliation Divergence',
    category: 'SOFT_WARNING',
    status: censusDeltaPct !== null && Math.abs(censusDeltaPct) <= 30 ? 'PASS' : 'WARN',
    detail:
      censusDeltaPct === null
        ? 'Census 2011 village link unavailable for custom boundary.'
        : `Satellite vs projected Census 2011 delta is ${censusDeltaPct >= 0 ? '+' : ''}${censusDeltaPct.toFixed(1)}%.`,
    remediation: 'Validate household counts during Gram Sabha walk-through.',
  });

  const hardFailed = checks.filter((c) => c.category === 'HARD_BLOCKER' && c.status === 'FAIL').length;
  const softWarn = checks.filter((c) => c.status === 'WARN').length;

  const sections: DprSectionStatusItemDto[] = DPR_24_SECTIONS.map((spec) => {
    if (spec.section_number === 5 && verifiedRecordsCount === 0) {
      return {
        ...spec,
        is_populated: false,
        data_status_note:
          'No data available — reason: Zero Axis-2 field or utility verification records submitted yet; clusters remain labeled UNVERIFIED.',
      };
    }
    if (spec.section_number === 6 && !hasExistingInfra) {
      return {
        ...spec,
        is_populated: false,
        data_status_note:
          'No data available — reason: No utility 11 kV/LT lines or USER_ASSUMED tie-in points placed yet.',
      };
    }
    return {
      ...spec,
      is_populated: true,
      data_status_note: hasSampleDemoGeometry
        ? 'Populated with illustrative sample demo data & real engineering calculations.'
        : 'Populated with traceable project & engineering records.',
    };
  });

  const snapshotHash = sha256Hex(
    JSON.stringify({
      projectId,
      projectVersion,
      scenarioKey: activeScenario.scenario_key,
      clustersCount,
      unsetCodes,
      missingTieIn,
      vdropOk: activeScenario.vdrop_compliance_ok,
      verificationCoveragePct: roundN(verificationCoveragePct, 1),
      capex: comparison.active_scenario_boq.total_capex_inr,
      npc: comparison.active_scenario_boq.economics.npc_inr,
    }),
  );

  return {
    project_id: projectId,
    project_version: projectVersion,
    active_scenario_key: activeScenario.scenario_key,
    can_export: hardFailed === 0,
    hard_blockers_failed: hardFailed,
    soft_warnings_count: softWarn,
    requires_not_field_verified_watermark: requiresWatermark,
    watermark_text: requiresWatermark
      ? 'PRELIMINARY ENGINEERING — NOT FIELD VERIFIED'
      : 'PRELIMINARY ENGINEERING ASSESSMENT — FOR SURVEY VALIDATION',
    snapshot_hash: snapshotHash,
    checks,
    sections,
  };
}
