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
import { BookOpen, Network, RefreshCw, Search, X } from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
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
  scenariosState: PlanningScenarioListDto | null;
  constants: EngineeringConstantListDto | null;
  onScenariosUpdated: () => Promise<void>;
}

const SCENARIO_OPTIONS = [
  {
    key: 'HYBRID_OPTIMAL',
    label: 'HYBRID_OPTIMAL · Least-Cost Hybrid (Grid + Mini-Grid + SHS)',
  },
  {
    key: 'GRID_EXTENSION_ONLY',
    label: 'GRID_EXTENSION_ONLY · 100% Grid Extension / Augmentation',
  },
  {
    key: 'MINIGRID_PRIORITY',
    label: 'MINIGRID_PRIORITY · Solar PV + LiFePO4 Mini-Grid Priority',
  },
  {
    key: 'SHS_DISPERSED',
    label: 'SHS_DISPERSED · Standalone Solar Home Systems Priority',
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
  scenariosState,
  constants,
  onScenariosUpdated,
}) => {
  const activeScenario = scenariosState?.active_scenario ?? null;
  const [selectedScenarioKey, setSelectedScenarioKey] = useState<string>(
    activeScenario?.scenario_key ?? 'HYBRID_OPTIMAL',
  );
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
        `Generated and routed scenario '${scenarioKey}' in UTM EPSG:32644.`,
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to generate planning scenario.',
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
        `Applied manual modality override (${newModality}) and recalculated network routing & voltage drop.`,
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to override cluster modality.',
      );
    } finally {
      setOverridingClusterId(null);
    }
  };

  return (
    <Panel
      aria-label="Network Layout Routing and Engineering Engine"
      overline="Step 4 · Network Routing & Sizing"
      title="Network Layout Routing, Voltage Drop, Technical Losses & Off-Grid Sizing Engine"
      subtitle="Routes 11 kV ACSR Rabbit feeders via MCP_Geometric, constructs 415 V LT AB cable Minimum Spanning Trees, sizes IS 1180 DTs & Solar/LiFePO4 Mini-Grids, and verifies CEA voltage regulation."
      icon={Network}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Select Planning Scenario"
            size="sm"
            value={selectedScenarioKey}
            onChange={(e) => {
              const nextKey = e.target.value;
              if (hasManualOverrides) {
                setPendingScenarioSwitch(nextKey);
                return;
              }
              setSelectedScenarioKey(nextKey);
              void handleGenerateScenario(nextKey, false);
            }}
            disabled={generatingScenario}
            options={SCENARIO_OPTIONS.map((opt) => ({
              value: opt.key,
              label: opt.label,
            }))}
          />

          <Button
            size="sm"
            variant="secondary"
            leftIcon={RefreshCw}
            isLoading={generatingScenario}
            loadingText="Routing & Sizing…"
            onClick={() => void handleGenerateScenario(selectedScenarioKey, true)}
          >
            Recalculate Active Scenario
          </Button>

          <Button
            size="sm"
            variant={showConstantsDrawer ? 'primary' : 'ghost'}
            leftIcon={BookOpen}
            onClick={() => setShowConstantsDrawer((prev) => !prev)}
          >
            {showConstantsDrawer
              ? 'Hide REC/IS/CEA Constants'
              : `REC/IS/CEA Constants (${constants?.count ?? 19})`}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {errorMessage && (
          <Callout tone="error" title="Network Engineering Error">
            {errorMessage}
          </Callout>
        )}
        {statusMessage && (
          <Callout tone="info" title="Scenario & Network Layout Update">
            {statusMessage}
          </Callout>
        )}

        {activeScenario?.requires_tie_in_warning && (
          <Callout
            tone="warn"
            title="11 kV Tie-In Point Required for Grid Extension Routing (Core Principle #4)"
          >
            One or more clusters are assigned <code>GRID_EXTENSION</code> while no existing or
            assumed 11 kV tie-in point exists in the project. In accordance with Core Principle #4
            (zero fabricated infrastructure), 11 kV feeder length remains{' '}
            <code>0 m (UNSET TIE-IN)</code> until you place an assumed 11 kV tie-in point or upload
            utility GIS above.
          </Callout>
        )}

        {!activeScenario ? (
          <EmptyState
            icon={Network}
            title="No Network Engineering Scenario Generated Yet"
            description="Generate an engineering planning scenario to route 11 kV HT feeders, 415 V LT Minimum Spanning Trees, IS 1180 DTs, and Solar PV Mini-Grid / SHS sizing."
            epistemicNote="Grid extension lengths require an explicit 11 kV tie-in or utility GIS record; zero infrastructure is ever fabricated."
            action={
              <Button
                size="sm"
                variant="primary"
                isLoading={generatingScenario}
                onClick={() => void handleGenerateScenario(selectedScenarioKey, false)}
              >
                Generate &amp; Route {selectedScenarioKey}
              </Button>
            }
          />
        ) : (
          <>
            {/* 6-Tile Engineering KPI Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <StatTile
                label="11 kV HT Feeder (ACSR)"
                value={`${activeScenario.total_ht_length_m.toFixed(0)} m`}
                quality="ESTIMATED"
                subtitle={`${activeScenario.total_ht_poles} × 9m PSC Poles`}
              />
              <StatTile
                label="415 V LT Radial MST"
                value={`${activeScenario.total_lt_length_m.toFixed(0)} m`}
                quality="ESTIMATED"
                subtitle={`${activeScenario.total_lt_poles} × 8m PSC Poles`}
              />
              <StatTile
                label="Distribution DTs (IS 1180)"
                value={`${activeScenario.total_dt_count} Units (${activeScenario.total_dt_capacity_kva} kVA)`}
                quality="ESTIMATED"
                subtitle="11/0.433 kV Level-2"
              />
              <StatTile
                label="Max Voltage Drop (HT / LT)"
                value={`${activeScenario.max_ht_vdrop_pct.toFixed(2)}% / ${activeScenario.max_lt_vdrop_pct.toFixed(2)}%`}
                quality={activeScenario.vdrop_compliance_ok ? 'ESTIMATED' : 'ASSUMED'}
                tone={activeScenario.vdrop_compliance_ok ? 'ok' : 'warn'}
                subtitle={
                  activeScenario.vdrop_compliance_ok
                    ? '✓ CEA Compliant (≤5% / ≤6%)'
                    : '⚠ Exceeds CEA Limit'
                }
              />
              <StatTile
                label="Annual Technical Losses"
                value={activeScenario.total_loss_mwh_yr.toFixed(3)}
                unit="MWh/yr"
                quality="ESTIMATED"
                subtitle="I²R Line + DT Core/Cu"
              />
              <StatTile
                label="Off-Grid Solar & BESS"
                value={`${activeScenario.total_solar_kwp.toFixed(1)} kWp · ${activeScenario.total_bess_kwh.toFixed(0)} kWh`}
                tone="accent"
                quality="ESTIMATED"
                subtitle={`${activeScenario.total_shs_kits} Standalone SHS Kits`}
              />
            </div>

            {/* Interactive Cluster Engineering Schedule & Modality Override Table */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="small-caps-heading">
                    Cluster Network Routing, Voltage Drop &amp; Off-Grid Sizing Schedule (
                    {activeScenario.name})
                  </div>
                  <span className="text-xs text-ink-2">
                    Change any cluster&apos;s modality dropdown below to trigger synchronous
                    engineering recalculation
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="search"
                    size="sm"
                    leftIcon={Search}
                    aria-label="Filter scenario clusters"
                    placeholder="Search cluster..."
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
                        label: `All Clusters (${activeScenario.clusters.length})`,
                      },
                      { value: 'GRID', label: 'Grid Extension / Aug.' },
                      { value: 'SOLAR_MINIGRID', label: 'Solar PV Mini-Grid' },
                      { value: 'STANDALONE_SHS', label: 'Standalone SHS' },
                      { value: 'NON_COMPLIANT', label: 'CEA VDrop Non-Compliant' },
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
                  title="No Clusters Match Engineering Filter"
                  description="Clear search or filter criteria to inspect all cluster routing schedules."
                  action={
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => {
                        setClusterSearch('');
                        setClusterFilter('ALL');
                      }}
                    >
                      Show All Clusters
                    </Button>
                  }
                />
              ) : (
                <div className="table-scroll-container">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-subtle border-b border-rule font-mono text-[11px] text-ink-2">
                        <th className="py-2 px-2.5">Cluster</th>
                        <th className="py-2 px-2.5">Modality (Editable)</th>
                        <th className="py-2 px-2.5">Horizon Peak</th>
                        <th className="py-2 px-2.5">DTs (IS 1180)</th>
                        <th className="py-2 px-2.5">11 kV HT Feeder</th>
                        <th className="py-2 px-2.5">415 V LT MST</th>
                        <th className="py-2 px-2.5">VDrop (HT / LT)</th>
                        <th className="py-2 px-2.5">Tech Loss</th>
                        <th className="py-2 px-2.5">Solar PV / BESS / SHS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rule-subtle">
                      {filteredClusters.map((cl) => (
                        <tr key={cl.id} className="hover:bg-surface-hover">
                          <td className="py-2 px-2.5 font-mono font-semibold text-ink">
                            <div>
                              {cl.cluster_label} · {cl.cluster_name}
                            </div>
                            <div className="text-[11px] text-ink-2 font-normal">
                              {cl.est_households} HH · {cl.energy_kwh_day_horizon.toFixed(1)}{' '}
                              kWh/d
                            </div>
                          </td>

                          <td className="py-2 px-2.5">
                            <div className="flex flex-col gap-1">
                              <Select
                                aria-label={`Modality for ${cl.cluster_label}`}
                                size="sm"
                                mono
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
                                  label: m,
                                }))}
                              />
                              {cl.is_manual_override && (
                                <QualityTag kind="USER_ENTERED" label="MANUAL OVERRIDE" />
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
                                  Max load {cl.max_dt_loading_pct.toFixed(1)}%
                                </div>
                              </div>
                            ) : (
                              <span className="text-ink-2">—</span>
                            )}
                          </td>

                          <td className="py-2.5 px-2.5 text-xs tabular-nums">
                            {cl.requires_tie_in ? (
                              <span className="text-warn font-semibold">UNSET TIE-IN</span>
                            ) : cl.ht_length_m > 0 ? (
                              <div>
                                <div className="font-mono">{cl.ht_length_m.toFixed(0)} m</div>
                                <div className="text-xs text-ink-2">
                                  {cl.ht_poles_count} poles (9m)
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
                                  {cl.lt_poles_count}p · max {cl.max_lt_branch_m.toFixed(0)}m
                                </div>
                              </div>
                            ) : (
                              <span className="text-ink-2">0 m</span>
                            )}
                          </td>

                          <td className="py-2.5 px-2.5 text-xs tabular-nums">
                            <div
                              className={`font-mono ${
                                cl.overall_vdrop_compliant
                                  ? 'text-ink font-semibold'
                                  : 'text-error font-semibold'
                              }`}
                            >
                              {cl.ht_drop_pct.toFixed(2)}% / {cl.lt_drop_pct.toFixed(2)}%
                            </div>
                            <div className="text-xs text-ink-2">
                              {cl.overall_vdrop_compliant ? 'CEA OK' : 'LIMIT EXCEEDED'}
                            </div>
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
                                <strong>{cl.solar_pv_kwp.toFixed(1)} kWp PV</strong>
                                <div className="text-xs text-ink-2">
                                  {cl.bess_capacity_kwh.toFixed(0)} kWh BESS ·{' '}
                                  {cl.inverter_kva} kVA PCU
                                </div>
                              </div>
                            ) : cl.modality === 'STANDALONE_SHS' ? (
                              <div>
                                <strong>{cl.shs_kits_count} SHS Kits</strong>
                                <div className="text-xs text-ink-2">
                                  {cl.solar_pv_kwp.toFixed(2)} kWp ·{' '}
                                  {cl.bess_capacity_kwh.toFixed(1)} kWh
                                </div>
                              </div>
                            ) : (
                              <span className="text-ink-2">Grid Fed</span>
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

      {/* Interactive Vector Single-Line Diagram (SLD) Schematic */}
      {activeScenario && activeScenario.clusters.length > 0 && (
        <div className="bg-paper border border-rule rounded-xs p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="small-caps-heading">
                Preliminary Single-Line Diagram (SLD) Schematic — {activeScenario.scenario_key}
              </span>
              <LayerSourceBadge source="PROJECT" />
            </div>
            <span className="font-mono text-[10px] text-warn font-semibold">
              PRELIMINARY ENGINEERING SCHEMATIC — REQUIRES FIELD SURVEY VALIDATION
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
            <QualityTag kind="ASSUMED" label="PROPOSED = DASHED · NOT INSTALLED" />
          </div>

          <div className="overflow-x-auto">
            <svg
              role="img"
              aria-label="Preliminary Single-Line Diagram"
              viewBox="0 0 920 210"
              className="w-full min-w-[680px] h-auto bg-sheet border border-rule rounded-xs"
            >
              {/* 11 kV Header Feeder Bus */}
              <line
                x1="40"
                y1="36"
                x2="880"
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

              {activeScenario.clusters.slice(0, 5).map((cl, idx, arr) => {
                const slotWidth = 820 / Math.max(1, arr.length);
                const cx = 50 + (idx + 0.5) * slotWidth;
                const isGrid =
                  cl.modality === 'GRID_EXTENSION' || cl.modality === 'GRID_AUGMENTATION';
                const isMinigrid = cl.modality === 'SOLAR_MINIGRID';

                return (
                  <g key={cl.id}>
                    {isGrid && (
                      <>
                        <line
                          x1={cx}
                          y1="36"
                          x2={cx}
                          y2="78"
                          stroke={SLD_PALETTE.ht11kvStroke}
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
                          stroke={SLD_PALETTE.ltCompliantStroke}
                          strokeWidth="2"
                        />
                        <line
                          x1={cx}
                          y1="113"
                          x2={cx}
                          y2="136"
                          stroke={SLD_PALETTE.ltCompliantStroke}
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
                          stroke={SLD_PALETTE.ltCompliantStroke}
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
                      stroke={SLD_PALETTE.inkSecondary}
                      strokeWidth="1.2"
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
                          : `${cl.shs_kits_count}x SHS Kits (${cl.solar_pv_kwp} kWp)`}
                    </text>
                    <text
                      x={cx}
                      y="182"
                      textAnchor="middle"
                      fill={SLD_PALETTE.ltCompliantStroke}
                      fontSize="9"
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
          </div>
        </div>
      )}

      {/* Collapsible Verified Engineering Constants Drawer */}
      {showConstantsDrawer && constants && (
        <div className="bg-paper border border-rule rounded-xs p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="small-caps-heading">
              Verified REC / IS / CEA / MNRE Engineering Constants ({filteredConstants.length}/
              {constants.count} Standards)
            </div>
            <Input
              type="search"
              size="sm"
              leftIcon={Search}
              aria-label="Filter REC/IS/CEA engineering constants"
              placeholder="Search key or IS/REC code..."
              value={constantSearch}
              onChange={(e) => setConstantSearch(e.target.value)}
              containerClassName="w-60"
            />
          </div>

          {filteredConstants.length === 0 ? (
            <EmptyState
              compact
              icon={Search}
              title="No Matching Engineering Constants"
              description="Clear your constant search filter to view all normative REC/IS/CEA standards."
              action={
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => setConstantSearch('')}
                >
                  Show All Constants
                </Button>
              }
            />
          ) : (
            <div className="table-scroll-container max-h-[280px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-body-sm">
                <thead>
                  <tr className="bg-subtle border-b border-rule text-xs font-semibold text-ink-2">
                    <th className="py-2 px-3">Constant Key</th>
                    <th className="py-2 px-3">Value &amp; Unit</th>
                    <th className="py-2 px-3">Engineering Description</th>
                    <th className="py-2 px-3">Standard Citation</th>
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
        title="Switch Scenario & Replace Manual Overrides?"
        description={
          pendingScenarioSwitch ? (
            <div className="space-y-1">
              <p>
                One or more clusters in the current scenario have manual modality overrides.
                Switching to <strong className="font-mono">{pendingScenarioSwitch}</strong> will
                regenerate routing with standard scenario rules.
              </p>
              <p className="text-2xs text-ink-3 font-mono">
                Use &quot;Recalculate Active Scenario&quot; if you want to preserve manual
                cluster overrides instead.
              </p>
            </div>
          ) : null
        }
        confirmLabel="Switch Scenario"
        variant="primary"
        isLoading={generatingScenario}
      />
    </Panel>
  );
};

