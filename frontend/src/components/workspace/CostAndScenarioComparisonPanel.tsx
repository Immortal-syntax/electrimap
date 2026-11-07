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

import React, { useState } from 'react';
import { Callout } from '../ui/Callout';
import { QualityTag } from '../ui/QualityTag';
import { StatTile } from '../ui/StatTile';

export interface ProjectRateItemDto {
  id: string;
  project_id: string;
  template_key: string;
  template_name: string;
  item_code: string;
  description: string;
  category: string;
  unit: string;
  rate_inr: number | null;
  source_type: string;
  citation: string;
  source_year: number;
  is_user_edited: boolean;
  updated_at: string;
}

export interface ProjectRateListDto {
  project_id: string;
  template_key: string;
  template_name: string;
  total_items: number;
  unset_count: number;
  unset_item_codes: string[];
  user_edited_count: number;
  items: ProjectRateItemDto[];
}

export interface CsvImportErrorDto {
  row_number: number;
  item_code: string;
  field: string;
  message: string;
}

export interface SorCsvImportResponseDto {
  is_valid: boolean;
  imported_count: number;
  unset_count: number;
  unset_item_codes: string[];
  errors: CsvImportErrorDto[];
  rates: ProjectRateListDto | null;
}

export interface BoqLineItemDto {
  cluster_id: string | null;
  cluster_label: string | null;
  item_code: string;
  description: string;
  category: string;
  unit: string;
  quantity: number;
  quantity_basis: string;
  rate_inr: number | null;
  rate_source_type: string;
  citation: string;
  is_unset: boolean;
  amount_inr: number;
}

export interface LifecycleEconomicsDto {
  modality: string;
  capex_inr: number;
  capex_lakhs: number;
  capital_subsidy_inr: number;
  net_utility_capex_inr: number;
  annual_om_inr: number;
  annual_energy_purchase_inr: number;
  pv_om_inr: number;
  pv_energy_purchase_inr: number;
  pv_battery_replacement_inr: number;
  npc_inr: number;
  npc_lakhs: number;
  annual_delivered_energy_kwh: number;
  pv_delivered_energy_kwh: number;
  lcoe_inr_kwh: number;
  annualized_cost_inr_yr: number;
  cost_per_household_inr: number;
  npc_per_household_inr: number;
  avoided_co2_tonnes_yr: number;
}

export interface ClusterBoqBreakdownDto {
  cluster_id: string;
  cluster_label: string;
  cluster_name: string;
  modality: string;
  est_households: number;
  terrain_multiplier: number;
  terrain_classification: string;
  base_equipment_inr: number;
  terrain_premium_inr: number;
  subtotal_supply_erection_inr: number;
  gst_amount_inr: number;
  contingency_amount_inr: number;
  pmc_overhead_amount_inr: number;
  total_capex_inr: number;
  total_capex_lakhs: number;
  has_unset_rates: boolean;
  unset_item_codes: string[];
  economics: LifecycleEconomicsDto;
  lines: BoqLineItemDto[];
}

export interface ScenarioBoqDto {
  project_id: string;
  scenario_id: string;
  scenario_key: string;
  scenario_name: string;
  is_active_baseline: boolean;
  discount_rate: number;
  horizon_years: number;
  gst_pct: number;
  contingency_pct: number;
  pmc_overhead_pct: number;
  capital_subsidy_pct: number;
  base_equipment_inr: number;
  terrain_premium_inr: number;
  subtotal_supply_erection_inr: number;
  gst_amount_inr: number;
  contingency_amount_inr: number;
  pmc_overhead_amount_inr: number;
  total_capex_inr: number;
  total_capex_lakhs: number;
  has_unset_rates: boolean;
  unset_item_codes: string[];
  export_blocked_reason: string | null;
  economics: LifecycleEconomicsDto;
  aggregated_lines: BoqLineItemDto[];
  cluster_breakdowns: ClusterBoqBreakdownDto[];
}

export interface HabitationOptionComparisonRowDto {
  cluster_id: string;
  cluster_label: string;
  cluster_name: string;
  est_households: number;
  annual_energy_mwh_horizon: number;
  active_modality: string;
  least_cost_npc_modality: string;
  grid_capex_inr: number;
  grid_npc_inr: number;
  grid_lcoe_inr_kwh: number;
  grid_requires_tie_in: boolean;
  minigrid_capex_inr: number;
  minigrid_npc_inr: number;
  minigrid_lcoe_inr_kwh: number;
  shs_capex_inr: number;
  shs_npc_inr: number;
  shs_lcoe_inr_kwh: number;
  rationale: string;
}

export interface ScenarioComparisonCardDto {
  scenario_id: string;
  scenario_key: string;
  scenario_name: string;
  is_active_baseline: boolean;
  requires_tie_in_warning: boolean;
  vdrop_compliance_ok: boolean;
  total_households_served: number;
  annual_delivered_energy_mwh: number;
  modality_counts: Record<string, number>;
  base_equipment_inr: number;
  terrain_premium_inr: number;
  gst_amount_inr: number;
  contingency_amount_inr: number;
  pmc_overhead_amount_inr: number;
  total_capex_inr: number;
  total_capex_lakhs: number;
  capital_subsidy_inr: number;
  net_utility_capex_inr: number;
  annual_om_inr: number;
  annual_energy_purchase_inr: number;
  npc_inr: number;
  npc_lakhs: number;
  lcoe_inr_kwh: number;
  cost_per_household_inr: number;
  npc_per_household_inr: number;
  avoided_co2_tonnes_yr: number;
  has_unset_rates: boolean;
  unset_item_codes: string[];
}

export interface ProjectScenarioComparisonDto {
  project_id: string;
  active_scenario_id: string;
  active_scenario_key: string;
  discount_rate: number;
  horizon_years: number;
  has_unset_rates: boolean;
  unset_item_codes: string[];
  export_blocked_reason: string | null;
  scenarios: ScenarioComparisonCardDto[];
  habitation_comparisons: HabitationOptionComparisonRowDto[];
  active_scenario_boq: ScenarioBoqDto;
}

interface CostAndScenarioComparisonPanelProps {
  projectId: string;
  rates: ProjectRateListDto | null;
  comparison: ProjectScenarioComparisonDto | null;
  onUpdateRateItem: (itemCode: string, rateInr: number | null, citation?: string) => Promise<void>;
  onResetRates: () => Promise<void>;
  onImportRatesCsv: (
    csvContent: string,
    templateName: string,
  ) => Promise<SorCsvImportResponseDto>;
  onPinScenario: (scenarioId: string) => Promise<void>;
}

function formatInr(amountInr: number): string {
  return `₹${amountInr.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatInrCompact(amountInr: number): string {
  return `₹${Math.round(amountInr).toLocaleString('en-IN')}`;
}

export const CostAndScenarioComparisonPanel: React.FC<CostAndScenarioComparisonPanelProps> = ({
  projectId,
  rates,
  comparison,
  onUpdateRateItem,
  onResetRates,
  onImportRatesCsv,
  onPinScenario,
}) => {
  const [activeTab, setActiveTab] = useState<'boq' | 'compare' | 'sor'>('boq');
  const [selectedClusterFilter, setSelectedClusterFilter] = useState<string>('ALL');
  const [editingRates, setEditingRates] = useState<Record<string, string>>({});
  const [busyAction, setBusyAction] = useState<boolean>(false);
  const [csvText, setCsvText] = useState<string>('');
  const [csvTemplateName, setCsvTemplateName] = useState<string>(
    'Custom State DISCOM Schedule of Rates (FY 2025-26)',
  );
  const [csvErrors, setCsvErrors] = useState<CsvImportErrorDto[]>([]);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  if (!comparison || !rates) {
    return null;
  }

  const boq = comparison.active_scenario_boq;
  const activeClusterBreakdown =
    selectedClusterFilter === 'ALL'
      ? null
      : boq.cluster_breakdowns.find((cb) => cb.cluster_id === selectedClusterFilter) ?? null;

  const displayedLines = activeClusterBreakdown
    ? activeClusterBreakdown.lines
    : boq.aggregated_lines;

  const handleSaveRate = async (itemCode: string, currentRate: number | null) => {
    const raw = editingRates[itemCode];
    const targetVal =
      raw !== undefined ? parseFloat(raw) : currentRate !== null ? currentRate : NaN;
    if (Number.isNaN(targetVal) || targetVal <= 0) {
      return;
    }
    setBusyAction(true);
    setStatusBanner(null);
    try {
      await onUpdateRateItem(itemCode, targetVal);
      setStatusBanner(`Updated unit rate for ${itemCode} to ${formatInr(targetVal)} and recalculated BOQ.`);
    } finally {
      setBusyAction(false);
    }
  };

  const handleMarkUnset = async (itemCode: string) => {
    setBusyAction(true);
    setStatusBanner(null);
    try {
      await onUpdateRateItem(itemCode, null);
      setStatusBanner(
        `Marked ${itemCode} as UNSET. DPR export is now blocked until a valid rate is restored.`,
      );
    } finally {
      setBusyAction(false);
    }
  };

  const handleResetAllRates = async () => {
    setBusyAction(true);
    setStatusBanner(null);
    setCsvErrors([]);
    try {
      await onResetRates();
      setEditingRates({});
      setStatusBanner('Restored verified Odisha OPTCL / TPSODL & MNRE reference Schedule of Rates.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleCsvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) return;
    setBusyAction(true);
    setCsvErrors([]);
    setStatusBanner(null);
    try {
      const res = await onImportRatesCsv(csvText, csvTemplateName);
      if (!res.is_valid) {
        setCsvErrors(res.errors);
      } else {
        setCsvText('');
        setStatusBanner(
          `Successfully imported ${res.imported_count} Schedule of Rates items (${res.unset_count} UNSET).`,
        );
      }
    } finally {
      setBusyAction(false);
    }
  };

  const handleLoadSampleCsv = () => {
    const sample = [
      'item_code,description,category,unit,rate_inr,source_type,citation,source_year',
      'HT-COND-ACSR-50,11 kV 3-Phase Overhead Line ACSR Rabbit 50 mm2,HT_11KV,km,192000.00,USER_TEMPLATE,Odisha TPSODL Revised Hilly SoR 2025,2025',
      'SHS-KIT-200WP,Standalone Solar Home System 200 Wp + LiFePO4,STANDALONE_SHS,Kit,23800.00,USER_TEMPLATE,OREDA Tribal Tender Rate 2025,2025',
    ].join('\n');
    setCsvText(sample);
  };

  const handlePinScenarioClick = async (scenarioId: string) => {
    setBusyAction(true);
    setStatusBanner(null);
    try {
      await onPinScenario(scenarioId);
      setStatusBanner('Pinned selected scenario as the active DPR baseline.');
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-md shadow-xs overflow-hidden">
      {/* Header Bar */}
      <div className="px-4 py-3 border-b border-border bg-subtle flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-ink uppercase tracking-wider">
              Milestone M6 — Traceable Cost Estimation, BOQ & Scenario Comparison
            </h2>
            <QualityTag
              kind={comparison.has_unset_rates ? 'ASSUMED' : 'ESTIMATED'}
            />
          </div>
          <p className="text-xs text-muted mt-0.5">
            Active Schedule of Rates: <span className="font-medium text-ink">{rates.template_name}</span>{' '}
            · Pinned DPR Baseline:{' '}
            <span className="font-mono font-semibold text-primary">
              {comparison.active_scenario_key}
            </span>
          </p>
        </div>

        {/* Sub-Tab Selector */}
        <div className="flex items-center gap-1.5 bg-canvas p-1 rounded border border-border">
          <button
            type="button"
            onClick={() => setActiveTab('boq')}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
              activeTab === 'boq'
                ? 'bg-primary text-white'
                : 'text-muted hover:text-ink'
            }`}
          >
            1. Itemized Cost BOQ ({boq.aggregated_lines.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('compare')}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
              activeTab === 'compare'
                ? 'bg-primary text-white'
                : 'text-muted hover:text-ink'
            }`}
          >
            2. Compare 4 Scenarios (NPC & LCOE)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sor')}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
              activeTab === 'sor'
                ? 'bg-primary text-white'
                : 'text-muted hover:text-ink'
            }`}
          >
            3. Schedule of Rates & CSV ({rates.total_items})
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Core Principle #4 Export-Blocking Alert when any rate is UNSET */}
        {comparison.has_unset_rates && (
          <Callout tone="error" title="DPR Export Blocked — UNSET Unit Rates Detected (Core Principle #4)">
            {comparison.export_blocked_reason} Missing unit costs are never invented. Open the{' '}
            <button
              type="button"
              onClick={() => setActiveTab('sor')}
              className="underline font-semibold"
            >
              Schedule of Rates & CSV tab
            </button>{' '}
            to enter verified unit prices or click <strong>Reset to Reference SoR</strong>.
          </Callout>
        )}

        {statusBanner && (
          <div className="px-3 py-2 rounded bg-emerald-50 border border-emerald-300 text-xs text-emerald-900 flex items-center justify-between">
            <span>{statusBanner}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-emerald-700 font-semibold hover:underline ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 6-Tile Financial & Life-Cycle Economic KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatTile
            label="Total Capital Outlay"
            value={`₹${boq.total_capex_lakhs.toFixed(2)} L`}
            unit={formatInrCompact(boq.total_capex_inr)}
            quality="ESTIMATED"
            subtitle={`Net Utility: ${formatInrCompact(boq.economics.net_utility_capex_inr)} (${100 - boq.capital_subsidy_pct}% share)`}
          />
          <StatTile
            label={`${boq.horizon_years}-Yr Net Present Cost`}
            value={`₹${boq.economics.npc_lakhs.toFixed(2)} L`}
            unit={`@ ${(boq.discount_rate * 100).toFixed(1)}% disc.`}
            quality="ESTIMATED"
            subtitle="Includes O&M, Grid Tariff & Yr-7 BESS"
          />
          <StatTile
            label="Levelized Cost (LCOE)"
            value={`₹${boq.economics.lcoe_inr_kwh.toFixed(2)}`}
            unit="/ kWh"
            quality="ESTIMATED"
            subtitle={`${(boq.economics.annual_delivered_energy_kwh / 1000).toFixed(2)} MWh/yr delivered`}
          />
          <StatTile
            label="Cost per Household"
            value={formatInrCompact(boq.economics.cost_per_household_inr)}
            unit="/ HH"
            quality="ESTIMATED"
            subtitle={`NPC/HH: ${formatInrCompact(boq.economics.npc_per_household_inr)}`}
          />
          <StatTile
            label="Rate Provenance"
            value={
              rates.unset_count === 0
                ? `${rates.total_items}/${rates.total_items} Ready`
                : `${rates.unset_count} UNSET`
            }
            quality={rates.unset_count === 0 ? 'VERIFIED' : 'ASSUMED'}
            subtitle={
              rates.unset_count === 0
                ? `${rates.user_edited_count} user-edited · Export Ready`
                : `Blocked: ${rates.unset_item_codes.join(', ')}`
            }
          />
          <StatTile
            label="Pinned DPR Baseline"
            value={boq.scenario_key.replace('_OPTIMAL', '').replace('_ONLY', '')}
            unit={`${boq.economics.avoided_co2_tonnes_yr.toFixed(1)} tCO2/yr`}
            quality="ESTIMATED"
            subtitle={`Scheme Grant (${boq.capital_subsidy_pct}%): ${formatInrCompact(boq.economics.capital_subsidy_inr)}`}
          />
        </div>

        {/* TAB 1: ITEMIZED BILL OF QUANTITIES (BOQ) SPREADSHEET */}
        {activeTab === 'boq' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-subtle px-3 py-2 rounded border border-border">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-ink">Filter BOQ Scope:</span>
                <select
                  aria-label="Filter BOQ Scope"
                  value={selectedClusterFilter}
                  onChange={(e) => setSelectedClusterFilter(e.target.value)}
                  className="px-2.5 py-1 text-xs bg-surface border border-border rounded font-mono text-ink"
                >
                  <option value="ALL">
                    ALL HABITATIONS — Project Aggregate ({boq.aggregated_lines.length} items)
                  </option>
                  {boq.cluster_breakdowns.map((cb) => (
                    <option key={cb.cluster_id} value={cb.cluster_id}>
                      {cb.cluster_label}: {cb.cluster_name} ({cb.modality} · ₹{cb.total_capex_lakhs.toFixed(2)} L)
                    </option>
                  ))}
                </select>
              </div>
              {activeClusterBreakdown && (
                <div className="text-xs text-muted">
                  Terrain Factor:{' '}
                  <span className="font-mono font-semibold text-ink">
                    {activeClusterBreakdown.terrain_multiplier.toFixed(2)}x
                  </span>{' '}
                  ({activeClusterBreakdown.terrain_classification})
                </div>
              )}
            </div>

            <div className="overflow-x-auto border border-border rounded">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-subtle border-b border-border text-[11px] uppercase text-muted">
                    <th className="py-2 px-2.5 font-semibold">Item Code</th>
                    <th className="py-2 px-2.5 font-semibold">Description & Specification</th>
                    <th className="py-2 px-2.5 font-semibold">Category</th>
                    <th className="py-2 px-2.5 font-semibold">Quantity Basis</th>
                    <th className="py-2 px-2.5 font-semibold text-right">Qty</th>
                    <th className="py-2 px-2.5 font-semibold">Unit</th>
                    <th className="py-2 px-2.5 font-semibold text-right">Unit Rate (₹)</th>
                    <th className="py-2 px-2.5 font-semibold">Rate Provenance</th>
                    <th className="py-2 px-2.5 font-semibold text-right">Line Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayedLines.map((ln) => (
                    <tr
                      key={`${ln.cluster_label ?? 'ALL'}-${ln.item_code}`}
                      className={ln.is_unset ? 'bg-red-50/70' : 'hover:bg-subtle/60'}
                    >
                      <td className="py-2 px-2.5 font-mono font-semibold text-ink whitespace-nowrap">
                        {ln.item_code}
                      </td>
                      <td className="py-2 px-2.5 text-ink max-w-xs">
                        <div className="font-medium">{ln.description}</div>
                        <div className="text-[11px] text-muted truncate" title={ln.citation}>
                          Ref: {ln.citation}
                        </div>
                      </td>
                      <td className="py-2 px-2.5 font-mono text-[11px] text-muted whitespace-nowrap">
                        {ln.category}
                      </td>
                      <td className="py-2 px-2.5 text-muted text-[11px]">
                        {ln.quantity_basis}
                      </td>
                      <td className="py-2 px-2.5 font-mono text-right font-semibold text-ink whitespace-nowrap">
                        {ln.quantity.toFixed(2)}
                      </td>
                      <td className="py-2 px-2.5 text-muted whitespace-nowrap">{ln.unit}</td>
                      <td className="py-2 px-2.5 font-mono text-right whitespace-nowrap">
                        {ln.rate_inr !== null ? (
                          formatInr(ln.rate_inr)
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[11px]">
                            UNSET
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2.5 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                            ln.is_unset
                              ? 'bg-red-100 text-red-800 border border-red-300'
                              : ln.rate_source_type === 'REFERENCE_PUBLIC_DOCUMENT'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {ln.rate_source_type}
                        </span>
                      </td>
                      <td className="py-2 px-2.5 font-mono text-right font-semibold text-ink whitespace-nowrap">
                        {ln.is_unset ? 'BLOCKED (UNSET)' : formatInr(ln.amount_inr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-subtle/90 border-t-2 border-border text-xs">
                  <tr>
                    <td colSpan={8} className="py-1.5 px-2.5 text-right font-medium text-muted">
                      A. Direct Equipment, Conductor & Support Supply Subtotal:
                    </td>
                    <td className="py-1.5 px-2.5 text-right font-mono font-semibold text-ink">
                      {formatInr(
                        activeClusterBreakdown
                          ? activeClusterBreakdown.base_equipment_inr
                          : boq.base_equipment_inr,
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={8} className="py-1.5 px-2.5 text-right font-medium text-muted">
                      B. Difficult Hilly / Forest Terrain Erection Multiplier Premium:
                    </td>
                    <td className="py-1.5 px-2.5 text-right font-mono font-semibold text-ink">
                      {formatInr(
                        activeClusterBreakdown
                          ? activeClusterBreakdown.terrain_premium_inr
                          : boq.terrain_premium_inr,
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={8} className="py-1.5 px-2.5 text-right font-medium text-muted">
                      C. Goods & Services Tax (GST @ {boq.gst_pct.toFixed(1)}%):
                    </td>
                    <td className="py-1.5 px-2.5 text-right font-mono font-semibold text-ink">
                      {formatInr(
                        activeClusterBreakdown
                          ? activeClusterBreakdown.gst_amount_inr
                          : boq.gst_amount_inr,
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={8} className="py-1.5 px-2.5 text-right font-medium text-muted">
                      D. Physical Contingency ({boq.contingency_pct.toFixed(1)}%) + PMC & Dept. Overheads ({boq.pmc_overhead_pct.toFixed(1)}%):
                    </td>
                    <td className="py-1.5 px-2.5 text-right font-mono font-semibold text-ink">
                      {formatInr(
                        activeClusterBreakdown
                          ? activeClusterBreakdown.contingency_amount_inr +
                              activeClusterBreakdown.pmc_overhead_amount_inr
                          : boq.contingency_amount_inr + boq.pmc_overhead_amount_inr,
                      )}
                    </td>
                  </tr>
                  <tr className="bg-slate-200/80 border-t border-border">
                    <td colSpan={8} className="py-2 px-2.5 text-right font-bold text-ink">
                      GRAND TOTAL CAPITAL OUTLAY (CAPEX):
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono font-bold text-primary text-sm">
                      {formatInr(
                        activeClusterBreakdown
                          ? activeClusterBreakdown.total_capex_inr
                          : boq.total_capex_inr,
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: SIDE-BY-SIDE 4-SCENARIO COMPARISON & PER-HABITATION MATRIX */}
        {activeTab === 'compare' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {comparison.scenarios.map((sc) => (
                <div
                  key={sc.scenario_id}
                  className={`p-3.5 rounded border flex flex-col justify-between ${
                    sc.is_active_baseline
                      ? 'border-primary bg-blue-50/30 ring-1 ring-primary'
                      : 'border-border bg-surface'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-ink">
                        {sc.scenario_key}
                      </span>
                      {sc.is_active_baseline ? (
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-primary text-white">
                          Pinned DPR Baseline
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={() => handlePinScenarioClick(sc.scenario_id)}
                          className="px-2 py-0.5 text-[11px] font-semibold rounded border border-primary text-primary hover:bg-primary hover:text-white transition-colors"
                        >
                          Pin as Baseline
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-muted mb-3">{sc.scenario_name}</p>

                    <dl className="space-y-1.5 text-xs border-t border-border pt-2.5">
                      <div className="flex justify-between">
                        <dt className="text-muted">Total CAPEX:</dt>
                        <dd className="font-mono font-bold text-ink">
                          ₹{sc.total_capex_lakhs.toFixed(2)} Lakhs ({formatInrCompact(sc.total_capex_inr)})
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted">Net Utility Outlay:</dt>
                        <dd className="font-mono font-semibold text-ink">
                          {formatInrCompact(sc.net_utility_capex_inr)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted">{comparison.horizon_years}-Yr NPC:</dt>
                        <dd className="font-mono font-bold text-primary">
                          ₹{sc.npc_lakhs.toFixed(2)} Lakhs ({formatInrCompact(sc.npc_inr)})
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted">Levelized LCOE:</dt>
                        <dd className="font-mono font-semibold text-ink">
                          ₹{sc.lcoe_inr_kwh.toFixed(2)} / kWh
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted">CAPEX / Household:</dt>
                        <dd className="font-mono text-ink">
                          {formatInrCompact(sc.cost_per_household_inr)} / HH
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted">Annual O&M + Energy:</dt>
                        <dd className="font-mono text-ink">
                          {formatInrCompact(sc.annual_om_inr + sc.annual_energy_purchase_inr)} / yr
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted">Avoided Emissions:</dt>
                        <dd className="font-mono text-emerald-700 font-semibold">
                          {sc.avoided_co2_tonnes_yr.toFixed(2)} tCO2/yr
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-[11px]">
                    <span className="text-muted">
                      HH Served: <strong>{sc.total_households_served}</strong>
                    </span>
                    <span
                      className={`font-mono font-semibold ${
                        sc.requires_tie_in_warning ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {sc.requires_tie_in_warning ? '11kV Tie-In Needed' : 'CEA VDrop OK'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Per-Habitation Option Comparison Table (AC-10.1) */}
            <div className="border border-border rounded overflow-x-auto">
              <div className="px-3 py-2 bg-subtle border-b border-border flex items-center justify-between">
                <h3 className="text-xs font-semibold text-ink uppercase tracking-wider">
                  Per-Habitation Option Comparison (Same Demand Inputs Across All Modalities — AC-10.1)
                </h3>
                <span className="text-[11px] text-muted">
                  Compares 10-Yr Net Present Cost (NPC) & LCOE per Cluster
                </span>
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-subtle/60 border-b border-border text-[11px] uppercase text-muted">
                    <th className="py-2 px-2.5 font-semibold">Cluster</th>
                    <th className="py-2 px-2.5 font-semibold">HH & Energy</th>
                    <th className="py-2 px-2.5 font-semibold">Pinned Modality</th>
                    <th className="py-2 px-2.5 font-semibold text-right">Grid Ext / Aug (NPC)</th>
                    <th className="py-2 px-2.5 font-semibold text-right">Solar Mini-Grid (NPC)</th>
                    <th className="py-2 px-2.5 font-semibold text-right">Standalone SHS (NPC)</th>
                    <th className="py-2 px-2.5 font-semibold">Least-Cost NPC Option</th>
                    <th className="py-2 px-2.5 font-semibold">Economic & Terrain Rationale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {comparison.habitation_comparisons.map((row) => (
                    <tr key={row.cluster_id} className="hover:bg-subtle/50">
                      <td className="py-2 px-2.5 font-mono font-semibold text-ink whitespace-nowrap">
                        {row.cluster_label}: {row.cluster_name}
                      </td>
                      <td className="py-2 px-2.5 font-mono text-muted whitespace-nowrap">
                        {row.est_households} HH · {row.annual_energy_mwh_horizon.toFixed(2)} MWh/yr
                      </td>
                      <td className="py-2 px-2.5 font-mono font-semibold text-primary whitespace-nowrap">
                        {row.active_modality}
                      </td>
                      <td className="py-2 px-2.5 font-mono text-right whitespace-nowrap">
                        <div>{formatInrCompact(row.grid_npc_inr)}</div>
                        <div className="text-[10px] text-muted">
                          CAPEX {formatInrCompact(row.grid_capex_inr)} · ₹{row.grid_lcoe_inr_kwh.toFixed(2)}/kWh
                          {row.grid_requires_tie_in ? ' (No Tie-In)' : ''}
                        </div>
                      </td>
                      <td className="py-2 px-2.5 font-mono text-right whitespace-nowrap">
                        <div>{formatInrCompact(row.minigrid_npc_inr)}</div>
                        <div className="text-[10px] text-muted">
                          CAPEX {formatInrCompact(row.minigrid_capex_inr)} · ₹{row.minigrid_lcoe_inr_kwh.toFixed(2)}/kWh
                        </div>
                      </td>
                      <td className="py-2 px-2.5 font-mono text-right whitespace-nowrap">
                        <div>{formatInrCompact(row.shs_npc_inr)}</div>
                        <div className="text-[10px] text-muted">
                          CAPEX {formatInrCompact(row.shs_capex_inr)} · ₹{row.shs_lcoe_inr_kwh.toFixed(2)}/kWh
                        </div>
                      </td>
                      <td className="py-2 px-2.5 font-mono font-semibold text-emerald-800 whitespace-nowrap">
                        {row.least_cost_npc_modality}
                      </td>
                      <td className="py-2 px-2.5 text-muted text-[11px] max-w-xs">
                        {row.rationale}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: SCHEDULE OF RATES (SOR) MANAGEMENT & CSV IMPORT/EXPORT */}
        {activeTab === 'sor' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-subtle px-3 py-2.5 rounded border border-border">
              <div className="text-xs">
                <span className="font-semibold text-ink">Schedule of Rates Catalog:</span>{' '}
                <span className="text-muted">
                  Edit any unit rate inline or mark an item <code>UNSET</code> to test export-blocking validation.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/v1/projects/${projectId}/rates/export-csv`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 text-xs font-semibold rounded border border-border bg-surface text-ink hover:bg-subtle"
                >
                  Export SoR CSV
                </a>
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={handleResetAllRates}
                  className="px-2.5 py-1 text-xs font-semibold rounded border border-border bg-surface text-ink hover:bg-subtle"
                >
                  Reset to Reference SoR
                </button>
              </div>
            </div>

            {/* Custom CSV Upload / Paste Form */}
            <form
              onSubmit={handleCsvSubmit}
              className="p-3 bg-subtle/60 border border-border rounded space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-ink">
                  Import Custom State Schedule of Rates (CSV Schema Validation — AC-09.2)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLoadSampleCsv}
                    className="text-xs text-primary font-semibold hover:underline"
                  >
                    Load Sample Valid CSV
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={csvTemplateName}
                  onChange={(e) => setCsvTemplateName(e.target.value)}
                  placeholder="Rate Schedule Name"
                  className="px-2.5 py-1.5 text-xs bg-surface border border-border rounded text-ink"
                />
                <div className="md:col-span-2 flex items-center gap-2">
                  <textarea
                    rows={2}
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    placeholder="item_code,description,category,unit,rate_inr,source_type,citation,source_year"
                    className="w-full px-2.5 py-1 text-xs font-mono bg-surface border border-border rounded text-ink"
                  />
                  <button
                    type="submit"
                    disabled={busyAction || !csvText.trim()}
                    className="px-3 py-2 text-xs font-semibold rounded bg-primary text-white hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap"
                  >
                    Validate & Import CSV
                  </button>
                </div>
              </div>

              {csvErrors.length > 0 && (
                <div className="p-2.5 rounded bg-red-50 border border-red-300 text-xs text-red-900 space-y-1">
                  <div className="font-semibold">
                    CSV Validation Failed ({csvErrors.length} row error(s)):
                  </div>
                  <ul className="list-disc list-inside font-mono text-[11px]">
                    {csvErrors.map((err, idx) => (
                      <li key={`${err.row_number}-${idx}`}>
                        Row {err.row_number} [{err.item_code} · {err.field}]: {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </form>

            {/* Interactive Schedule of Rates Table */}
            <div className="overflow-x-auto border border-border rounded">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-subtle border-b border-border text-[11px] uppercase text-muted">
                    <th className="py-2 px-2.5 font-semibold">Item Code</th>
                    <th className="py-2 px-2.5 font-semibold">Description & Citation</th>
                    <th className="py-2 px-2.5 font-semibold">Category</th>
                    <th className="py-2 px-2.5 font-semibold">Unit</th>
                    <th className="py-2 px-2.5 font-semibold">Provenance Source</th>
                    <th className="py-2 px-2.5 font-semibold text-right">Unit Rate (₹)</th>
                    <th className="py-2 px-2.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rates.items.map((item) => {
                    const draftVal =
                      editingRates[item.item_code] !== undefined
                        ? editingRates[item.item_code]
                        : item.rate_inr !== null
                          ? String(item.rate_inr)
                          : '';
                    return (
                      <tr
                        key={item.id}
                        className={item.rate_inr === null ? 'bg-red-50/70' : 'hover:bg-subtle/50'}
                      >
                        <td className="py-2 px-2.5 font-mono font-semibold text-ink whitespace-nowrap">
                          {item.item_code}
                        </td>
                        <td className="py-2 px-2.5 max-w-md">
                          <div className="font-medium text-ink">{item.description}</div>
                          <div className="text-[11px] text-muted">
                            Citation ({item.source_year}): {item.citation}
                          </div>
                        </td>
                        <td className="py-2 px-2.5 font-mono text-[11px] text-muted whitespace-nowrap">
                          {item.category}
                        </td>
                        <td className="py-2 px-2.5 text-muted whitespace-nowrap">{item.unit}</td>
                        <td className="py-2 px-2.5 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                              item.rate_inr === null
                                ? 'bg-red-100 text-red-800 border border-red-300'
                                : item.source_type === 'REFERENCE_PUBLIC_DOCUMENT'
                                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {item.source_type}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-right whitespace-nowrap">
                          <input
                            type="number"
                            step="0.01"
                            aria-label={`Rate for ${item.item_code}`}
                            value={draftVal}
                            placeholder="UNSET"
                            onChange={(e) =>
                              setEditingRates((prev) => ({
                                ...prev,
                                [item.item_code]: e.target.value,
                              }))
                            }
                            className="w-28 px-2 py-1 text-right font-mono text-xs bg-surface border border-border rounded text-ink"
                          />
                        </td>
                        <td className="py-2 px-2.5 text-right whitespace-nowrap space-x-1.5">
                          <button
                            type="button"
                            disabled={busyAction}
                            onClick={() => handleSaveRate(item.item_code, item.rate_inr)}
                            className="px-2 py-1 text-[11px] font-semibold rounded bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                          >
                            Save Rate
                          </button>
                          <button
                            type="button"
                            disabled={busyAction || item.rate_inr === null}
                            onClick={() => handleMarkUnset(item.item_code)}
                            className="px-2 py-1 text-[11px] font-semibold rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-40"
                          >
                            Mark UNSET
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
