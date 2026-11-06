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
import { apiRequest } from '../../lib/apiClient';
import { Button } from '../ui/Button';
import { Callout } from '../ui/Callout';
import { QualityTag } from '../ui/QualityTag';

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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    <section
      aria-label="Network Layout Routing and Engineering Engine"
      className="bg-sheet border border-rule-strong rounded-xs p-4 space-y-5"
    >
      {/* Header & Scenario Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3">
        <div>
          <div className="small-caps-heading">
            Milestone M5 · Network Layout Routing, Voltage Drop, Technical Losses &amp; Off-Grid
            Sizing Engine
          </div>
          <p className="text-xs text-ink-2 mt-0.5">
            Routes 11 kV ACSR Rabbit feeders via <code>MCP_Geometric</code>, constructs 415 V LT AB
            cable Minimum Spanning Trees, sizes IS 1180 DTs &amp; Solar/LiFePO4 Mini-Grids, and
            verifies CEA voltage regulation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Select Planning Scenario"
            value={selectedScenarioKey}
            onChange={(e) => {
              const nextKey = e.target.value;
              setSelectedScenarioKey(nextKey);
              void handleGenerateScenario(nextKey, false);
            }}
            disabled={generatingScenario}
            className="px-2.5 py-1 text-xs font-mono bg-paper border border-rule-strong rounded-xs text-ink"
          >
            {SCENARIO_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>

          <Button
            size="sm"
            variant="secondary"
            disabled={generatingScenario}
            onClick={() => void handleGenerateScenario(selectedScenarioKey, true)}
          >
            {generatingScenario ? 'Routing & Sizing…' : 'Recalculate Active Scenario'}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowConstantsDrawer((prev) => !prev)}
          >
            {showConstantsDrawer
              ? 'Hide REC/IS/CEA Constants'
              : `REC/IS/CEA Constants (${constants?.count ?? 19})`}
          </Button>
        </div>
      </div>

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
          One or more clusters are assigned <code>GRID_EXTENSION</code> while no existing or assumed
          11 kV tie-in point exists in the project. In accordance with Core Principle #4 (zero
          fabricated infrastructure), 11 kV feeder length remains <code>0 m (UNSET TIE-IN)</code>{' '}
          until you place an assumed 11 kV tie-in point or upload utility GIS above.
        </Callout>
      )}

      {/* 6-Tile Engineering KPI Summary */}
      {activeScenario && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 font-mono text-xs">
          <div className="p-2.5 bg-paper border border-rule rounded-xs">
            <span className="text-[10px] text-ink-2 block">11 kV HT Feeder (ACSR)</span>
            <strong className="text-sm text-ink">
              {activeScenario.total_ht_length_m.toFixed(0)} m
            </strong>
            <span className="text-[10px] text-ink-2 block">
              {activeScenario.total_ht_poles} × 9m PSC Poles
            </span>
          </div>

          <div className="p-2.5 bg-paper border border-rule rounded-xs">
            <span className="text-[10px] text-ink-2 block">415 V LT Radial MST</span>
            <strong className="text-sm text-ink">
              {activeScenario.total_lt_length_m.toFixed(0)} m
            </strong>
            <span className="text-[10px] text-ink-2 block">
              {activeScenario.total_lt_poles} × 8m PSC Poles
            </span>
          </div>

          <div className="p-2.5 bg-paper border border-rule rounded-xs">
            <span className="text-[10px] text-ink-2 block">Distribution DTs (IS 1180)</span>
            <strong className="text-sm text-ink">
              {activeScenario.total_dt_count} Units ({activeScenario.total_dt_capacity_kva} kVA)
            </strong>
            <span className="text-[10px] text-ink-2 block">11/0.433 kV Level-2</span>
          </div>

          <div
            className={`p-2.5 border rounded-xs ${
              activeScenario.vdrop_compliance_ok
                ? 'bg-paper border-rule'
                : 'bg-warn-bg border-warn'
            }`}
          >
            <span className="text-[10px] text-ink-2 block">Max Voltage Drop (HT / LT)</span>
            <strong className="text-sm text-ink">
              {activeScenario.max_ht_vdrop_pct.toFixed(2)}% /{' '}
              {activeScenario.max_lt_vdrop_pct.toFixed(2)}%
            </strong>
            <span className="text-[10px] text-ink-2 block">
              {activeScenario.vdrop_compliance_ok
                ? '✓ CEA Compliant (≤5% / ≤6%)'
                : '⚠ Exceeds CEA Limit'}
            </span>
          </div>

          <div className="p-2.5 bg-paper border border-rule rounded-xs">
            <span className="text-[10px] text-ink-2 block">Annual Technical Losses</span>
            <strong className="text-sm text-ink">
              {activeScenario.total_loss_mwh_yr.toFixed(3)} MWh/yr
            </strong>
            <span className="text-[10px] text-ink-2 block">I²R Line + DT Core/Cu</span>
          </div>

          <div className="p-2.5 bg-accent-tint/40 border border-accent/40 rounded-xs">
            <span className="text-[10px] text-accent block">Off-Grid Solar &amp; BESS</span>
            <strong className="text-sm text-accent">
              {activeScenario.total_solar_kwp.toFixed(1)} kWp ·{' '}
              {activeScenario.total_bess_kwh.toFixed(0)} kWh
            </strong>
            <span className="text-[10px] text-ink-2 block">
              {activeScenario.total_shs_kits} Standalone SHS Kits
            </span>
          </div>
        </div>
      )}

      {/* Interactive Cluster Engineering Schedule & Modality Override Table */}
      {activeScenario && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="small-caps-heading">
              Cluster Network Routing, Voltage Drop &amp; Off-Grid Sizing Schedule (
              {activeScenario.name})
            </div>
            <span className="text-[11px] text-ink-2">
              Change any cluster&apos;s modality dropdown below to trigger synchronous engineering
              recalculation
            </span>
          </div>

          <div className="overflow-x-auto border border-rule rounded-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-paper border-b border-rule font-mono text-[11px] text-ink-2">
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
              <tbody className="divide-y divide-rule">
                {activeScenario.clusters.map((cl) => (
                  <tr key={cl.id} className="hover:bg-paper/40">
                    <td className="py-2 px-2.5 font-mono font-semibold text-ink">
                      <div>
                        {cl.cluster_label} · {cl.cluster_name}
                      </div>
                      <div className="text-[10px] text-ink-2 font-normal">
                        {cl.est_households} HH · {cl.energy_kwh_day_horizon.toFixed(1)} kWh/d
                      </div>
                    </td>

                    <td className="py-2 px-2.5">
                      <div className="flex flex-col gap-1">
                        <select
                          aria-label={`Modality for ${cl.cluster_label}`}
                          value={cl.modality}
                          disabled={overridingClusterId === cl.cluster_id}
                          onChange={(e) =>
                            void handleOverrideClusterModality(cl.cluster_id, e.target.value)
                          }
                          className="px-2 py-0.5 text-[11px] font-mono bg-paper border border-rule-strong rounded-xs text-ink"
                        >
                          {MODALITY_OPTIONS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                        {cl.is_manual_override && (
                          <QualityTag kind="USER_ENTERED" label="MANUAL OVERRIDE" />
                        )}
                      </div>
                    </td>

                    <td className="py-2 px-2.5 font-mono text-[11px]">
                      <div>{cl.peak_kva_horizon.toFixed(2)} kVA</div>
                      <div className="text-[10px] text-ink-2">
                        ({cl.peak_kw_horizon.toFixed(2)} kW)
                      </div>
                    </td>

                    <td className="py-2 px-2.5 font-mono text-[11px]">
                      {cl.dt_count > 0 ? (
                        <div>
                          <strong>
                            {cl.dt_count}× ({cl.total_dt_rating_kva} kVA)
                          </strong>
                          <div className="text-[10px] text-ink-2">
                            Max load {cl.max_dt_loading_pct.toFixed(1)}%
                          </div>
                        </div>
                      ) : (
                        <span className="text-ink-2">—</span>
                      )}
                    </td>

                    <td className="py-2 px-2.5 font-mono text-[11px]">
                      {cl.requires_tie_in ? (
                        <span className="text-warn font-semibold">UNSET TIE-IN</span>
                      ) : cl.ht_length_m > 0 ? (
                        <div>
                          <div>{cl.ht_length_m.toFixed(0)} m</div>
                          <div className="text-[10px] text-ink-2">
                            {cl.ht_poles_count} poles (9m)
                          </div>
                        </div>
                      ) : (
                        <span className="text-ink-2">0 m</span>
                      )}
                    </td>

                    <td className="py-2 px-2.5 font-mono text-[11px]">
                      {cl.lt_total_length_m > 0 ? (
                        <div>
                          <div>{cl.lt_total_length_m.toFixed(0)} m</div>
                          <div className="text-[10px] text-ink-2">
                            {cl.lt_poles_count}p · max {cl.max_lt_branch_m.toFixed(0)}m
                          </div>
                        </div>
                      ) : (
                        <span className="text-ink-2">0 m</span>
                      )}
                    </td>

                    <td className="py-2 px-2.5 font-mono text-[11px]">
                      <div
                        className={
                          cl.overall_vdrop_compliant
                            ? 'text-ink font-semibold'
                            : 'text-error font-semibold'
                        }
                      >
                        {cl.ht_drop_pct.toFixed(2)}% / {cl.lt_drop_pct.toFixed(2)}%
                      </div>
                      <div className="text-[10px] text-ink-2">
                        {cl.overall_vdrop_compliant ? 'CEA OK' : 'LIMIT EXCEEDED'}
                      </div>
                    </td>

                    <td className="py-2 px-2.5 font-mono text-[11px]">
                      <div>{cl.total_loss_mwh_yr.toFixed(3)} MWh/yr</div>
                      <div className="text-[10px] text-ink-2">
                        ({cl.technical_loss_pct.toFixed(1)}%)
                      </div>
                    </td>

                    <td className="py-2 px-2.5 font-mono text-[11px]">
                      {cl.modality === 'SOLAR_MINIGRID' ? (
                        <div>
                          <strong>{cl.solar_pv_kwp.toFixed(1)} kWp PV</strong>
                          <div className="text-[10px] text-ink-2">
                            {cl.bess_capacity_kwh.toFixed(0)} kWh BESS · {cl.inverter_kva} kVA PCU
                          </div>
                        </div>
                      ) : cl.modality === 'STANDALONE_SHS' ? (
                        <div>
                          <strong>{cl.shs_kits_count} SHS Kits</strong>
                          <div className="text-[10px] text-ink-2">
                            {cl.solar_pv_kwp.toFixed(2)} kWp · {cl.bess_capacity_kwh.toFixed(1)} kWh
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
        </div>
      )}

      {/* Interactive Vector Single-Line Diagram (SLD) Schematic */}
      {activeScenario && activeScenario.clusters.length > 0 && (
        <div className="bg-paper border border-rule rounded-xs p-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="small-caps-heading">
              Preliminary Single-Line Diagram (SLD) Schematic — {activeScenario.scenario_key}
            </span>
            <span className="font-mono text-[10px] text-warn font-semibold">
              PRELIMINARY ENGINEERING SCHEMATIC — REQUIRES FIELD SURVEY VALIDATION
            </span>
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
                stroke="#9B2C2C"
                strokeWidth="3.5"
              />
              <text
                x="45"
                y="22"
                fill="#9B2C2C"
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
                          stroke="#9B2C2C"
                          strokeWidth="2"
                        />
                        <circle
                          cx={cx}
                          cy="88"
                          r="11"
                          fill="none"
                          stroke="#1E3A5F"
                          strokeWidth="2"
                        />
                        <circle
                          cx={cx}
                          cy="102"
                          r="11"
                          fill="none"
                          stroke="#0F766E"
                          strokeWidth="2"
                        />
                        <line
                          x1={cx}
                          y1="113"
                          x2={cx}
                          y2="136"
                          stroke="#0F766E"
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
                          stroke="#D97706"
                          strokeWidth="3"
                        />
                        <text
                          x={cx}
                          y="64"
                          textAnchor="middle"
                          fill="#B45309"
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
                          stroke="#0F766E"
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
                      fill="#F8FAFC"
                      stroke="#334155"
                      strokeWidth="1.2"
                    />
                    <text
                      x={cx}
                      y="152"
                      textAnchor="middle"
                      fill="#0F172A"
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
                      fill="#1E293B"
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
                      fill="#0F766E"
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
        <div className="bg-paper border border-rule rounded-xs p-3.5 space-y-2">
          <div className="small-caps-heading">
            Verified REC / IS / CEA / MNRE Engineering Constants ({constants.count} Standards)
          </div>
          <div className="overflow-x-auto border border-rule rounded-xs max-h-[260px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-sheet border-b border-rule font-mono text-[11px] text-ink-2">
                  <th className="py-1.5 px-2.5">Constant Key</th>
                  <th className="py-1.5 px-2.5">Value &amp; Unit</th>
                  <th className="py-1.5 px-2.5">Engineering Description</th>
                  <th className="py-1.5 px-2.5">Standard Citation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {constants.items.map((c) => (
                  <tr key={c.key} className="hover:bg-sheet/50">
                    <td className="py-1.5 px-2.5 font-mono text-[11px] font-semibold text-ink">
                      {c.key}
                    </td>
                    <td className="py-1.5 px-2.5 font-mono text-[11px] text-accent font-semibold">
                      {c.value} {c.unit}
                    </td>
                    <td className="py-1.5 px-2.5 text-[11px] text-ink">{c.description}</td>
                    <td className="py-1.5 px-2.5 font-mono text-[10px] text-ink-2">
                      {c.citation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};

