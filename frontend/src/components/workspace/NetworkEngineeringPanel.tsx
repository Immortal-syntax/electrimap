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

import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Network, RefreshCw, Search, X } from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import { formatModalityLabel, formatScenarioLabel } from '../../lib/beginnerGlossary';
import { INFRASTRUCTURE_CATEGORY_META, SLD_PALETTE } from '../map/symbology';
import { LayerSourceBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Callout } from '../ui/Callout';
import { ConfirmDialog } from '../ui/Dialog';
import { EmptyState } from '../ui/EmptyState';
import { Input } from '../ui/Input';
import { Panel } from '../ui/Panel';
import { QualityTag } from '../ui/QualityTag';
import { Select } from '../ui/Select';
import { StatTile } from '../ui/StatTile';
import { HelpTooltip } from '../ui/Tooltip';

export interface EngineeringConstantDto {
  key: string;
  value: number;
  unit: string;
  description: string;
  citation: string;
  status: string;
}

export interface EngineeringConstantListDto {
  count: number;
  items: EngineeringConstantDto[];
}

export interface PlacedDtDto {
  subzone_index: number;
  label: string;
  lon: number;
  lat: number;
  rating_kva: number;
  allocated_peak_kva: number;
  loading_pct: number;
  served_buildings_count: number;
  max_radial_reach_m: number;
  citation: string;
}

export interface ClusterEngineeringLayoutDto {
  id: string;
  scenario_id: string;
  project_id: string;
  cluster_id: string;
  cluster_label: string;
  cluster_name: string;
  est_households: number;
  modality: string;
  is_manual_override: boolean;
  requires_tie_in: boolean;
  peak_kw_horizon: number;
  peak_kva_horizon: number;
  energy_kwh_day_horizon: number;
  annual_energy_mwh_horizon: number;
  dt_count: number;
  total_dt_rating_kva: number;
  max_dt_loading_pct: number;
  placed_dts: PlacedDtDto[];
  ht_length_m: number;
  ht_poles_count: number;
  lt_3ph_length_m: number;
  lt_1ph_length_m: number;
  lt_total_length_m: number;
  max_lt_branch_m: number;
  lt_poles_count: number;
  ht_current_a: number;
  ht_drop_v: number;
  ht_drop_pct: number;
  ht_vdrop_compliant: boolean;
  lt_current_a: number;
  lt_drop_v: number;
  lt_drop_pct: number;
  lt_vdrop_compliant: boolean;
  overall_vdrop_compliant: boolean;
  load_factor: number;
  load_loss_factor: number;
  ht_line_loss_kwh_yr: number;
  lt_line_loss_kwh_yr: number;
  dt_no_load_loss_kwh_yr: number;
  dt_copper_loss_kwh_yr: number;
  total_loss_mwh_yr: number;
  technical_loss_pct: number;
  solar_pv_kwp: number;
  bess_capacity_kwh: number;
  inverter_kva: number;
  shs_kits_count: number;
  engineering_notes: string[];
  updated_at: string;
}

export interface PlanningScenarioDto {
  id: string;
  project_id: string;
  scenario_key: string;
  name: string;
  is_active: boolean;
  requires_tie_in_warning: boolean;
  total_ht_length_m: number;
  total_lt_length_m: number;
  total_dt_count: number;
  total_dt_capacity_kva: number;
  total_ht_poles: number;
  total_lt_poles: number;
  max_ht_vdrop_pct: number;
  max_lt_vdrop_pct: number;
  vdrop_compliance_ok: boolean;
  total_loss_mwh_yr: number;
  total_solar_kwp: number;
  total_bess_kwh: number;
  total_shs_kits: number;
  network_geojson: GeoJSON.FeatureCollection;
  clusters: ClusterEngineeringLayoutDto[];
  updated_at: string;
}

export interface PlanningScenarioListDto {
  project_id: string;
  active_scenario_key: string;
  active_scenario: PlanningScenarioDto;
  scenarios: PlanningScenarioDto[];
}

export interface NetworkEngineeringPanelProps {
  projectId: string;
  metricEpsg?: number;
  scenariosState: PlanningScenarioListDto | null;
  constants: EngineeringConstantListDto | null;
  onScenariosUpdated: () => Promise<void>;
}

const SCENARIO_OPTIONS = [
  {
    key: 'HYBRID_OPTIMAL',
    label: 'Recommended Mix (Grid + Mini-Grid + Home Solar)',
  },
  {
    key: 'GRID_EXTENSION_ONLY',
    label: 'Full Grid Extension Only (100% Utility Lines)',
  },
  {
    key: 'MINIGRID_PRIORITY',
    label: 'Solar Mini-Grid Priority (Village Solar + Battery)',
  },
  {
    key: 'SHS_DISPERSED',
    label: 'Home Solar Priority (Individual Solar Systems)',
  },
];

const MODALITY_OPTIONS = [
  'GRID_EXTENSION',
  'SOLAR_MINIGRID',
  'STANDALONE_SHS',
  'GRID_AUGMENTATION',
];

export const NetworkEngineeringPanel: React.FC<NetworkEngineeringPanelProps> = ({
  projectId,
  metricEpsg,
  scenariosState,
  constants,
  onScenariosUpdated,
}) => {
  const activeScenario = scenariosState?.active_scenario ?? null;
  const [selectedScenarioKey, setSelectedScenarioKey] = useState<string>(
    activeScenario?.scenario_key ?? 'HYBRID_OPTIMAL',
  );

  useEffect(() => {
    if (activeScenario?.scenario_key) {
      setSelectedScenarioKey(activeScenario.scenario_key);
    }
  }, [activeScenario?.scenario_key]);
  const [generatingScenario, setGeneratingScenario] = useState(false);
  const [overridingClusterId, setOverridingClusterId] = useState<string | null>(null);
  const [showConstantsDrawer, setShowConstantsDrawer] = useState(false);
  const [pendingScenarioSwitch, setPendingScenarioSwitch] = useState<string | null>(null);
  const [clusterSearch, setClusterSearch] = useState('');
  const [clusterFilter, setClusterFilter] = useState<
    'ALL' | 'GRID' | 'SOLAR_MINIGRID' | 'STANDALONE_SHS' | 'NON_COMPLIANT'
  >('ALL');
  const [constantSearch, setConstantSearch] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasManualOverrides = Boolean(
    activeScenario?.clusters.some((c) => c.is_manual_override),
  );
  const hasPendingScenarioChange =
    Boolean(activeScenario) && selectedScenarioKey !== activeScenario?.scenario_key;

  const filteredClusters = useMemo(() => {
    if (!activeScenario) return [];
    const q = clusterSearch.trim().toLowerCase();
    return activeScenario.clusters.filter((cl) => {
      if (
        q &&
        !`${cl.cluster_label} ${cl.cluster_name} ${cl.modality}`.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (clusterFilter === 'GRID') return cl.modality.startsWith('GRID');
      if (clusterFilter === 'SOLAR_MINIGRID') return cl.modality === 'SOLAR_MINIGRID';
      if (clusterFilter === 'STANDALONE_SHS') return cl.modality === 'STANDALONE_SHS';
      if (clusterFilter === 'NON_COMPLIANT') return !cl.overall_vdrop_compliant;
      return true;
    });
  }, [activeScenario, clusterSearch, clusterFilter]);

  const filteredConstants = useMemo(() => {
    const items = constants?.items ?? [];
    const q = constantSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) =>
      `${c.key} ${c.description} ${c.citation}`.toLowerCase().includes(q),
    );
  }, [constants?.items, constantSearch]);

  const handleGenerateScenario = async (scenarioKey: string, preserveOverrides = false) => {
    setGeneratingScenario(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await apiRequest(`/api/v1/projects/${projectId}/scenarios/generate`, {
        method: 'POST',
        body: JSON.stringify({
          scenario_key: scenarioKey,
          preserve_manual_overrides: preserveOverrides,
        }),
      });
      await onScenariosUpdated();
      setStatusMessage(
        `Designed and updated "${formatScenarioLabel(scenarioKey)}" plan${metricEpsg ? ` using Zone EPSG:${metricEpsg}` : ''}.`,
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to build electricity supply plan.',
      );
    } finally {
      setGeneratingScenario(false);
    }
  };

  const handleOverrideClusterModality = async (clusterId: string, newModality: string) => {
    if (!activeScenario) return;
    setOverridingClusterId(clusterId);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await apiRequest(
        `/api/v1/projects/${projectId}/scenarios/${activeScenario.id}/clusters/${clusterId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ modality: newModality }),
        },
      );
      await onScenariosUpdated();
      setStatusMessage(
        `Updated village option to ${formatModalityLabel(newModality)} and recalculated wires and voltage quality.`,
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to update village electricity option.',
      );
    } finally {
      setOverridingClusterId(null);
    }
  };

  const handleApplyOrRecalculate = () => {
    if (hasPendingScenarioChange) {
      if (hasManualOverrides) {
        setPendingScenarioSwitch(selectedScenarioKey);
        return;
      }
      void handleGenerateScenario(selectedScenarioKey, false);
      return;
    }
    void handleGenerateScenario(selectedScenarioKey, Boolean(activeScenario));
  };

  const hasRoutedNetworkLines = Boolean(
    activeScenario &&
      activeScenario.clusters.length > 0 &&
      (activeScenario.total_ht_length_m > 0 || activeScenario.total_lt_length_m > 0),
  );

  return (
    <Panel
      aria-label="Network Layout Routing and Engineering Engine"
      overline="Step 4 · Power Lines & System Sizing"
      title={
        <span className="inline-flex items-center gap-1.5">
          <span>Power Network Design, Transformers &amp; Solar Sizing</span>
          <HelpTooltip glossaryKey="htAndLtLines" />
        </span>
      }
      subtitle="Plans where new high-voltage (11 kV) lines, village transformers, low-voltage (415 V) cables, solar mini-grids, or home solar kits go, and checks if voltage stays strong."
      icon={Network}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Choose Planning Option"
            size="sm"
            value={selectedScenarioKey}
            onChange={(e) => setSelectedScenarioKey(e.target.value)}
            disabled={generatingScenario}
            options={SCENARIO_OPTIONS.map((opt) => ({
              value: opt.key,
              label: opt.label,
            }))}
          />

          <Button
            size="sm"
            variant={hasPendingScenarioChange || !activeScenario ? 'primary' : 'secondary'}
            leftIcon={RefreshCw}
            isLoading={generatingScenario}
            loadingText="Designing Plan…"
            onClick={handleApplyOrRecalculate}
          >
            {hasPendingScenarioChange || !activeScenario
              ? 'Apply Selected Plan'
              : 'Recalculate Plan'}
          </Button>

          <Button
            size="sm"
            variant={showConstantsDrawer ? 'primary' : 'ghost'}
            leftIcon={BookOpen}
            onClick={() => setShowConstantsDrawer((prev) => !prev)}
          >
            {showConstantsDrawer
              ? 'Hide Design Rules'
              : `Engineering Standards (${constants?.count ?? 19})`}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {hasPendingScenarioChange && (
          <Callout tone="info" title="Plan Selection Ready to Apply">
            You selected <strong>{formatScenarioLabel(selectedScenarioKey)}</strong> (current active
            plan is <strong>{formatScenarioLabel(activeScenario!.scenario_key)}</strong>). Click{' '}
            <strong>Apply Selected Plan</strong> above when ready to generate and save the new
            layout.
          </Callout>
        )}

        {errorMessage && (
          <Callout tone="error" title="Network Design Error">
            {errorMessage}
          </Callout>
        )}
        {statusMessage && (
          <Callout tone="info" title="Network Plan Updated">
            {statusMessage}
          </Callout>
        )}

        {activeScenario?.requires_tie_in_warning && (
          <Callout
            tone="warn"
            title="Grid Connection Point Needed Before Measuring New Power Lines"
          >
            Some village clusters are assigned to connect to the main electricity grid, but no
            existing power line or starting tap point has been added yet. New 11 kV line length
            stays at <strong>0 m (not estimated)</strong> until you mark a starting connection point
            on the map in Step 3.
          </Callout>
        )}

        {!activeScenario ? (
          <EmptyState
            icon={Network}
            title="No Power Network Plan Built Yet"
            description="Choose an electrification strategy above and click Apply Selected Plan to map new power lines, size village transformers, or design solar mini-grids and home solar kits."
            epistemicNote="Grid line lengths require a real or assumed starting connection point; missing power lines are never guessed."
            action={
              <Button
                size="sm"
                variant="primary"
                isLoading={generatingScenario}
                onClick={() => void handleGenerateScenario(selectedScenarioKey, false)}
              >
                Generate &amp; Apply {formatScenarioLabel(selectedScenarioKey)}
              </Button>
            }
          />
        ) : (
          <>
            {/* 6-Tile Engineering KPI Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <StatTile
                label="High-Voltage Line (11 kV)"
                value={`${activeScenario.total_ht_length_m.toFixed(0)} m`}
                quality="ESTIMATED"
                subtitle={`${activeScenario.total_ht_poles} × 9m concrete poles`}
              />
              <StatTile
                label="Village Cable (415 V LT)"
                value={`${activeScenario.total_lt_length_m.toFixed(0)} m`}
                quality="ESTIMATED"
                subtitle={`${activeScenario.total_lt_poles} × 8m service poles`}
              />
              <StatTile
                label="Village Transformers"
                value={`${activeScenario.total_dt_count} Units (${activeScenario.total_dt_capacity_kva} kVA)`}
                quality="ESTIMATED"
                subtitle="Step-down 11 kV to home voltage"
              />
              <StatTile
                label="Voltage Strength Check"
                value={
                  hasRoutedNetworkLines
                    ? `${activeScenario.max_ht_vdrop_pct.toFixed(2)}% / ${activeScenario.max_lt_vdrop_pct.toFixed(2)}%`
                    : 'Not Applicable'
                }
                quality={
                  hasRoutedNetworkLines
                    ? activeScenario.vdrop_compliance_ok
                      ? 'ESTIMATED'
                      : 'ASSUMED'
                    : 'ASSUMED'
                }
                tone={
                  !hasRoutedNetworkLines
                    ? undefined
                    : activeScenario.vdrop_compliance_ok
                      ? 'ok'
                      : 'warn'
                }
                subtitle={
                  !hasRoutedNetworkLines
                    ? 'No power lines routed yet (off-grid or needs tie-in)'
                    : activeScenario.vdrop_compliance_ok
                      ? 'Within CEA safe limits (≤5% HV / ≤6% LV)'
                      : 'Exceeds safe limit — consider transformer upgrade or solar'
                }
              />
              <StatTile
                label="Yearly Line Losses"
                value={activeScenario.total_loss_mwh_yr.toFixed(3)}
                unit="MWh/yr"
                quality="ESTIMATED"
                subtitle="Estimated heat loss on wires & transformers"
              />
              <StatTile
                label="Off-Grid Solar & Batteries"
                value={`${activeScenario.total_solar_kwp.toFixed(1)} kWp · ${activeScenario.total_bess_kwh.toFixed(0)} kWh`}
                tone="accent"
                quality="ESTIMATED"
                subtitle={`${activeScenario.total_shs_kits} Home Solar Kits`}
              />
            </div>

            {/* Interactive Cluster Engineering Schedule & Modality Override Table */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="small-caps-heading flex items-center gap-1.5">
                    <span>
                      Village Electricity Supply Schedule ({formatScenarioLabel(activeScenario.scenario_key)})
                    </span>
                    <HelpTooltip glossaryKey="voltageRegulation" />
                  </div>
                  <span className="text-xs text-ink-2">
                    Pick a different supply option for any village cluster below to update power
                    lines, transformers, and voltage checks.
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="search"
                    size="sm"
                    leftIcon={Search}
                    aria-label="Filter scenario clusters"
                    placeholder="Search village..."
                    value={clusterSearch}
                    onChange={(e) => setClusterSearch(e.target.value)}
                    containerClassName="w-44"
                  />
                  <Select
                    size="sm"
                    mono
                    aria-label="Filter scenario clusters by modality or compliance"
                    value={clusterFilter}
                    onChange={(e) =>
                      setClusterFilter(e.target.value as typeof clusterFilter)
                    }
                    options={[
                      {
                        value: 'ALL',
                        label: `All Villages (${activeScenario.clusters.length})`,
                      },
                      { value: 'GRID', label: 'Grid Extension / Upgrade' },
                      { value: 'SOLAR_MINIGRID', label: 'Solar Mini-Grid' },
                      { value: 'STANDALONE_SHS', label: 'Home Solar Kits' },
                      { value: 'NON_COMPLIANT', label: 'Voltage Alert' },
                    ]}
                  />
                  {(clusterSearch || clusterFilter !== 'ALL') && (
                    <Button
                      size="xs"
                      variant="ghost"
                      leftIcon={X}
                      onClick={() => {
                        setClusterSearch('');
                        setClusterFilter('ALL');
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {filteredClusters.length === 0 ? (
                <EmptyState
                  compact
                  icon={Search}
                  title="No Village Rows Match Filter"
                  description="Clear search or filter criteria to inspect all village supply plans."
                  action={
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => {
                        setClusterSearch('');
                        setClusterFilter('ALL');
                      }}
                    >
                      Show All Villages
                    </Button>
                  }
                />
              ) : (
                <div className="table-scroll-container">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-subtle border-b border-rule font-mono text-[11px] text-ink-2">
                        <th className="py-2 px-2.5">Village Cluster</th>
                        <th className="py-2 px-2.5">Supply Option (Editable)</th>
                        <th className="py-2 px-2.5">Future Peak</th>
                        <th className="py-2 px-2.5">
                          <span className="inline-flex items-center gap-1">
                            <span>Transformers</span>
                            <HelpTooltip glossaryKey="transformerKva" />
                          </span>
                        </th>
                        <th className="py-2 px-2.5">11 kV Line</th>
                        <th className="py-2 px-2.5">Village Cable</th>
                        <th className="py-2 px-2.5">Voltage Check</th>
                        <th className="py-2 px-2.5">Line Loss</th>
                        <th className="py-2 px-2.5">Solar &amp; Battery</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rule-subtle">
                      {filteredClusters.map((cl) => (
                        <tr key={cl.id} className="hover:bg-surface-hover">
                          <td className="py-2 px-2.5 font-mono font-semibold text-ink">
                            <div>
                              {cl.cluster_label} · {cl.cluster_name}
                            </div>
                            <div className="text-[11px] text-ink-2 font-normal font-sans">
                              {cl.est_households} homes · {cl.energy_kwh_day_horizon.toFixed(1)}{' '}
                              kWh/day
                            </div>
                          </td>

                          <td className="py-2 px-2.5">
                            <div className="flex flex-col gap-1">
                              <Select
                                aria-label={`Modality for ${cl.cluster_label}`}
                                size="sm"
                                value={cl.modality}
                                disabled={overridingClusterId === cl.cluster_id}
                                onChange={(e) =>
                                  void handleOverrideClusterModality(
                                    cl.cluster_id,
                                    e.target.value,
                                  )
                                }
                                options={MODALITY_OPTIONS.map((m) => ({
                                  value: m,
                                  label: formatModalityLabel(m),
                                }))}
                              />
                              {cl.is_manual_override && (
                                <QualityTag kind="USER_ENTERED" label="Custom Choice" />
                              )}
                            </div>
                          </td>

                          <td className="py-2.5 px-2.5 font-mono tabular-nums text-xs">
                            <div>{cl.peak_kva_horizon.toFixed(2)} kVA</div>
                            <div className="text-xs text-ink-2">
                              ({cl.peak_kw_horizon.toFixed(2)} kW)
                            </div>
                          </td>

                          <td className="py-2.5 px-2.5 text-xs tabular-nums">
                            {cl.dt_count > 0 ? (
                              <div>
                                <strong>
                                  {cl.dt_count}× ({cl.total_dt_rating_kva} kVA)
                                </strong>
                                <div className="text-xs text-ink-2">
                                  Load {cl.max_dt_loading_pct.toFixed(1)}%
                                </div>
                              </div>
                            ) : (
                              <span className="text-ink-2">—</span>
                            )}
                          </td>

                          <td className="py-2.5 px-2.5 text-xs tabular-nums">
                            {cl.requires_tie_in ? (
                              <span className="text-warn font-semibold">Needs Tie-In</span>
                            ) : cl.ht_length_m > 0 ? (
                              <div>
                                <div className="font-mono">{cl.ht_length_m.toFixed(0)} m</div>
                                <div className="text-xs text-ink-2">
                                  {cl.ht_poles_count} poles
                                </div>
                              </div>
                            ) : (
                              <span className="text-ink-2">0 m</span>
                            )}
                          </td>

                          <td className="py-2.5 px-2.5 text-xs tabular-nums">
                            {cl.lt_total_length_m > 0 ? (
                              <div>
                                <div className="font-mono">{cl.lt_total_length_m.toFixed(0)} m</div>
                                <div className="text-xs text-ink-2">
                                  {cl.lt_poles_count} poles · max {cl.max_lt_branch_m.toFixed(0)}m
                                </div>
                              </div>
                            ) : (
                              <span className="text-ink-2">0 m</span>
                            )}
                          </td>

                          <td className="py-2.5 px-2.5 text-xs tabular-nums">
                            {cl.modality === 'STANDALONE_SHS' ? (
                              <div>
                                <div className="font-mono text-ink-2">Off-Grid (N/A)</div>
                                <div className="text-xs text-ink-3">Individual systems</div>
                              </div>
                            ) : cl.requires_tie_in ? (
                              <div>
                                <div className="font-mono text-ink-2">Pending</div>
                                <div className="text-xs text-ink-3">Add Step 3 tie-in</div>
                              </div>
                            ) : (
                              <>
                                <div
                                  className={`font-mono ${
                                    cl.overall_vdrop_compliant
                                      ? 'text-ink font-semibold'
                                      : 'text-error font-semibold'
                                  }`}
                                >
                                  {cl.ht_drop_pct.toFixed(2)}% / {cl.lt_drop_pct.toFixed(2)}%
                                </div>
                                <div
                                  className={`text-xs ${
                                    cl.overall_vdrop_compliant
                                      ? 'text-ink-2'
                                      : 'text-error font-semibold'
                                  }`}
                                >
                                  {cl.overall_vdrop_compliant ? 'Voltage OK' : 'Voltage Alert'}
                                </div>
                              </>
                            )}
                          </td>

                          <td className="py-2.5 px-2.5 text-xs tabular-nums">
                            <div className="font-mono">{cl.total_loss_mwh_yr.toFixed(3)} MWh/yr</div>
                            <div className="text-xs text-ink-2">
                              ({cl.technical_loss_pct.toFixed(1)}%)
                            </div>
                          </td>

                          <td className="py-2.5 px-2.5 text-xs tabular-nums">
                            {cl.modality === 'SOLAR_MINIGRID' ? (
                              <div>
                                <strong>{cl.solar_pv_kwp.toFixed(1)} kWp Solar</strong>
                                <div className="text-xs text-ink-2">
                                  {cl.bess_capacity_kwh.toFixed(0)} kWh battery ·{' '}
                                  {cl.inverter_kva} kVA inverter
                                </div>
                              </div>
                            ) : cl.modality === 'STANDALONE_SHS' ? (
                              <div>
                                <strong>{cl.shs_kits_count} Home Kits</strong>
                                <div className="text-xs text-ink-2">
                                  {cl.solar_pv_kwp.toFixed(2)} kWp ·{' '}
                                  {cl.bess_capacity_kwh.toFixed(1)} kWh
                                </div>
                              </div>
                            ) : (
                              <span className="text-ink-2">Grid Connected</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

      {/* Collapsible Interactive Vector Single-Line Diagram (SLD) Schematic */}
      {activeScenario && activeScenario.clusters.length > 0 && (
        <details className="bg-paper border border-rule rounded-xs p-3.5">
          <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2 select-none">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-ink inline-flex items-center gap-1.5">
                Technical Wiring Schematic (Single-Line Diagram) —{' '}
                {formatScenarioLabel(activeScenario.scenario_key)}
                <HelpTooltip glossaryKey="sldDiagram" />
              </span>
              <LayerSourceBadge source="PROJECT" />
            </div>
            <span className="text-[11px] font-medium text-accent">
              Optional Engineering View · Expand Diagram
            </span>
          </summary>

          <div className="space-y-2.5 mt-3 pt-3 border-t border-rule-subtle">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-ink-2">
                Shows preliminary transformers, solar mini-grids, and feeder branches for each
                village cluster.
              </span>
              <span className="text-2xs text-warn font-semibold">
                Preliminary Schematic — Requires Field Survey
              </span>
            </div>

            {/* Phase 5: Existing vs. Proposed Network Symbology Bar */}
            <div className="p-2 bg-sheet border border-rule rounded-xs flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-ink-2">
              <div className="flex flex-wrap items-center gap-3">
                {[
                  INFRASTRUCTURE_CATEGORY_META.LINE_11KV_EXISTING,
                  INFRASTRUCTURE_CATEGORY_META.TIE_IN_ASSUMED,
                  INFRASTRUCTURE_CATEGORY_META.LINE_11KV_PROPOSED,
                  INFRASTRUCTURE_CATEGORY_META.LINE_415V_LT_PROPOSED,
                  INFRASTRUCTURE_CATEGORY_META.DT_PROPOSED,
                  INFRASTRUCTURE_CATEGORY_META.MINIGRID_PROPOSED,
                ].map((spec) => (
                  <span
                    key={spec.code}
                    className="inline-flex items-center gap-1.5"
                    title={spec.description}
                  >
                    {spec.geometryKind === 'LINE' ? (
                      <span
                        className="w-4 h-0 inline-block shrink-0"
                        style={{
                          borderBottomWidth: '3px',
                          borderBottomStyle: spec.dashArray ? 'dashed' : 'solid',
                          borderBottomColor: spec.color,
                        }}
                      />
                    ) : (
                      <span
                        className="w-3 h-3 rounded-full inline-block shrink-0"
                        style={{
                          backgroundColor: spec.color,
                          border: `2px solid ${spec.strokeColor ?? '#FFFFFF'}`,
                        }}
                      />
                    )}
                    <span>{spec.shortLabel}</span>
                  </span>
                ))}
              </div>
              <QualityTag kind="ASSUMED" label="Dashed = Proposed New Line" />
            </div>

            <div className="overflow-x-auto">
              {(() => {
                const sldClusters = activeScenario.clusters;
                const sldWidth = Math.max(920, 100 + sldClusters.length * 170);
                return (
                  <svg
                    role="img"
                    aria-label="Preliminary Single-Line Diagram"
                    viewBox={`0 0 ${sldWidth} 210`}
                    style={{ minWidth: `${Math.max(680, Math.round(sldWidth * 0.9))}px` }}
                    className="w-full h-auto bg-sheet border border-rule rounded-xs"
                  >
                    {/* 11 kV Header Feeder Bus */}
                    <line
                      x1="40"
                      y1="36"
                      x2={sldWidth - 40}
                      y2="36"
                      stroke={SLD_PALETTE.ht11kvStroke}
                      strokeWidth="3.5"
                    />
                    <text
                      x="45"
                      y="22"
                      fill={SLD_PALETTE.ht11kvStroke}
                      fontSize="11"
                      fontFamily="IBM Plex Mono, monospace"
                      fontWeight="600"
                    >
                      11 kV 3-Phase 50 Hz Feeder Bus (ACSR Rabbit 50 mm² · R=0.5426 Ω/km)
                    </text>

                    {sldClusters.map((cl, idx, arr) => {
                      const slotWidth = (sldWidth - 100) / Math.max(1, arr.length);
                      const cx = 50 + (idx + 0.5) * slotWidth;
                      const isGrid =
                        cl.modality === 'GRID_EXTENSION' || cl.modality === 'GRID_AUGMENTATION';
                      const isMinigrid = cl.modality === 'SOLAR_MINIGRID';
                      const branchStroke = cl.overall_vdrop_compliant
                        ? SLD_PALETTE.ltCompliantStroke
                        : SLD_PALETTE.vdropViolationStroke;

                      return (
                        <g key={cl.id}>
                          {isGrid && (
                            <>
                              <line
                                x1={cx}
                                y1="36"
                                x2={cx}
                                y2="78"
                                stroke={
                                  cl.overall_vdrop_compliant
                                    ? SLD_PALETTE.ht11kvStroke
                                    : SLD_PALETTE.vdropViolationStroke
                                }
                                strokeWidth="2"
                              />
                              <circle
                                cx={cx}
                                cy="88"
                                r="11"
                                fill="none"
                                stroke={SLD_PALETTE.ltBackboneStroke}
                                strokeWidth="2"
                              />
                              <circle
                                cx={cx}
                                cy="102"
                                r="11"
                                fill="none"
                                stroke={branchStroke}
                                strokeWidth="2"
                              />
                              <line
                                x1={cx}
                                y1="113"
                                x2={cx}
                                y2="136"
                                stroke={branchStroke}
                                strokeWidth="2"
                              />
                            </>
                          )}

                          {isMinigrid && (
                            <>
                              <line
                                x1={cx - 48}
                                y1="72"
                                x2={cx + 48}
                                y2="72"
                                stroke={SLD_PALETTE.dtStroke}
                                strokeWidth="3"
                              />
                              <text
                                x={cx}
                                y="64"
                                textAnchor="middle"
                                fill={SLD_PALETTE.dtCoreStroke}
                                fontSize="9.5"
                                fontFamily="IBM Plex Mono, monospace"
                                fontWeight="600"
                              >
                                PV {cl.solar_pv_kwp.toFixed(1)} kWp + BESS{' '}
                                {cl.bess_capacity_kwh.toFixed(0)} kWh
                              </text>
                              <line
                                x1={cx}
                                y1="72"
                                x2={cx}
                                y2="136"
                                stroke={branchStroke}
                                strokeWidth="2"
                              />
                            </>
                          )}

                          <rect
                            x={cx - 72}
                            y="136"
                            width="144"
                            height="60"
                            rx="3"
                            fill={SLD_PALETTE.canvasBg}
                            stroke={
                              cl.overall_vdrop_compliant
                                ? SLD_PALETTE.inkSecondary
                                : SLD_PALETTE.vdropViolationStroke
                            }
                            strokeWidth={cl.overall_vdrop_compliant ? '1.2' : '1.8'}
                          />
                          <text
                            x={cx}
                            y="152"
                            textAnchor="middle"
                            fill={SLD_PALETTE.inkPrimary}
                            fontSize="10"
                            fontFamily="IBM Plex Mono, monospace"
                            fontWeight="600"
                          >
                            {cl.cluster_label} ({cl.est_households} HH)
                          </text>
                          <text
                            x={cx}
                            y="167"
                            textAnchor="middle"
                            fill={SLD_PALETTE.inkSecondary}
                            fontSize="9"
                            fontFamily="IBM Plex Mono, monospace"
                          >
                            {isGrid
                              ? `${cl.dt_count}x DT (${cl.total_dt_rating_kva} kVA)`
                              : isMinigrid
                                ? `PCU ${cl.inverter_kva} kVA · LT ${cl.lt_total_length_m.toFixed(0)}m`
                                : `${cl.shs_kits_count}x SHS Kits (${cl.solar_pv_kwp.toFixed(2)} kWp)`}
                          </text>
                          <text
                            x={cx}
                            y="182"
                            textAnchor="middle"
                            fill={branchStroke}
                            fontSize="9"
                            fontWeight={cl.overall_vdrop_compliant ? '400' : '700'}
                            fontFamily="IBM Plex Mono, monospace"
                          >
                            {isGrid
                              ? `ΔV: ${cl.ht_drop_pct.toFixed(1)}% HT / ${cl.lt_drop_pct.toFixed(1)}% LT`
                              : isMinigrid
                                ? `LT ΔV: ${cl.lt_drop_pct.toFixed(1)}%`
                                : 'Standalone Off-Grid DC/AC'}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}
            </div>
          </div>
        </details>
      )}

      {/* Collapsible Verified Engineering Constants Drawer */}
      {showConstantsDrawer && constants && (
        <div className="bg-paper border border-rule rounded-xs p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="small-caps-heading flex items-center gap-1.5">
              Reference Engineering Standards ({filteredConstants.length}/{constants.count} Rules)
              <HelpTooltip glossaryKey="voltageRegulation" />
            </div>
            <Input
              type="search"
              size="sm"
              leftIcon={Search}
              aria-label="Filter REC/IS/CEA engineering constants"
              placeholder="Search rule or standard..."
              value={constantSearch}
              onChange={(e) => setConstantSearch(e.target.value)}
              containerClassName="w-60"
            />
          </div>

          {filteredConstants.length === 0 ? (
            <EmptyState
              compact
              icon={Search}
              title="No Matching Standards"
              description="Clear your search filter to view all engineering rules."
              action={
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => setConstantSearch('')}
                >
                  Show All Standards
                </Button>
              }
            />
          ) : (
            <div className="table-scroll-container max-h-[280px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-body-sm">
                <thead>
                  <tr className="bg-subtle border-b border-rule text-xs font-semibold text-ink-2">
                    <th className="py-2 px-3">Parameter Key</th>
                    <th className="py-2 px-3">Value &amp; Unit</th>
                    <th className="py-2 px-3">What It Controls</th>
                    <th className="py-2 px-3">Standard Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule-subtle">
                  {filteredConstants.map((c) => (
                    <tr key={c.key} className="hover:bg-surface-hover">
                      <td className="py-2 px-3 font-mono text-xs font-semibold text-ink">
                        {c.key}
                      </td>
                      <td className="py-2 px-3 font-mono tabular-nums text-xs text-accent font-semibold">
                        {c.value} {c.unit}
                      </td>
                      <td className="py-2 px-3 text-xs text-ink">{c.description}</td>
                      <td className="py-2 px-3 text-xs text-ink-2">
                        {c.citation}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Confirmation Dialog when switching scenarios over manual overrides */}
      <ConfirmDialog
        open={pendingScenarioSwitch !== null}
        onClose={() => setPendingScenarioSwitch(null)}
        onConfirm={() => {
          if (!pendingScenarioSwitch) return;
          const nextKey = pendingScenarioSwitch;
          setPendingScenarioSwitch(null);
          setSelectedScenarioKey(nextKey);
          void handleGenerateScenario(nextKey, false);
        }}
        title="Apply New Plan & Replace Custom Village Choices?"
        description={
          pendingScenarioSwitch ? (
            <div className="space-y-1">
              <p>
                Some villages currently have custom supply choices. Applying{' '}
                <strong>{formatScenarioLabel(pendingScenarioSwitch)}</strong> will reset those to
                the new plan&apos;s standard rules.
              </p>
              <p className="text-2xs text-ink-3 font-mono">
                Click Cancel and use &quot;Recalculate Plan&quot; instead if you want to keep your
                custom village choices.
              </p>
            </div>
          ) : null
        }
        confirmLabel="Apply New Plan"
        variant="primary"
        isLoading={generatingScenario}
      />
    </Panel>
  );
};

