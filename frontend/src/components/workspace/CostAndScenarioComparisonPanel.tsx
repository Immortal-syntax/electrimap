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

import React, { useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  IndianRupee,
  RotateCcw,
  Scale,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Callout } from '../ui/Callout';
import { ConfirmDialog } from '../ui/Dialog';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/Icon';
import { Input, Textarea } from '../ui/Input';
import { Panel } from '../ui/Panel';
import { QualityTag } from '../ui/QualityTag';
import { Select } from '../ui/Select';
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
  const [boqSearch, setBoqSearch] = useState<string>('');
  const [boqUnsetOnly, setBoqUnsetOnly] = useState<boolean>(false);
  const [sorSearch, setSorSearch] = useState<string>('');
  const [sorCategoryFilter, setSorCategoryFilter] = useState<string>('ALL');
  const [sorUnsetOnly, setSorUnsetOnly] = useState<boolean>(false);
  const [pendingUnsetItemCode, setPendingUnsetItemCode] = useState<string | null>(null);
  const [confirmResetSor, setConfirmResetSor] = useState<boolean>(false);

  const boq = comparison?.active_scenario_boq ?? null;
  const activeClusterBreakdown = useMemo(() => {
    if (!boq || selectedClusterFilter === 'ALL') return null;
    return boq.cluster_breakdowns.find((cb) => cb.cluster_id === selectedClusterFilter) ?? null;
  }, [boq, selectedClusterFilter]);

  const rawDisplayedLines = useMemo(
    () => (activeClusterBreakdown ? activeClusterBreakdown.lines : boq?.aggregated_lines ?? []),
    [activeClusterBreakdown, boq?.aggregated_lines],
  );

  const displayedLines = useMemo(() => {
    const q = boqSearch.trim().toLowerCase();
    return rawDisplayedLines.filter((ln) => {
      if (boqUnsetOnly && !ln.is_unset) return false;
      if (q && !`${ln.item_code} ${ln.description} ${ln.category}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [rawDisplayedLines, boqSearch, boqUnsetOnly]);

  const sorCategories = useMemo(() => {
    const cats = new Set((rates?.items ?? []).map((i) => i.category));
    return Array.from(cats).sort();
  }, [rates?.items]);

  const filteredRateItems = useMemo(() => {
    const q = sorSearch.trim().toLowerCase();
    return (rates?.items ?? []).filter((item) => {
      if (sorUnsetOnly && item.rate_inr !== null) return false;
      if (sorCategoryFilter !== 'ALL' && item.category !== sorCategoryFilter) return false;
      if (q && !`${item.item_code} ${item.description} ${item.citation}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [rates?.items, sorSearch, sorCategoryFilter, sorUnsetOnly]);

  if (!comparison || !rates || !boq) {
    return (
      <Panel
        aria-label="Cost Estimation BOQ and Scenario Comparison"
        overline="Step 5 · Economic Feasibility & Costs"
        title="Traceable Cost Estimation, BOQ & Scenario Comparison"
        subtitle="Itemized Bill of Quantities, Odisha Reference Schedule of Rates (SoR), and 4-scenario NPC / LCOE comparison."
        icon={IndianRupee}
      >
        <EmptyState
          icon={IndianRupee}
          title="Cost Estimation & Schedule of Rates Not Available Yet"
          description="Generate an engineering planning scenario in Step 4 to compute the itemized Bill of Quantities (BOQ), 4-scenario NPC/LCOE comparison, and unit rate ledger."
          epistemicNote="Missing unit costs remain UNSET and explicitly block DPR export rather than fabricating figures."
        />
      </Panel>
    );
  }

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
    <Panel
      aria-label="Cost Estimation BOQ and Scenario Comparison"
      overline="Step 5 · Economic Feasibility & Costs"
      title="Traceable Cost Estimation, BOQ & Scenario Comparison"
      subtitle={
        <>
          Active Schedule of Rates:{' '}
          <span className="font-medium text-ink">{rates.template_name}</span> · Pinned DPR
          Baseline:{' '}
          <span className="font-mono font-semibold text-accent">
            {comparison.active_scenario_key}
          </span>
        </>
      }
      icon={IndianRupee}
      badge={
        <QualityTag
          kind={comparison.has_unset_rates ? 'ASSUMED' : 'ESTIMATED'}
          label={comparison.has_unset_rates ? `${rates.unset_count} UNSET RATE(S)` : 'RATES READY'}
        />
      }
      actions={
        <div
          role="group"
          aria-label="Cost & Scenario Views"
          className="flex flex-wrap items-center gap-1 bg-paper p-1 rounded-xs border border-rule"
        >
          <Button
            size="sm"
            variant={activeTab === 'boq' ? 'primary' : 'ghost'}
            onClick={() => setActiveTab('boq')}
          >
            1. Itemized Cost BOQ ({boq.aggregated_lines.length})
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'compare' ? 'primary' : 'ghost'}
            onClick={() => setActiveTab('compare')}
          >
            2. Compare 4 Scenarios (NPC &amp; LCOE)
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'sor' ? 'primary' : 'ghost'}
            onClick={() => setActiveTab('sor')}
          >
            3. Schedule of Rates &amp; CSV ({rates.total_items})
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Core Principle #4 Export-Blocking Alert when any rate is UNSET */}
        {comparison.has_unset_rates && (
          <Callout
            tone="error"
            title="DPR Export Blocked — UNSET Unit Rates Detected (Core Principle #4)"
          >
            {comparison.export_blocked_reason} Missing unit costs are never invented. Open the{' '}
            <button
              type="button"
              onClick={() => setActiveTab('sor')}
              className="underline font-semibold text-error hover:text-ink"
            >
              Schedule of Rates &amp; CSV tab
            </button>{' '}
            to enter verified unit prices or click <strong>Reset to Reference SoR</strong>.
          </Callout>
        )}

        {statusBanner && (
          <Callout
            tone="ok"
            title="Schedule of Rates & BOQ Update"
            action={
              <Button size="xs" variant="ghost" onClick={() => setStatusBanner(null)}>
                Dismiss
              </Button>
            }
          >
            {statusBanner}
          </Callout>
        )}

        {/* 6-Tile Financial & Life-Cycle Economic KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
            tone={rates.unset_count === 0 ? 'ok' : 'warn'}
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
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-paper px-3 py-2.5 rounded-xs border border-rule">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-ink">Filter BOQ Scope:</span>
                <Select
                  aria-label="Filter BOQ Scope"
                  size="sm"
                  mono
                  value={selectedClusterFilter}
                  onChange={(e) => setSelectedClusterFilter(e.target.value)}
                  options={[
                    {
                      value: 'ALL',
                      label: `ALL HABITATIONS — Project Aggregate (${boq.aggregated_lines.length} items)`,
                    },
                    ...boq.cluster_breakdowns.map((cb) => ({
                      value: cb.cluster_id,
                      label: `${cb.cluster_label}: ${cb.cluster_name} (${cb.modality} · ₹${cb.total_capex_lakhs.toFixed(2)} L)`,
                    })),
                  ]}
                />
                <Input
                  type="search"
                  size="sm"
                  leftIcon={Search}
                  aria-label="Search BOQ line items"
                  placeholder="Search code or item..."
                  value={boqSearch}
                  onChange={(e) => setBoqSearch(e.target.value)}
                  containerClassName="w-48"
                />
                <Button
                  size="xs"
                  variant={boqUnsetOnly ? 'danger-outline' : 'secondary'}
                  onClick={() => setBoqUnsetOnly((prev) => !prev)}
                >
                  {boqUnsetOnly ? 'Showing UNSET Only' : 'UNSET Only'}
                </Button>
                {(boqSearch || boqUnsetOnly || selectedClusterFilter !== 'ALL') && (
                  <Button
                    size="xs"
                    variant="ghost"
                    leftIcon={X}
                    onClick={() => {
                      setBoqSearch('');
                      setBoqUnsetOnly(false);
                      setSelectedClusterFilter('ALL');
                    }}
                  >
                    Reset
                  </Button>
                )}
              </div>
              {activeClusterBreakdown && (
                <div className="text-xs text-ink-2">
                  Terrain Factor:{' '}
                  <span className="font-mono font-semibold text-ink">
                    {activeClusterBreakdown.terrain_multiplier.toFixed(2)}x
                  </span>{' '}
                  ({activeClusterBreakdown.terrain_classification})
                </div>
              )}
            </div>

            {displayedLines.length === 0 ? (
              <EmptyState
                compact
                icon={FileSpreadsheet}
                title="No Matching BOQ Line Items"
                description="Clear the BOQ search or scope filter to view all cost items."
                action={
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => {
                      setBoqSearch('');
                      setBoqUnsetOnly(false);
                      setSelectedClusterFilter('ALL');
                    }}
                  >
                    Reset BOQ Filters
                  </Button>
                }
              />
            ) : (
              <div className="table-scroll-container">
                <table className="w-full text-left border-collapse text-body-sm">
                  <thead>
                    <tr className="bg-subtle border-b border-rule text-xs font-semibold text-ink-2">
                      <th className="py-2.5 px-3">Item Code</th>
                      <th className="py-2.5 px-3">Description &amp; Specification</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Quantity Basis</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3">Unit</th>
                      <th className="py-2.5 px-3 text-right">Unit Rate (₹)</th>
                      <th className="py-2.5 px-3">Rate Provenance</th>
                      <th className="py-2.5 px-3 text-right">Line Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule-subtle">
                    {displayedLines.map((ln) => (
                      <tr
                        key={`${ln.cluster_label ?? 'ALL'}-${ln.item_code}`}
                        className={ln.is_unset ? 'bg-error-bg/70' : 'hover:bg-surface-hover'}
                      >
                        <td className="py-2.5 px-3 font-mono font-semibold text-ink whitespace-nowrap text-xs">
                          {ln.item_code}
                        </td>
                        <td className="py-2.5 px-3 text-ink max-w-xs">
                          <div className="font-medium text-xs">{ln.description}</div>
                          <div className="text-xs text-ink-2 truncate" title={ln.citation}>
                            Ref: {ln.citation}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-ink-2 whitespace-nowrap">
                          {ln.category}
                        </td>
                        <td className="py-2.5 px-3 text-ink-2 text-xs">
                          {ln.quantity_basis}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-right font-semibold text-ink whitespace-nowrap text-xs">
                          {ln.quantity.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-ink-2 whitespace-nowrap">{ln.unit}</td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-right whitespace-nowrap text-xs">
                          {ln.rate_inr !== null ? (
                            formatInr(ln.rate_inr)
                          ) : (
                            <Badge variant="error" size="sm">
                              UNSET
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 px-2.5 whitespace-nowrap">
                          <Badge
                            variant={
                              ln.is_unset
                                ? 'error'
                                : ln.rate_source_type === 'REFERENCE_PUBLIC_DOCUMENT'
                                  ? 'info'
                                  : 'warn'
                            }
                            size="sm"
                          >
                            {ln.rate_source_type}
                          </Badge>
                        </td>
                        <td className="py-2 px-2.5 font-mono text-right font-semibold text-ink whitespace-nowrap">
                          {ln.is_unset ? 'BLOCKED (UNSET)' : formatInr(ln.amount_inr)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-subtle border-t-2 border-rule text-xs">
                    <tr>
                      <td colSpan={8} className="py-1.5 px-2.5 text-right font-medium text-ink-2">
                        A. Direct Equipment, Conductor &amp; Support Supply Subtotal:
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
                      <td colSpan={8} className="py-1.5 px-2.5 text-right font-medium text-ink-2">
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
                      <td colSpan={8} className="py-1.5 px-2.5 text-right font-medium text-ink-2">
                        C. Goods &amp; Services Tax (GST @ {boq.gst_pct.toFixed(1)}%):
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
                      <td colSpan={8} className="py-1.5 px-2.5 text-right font-medium text-ink-2">
                        D. Physical Contingency ({boq.contingency_pct.toFixed(1)}%) + PMC &amp; Dept.
                        Overheads ({boq.pmc_overhead_pct.toFixed(1)}%):
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
                    <tr className="bg-subtle border-t border-rule-strong">
                      <td colSpan={8} className="py-2 px-2.5 text-right font-bold text-ink">
                        GRAND TOTAL CAPITAL OUTLAY (CAPEX):
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-bold text-accent text-sm">
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
            )}
          </div>
        )}

        {/* TAB 2: SIDE-BY-SIDE 4-SCENARIO COMPARISON & PER-HABITATION MATRIX */}
        {activeTab === 'compare' && (
          <div className="space-y-4">
            {comparison.scenarios.length === 0 ? (
              <EmptyState
                compact
                icon={Scale}
                title="No Comparison Scenarios Generated"
                description="Generate planning scenarios in Step 4 to evaluate least-cost CAPEX, Net Present Cost (NPC), and LCOE across modalities."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {comparison.scenarios.map((sc) => (
                  <div
                    key={sc.scenario_id}
                    className={`p-3.5 rounded-sm border flex flex-col justify-between ${
                      sc.is_active_baseline
                        ? 'border-accent bg-accent-tint/35 ring-1 ring-accent'
                        : 'border-rule bg-sheet'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-ink">
                          {sc.scenario_key}
                        </span>
                        {sc.is_active_baseline ? (
                          <Badge variant="primary" size="sm">
                            Pinned DPR Baseline
                          </Badge>
                        ) : (
                          <Button
                            size="xs"
                            variant="secondary"
                            disabled={busyAction}
                            onClick={() => void handlePinScenarioClick(sc.scenario_id)}
                          >
                            Pin as Baseline
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-ink-2 mb-3">{sc.scenario_name}</p>

                      <dl className="space-y-1.5 text-xs border-t border-rule-subtle pt-2.5">
                        <div className="flex justify-between">
                          <dt className="text-ink-2">Total CAPEX:</dt>
                          <dd className="font-mono font-bold text-ink">
                            ₹{sc.total_capex_lakhs.toFixed(2)} Lakhs (
                            {formatInrCompact(sc.total_capex_inr)})
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-ink-2">Net Utility Outlay:</dt>
                          <dd className="font-mono font-semibold text-ink">
                            {formatInrCompact(sc.net_utility_capex_inr)}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-ink-2">{comparison.horizon_years}-Yr NPC:</dt>
                          <dd className="font-mono font-bold text-accent">
                            ₹{sc.npc_lakhs.toFixed(2)} Lakhs ({formatInrCompact(sc.npc_inr)})
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-ink-2">Levelized LCOE:</dt>
                          <dd className="font-mono font-semibold text-ink">
                            ₹{sc.lcoe_inr_kwh.toFixed(2)} / kWh
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-ink-2">CAPEX / Household:</dt>
                          <dd className="font-mono text-ink">
                            {formatInrCompact(sc.cost_per_household_inr)} / HH
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-ink-2">Annual O&amp;M + Energy:</dt>
                          <dd className="font-mono text-ink">
                            {formatInrCompact(sc.annual_om_inr + sc.annual_energy_purchase_inr)} /
                            yr
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-ink-2">Avoided Emissions:</dt>
                          <dd className="font-mono text-ok font-semibold">
                            {sc.avoided_co2_tonnes_yr.toFixed(2)} tCO2/yr
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-rule-subtle flex items-center justify-between text-xs">
                      <span className="text-ink-2">
                        HH Served: <strong className="text-ink">{sc.total_households_served}</strong>
                      </span>
                      <Badge
                        variant={sc.requires_tie_in_warning ? 'warn' : 'ok'}
                        size="sm"
                        dot
                      >
                        {sc.requires_tie_in_warning ? '11kV Tie-In Needed' : 'CEA VDrop OK'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Per-Habitation Option Comparison Table (AC-10.1) */}
            <div className="table-scroll-container">
              <div className="px-3.5 py-2.5 bg-subtle border-b border-rule flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-ink">
                  Per-Habitation Option Comparison (Same Demand Inputs Across All Modalities — AC-10.1)
                </h3>
                <span className="text-xs text-ink-2">
                  Compares 10-Yr Net Present Cost (NPC) &amp; LCOE per Cluster
                </span>
              </div>
              <table className="w-full text-left border-collapse text-body-sm">
                <thead>
                  <tr className="bg-paper border-b border-rule text-xs font-semibold text-ink-2">
                    <th className="py-2.5 px-3">Cluster</th>
                    <th className="py-2.5 px-3">HH &amp; Energy</th>
                    <th className="py-2.5 px-3">Pinned Modality</th>
                    <th className="py-2.5 px-3 text-right">Grid Ext / Aug (NPC)</th>
                    <th className="py-2.5 px-3 text-right">Solar Mini-Grid (NPC)</th>
                    <th className="py-2.5 px-3 text-right">Standalone SHS (NPC)</th>
                    <th className="py-2.5 px-3">Least-Cost NPC Option</th>
                    <th className="py-2.5 px-3">Economic &amp; Terrain Rationale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule-subtle">
                  {comparison.habitation_comparisons.map((row) => (
                    <tr key={row.cluster_id} className="hover:bg-surface-hover">
                      <td className="py-2.5 px-3 font-mono font-semibold text-ink whitespace-nowrap text-xs">
                        {row.cluster_label}: {row.cluster_name}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-ink-2 whitespace-nowrap text-xs">
                        {row.est_households} HH · {row.annual_energy_mwh_horizon.toFixed(2)} MWh/yr
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-accent whitespace-nowrap text-xs">
                        {row.active_modality}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-right whitespace-nowrap text-xs">
                        <div>{formatInrCompact(row.grid_npc_inr)}</div>
                        <div className="text-xs text-ink-2 font-sans">
                          CAPEX {formatInrCompact(row.grid_capex_inr)} · ₹
                          {row.grid_lcoe_inr_kwh.toFixed(2)}/kWh
                          {row.grid_requires_tie_in ? ' (No Tie-In)' : ''}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-right whitespace-nowrap text-xs">
                        <div>{formatInrCompact(row.minigrid_npc_inr)}</div>
                        <div className="text-xs text-ink-2 font-sans">
                          CAPEX {formatInrCompact(row.minigrid_capex_inr)} · ₹
                          {row.minigrid_lcoe_inr_kwh.toFixed(2)}/kWh
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-right whitespace-nowrap text-xs">
                        <div>{formatInrCompact(row.shs_npc_inr)}</div>
                        <div className="text-xs text-ink-2 font-sans">
                          CAPEX {formatInrCompact(row.shs_capex_inr)} · ₹
                          {row.shs_lcoe_inr_kwh.toFixed(2)}/kWh
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-ok whitespace-nowrap text-xs">
                        {row.least_cost_npc_modality}
                      </td>
                      <td className="py-2.5 px-3 text-ink-2 text-xs max-w-xs">
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
            <div className="flex flex-wrap items-center justify-between gap-2 bg-paper px-3 py-2.5 rounded-xs border border-rule">
              <div className="text-xs">
                <span className="font-semibold text-ink">Schedule of Rates Catalog:</span>{' '}
                <span className="text-ink-2">
                  Edit any unit rate inline or mark an item <code className="code-pill">UNSET</code>{' '}
                  to enforce export-blocking validation.
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`/api/v1/projects/${projectId}/rates/export-csv`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-xs border border-rule-strong bg-sheet text-ink hover:bg-subtle transition-colors"
                >
                  <Icon icon={FileSpreadsheet} size="xs" />
                  <span>Export SoR CSV</span>
                </a>
                <Button
                  size="sm"
                  variant="danger-outline"
                  leftIcon={RotateCcw}
                  disabled={busyAction}
                  onClick={() => setConfirmResetSor(true)}
                >
                  Reset to Reference SoR
                </Button>
              </div>
            </div>

            {/* Custom CSV Upload / Paste Form */}
            <form
              onSubmit={(e) => void handleCsvSubmit(e)}
              className="p-3.5 bg-paper border border-rule rounded-xs space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-ink flex items-center gap-1.5">
                  <Icon icon={Upload} size="xs" className="text-accent" />
                  <span>Import Custom State Schedule of Rates (CSV Schema Validation — AC-09.2)</span>
                </div>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={handleLoadSampleCsv}
                >
                  Load Sample Valid CSV
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-start">
                <Input
                  type="text"
                  size="sm"
                  aria-label="Rate Schedule Name"
                  value={csvTemplateName}
                  onChange={(e) => setCsvTemplateName(e.target.value)}
                  placeholder="Rate Schedule Name"
                />
                <div className="md:col-span-2 flex flex-col sm:flex-row items-stretch sm:items-start gap-2">
                  <Textarea
                    rows={2}
                    aria-label="Schedule of Rates CSV Content"
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    placeholder="item_code,description,category,unit,rate_inr,source_type,citation,source_year"
                    containerClassName="flex-1"
                    className="font-mono text-xs"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="primary"
                    isLoading={busyAction}
                    disabled={!csvText.trim()}
                    className="whitespace-nowrap"
                  >
                    Validate &amp; Import CSV
                  </Button>
                </div>
              </div>

              {csvErrors.length > 0 && (
                <Callout
                  tone="error"
                  title={`CSV Validation Failed (${csvErrors.length} row error(s))`}
                >
                  <ul className="list-disc list-inside font-mono text-[11px]">
                    {csvErrors.map((err, idx) => (
                      <li key={`${err.row_number}-${idx}`}>
                        Row {err.row_number} [{err.item_code} · {err.field}]: {err.message}
                      </li>
                    ))}
                  </ul>
                </Callout>
              )}
            </form>

            {/* Filter Toolbar for SoR Table */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="search"
                  size="sm"
                  leftIcon={Search}
                  aria-label="Search Schedule of Rates"
                  placeholder="Search item code, description, or citation..."
                  value={sorSearch}
                  onChange={(e) => setSorSearch(e.target.value)}
                  containerClassName="w-64"
                />
                <Select
                  size="sm"
                  mono
                  aria-label="Filter Schedule of Rates by category"
                  value={sorCategoryFilter}
                  onChange={(e) => setSorCategoryFilter(e.target.value)}
                  options={[
                    { value: 'ALL', label: `All Categories (${rates.items.length})` },
                    ...sorCategories.map((cat) => ({ value: cat, label: cat })),
                  ]}
                />
                <Button
                  size="xs"
                  variant={sorUnsetOnly ? 'danger-outline' : 'secondary'}
                  onClick={() => setSorUnsetOnly((prev) => !prev)}
                >
                  {sorUnsetOnly ? 'Showing UNSET Only' : 'Filter UNSET'}
                </Button>
                {(sorSearch || sorCategoryFilter !== 'ALL' || sorUnsetOnly) && (
                  <Button
                    size="xs"
                    variant="ghost"
                    leftIcon={X}
                    onClick={() => {
                      setSorSearch('');
                      setSorCategoryFilter('ALL');
                      setSorUnsetOnly(false);
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <span className="font-mono text-[11px] text-ink-2">
                Showing {filteredRateItems.length} of {rates.items.length} rates
              </span>
            </div>

            {/* Interactive Schedule of Rates Table */}
            {filteredRateItems.length === 0 ? (
              <EmptyState
                compact
                icon={Search}
                title="No Schedule of Rates Items Match Filter"
                description="Clear search or category filters to view all reference rates."
                action={
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => {
                      setSorSearch('');
                      setSorCategoryFilter('ALL');
                      setSorUnsetOnly(false);
                    }}
                  >
                    Show All Rates
                  </Button>
                }
              />
            ) : (
              <div className="table-scroll-container">
                <table className="w-full text-left border-collapse text-body-sm">
                  <thead>
                    <tr className="bg-subtle border-b border-rule text-xs text-ink-2">
                      <th className="py-2.5 px-3 font-semibold">Item Code</th>
                      <th className="py-2.5 px-3 font-semibold">Description &amp; Citation</th>
                      <th className="py-2.5 px-3 font-semibold">Category</th>
                      <th className="py-2.5 px-3 font-semibold">Unit</th>
                      <th className="py-2.5 px-3 font-semibold">Provenance Source</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Unit Rate (₹)</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule-subtle">
                    {filteredRateItems.map((item) => {
                      const draftVal =
                        editingRates[item.item_code] !== undefined
                          ? editingRates[item.item_code]
                          : item.rate_inr !== null
                            ? String(item.rate_inr)
                            : '';
                      return (
                        <tr
                          key={item.id}
                          className={
                            item.rate_inr === null ? 'bg-error-bg/70' : 'hover:bg-surface-hover'
                          }
                        >
                          <td className="py-2.5 px-3 font-mono font-semibold text-ink whitespace-nowrap text-xs">
                            {item.item_code}
                          </td>
                          <td className="py-2.5 px-3 max-w-md">
                            <div className="font-medium text-ink">{item.description}</div>
                            <div className="text-xs text-ink-2 mt-0.5">
                              Citation ({item.source_year}): {item.citation}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-xs text-ink-2 whitespace-nowrap">
                            {item.category}
                          </td>
                          <td className="py-2.5 px-3 text-ink-2 whitespace-nowrap">{item.unit}</td>
                          <td className="py-2 px-2.5 whitespace-nowrap">
                            <Badge
                              variant={
                                item.rate_inr === null
                                  ? 'error'
                                  : item.source_type === 'REFERENCE_PUBLIC_DOCUMENT'
                                    ? 'info'
                                    : 'warn'
                              }
                              size="sm"
                            >
                              {item.source_type}
                            </Badge>
                          </td>
                          <td className="py-2 px-2.5 text-right whitespace-nowrap">
                            <Input
                              type="number"
                              size="sm"
                              step="0.01"
                              mono
                              aria-label={`Rate for ${item.item_code}`}
                              value={draftVal}
                              placeholder="UNSET"
                              onChange={(e) =>
                                setEditingRates((prev) => ({
                                  ...prev,
                                  [item.item_code]: e.target.value,
                                }))
                              }
                              containerClassName="w-32 ml-auto"
                              className="text-right"
                            />
                          </td>
                          <td className="py-2 px-2.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <Button
                                size="xs"
                                variant="primary"
                                disabled={busyAction}
                                onClick={() => void handleSaveRate(item.item_code, item.rate_inr)}
                              >
                                Save Rate
                              </Button>
                              <Button
                                size="xs"
                                variant="danger-outline"
                                disabled={busyAction || item.rate_inr === null}
                                onClick={() => setPendingUnsetItemCode(item.item_code)}
                              >
                                Mark UNSET
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Dialog: Mark Unit Rate UNSET (Blocks Export) */}
      <ConfirmDialog
        open={pendingUnsetItemCode !== null}
        onClose={() => setPendingUnsetItemCode(null)}
        onConfirm={() => {
          if (!pendingUnsetItemCode) return;
          const code = pendingUnsetItemCode;
          setPendingUnsetItemCode(null);
          void handleMarkUnset(code);
        }}
        title="Mark Unit Rate UNSET & Block DPR Export?"
        description={
          pendingUnsetItemCode ? (
            <div className="space-y-1">
              <p>
                Clear the unit price for{' '}
                <strong className="font-mono">{pendingUnsetItemCode}</strong> and mark it{' '}
                <Badge variant="error" size="sm">
                  UNSET
                </Badge>
                ?
              </p>
              <p className="text-2xs text-ink-3 font-mono">
                Per Core Principle #4, 24-section PDF DPR and Formula BOQ Excel exports will remain
                blocked until a verified rate is entered or restored.
              </p>
            </div>
          ) : null
        }
        confirmLabel="Mark UNSET"
        variant="danger"
        isLoading={busyAction}
      />

      {/* Confirmation Dialog: Reset All Rates to Reference SoR */}
      <ConfirmDialog
        open={confirmResetSor}
        onClose={() => setConfirmResetSor(false)}
        onConfirm={() => {
          setConfirmResetSor(false);
          void handleResetAllRates();
        }}
        title="Reset All Rates to Reference Schedule of Rates?"
        description="This overwrites any inline edits or custom imported CSV unit rates and restores the verified Odisha OPTCL / TPSODL & MNRE reference rates."
        confirmLabel="Reset to Reference SoR"
        variant="danger"
        isLoading={busyAction}
      />
    </Panel>
  );
};
