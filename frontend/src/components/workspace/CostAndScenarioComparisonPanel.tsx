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
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  IndianRupee,
  RotateCcw,
  Scale,
  Search,
  Upload,
  X,
} from 'lucide-react';
import {
  formatBoqCategoryLabel,
  formatRateProvenanceLabel,
  formatScenarioLabel,
} from '../../lib/beginnerGlossary';
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
import { HelpTooltip } from '../ui/Tooltip';

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
  totals_withheld?: boolean;
  grant_policy_note?: string | null;
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
  totals_withheld?: boolean;
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
  totals_withheld?: boolean;
  grant_policy_note?: string | null;
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

const MODALITY_SHORT_LABELS: Record<string, string> = {
  GRID_EXTENSION: 'Grid Extension',
  GRID_AUGMENTATION: 'Grid Aug.',
  SOLAR_MINIGRID: 'Solar Mini-Grid',
  STANDALONE_SHS: 'Standalone SHS',
};

function formatModalityShort(modality: string): string {
  return MODALITY_SHORT_LABELS[modality] ?? modality.replace(/_/g, ' ');
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
  const [actionError, setActionError] = useState<string | null>(null);
  const [boqSearch, setBoqSearch] = useState<string>('');
  const [boqUnsetOnly, setBoqUnsetOnly] = useState<boolean>(false);
  const [expandedBoqCodes, setExpandedBoqCodes] = useState<Record<string, boolean>>({});
  const [expandedHabitationIds, setExpandedHabitationIds] = useState<Record<string, boolean>>({});
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
      if (
        q &&
        !`${ln.item_code} ${ln.description} ${ln.category} ${formatBoqCategoryLabel(ln.category)}`
          .toLowerCase()
          .includes(q)
      ) {
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
      if (
        q &&
        !`${item.item_code} ${item.description} ${item.citation} ${formatBoqCategoryLabel(item.category)}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [rates?.items, sorSearch, sorCategoryFilter, sorUnsetOnly]);

  const rateStatusSummary = useMemo(() => {
    const items = rates?.items ?? [];
    let referenceCount = 0;
    let plannerCount = 0;
    let unsetCount = 0;
    for (const item of items) {
      if (item.rate_inr === null || item.source_type === 'UNSET') {
        unsetCount += 1;
      } else if (item.source_type === 'REFERENCE_PUBLIC_DOCUMENT') {
        referenceCount += 1;
      } else {
        plannerCount += 1;
      }
    }
    return {
      totalCount: items.length,
      referenceCount,
      plannerCount,
      unsetCount,
      // Rate items currently track public reference, planner edits/uploads, or UNSET only;
      // independent DISCOM tender/field rate verification is recorded separately outside SoR defaults.
      verifiedOrApprovedCount: 0,
    };
  }, [rates?.items]);

  const deduplicatedRateSources = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        citation: string;
        sourceYear: number;
        sourceType: string;
        itemCodes: string[];
        categories: string[];
      }
    >();
    for (const item of rates?.items ?? []) {
      const citation = item.citation || 'Unspecified source document';
      const sourceType =
        item.rate_inr === null || item.source_type === 'UNSET' ? 'UNSET' : item.source_type;
      const key = `${citation}::${item.source_year}::${sourceType}`;
      const existing = groups.get(key);
      if (existing) {
        existing.itemCodes.push(item.item_code);
        if (!existing.categories.includes(item.category)) {
          existing.categories.push(item.category);
        }
      } else {
        groups.set(key, {
          key,
          citation,
          sourceYear: item.source_year,
          sourceType,
          itemCodes: [item.item_code],
          categories: [item.category],
        });
      }
    }
    return Array.from(groups.values());
  }, [rates?.items]);

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
      setActionError(`Enter a positive INR unit rate (> 0) for ${itemCode} before saving.`);
      return;
    }
    setBusyAction(true);
    setActionError(null);
    setStatusBanner(null);
    try {
      await onUpdateRateItem(itemCode, targetVal);
      setStatusBanner(`Updated unit rate for ${itemCode} to ${formatInr(targetVal)} and recalculated BOQ.`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : `Failed to update unit rate for ${itemCode}.`,
      );
    } finally {
      setBusyAction(false);
    }
  };

  const handleMarkUnset = async (itemCode: string) => {
    setBusyAction(true);
    setActionError(null);
    setStatusBanner(null);
    try {
      await onUpdateRateItem(itemCode, null);
      setStatusBanner(
        `Marked ${itemCode} as UNSET. DPR export is now blocked until a valid rate is restored.`,
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : `Failed to mark ${itemCode} as UNSET.`,
      );
    } finally {
      setBusyAction(false);
    }
  };

  const handleResetAllRates = async () => {
    setBusyAction(true);
    setActionError(null);
    setStatusBanner(null);
    setCsvErrors([]);
    try {
      await onResetRates();
      setEditingRates({});
      setStatusBanner('Restored verified Odisha OPTCL / TPSODL & MNRE reference Schedule of Rates.');
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to reset Schedule of Rates to defaults.',
      );
    } finally {
      setBusyAction(false);
    }
  };

  const handleCsvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) return;
    setBusyAction(true);
    setActionError(null);
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
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to import Schedule of Rates CSV.',
      );
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
    setActionError(null);
    setStatusBanner(null);
    try {
      await onPinScenario(scenarioId);
      setStatusBanner('Pinned selected scenario as the active DPR baseline.');
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to pin selected scenario as baseline.',
      );
    } finally {
      setBusyAction(false);
    }
  };

  const hasBoqItems = boq.aggregated_lines.length > 0;
  const isTotalsWithheld = Boolean(boq.totals_withheld || boq.has_unset_rates);
  const activeScenarioCard =
    comparison.scenarios.find((sc) => sc.is_active_baseline || sc.scenario_id === boq.scenario_id) ??
    null;
  const totalHouseholdsServed =
    activeScenarioCard?.total_households_served ??
    boq.cluster_breakdowns.reduce((acc, cb) => acc + cb.est_households, 0);
  const planHasRoutes =
    activeScenarioCard !== null
      ? activeScenarioCard.total_capex_inr > 0 || activeScenarioCard.total_households_served > 0
      : hasBoqItems;

  return (
    <Panel
      aria-label="Cost Estimation BOQ and Scenario Comparison"
      overline="Step 5 · Costs & Scenarios"
      title={
        <span className="inline-flex items-center gap-1.5">
          <span>Project Costs &amp; Scenarios</span>
          <HelpTooltip glossaryKey="boq" />
        </span>
      }
      subtitle={
        <>
          Selected plan:{' '}
          <span className="font-semibold text-accent">
            {formatScenarioLabel(comparison.active_scenario_key)}
          </span>
          {' · '}
          Price catalog: <span className="font-medium text-ink">{rates.template_name}</span>
        </>
      }
      icon={IndianRupee}
      badge={
        <QualityTag
          kind={
            comparison.has_unset_rates || !hasBoqItems
              ? 'ASSUMED'
              : rates.user_edited_count > 0
                ? 'USER_ENTERED'
                : 'ESTIMATED'
          }
          label={
            comparison.has_unset_rates
              ? `${rates.unset_count} Missing Price(s)`
              : !hasBoqItems
                ? 'Waiting for Step 4 Plan'
                : rates.user_edited_count > 0
                  ? `${rates.user_edited_count} Planner-Entered · Unverified`
                  : 'Preliminary · Reference-Priced'
          }
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
            1. Equipment Cost List ({boq.aggregated_lines.length})
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'compare' ? 'primary' : 'ghost'}
            onClick={() => setActiveTab('compare')}
          >
            2. Compare 4 Plans
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'sor' ? 'primary' : 'ghost'}
            onClick={() => setActiveTab('sor')}
          >
            3. Edit Unit Prices &amp; CSV ({rates.total_items})
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Export-Blocking Alert when any rate is missing */}
        {comparison.has_unset_rates && (
          <Callout
            tone="error"
            title="Report Export Paused — Some Equipment Prices Are Missing"
          >
            {comparison.export_blocked_reason} ElectriMap never invents prices. Open the{' '}
            <button
              type="button"
              onClick={() => setActiveTab('sor')}
              className="underline font-semibold text-error hover:text-ink"
            >
              Edit Unit Prices &amp; CSV tab
            </button>{' '}
            to enter unit prices or click <strong>Reset to Default Prices</strong>.
          </Callout>
        )}

        {/* Single Preliminary-Estimate & Rate-Verification Honesty Notice */}
        <div
          className="rounded-sm border border-rule bg-paper px-3.5 py-2.5 text-xs text-ink-2 flex flex-col gap-1"
          role="note"
          aria-label="Preliminary estimate and rate status notice"
        >
          <div className="flex flex-wrap items-center gap-1.5 font-semibold text-ink">
            <span>Preliminary Pre-Feasibility Estimate (Unverified Quantities &amp; Rates)</span>
            <HelpTooltip glossaryKey="rateVerificationStatus" />
          </div>
          <p className="leading-relaxed">
            Equipment quantities are <strong className="text-ink">estimated</strong> from Step 4 GIS
            sizing, and grant/overhead splits ({boq.capital_subsidy_pct}% subsidy, {boq.gst_pct}% GST)
            are <strong className="text-ink">assumed</strong> planning parameters. Catalog status:{' '}
            <strong className="text-ink">Reference-priced (unverified):</strong>{' '}
            {rateStatusSummary.referenceCount}
            {' · '}
            <strong className="text-ink">Planner-entered / CSV (unverified):</strong>{' '}
            {rateStatusSummary.plannerCount}
            {' · '}
            <strong className="text-ink">Field-verified / Approved:</strong>{' '}
            {rateStatusSummary.verifiedOrApprovedCount}
            {rateStatusSummary.unsetCount > 0 && (
              <>
                {' · '}
                <strong className="text-error">
                  Missing prices: {rateStatusSummary.unsetCount} (
                  {rates.unset_item_codes.join(', ')})
                </strong>
              </>
            )}
            .
          </p>
        </div>

        {actionError && (
          <Callout
            tone="error"
            title="Price Sheet / Plan Update Failed"
            action={
              <Button size="xs" variant="ghost" onClick={() => setActionError(null)}>
                Dismiss
              </Button>
            }
          >
            {actionError}
          </Callout>
        )}

        {statusBanner && (
          <Callout
            tone="ok"
            title="Unit Prices & Cost List Updated"
            action={
              <Button size="xs" variant="ghost" onClick={() => setStatusBanner(null)}>
                Dismiss
              </Button>
            }
          >
            {statusBanner}
          </Callout>
        )}

        {/* 3 Headline Financial & Plan Summary Cards (No repeated ESTIMATED badges) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Estimated project cost */}
          <div
            className={`bg-sheet border rounded-md p-5 flex flex-col justify-between gap-2.5 shadow-card ${
              isTotalsWithheld ? 'border-warn-border/80 bg-gradient-to-b from-warn-bg/35 to-sheet' : 'border-rule/80'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold text-ink-2">Estimated project cost</span>
              {(isTotalsWithheld || !hasBoqItems) && (
                <Badge variant={isTotalsWithheld ? 'warn' : 'neutral'} size="sm">
                  {isTotalsWithheld ? 'Missing Prices' : 'Awaiting Plan'}
                </Badge>
              )}
            </div>
            <div className="flex items-baseline gap-2 flex-wrap min-w-0">
              <span className="text-2xl font-bold tracking-tight tabular-nums text-ink">
                {isTotalsWithheld
                  ? 'Held (Missing Prices)'
                  : !hasBoqItems
                    ? 'Pending Step 4'
                    : `₹${boq.total_capex_lakhs.toFixed(2)} L`}
              </span>
              {!isTotalsWithheld && hasBoqItems && (
                <span className="text-xs font-mono text-ink-3">
                  ({formatInrCompact(boq.total_capex_inr)})
                </span>
              )}
            </div>
            <div className="text-xs text-ink-3 leading-relaxed">
              {isTotalsWithheld
                ? 'Totals stay hidden until all required equipment prices are filled'
                : !hasBoqItems
                  ? 'Equipment quantities calculate after Step 4'
                  : `Includes equipment, terrain factor, ${boq.gst_pct}% GST & contingency`}
            </div>
          </div>

          {/* Card 2: Upfront cost per household */}
          <div
            className={`bg-sheet border rounded-md p-5 flex flex-col justify-between gap-2.5 shadow-card ${
              isTotalsWithheld ? 'border-warn-border/80 bg-gradient-to-b from-warn-bg/35 to-sheet' : 'border-rule/80'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold text-ink-2 inline-flex items-center gap-1">
                <span>Upfront cost per household</span>
                <HelpTooltip glossaryKey="costPerHousehold" />
              </span>
              {(isTotalsWithheld || !hasBoqItems) && (
                <Badge variant={isTotalsWithheld ? 'warn' : 'neutral'} size="sm">
                  {isTotalsWithheld ? 'Missing Prices' : 'Awaiting Plan'}
                </Badge>
              )}
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap min-w-0">
              <span className="text-2xl font-bold tracking-tight tabular-nums text-ink">
                {isTotalsWithheld
                  ? 'Held (Missing Prices)'
                  : !hasBoqItems
                    ? 'Pending Step 4'
                    : formatInrCompact(boq.economics.cost_per_household_inr)}
              </span>
              {!isTotalsWithheld && hasBoqItems && (
                <span className="text-xs text-ink-3">per household</span>
              )}
            </div>
            <div className="text-xs text-ink-3 leading-relaxed">
              {isTotalsWithheld
                ? 'Per-household estimate held while prices are missing'
                : !hasBoqItems
                  ? 'Needs village demand clusters from Steps 2–4'
                  : `Across ${totalHouseholdsServed} estimated households`}
            </div>
          </div>

          {/* Card 3: Recommended electrification plan */}
          <div className="bg-sheet border border-accent-border/70 bg-gradient-to-b from-accent-tint/20 to-sheet rounded-md p-5 flex flex-col justify-between gap-2.5 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold text-ink-2">
                Recommended electrification plan
              </span>
              {activeScenarioCard && (
                <Badge
                  variant={
                    !planHasRoutes
                      ? 'neutral'
                      : !activeScenarioCard.vdrop_compliance_ok
                        ? 'error'
                        : activeScenarioCard.requires_tie_in_warning
                          ? 'warn'
                          : 'ok'
                  }
                  size="sm"
                  dot
                >
                  {!planHasRoutes
                    ? 'Pending Routes'
                    : !activeScenarioCard.vdrop_compliance_ok
                      ? 'Voltage Alert'
                      : activeScenarioCard.requires_tie_in_warning
                        ? 'Needs Grid Tie-In'
                        : 'Voltage OK'}
                </Badge>
              )}
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-lg font-bold tracking-tight text-ink leading-snug">
                {formatScenarioLabel(boq.scenario_key).replace(/\s*\([^)]*\)$/, '')}
              </span>
              {formatScenarioLabel(boq.scenario_key).match(/\(([^)]+)\)$/)?.[1] && (
                <span className="text-xs text-ink-2">
                  {formatScenarioLabel(boq.scenario_key).match(/\(([^)]+)\)$/)?.[1]}
                </span>
              )}
            </div>
            <div className="text-xs text-ink-3 leading-relaxed">
              {activeScenarioCard && Object.keys(activeScenarioCard.modality_counts).length > 0
                ? Object.entries(activeScenarioCard.modality_counts)
                    .map(([mod, count]) => `${count} ${formatModalityShort(mod)}`)
                    .join(' · ')
                : boq.scenario_name}
            </div>
          </div>
        </div>

        {/* Collapsible Financial Details (NPC, LCOE, OPEX, Battery Swap, Subsidy Split, Assumptions) */}
        <details className="rounded-sm border border-rule bg-paper">
          <summary className="cursor-pointer select-none px-4 py-2.5 text-xs font-semibold text-ink flex flex-wrap items-center justify-between gap-2 hover:bg-subtle/70 transition-colors">
            <span>Financial details</span>
            <span className="font-normal text-ink-2">
              {boq.horizon_years}-year NPC, LCOE, annual O&amp;M, battery replacement, energy
              delivered &amp; subsidy split
            </span>
          </summary>
          <div className="px-4 pb-4 pt-3 border-t border-rule-subtle grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div className="bg-sheet border border-rule-subtle rounded-xs p-3 space-y-1">
              <div className="text-ink-2 font-medium inline-flex items-center gap-1">
                <span>{boq.horizon_years}-Year Lifetime Cost (NPC)</span>
                <HelpTooltip glossaryKey="capexOpexNpvLcoe" />
              </div>
              <div className="font-mono font-bold text-sm text-ink">
                {isTotalsWithheld
                  ? 'Held (Missing Prices)'
                  : !hasBoqItems
                    ? 'Pending Step 4'
                    : `₹${boq.economics.npc_lakhs.toFixed(2)} L (${formatInrCompact(boq.economics.npc_inr)})`}
              </div>
              <div className="text-ink-3">
                Discount rate: {(boq.discount_rate * 100).toFixed(1)}% · Lifetime cost/home:{' '}
                {isTotalsWithheld
                  ? 'Held'
                  : formatInrCompact(boq.economics.npc_per_household_inr)}
              </div>
            </div>

            <div className="bg-sheet border border-rule-subtle rounded-xs p-3 space-y-1">
              <div className="text-ink-2 font-medium inline-flex items-center gap-1">
                <span>Levelized Cost of Energy (LCOE)</span>
                <HelpTooltip glossaryKey="lcoeCost" />
              </div>
              <div className="font-mono font-bold text-sm text-ink">
                {isTotalsWithheld
                  ? 'Held'
                  : !hasBoqItems
                    ? 'Pending'
                    : `₹${boq.economics.lcoe_inr_kwh.toFixed(2)} / kWh`}
              </div>
              <div className="text-ink-3">
                Annual energy delivered:{' '}
                {(boq.economics.annual_delivered_energy_kwh / 1000).toFixed(2)} MWh/yr (
                {(boq.economics.pv_delivered_energy_kwh / 1000).toFixed(1)} MWh discounted)
              </div>
            </div>

            <div className="bg-sheet border border-rule-subtle rounded-xs p-3 space-y-1">
              <div className="text-ink-2 font-medium">Annual OPEX &amp; Replacements</div>
              <div className="font-mono font-bold text-sm text-ink">
                {formatInrCompact(
                  boq.economics.annual_om_inr + boq.economics.annual_energy_purchase_inr,
                )}{' '}
                / yr
              </div>
              <div className="text-ink-3">
                O&amp;M: {formatInrCompact(boq.economics.annual_om_inr)}/yr · Power:{' '}
                {formatInrCompact(boq.economics.annual_energy_purchase_inr)}/yr
                {boq.horizon_years >= 7
                  ? ` · Yr-7 battery PV: ${formatInrCompact(boq.economics.pv_battery_replacement_inr)}`
                  : ''}
              </div>
            </div>

            <div className="bg-sheet border border-rule-subtle rounded-xs p-3 space-y-1">
              <div className="text-ink-2 font-medium inline-flex items-center gap-1">
                <span>Subsidy vs. Net Utility Share (Assumed)</span>
                <HelpTooltip glossaryKey="subsidyAssumptions" />
              </div>
              <div className="font-mono font-bold text-sm text-ink">
                {isTotalsWithheld
                  ? 'Held'
                  : `Utility (${100 - boq.capital_subsidy_pct}%): ${formatInrCompact(boq.economics.net_utility_capex_inr)}`}
              </div>
              <div className="text-ink-3">
                Assumed grant ({boq.capital_subsidy_pct}%):{' '}
                {isTotalsWithheld ? 'Held' : formatInrCompact(boq.economics.capital_subsidy_inr)}
                {boq.grant_policy_note ? ` · ${boq.grant_policy_note}` : ''}
              </div>
            </div>

            <div className="bg-sheet border border-rule-subtle rounded-xs p-3 space-y-1">
              <div className="text-ink-2 font-medium">Tax &amp; Overhead Assumptions</div>
              <div className="font-mono font-semibold text-sm text-ink">
                GST {boq.gst_pct.toFixed(1)}% · Contingency {boq.contingency_pct.toFixed(1)}% · PMC{' '}
                {boq.pmc_overhead_pct.toFixed(1)}%
              </div>
              <div className="text-ink-3">
                Applied above equipment + terrain difficulty construction subtotal
              </div>
            </div>

            <div className="bg-sheet border border-rule-subtle rounded-xs p-3 space-y-1">
              <div className="text-ink-2 font-medium">PV Lifecycle &amp; Emissions Proxy</div>
              <div className="font-mono font-semibold text-sm text-ink">
                {boq.economics.avoided_co2_tonnes_yr.toFixed(1)} t CO₂ avoided / yr
              </div>
              <div className="text-ink-3">
                PV O&amp;M: {formatInrCompact(boq.economics.pv_om_inr)} · PV grid power:{' '}
                {formatInrCompact(boq.economics.pv_energy_purchase_inr)}
              </div>
            </div>
          </div>
        </details>

        {/* TAB 1: ITEMIZED BILL OF QUANTITIES (BOQ) SPREADSHEET */}
        {activeTab === 'boq' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-paper px-3 py-2.5 rounded-xs border border-rule">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-ink">Scope:</span>
                <Select
                  aria-label="Filter BOQ Scope"
                  size="sm"
                  value={selectedClusterFilter}
                  onChange={(e) => setSelectedClusterFilter(e.target.value)}
                  options={[
                    {
                      value: 'ALL',
                      label: `Whole Project (${boq.aggregated_lines.length} items)`,
                    },
                    ...boq.cluster_breakdowns.map((cb) => ({
                      value: cb.cluster_id,
                      label: `${cb.cluster_name} (${formatModalityShort(cb.modality)} · ₹${cb.total_capex_lakhs.toFixed(2)} L)`,
                    })),
                  ]}
                />
                <Input
                  type="search"
                  size="sm"
                  leftIcon={Search}
                  aria-label="Search BOQ line items"
                  placeholder="Search equipment or code..."
                  value={boqSearch}
                  onChange={(e) => setBoqSearch(e.target.value)}
                  containerClassName="w-52"
                />
                <Button
                  size="xs"
                  variant={boqUnsetOnly ? 'danger-outline' : 'secondary'}
                  onClick={() => setBoqUnsetOnly((prev) => !prev)}
                >
                  {boqUnsetOnly ? 'Showing Missing Only' : 'Missing Prices Only'}
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
                  Terrain difficulty factor:{' '}
                  <span className="font-mono font-semibold text-ink">
                    {activeClusterBreakdown.terrain_multiplier.toFixed(2)}×
                  </span>{' '}
                  ({activeClusterBreakdown.terrain_classification})
                </div>
              )}
            </div>

            {displayedLines.length === 0 ? (
              <EmptyState
                compact
                icon={FileSpreadsheet}
                title="No Equipment Cost Items Shown"
                description={
                  !hasBoqItems
                    ? 'Generate a power supply plan in Step 4 to see itemized poles, wires, transformers, solar kits, and costs here.'
                    : 'Clear the search or scope filter to view all equipment items.'
                }
                action={
                  hasBoqItems ? (
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => {
                        setBoqSearch('');
                        setBoqUnsetOnly(false);
                        setSelectedClusterFilter('ALL');
                      }}
                    >
                      Show All Equipment
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="table-scroll-container">
                <table className="w-full text-left border-collapse text-body-sm">
                  <thead>
                    <tr className="bg-subtle border-b border-rule text-xs font-semibold text-ink-2">
                      <th className="py-2.5 px-3 min-w-[220px]">Equipment</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">Quantity</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">Unit rate</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">Total cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule-subtle">
                    {displayedLines.map((ln) => {
                      const rowKey = `${ln.cluster_label ?? 'ALL'}::${ln.item_code}`;
                      const isExpanded = Boolean(expandedBoqCodes[rowKey]);
                      const contributingSettlements = activeClusterBreakdown
                        ? [
                            {
                              cluster_id: activeClusterBreakdown.cluster_id,
                              cluster_name: activeClusterBreakdown.cluster_name,
                              cluster_label: activeClusterBreakdown.cluster_label,
                              modality: activeClusterBreakdown.modality,
                              line: ln,
                            },
                          ]
                        : boq.cluster_breakdowns
                            .map((cb) => ({
                              cluster_id: cb.cluster_id,
                              cluster_name: cb.cluster_name,
                              cluster_label: cb.cluster_label,
                              modality: cb.modality,
                              line: cb.lines.find((cLine) => cLine.item_code === ln.item_code) ?? null,
                            }))
                            .filter(
                              (entry): entry is {
                                cluster_id: string;
                                cluster_name: string;
                                cluster_label: string;
                                modality: string;
                                line: BoqLineItemDto;
                              } => entry.line !== null,
                            );
                      const matchedRateItem =
                        rates.items.find((ri) => ri.item_code === ln.item_code) ?? null;
                      const draftRateVal =
                        editingRates[ln.item_code] !== undefined
                          ? editingRates[ln.item_code]
                          : ln.rate_inr !== null
                            ? String(ln.rate_inr)
                            : '';

                      return (
                        <React.Fragment key={rowKey}>
                          <tr
                            className={
                              ln.is_unset ? 'bg-error-bg/70' : 'hover:bg-surface-hover'
                            }
                          >
                            <td className="py-2.5 px-3 text-ink">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 space-y-0.5">
                                  <div className="font-medium text-xs leading-snug text-ink">
                                    {ln.description}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-2">
                                    <span>{formatBoqCategoryLabel(ln.category)}</span>
                                    {(ln.is_unset ||
                                      ln.rate_source_type !== 'REFERENCE_PUBLIC_DOCUMENT') && (
                                      <Badge
                                        variant={ln.is_unset ? 'error' : 'warn'}
                                        size="sm"
                                      >
                                        {ln.is_unset
                                          ? 'Missing Price'
                                          : formatRateProvenanceLabel(ln.rate_source_type)}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="ghost"
                                  aria-expanded={isExpanded}
                                  aria-label={`${isExpanded ? 'Hide' : 'Show'} details for ${ln.description}`}
                                  onClick={() =>
                                    setExpandedBoqCodes((prev) => ({
                                      ...prev,
                                      [rowKey]: !prev[rowKey],
                                    }))
                                  }
                                  leftIcon={isExpanded ? ChevronDown : ChevronRight}
                                  className="shrink-0"
                                >
                                  {isExpanded ? 'Hide details' : 'Details'}
                                </Button>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono tabular-nums text-right text-ink whitespace-nowrap text-xs align-top">
                              <span className="font-semibold">{ln.quantity.toFixed(2)}</span>{' '}
                              <span className="text-ink-2">{ln.unit}</span>
                            </td>
                            <td className="py-2.5 px-3 font-mono tabular-nums text-right whitespace-nowrap text-xs align-top">
                              {ln.rate_inr !== null ? (
                                formatInr(ln.rate_inr)
                              ) : (
                                <Badge variant="error" size="sm">
                                  Not Set
                                </Badge>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono tabular-nums text-right font-semibold text-ink whitespace-nowrap text-xs align-top">
                              {ln.is_unset ? 'Held (Missing Price)' : formatInr(ln.amount_inr)}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-paper/80">
                              <td colSpan={4} className="px-4 py-3 border-t border-rule-subtle">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                                  <div className="space-y-2">
                                    <div>
                                      <span className="text-ink-2 font-semibold">
                                        Technical code &amp; category:{' '}
                                      </span>
                                      <span className="font-mono font-semibold text-ink">
                                        {ln.item_code}
                                      </span>{' '}
                                      <span className="text-ink-2">
                                        ({ln.category} · {formatBoqCategoryLabel(ln.category)} · Unit:{' '}
                                        {ln.unit})
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-ink-2 font-semibold">
                                        Calculation methodology:{' '}
                                      </span>
                                      <span className="text-ink">{ln.quantity_basis}</span>
                                    </div>
                                    <div>
                                      <span className="text-ink-2 font-semibold">
                                        Contributing sections &amp; settlements:{' '}
                                      </span>
                                      {contributingSettlements.length > 0 ? (
                                        <ul className="mt-1 space-y-1 text-[11px] text-ink-2">
                                          {contributingSettlements.map((cs) => (
                                            <li
                                              key={`${rowKey}-${cs.cluster_id}`}
                                              className="flex flex-wrap items-center justify-between gap-2 bg-sheet border border-rule-subtle rounded-xs px-2 py-1"
                                            >
                                              <span>
                                                <strong className="text-ink">
                                                  {cs.cluster_name}
                                                </strong>{' '}
                                                <span className="font-mono text-ink-3">
                                                  ({cs.cluster_label})
                                                </span>{' '}
                                                · {formatModalityShort(cs.modality)}
                                              </span>
                                              <span className="font-mono text-ink">
                                                {cs.line.quantity.toFixed(2)} {cs.line.unit} ·{' '}
                                                {cs.line.is_unset
                                                  ? 'Held (Missing Price)'
                                                  : formatInr(cs.line.amount_inr)}
                                              </span>
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <span className="text-ink-2">
                                          Aggregated across active project settlements
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="space-y-2 bg-sheet border border-rule-subtle rounded-xs p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span className="font-semibold text-ink">
                                        Rate source &amp; inline edit
                                      </span>
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
                                        {ln.is_unset
                                          ? 'Missing Price (Unset)'
                                          : formatRateProvenanceLabel(ln.rate_source_type)}
                                      </Badge>
                                    </div>
                                    <div className="text-[11px] text-ink-2">
                                      <strong className="text-ink">Source citation:</strong>{' '}
                                      {ln.citation}
                                      {matchedRateItem
                                        ? ` (${matchedRateItem.source_year})`
                                        : ''}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                      <Input
                                        type="number"
                                        size="sm"
                                        step="0.01"
                                        mono
                                        aria-label={`Inline unit price for ${ln.item_code}`}
                                        value={draftRateVal}
                                        placeholder="Enter INR rate"
                                        onChange={(e) =>
                                          setEditingRates((prev) => ({
                                            ...prev,
                                            [ln.item_code]: e.target.value,
                                          }))
                                        }
                                        containerClassName="w-36"
                                        className="text-right"
                                      />
                                      <Button
                                        size="xs"
                                        variant="primary"
                                        disabled={busyAction}
                                        onClick={() => void handleSaveRate(ln.item_code, ln.rate_inr)}
                                      >
                                        Save Price
                                      </Button>
                                      <Button
                                        size="xs"
                                        variant="danger-outline"
                                        disabled={busyAction || ln.rate_inr === null}
                                        onClick={() => setPendingUnsetItemCode(ln.item_code)}
                                      >
                                        Clear Price
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-subtle border-t-2 border-rule text-xs">
                    <tr>
                      <td colSpan={3} className="py-1.5 px-3 text-right font-medium text-ink-2">
                        A. Direct Equipment &amp; Materials Subtotal:
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono font-semibold text-ink whitespace-nowrap">
                        {isTotalsWithheld
                          ? 'Held (Missing Price)'
                          : formatInr(
                              activeClusterBreakdown
                                ? activeClusterBreakdown.base_equipment_inr
                                : boq.base_equipment_inr,
                            )}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="py-1.5 px-3 text-right font-medium text-ink-2">
                        B. Difficult Hill / Forest Construction Allowance:
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono font-semibold text-ink whitespace-nowrap">
                        {isTotalsWithheld
                          ? 'Held (Missing Price)'
                          : formatInr(
                              activeClusterBreakdown
                                ? activeClusterBreakdown.terrain_premium_inr
                                : boq.terrain_premium_inr,
                            )}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="py-1.5 px-3 text-right font-medium text-ink-2">
                        C. GST Taxes ({boq.gst_pct.toFixed(1)}%):
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono font-semibold text-ink whitespace-nowrap">
                        {isTotalsWithheld
                          ? 'Held (Missing Price)'
                          : formatInr(
                              activeClusterBreakdown
                                ? activeClusterBreakdown.gst_amount_inr
                                : boq.gst_amount_inr,
                            )}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="py-1.5 px-3 text-right font-medium text-ink-2">
                        D. Contingency ({boq.contingency_pct.toFixed(1)}%) + Management Overheads (
                        {boq.pmc_overhead_pct.toFixed(1)}%):
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono font-semibold text-ink whitespace-nowrap">
                        {isTotalsWithheld
                          ? 'Held (Missing Price)'
                          : formatInr(
                              activeClusterBreakdown
                                ? activeClusterBreakdown.contingency_amount_inr +
                                  activeClusterBreakdown.pmc_overhead_amount_inr
                                : boq.contingency_amount_inr + boq.pmc_overhead_amount_inr,
                            )}
                      </td>
                    </tr>
                    <tr className="bg-subtle border-t border-rule-strong">
                      <td colSpan={3} className="py-2 px-3 text-right font-bold text-ink">
                        TOTAL UPFRONT PROJECT COST:
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-accent text-sm whitespace-nowrap">
                        {isTotalsWithheld
                          ? 'Held (Missing Price)'
                          : formatInr(
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
                title="No Electricity Plans Created Yet"
                description="Generate plans in Step 4 to compare upfront build costs, lifetime costs, and per-unit electricity prices."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {comparison.scenarios.map((sc) => {
                  const scWithheld = Boolean(sc.totals_withheld || sc.has_unset_rates);
                  const hasLines = sc.total_capex_inr > 0 || sc.total_households_served > 0;
                  return (
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
                          <span className="text-xs font-bold text-ink">
                            {formatScenarioLabel(sc.scenario_key)}
                          </span>
                          {sc.is_active_baseline ? (
                            <Badge variant="primary" size="sm">
                              Selected Plan
                            </Badge>
                          ) : (
                            <Button
                              size="xs"
                              variant="secondary"
                              disabled={busyAction}
                              onClick={() => void handlePinScenarioClick(sc.scenario_id)}
                            >
                              Select Plan
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-ink-2 mb-3">{sc.scenario_name}</p>

                        <dl className="space-y-1.5 text-xs border-t border-rule-subtle pt-2.5">
                          <div className="flex justify-between gap-2">
                            <dt className="text-ink-2">Estimated cost:</dt>
                            <dd className="font-mono font-bold text-ink text-right">
                              {scWithheld
                                ? 'Held (Missing Price)'
                                : `₹${sc.total_capex_lakhs.toFixed(2)} L`}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-ink-2">Upfront / home:</dt>
                            <dd className="font-mono text-ink text-right">
                              {scWithheld
                                ? 'Held'
                                : `${formatInrCompact(sc.cost_per_household_inr)}`}
                            </dd>
                          </div>
                        </dl>

                        <details className="mt-2.5 border-t border-rule-subtle pt-2 text-[11px]">
                          <summary className="cursor-pointer select-none font-medium text-ink-2 hover:text-ink">
                            Lifecycle &amp; financial details
                          </summary>
                          <dl className="mt-1.5 space-y-1 text-xs">
                            <div className="flex justify-between gap-2">
                              <dt className="text-ink-2">Exact upfront:</dt>
                              <dd className="font-mono text-ink text-right">
                                {scWithheld ? 'Held' : formatInrCompact(sc.total_capex_inr)}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-ink-2">Net utility share:</dt>
                              <dd className="font-mono font-semibold text-ink text-right">
                                {scWithheld
                                  ? 'Held (Missing Price)'
                                  : formatInrCompact(sc.net_utility_capex_inr)}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-ink-2">{comparison.horizon_years}-yr NPC:</dt>
                              <dd className="font-mono font-bold text-accent text-right">
                                {scWithheld
                                  ? 'Held (Missing Price)'
                                  : `₹${sc.npc_lakhs.toFixed(2)} L (${formatInrCompact(sc.npc_inr)})`}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-ink-2">LCOE:</dt>
                              <dd className="font-mono font-semibold text-ink text-right">
                                {scWithheld
                                  ? 'Held'
                                  : `₹${sc.lcoe_inr_kwh.toFixed(2)} / kWh`}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-ink-2">Annual OPEX:</dt>
                              <dd className="font-mono text-ink text-right">
                                {formatInrCompact(sc.annual_om_inr + sc.annual_energy_purchase_inr)}
                                /yr
                              </dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-ink-2">CO₂ avoided:</dt>
                              <dd className="font-mono text-ok font-semibold text-right">
                                {sc.avoided_co2_tonnes_yr.toFixed(2)} t/yr
                              </dd>
                            </div>
                          </dl>
                        </details>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-rule-subtle flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="text-ink-2">
                          Homes Served: <strong className="text-ink">{sc.total_households_served}</strong>
                        </span>
                        <Badge
                          variant={
                            !hasLines
                              ? 'neutral'
                              : !sc.vdrop_compliance_ok
                                ? 'error'
                                : sc.requires_tie_in_warning
                                  ? 'warn'
                                  : 'ok'
                          }
                          size="sm"
                          dot
                        >
                          {!hasLines
                            ? 'Pending Routes'
                            : !sc.vdrop_compliance_ok
                              ? 'Voltage Alert'
                              : sc.requires_tie_in_warning
                                ? 'Needs Grid Tie-In'
                                : 'Voltage OK'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Per-Habitation Option Comparison Table */}
            <div className="table-scroll-container">
              <div className="px-3.5 py-2.5 bg-subtle border-b border-rule flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-ink inline-flex items-center gap-1.5">
                  <span>
                    Cost Comparison by Village Settlement (Grid vs. Solar Mini-Grid vs. Home Solar)
                  </span>
                  <HelpTooltip glossaryKey="capexOpexNpvLcoe" />
                </h3>
                <span className="text-xs text-ink-2">
                  Expand a settlement for full lifetime cost (NPC), LCOE &amp; cluster ID details
                </span>
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-paper border-b border-rule text-xs font-semibold text-ink-2">
                    <th className="py-2.5 px-3">Settlement</th>
                    <th className="py-2.5 px-3">Homes &amp; Power</th>
                    <th className="py-2.5 px-3">Selected Option</th>
                    <th className="py-2.5 px-3">Lowest Lifetime Cost</th>
                    <th className="py-2.5 px-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule-subtle">
                  {comparison.habitation_comparisons.map((row) => {
                    const isHabExpanded = Boolean(expandedHabitationIds[row.cluster_id]);
                    return (
                      <React.Fragment key={row.cluster_id}>
                        <tr className="hover:bg-surface-hover">
                          <td className="py-2 px-3 text-ink text-xs">
                            <div className="font-semibold text-ink">{row.cluster_name}</div>
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-ink-2 whitespace-nowrap text-xs">
                            <div>{row.est_households} homes</div>
                            <div className="text-[11px] font-sans">
                              {row.annual_energy_mwh_horizon.toFixed(1)} MWh/yr
                            </div>
                          </td>
                          <td className="py-2 px-3 font-medium text-accent whitespace-nowrap text-xs">
                            {formatModalityShort(row.active_modality)}
                          </td>
                          <td className="py-2 px-3 font-semibold text-ok whitespace-nowrap text-xs">
                            {formatModalityShort(row.least_cost_npc_modality)}
                          </td>
                          <td className="py-2 px-3 text-right whitespace-nowrap">
                            <Button
                              type="button"
                              size="xs"
                              variant="ghost"
                              aria-expanded={isHabExpanded}
                              onClick={() =>
                                setExpandedHabitationIds((prev) => ({
                                  ...prev,
                                  [row.cluster_id]: !prev[row.cluster_id],
                                }))
                              }
                              leftIcon={isHabExpanded ? ChevronDown : ChevronRight}
                            >
                              {isHabExpanded ? 'Hide' : 'Breakdown'}
                            </Button>
                          </td>
                        </tr>
                        {isHabExpanded && (
                          <tr className="bg-paper/80">
                            <td colSpan={5} className="px-4 py-3 border-t border-rule-subtle">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs mb-2">
                                <div className="bg-sheet border border-rule-subtle rounded-xs p-2.5">
                                  <div className="font-semibold text-ink">Grid Extension / Aug.</div>
                                  <div className="font-mono text-ink mt-0.5">
                                    {formatInrCompact(row.grid_npc_inr)} NPC
                                  </div>
                                  <div className="text-[11px] text-ink-2">
                                    {formatInrCompact(row.grid_capex_inr)} upfront · ₹
                                    {row.grid_lcoe_inr_kwh.toFixed(2)}/kWh
                                    {row.grid_requires_tie_in ? ' · Needs Tie-In' : ''}
                                  </div>
                                </div>
                                <div className="bg-sheet border border-rule-subtle rounded-xs p-2.5">
                                  <div className="font-semibold text-ink">Solar Mini-Grid</div>
                                  <div className="font-mono text-ink mt-0.5">
                                    {formatInrCompact(row.minigrid_npc_inr)} NPC
                                  </div>
                                  <div className="text-[11px] text-ink-2">
                                    {formatInrCompact(row.minigrid_capex_inr)} upfront · ₹
                                    {row.minigrid_lcoe_inr_kwh.toFixed(2)}/kWh
                                  </div>
                                </div>
                                <div className="bg-sheet border border-rule-subtle rounded-xs p-2.5">
                                  <div className="font-semibold text-ink">Home Solar Systems</div>
                                  <div className="font-mono text-ink mt-0.5">
                                    {formatInrCompact(row.shs_npc_inr)} NPC
                                  </div>
                                  <div className="text-[11px] text-ink-2">
                                    {formatInrCompact(row.shs_capex_inr)} upfront · ₹
                                    {row.shs_lcoe_inr_kwh.toFixed(2)}/kWh
                                  </div>
                                </div>
                              </div>
                              <div className="text-[11px] text-ink-2 flex flex-wrap items-center justify-between gap-2">
                                <span>
                                  <strong className="text-ink">Engineering rationale:</strong>{' '}
                                  {row.rationale}
                                </span>
                                <span className="font-mono text-ink-3">
                                  Internal settlement code: {row.cluster_label}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: SCHEDULE OF RATES (SOR) MANAGEMENT & CSV IMPORT/EXPORT */}
        {activeTab === 'sor' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-paper px-3 py-2.5 rounded-xs border border-rule">
              <div className="text-xs flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-ink">Equipment Price Catalog:</span>
                <HelpTooltip glossaryKey="scheduleRatesProvenance" />
                <span className="text-ink-2">
                  Update unit rates inline, upload a CSV sheet, or clear any unknown price (export
                  stays paused while any price is missing).
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
                  <span>Download Current CSV</span>
                </a>
                <Button
                  size="sm"
                  variant="danger-outline"
                  leftIcon={RotateCcw}
                  disabled={busyAction}
                  onClick={() => setConfirmResetSor(true)}
                >
                  Reset to Default Prices
                </Button>
              </div>
            </div>

            {/* Custom CSV Upload / Paste Form (FTU-25) */}
            <form
              onSubmit={(e) => void handleCsvSubmit(e)}
              className="p-3.5 bg-paper border border-rule rounded-xs space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-ink flex items-center gap-1.5">
                  <Icon icon={Upload} size="xs" className="text-accent" />
                  <span>Upload Your State Utility Price List (.csv)</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    leftIcon={Download}
                    onClick={() => {
                      const sample = [
                        'item_code,description,category,unit,rate_inr,source_type,citation,source_year',
                        'HT-COND-ACSR-50,11 kV 3-Phase Overhead Line ACSR Rabbit 50 mm2,HT_11KV,km,192000.00,USER_TEMPLATE,Odisha TPSODL Revised Hilly SoR 2025,2025',
                        'SHS-KIT-200WP,Standalone Solar Home System 200 Wp + LiFePO4,STANDALONE_SHS,Kit,23800.00,USER_TEMPLATE,OREDA Tribal Tender Rate 2025,2025',
                      ].join('\n');
                      const blob = new Blob([sample], { type: 'text/csv;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'sample_schedule_of_rates.csv';
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download Sample CSV
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={handleLoadSampleCsv}
                  >
                    Fill Sample Text
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 items-center">
                <Input
                  type="text"
                  size="sm"
                  label="Price List Name"
                  aria-label="Rate Schedule Name"
                  value={csvTemplateName}
                  onChange={(e) => setCsvTemplateName(e.target.value)}
                  placeholder="e.g., State Utility Price List (FY 2025-26)"
                />
                <div className="md:col-span-2 flex flex-wrap items-center gap-2 pt-4">
                  <label className="inline-flex items-center gap-1.5 h-8 px-3 bg-sheet border border-rule-strong rounded-xs text-xs font-medium text-ink hover:bg-subtle cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5 text-ink-2" aria-hidden="true" />
                    <span>Choose .csv File from Computer</span>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      aria-label="Upload Schedule of Rates CSV file"
                      disabled={busyAction}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const text = await file.text();
                        setCsvText(text);
                        setActionError(null);
                        setStatusBanner(
                          `Loaded "${file.name}". Review or click "Validate & Import CSV" to apply these prices.`,
                        );
                        e.target.value = '';
                      }}
                      className="sr-only"
                    />
                  </label>
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
                  {csvText.trim() && (
                    <span className="text-[11px] text-ink-2">
                      {csvText.trim().split(/\r?\n/).length} lines ready to import
                    </span>
                  )}
                </div>
              </div>

              <details className="text-xs border-t border-rule-subtle pt-2">
                <summary className="cursor-pointer text-ink-2 hover:text-ink font-medium select-none">
                  Or paste / edit CSV rows directly
                </summary>
                <div className="mt-2">
                  <Textarea
                    rows={3}
                    aria-label="Schedule of Rates CSV Content"
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    placeholder="item_code,description,category,unit,rate_inr,source_type,citation,source_year"
                    containerClassName="w-full"
                    className="font-mono text-xs"
                  />
                </div>
              </details>

              {csvErrors.length > 0 && (
                <Callout
                  tone="error"
                  title={`CSV Check Failed (${csvErrors.length} issue(s) found)`}
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
                  placeholder="Search code, equipment, or source..."
                  value={sorSearch}
                  onChange={(e) => setSorSearch(e.target.value)}
                  containerClassName="w-64"
                />
                <Select
                  size="sm"
                  aria-label="Filter Schedule of Rates by category"
                  value={sorCategoryFilter}
                  onChange={(e) => setSorCategoryFilter(e.target.value)}
                  options={[
                    { value: 'ALL', label: `All Groups (${rates.items.length})` },
                    ...sorCategories.map((cat) => ({
                      value: cat,
                      label: formatBoqCategoryLabel(cat),
                    })),
                  ]}
                />
                <Button
                  size="xs"
                  variant={sorUnsetOnly ? 'danger-outline' : 'secondary'}
                  onClick={() => setSorUnsetOnly((prev) => !prev)}
                >
                  {sorUnsetOnly ? 'Showing Missing Only' : 'Missing Prices Only'}
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
                Showing {filteredRateItems.length} of {rates.items.length} equipment prices
              </span>
            </div>

            {/* Interactive Schedule of Rates Table */}
            {filteredRateItems.length === 0 ? (
              <EmptyState
                compact
                icon={Search}
                title="No Equipment Prices Match Filter"
                description="Clear search or category filters to view all equipment unit prices."
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
                    Show All Prices
                  </Button>
                }
              />
            ) : (
              <div className="table-scroll-container">
                <table className="w-full text-left border-collapse text-body-sm">
                  <thead>
                    <tr className="bg-subtle border-b border-rule text-xs text-ink-2">
                      <th className="py-2.5 px-3 font-semibold">Code</th>
                      <th className="py-2.5 px-3 font-semibold">Equipment &amp; Price Source</th>
                      <th className="py-2.5 px-3 font-semibold">Group</th>
                      <th className="py-2.5 px-3 font-semibold">Unit</th>
                      <th className="py-2.5 px-3 font-semibold">Price Origin</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Unit Price (₹)</th>
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
                              Source ({item.source_year}): {item.citation}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-xs text-ink-2 whitespace-nowrap">
                            {formatBoqCategoryLabel(item.category)}
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
                              {item.rate_inr === null
                                ? 'Not Set'
                                : formatRateProvenanceLabel(item.source_type)}
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
                              placeholder="Not set"
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
                                Save Price
                              </Button>
                              <Button
                                size="xs"
                                variant="danger-outline"
                                disabled={busyAction || item.rate_inr === null}
                                onClick={() => setPendingUnsetItemCode(item.item_code)}
                              >
                                Clear Price
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

        {/* Consolidated Rate Sources & Economic Assumptions */}
        <details className="rounded-sm border border-rule bg-paper">
          <summary className="cursor-pointer select-none px-4 py-2.5 text-xs font-semibold text-ink flex flex-wrap items-center justify-between gap-2 hover:bg-subtle/70 transition-colors">
            <span>Rate sources &amp; assumptions</span>
            <span className="font-normal text-ink-2">
              {deduplicatedRateSources.length} unique reference document(s) ·{' '}
              {boq.capital_subsidy_pct}% assumed grant · {boq.gst_pct}% GST ·{' '}
              {(boq.discount_rate * 100).toFixed(1)}% discount rate
            </span>
          </summary>
          <div className="px-4 pb-4 pt-3 border-t border-rule-subtle space-y-3 text-xs">
            <div>
              <h4 className="font-semibold text-ink mb-1.5">
                Deduplicated Schedule of Rates Citations
              </h4>
              <div className="space-y-1.5">
                {deduplicatedRateSources.map((src) => (
                  <div
                    key={src.key}
                    className="bg-sheet border border-rule-subtle rounded-xs px-3 py-2 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-medium text-ink">
                        {src.citation}{' '}
                        <span className="text-ink-2 font-normal">({src.sourceYear})</span>
                      </div>
                      <div className="text-[11px] text-ink-2">
                        Applies to {src.itemCodes.length} catalog item(s) across{' '}
                        {src.categories.map((c) => formatBoqCategoryLabel(c)).join(', ')}
                      </div>
                    </div>
                    <Badge
                      variant={
                        src.sourceType === 'UNSET'
                          ? 'error'
                          : src.sourceType === 'REFERENCE_PUBLIC_DOCUMENT'
                            ? 'info'
                            : 'warn'
                      }
                      size="sm"
                    >
                      {formatRateProvenanceLabel(src.sourceType)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-sheet border border-rule-subtle rounded-xs p-3 space-y-1 text-[11px] text-ink-2">
              <div className="font-semibold text-ink text-xs">
                Economic &amp; Verification Assumptions
              </div>
              <p>
                • <strong>Rates &amp; verification:</strong> Public reference prices come from{' '}
                {rates.template_name}. Neither public reference rates nor inline/CSV user edits are
                field-verified or formally tender-approved until signed off by DISCOM/implementing
                authorities.
              </p>
              <p>
                • <strong>Taxes, terrain &amp; overheads:</strong> Terrain difficulty multipliers from
                Step 4 apply before {boq.gst_pct.toFixed(1)}% GST, {boq.contingency_pct.toFixed(1)}%
                contingency, and {boq.pmc_overhead_pct.toFixed(1)}% project management overhead.
              </p>
              <p>
                • <strong>Subsidy &amp; discounting:</strong> Grant share ({boq.capital_subsidy_pct}
                %){boq.grant_policy_note ? ` — ${boq.grant_policy_note}` : ''} is an assumed
                planning split; {boq.horizon_years}-year NPC and LCOE use a{' '}
                {(boq.discount_rate * 100).toFixed(1)}% real discount rate
                {boq.horizon_years >= 7 ? ' including Year-7 LiFePO4 battery replacement' : ''}.
              </p>
            </div>
          </div>
        </details>
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
        title="Clear Unit Price & Pause Report Export?"
        description={
          pendingUnsetItemCode ? (
            <div className="space-y-1">
              <p>
                Clear the unit price for{' '}
                <strong className="font-mono">{pendingUnsetItemCode}</strong> and mark it as{' '}
                <Badge variant="error" size="sm">
                  Not Set
                </Badge>
                ?
              </p>
              <p className="text-2xs text-ink-3 font-mono">
                PDF report and Excel cost workbook downloads stay paused until every required price
                is entered or restored.
              </p>
            </div>
          ) : null
        }
        confirmLabel="Clear Price"
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
        title="Reset All Prices to Public Default Rates?"
        description="This overwrites any edited or uploaded unit prices and restores the pre-loaded public reference rates."
        confirmLabel="Reset to Default Prices"
        variant="danger"
        isLoading={busyAction}
      />
    </Panel>
  );
};
