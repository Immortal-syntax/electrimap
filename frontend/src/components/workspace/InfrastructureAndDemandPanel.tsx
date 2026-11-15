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
import {
  Activity,
  Cable,
  Route,
  Search,
  SlidersHorizontal,
  Upload,
  X,
} from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import { LayerSourceBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Callout } from '../ui/Callout';
import { ConfirmDialog } from '../ui/Dialog';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/Icon';
import { Input } from '../ui/Input';
import { Panel } from '../ui/Panel';
import { QualityTag, QualityTagKind } from '../ui/QualityTag';
import { Select } from '../ui/Select';
import { StatTile } from '../ui/StatTile';
import {
  INFRASTRUCTURE_CATEGORY_META,
  resolveInfraCategoryMeta,
} from '../map/symbology';

export interface InfrastructureAssetDto {
  id: string;
  project_id: string;
  asset_type: string;
  name: string;
  voltage_kv: number | null;
  rating_kva: number | null;
  provenance: string;
  quality_tag: QualityTagKind;
  dataset_id: string | null;
  source_note: string;
  attributes: Record<string, unknown>;
  geojson_geometry: GeoJSON.Geometry;
  updated_at: string;
}

export interface InfrastructureListDto {
  project_id: string;
  has_existing_infra: boolean;
  items: InfrastructureAssetDto[];
  geojson: GeoJSON.FeatureCollection;
}

export interface ClusterGapAnalysisDto {
  cluster_id: string;
  cluster_label: string;
  cluster_name: string;
  est_households: number;
  effective_electrification_class: string;
  nearest_asset_id: string | null;
  nearest_asset_name: string | null;
  nearest_asset_type: string | null;
  nearest_asset_provenance: string | null;
  d_straight_m: number | null;
  d_terrain_m: number | null;
  terrain_penalty_factor: number;
  slope_mean_deg: number;
  canopy_share: number;
  water_crossings_count: number;
  road_distance_m: number | null;
  recommended_modality: string;
  rationale: string;
  corridor_geojson: GeoJSON.Geometry | null;
}

export interface ProjectGapAnalysisDto {
  project_id: string;
  has_existing_infra: boolean;
  infra_assets_count: number;
  assumed_assets_count: number;
  verified_assets_count: number;
  mean_d_straight_m: number | null;
  mean_d_terrain_m: number | null;
  max_d_terrain_m: number | null;
  grid_extension_candidates: number;
  minigrid_candidates: number;
  shs_candidates: number;
  augmentation_candidates: number;
  corridors_geojson: GeoJSON.FeatureCollection;
  clusters: ClusterGapAnalysisDto[];
}

export interface ProjectSettingDto {
  id: string;
  project_id: string;
  key: string;
  category: string;
  label: string;
  value: number;
  default_value: number;
  min_value: number;
  max_value: number;
  unit: string;
  quality_tag: QualityTagKind;
  citation: string;
  is_user_edited: boolean;
  override_note: string | null;
  updated_at: string;
}

export interface ProjectSettingsListDto {
  project_id: string;
  user_edited_count: number;
  items: ProjectSettingDto[];
}

export interface CategoryDemandRowDto {
  category: string;
  label: string;
  consumer_count: number;
  connected_kw: number;
  demand_factor: number;
  max_demand_kw: number;
  daily_hours: number;
  energy_kwh_day: number;
  annual_energy_mwh: number;
}

export interface ClusterDemandDto {
  cluster_id: string;
  cluster_label: string;
  cluster_name: string;
  est_households: number;
  categories: CategoryDemandRowDto[];
  total_connected_kw: number;
  non_coincident_peak_kw: number;
  coincidence_factor: number;
  power_factor_cos_phi: number;
  peak_kw_base: number;
  peak_kva_base: number;
  energy_kwh_day_base: number;
  annual_energy_mwh_base: number;
  horizon_years: number;
  annual_growth_rate: number;
  growth_multiplier: number;
  peak_kw_horizon: number;
  peak_kva_horizon: number;
  energy_kwh_day_horizon: number;
  annual_energy_mwh_horizon: number;
}

export interface ProjectDemandSummaryDto {
  project_id: string;
  total_households: number;
  total_connected_kw: number;
  peak_kw_base: number;
  peak_kva_base: number;
  energy_kwh_day_base: number;
  annual_energy_mwh_base: number;
  horizon_years: number;
  annual_growth_rate: number;
  peak_kw_horizon: number;
  peak_kva_horizon: number;
  energy_kwh_day_horizon: number;
  annual_energy_mwh_horizon: number;
  category_totals: CategoryDemandRowDto[];
  clusters: ClusterDemandDto[];
}

export interface InfrastructureAndDemandPanelProps {
  projectId: string;
  infrastructure: InfrastructureListDto | null;
  gapAnalysis: ProjectGapAnalysisDto | null;
  settings: ProjectSettingsListDto | null;
  demand: ProjectDemandSummaryDto | null;
  placeTieInModeActive: boolean;
  onTogglePlaceTieInMode: () => void;
  onInfrastructureAndDemandUpdated: () => Promise<void>;
}

export const InfrastructureAndDemandPanel: React.FC<
  InfrastructureAndDemandPanelProps
> = ({
  projectId,
  infrastructure,
  gapAnalysis,
  settings,
  demand,
  placeTieInModeActive,
  onTogglePlaceTieInMode,
  onInfrastructureAndDemandUpdated,
}) => {
  const [editedValues, setEditedValues] = useState<Record<string, number>>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [placingRefTieIn, setPlacingRefTieIn] = useState(false);
  const [uploadingGeoJson, setUploadingGeoJson] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [pendingDeleteAsset, setPendingDeleteAsset] =
    useState<InfrastructureAssetDto | null>(null);
  const [confirmResetAssumptions, setConfirmResetAssumptions] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [assetSearch, setAssetSearch] = useState<string>('');
  const [assetCategoryFilter, setAssetCategoryFilter] = useState<string>('ALL');
  const [gapSearch, setGapSearch] = useState<string>('');
  const [modalityFilter, setModalityFilter] = useState<string>('ALL');

  useEffect(() => {
    if (!settings) return;
    const initial: Record<string, number> = {};
    for (const item of settings.items) {
      initial[item.key] = item.value;
    }
    setEditedValues(initial);
  }, [settings]);

  const handlePlaceReferenceTieIn = async () => {
    setPlacingRefTieIn(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await apiRequest(`/api/v1/projects/${projectId}/infrastructure`, {
        method: 'POST',
        body: JSON.stringify({
          asset_type: 'TIE_IN',
          name: 'Nandapur 11 kV Feeder Tap Point (Assumed)',
          voltage_kv: 11.0,
          provenance: 'USER_ASSUMED',
          source_note:
            'Explicit planner-placed assumed 11 kV tie-in point on Nandapur-Padwa road.',
          lon: 82.7265,
          lat: 18.5645,
        }),
      });
      await onInfrastructureAndDemandUpdated();
      setStatusMessage(
        'Placed explicit USER_ASSUMED 11 kV tie-in point and recomputed UTM terrain gap matrix.',
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to place tie-in point.',
      );
    } finally {
      setPlacingRefTieIn(false);
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    setDeletingAssetId(assetId);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await apiRequest(`/api/v1/projects/${projectId}/infrastructure/${assetId}`, {
        method: 'DELETE',
      });
      await onInfrastructureAndDemandUpdated();
      setStatusMessage('Removed infrastructure asset and updated gap analysis.');
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to delete infrastructure asset.',
      );
    } finally {
      setDeletingAssetId(null);
    }
  };

  const handleUploadInfraGeoJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingGeoJson(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('provenance', 'UTILITY_RECORD');
      fd.append('source_note', `Uploaded utility GIS file: ${file.name}`);
      await apiRequest(`/api/v1/projects/${projectId}/infrastructure/upload`, {
        method: 'POST',
        body: fd,
      });
      await onInfrastructureAndDemandUpdated();
      setStatusMessage(`Uploaded utility GIS infrastructure file '${file.name}'.`);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Infrastructure GeoJSON upload failed.',
      );
    } finally {
      setUploadingGeoJson(false);
      e.target.value = '';
    }
  };

  const handleSaveAssumptions = async () => {
    if (!settings) return;
    setSavingSettings(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const updates = settings.items.map((item) => ({
        key: item.key,
        value: editedValues[item.key] ?? item.value,
      }));
      await apiRequest(`/api/v1/projects/${projectId}/settings`, {
        method: 'PATCH',
        body: JSON.stringify({ updates }),
      });
      await apiRequest(`/api/v1/projects/${projectId}/demand/calculate`, {
        method: 'POST',
      });
      await onInfrastructureAndDemandUpdated();
      setStatusMessage(
        'Saved assumption overrides (tagged USER_ENTERED) and recalculated 7-category demand.',
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to save project assumptions.',
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetAssumptions = async () => {
    setSavingSettings(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await apiRequest(`/api/v1/projects/${projectId}/settings/reset`, {
        method: 'POST',
      });
      await apiRequest(`/api/v1/projects/${projectId}/demand/calculate`, {
        method: 'POST',
      });
      await onInfrastructureAndDemandUpdated();
      setStatusMessage(
        'Reset all engineering assumptions to normative REC/CEA defaults and recalculated demand.',
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to reset project assumptions.',
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const hasInfra = infrastructure?.has_existing_infra ?? false;

  const filteredAssets = useMemo(() => {
    const q = assetSearch.trim().toLowerCase();
    return (infrastructure?.items ?? []).filter((asset) => {
      if (q && !`${asset.name} ${asset.asset_type} ${asset.source_note}`.toLowerCase().includes(q)) {
        return false;
      }
      if (assetCategoryFilter === 'ALL') return true;
      const upper = asset.asset_type.toUpperCase();
      if (assetCategoryFilter === 'TIE_IN') {
        return upper === 'TIE_IN' || asset.provenance === 'USER_ASSUMED';
      }
      if (assetCategoryFilter === 'SUBSTATION') {
        return upper.includes('SUBSTATION');
      }
      if (assetCategoryFilter === 'DT') {
        return upper === 'DT' || upper === 'TRANSFORMER';
      }
      if (assetCategoryFilter === 'LINE') {
        return upper.includes('LINE');
      }
      if (assetCategoryFilter === 'POLE_TOWER') {
        return upper === 'POLE' || upper === 'TOWER';
      }
      return true;
    });
  }, [infrastructure?.items, assetSearch, assetCategoryFilter]);

  const filteredGapClusters = useMemo(() => {
    const q = gapSearch.trim().toLowerCase();
    return (gapAnalysis?.clusters ?? []).filter((g) => {
      if (q && !`${g.cluster_label} ${g.cluster_name} ${g.nearest_asset_name ?? ''}`.toLowerCase().includes(q)) {
        return false;
      }
      if (modalityFilter === 'ALL') return true;
      return g.recommended_modality.toUpperCase().includes(modalityFilter);
    });
  }, [gapAnalysis?.clusters, gapSearch, modalityFilter]);

  return (
    <Panel
      aria-label="Infrastructure Gap Analysis and Demand Engine"
      overline="Step 3 · Infrastructure Gaps & Demand"
      title="Existing Infrastructure, Terrain Gap Matrix, Assumptions Register & 7-Category Demand Engine"
      subtitle="Enforces Core Principle #4 (no fabricated infrastructure), computes UTM (EPSG:32644) terrain-weighted feeder distances, and models 7-category rural demand over the planning horizon."
      icon={Cable}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={placeTieInModeActive ? 'primary' : 'secondary'}
            onClick={onTogglePlaceTieInMode}
          >
            {placeTieInModeActive
              ? '✓ Click Map to Place Tie-In (Cancel)'
              : '+ Place Assumed 11 kV Tie-In on Map'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            isLoading={placingRefTieIn}
            loadingText="Placing Tie-In…"
            onClick={() => void handlePlaceReferenceTieIn()}
          >
            Place Reference Nandapur 11 kV Tap (USER_ASSUMED)
          </Button>
          <label className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-paper border border-rule-strong rounded-xs cursor-pointer hover:bg-sheet transition-colors">
            <Icon icon={Upload} size="xs" className="text-ink-2" />
            <span>{uploadingGeoJson ? 'Uploading…' : 'Upload Utility GIS (.geojson)'}</span>
            <input
              type="file"
              accept=".geojson,.json"
              aria-label="Upload Utility GIS"
              disabled={uploadingGeoJson}
              onChange={(e) => void handleUploadInfraGeoJson(e)}
              className="sr-only"
            />
          </label>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Phase 5: Electricity Infrastructure Symbology & Data-Source Reference Bar */}
        <div className="p-3.5 bg-paper border border-rule-subtle rounded-xs space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-ink">
                Electricity Infrastructure Symbology &amp; Data Provenance Key
              </span>
              <LayerSourceBadge source={hasInfra ? 'PROJECT' : 'REFERENCE_DEMO'} />
            </div>
            <span className="text-xs text-ink-2">
              Solid = Existing / Mapped Grid · Dashed = Preliminary Proposed (Layer F)
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-2 pt-2 border-t border-rule-subtle">
            {[
              INFRASTRUCTURE_CATEGORY_META.SUBSTATION_33_11KV,
              INFRASTRUCTURE_CATEGORY_META.LINE_33KV_EXISTING,
              INFRASTRUCTURE_CATEGORY_META.LINE_11KV_EXISTING,
              INFRASTRUCTURE_CATEGORY_META.DT_EXISTING,
              INFRASTRUCTURE_CATEGORY_META.TIE_IN_ASSUMED,
              INFRASTRUCTURE_CATEGORY_META.TOWER_33KV,
              INFRASTRUCTURE_CATEGORY_META.POLE_11KV,
            ].map((spec) => (
              <span
                key={spec.code}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sheet border border-rule-subtle rounded-xs"
                title={spec.description}
              >
                {spec.geometryKind === 'LINE' ? (
                  <span
                    className="w-4 h-0 inline-block shrink-0"
                    style={{
                      borderBottomWidth: `${Math.max(2, Math.round(spec.lineWidthPx ?? 3))}px`,
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
          <p className="text-[11px] text-ink-2 leading-snug">
            <strong className="text-ink">Contextual Note:</strong> 33 kV lines carry bulk power to
            33/11 kV primary substations; 11 kV feeders supply village distribution transformers
            (DTs); 415 V LT cables connect households. Incomplete OpenStreetMap or utility GIS records
            never prove that physical lines are absent on the ground.
          </p>
        </div>

        {errorMessage && (
          <Callout tone="error" title="Infrastructure / Demand Error">
            {errorMessage}
          </Callout>
        )}
        {statusMessage && (
          <Callout tone="info" title="Infrastructure & Demand Update">
            {statusMessage}
          </Callout>
        )}

        {/* Honest Warning when no infrastructure is present */}
        {!hasInfra && (
          <Callout
            tone="warn"
            title="Existing Electrical Infrastructure UNSET (Core Principle #4 — Zero Fabricated Lines)"
          >
            No utility 11 kV/LT lines, Distribution Transformers, or tie-in points have been uploaded
            or placed yet. Consistent with epistemic honesty rules, <code>d_straight_m</code> and{' '}
            <code>d_terrain_m</code> remain <strong>UNSET</strong> rather than invented. Click{' '}
            <strong>Place Reference Nandapur 11 kV Tap (USER_ASSUMED)</strong>, click on the map,
            or upload a utility GeoJSON file to compute grid extension distances.
          </Callout>
        )}

        {/* Existing Infrastructure Assets Table */}
        {hasInfra && infrastructure && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="small-caps-heading">
                Registered Existing Infrastructure &amp; Tie-In Points ({filteredAssets.length} of{' '}
                {infrastructure.items.length} Assets)
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="search"
                  size="sm"
                  leftIcon={Search}
                  aria-label="Search registered infrastructure assets"
                  placeholder="Search asset name or note..."
                  value={assetSearch}
                  onChange={(e) => setAssetSearch(e.target.value)}
                  containerClassName="w-52"
                />
                <div className="flex items-center gap-1.5">
                  <label
                    htmlFor="asset-category-filter-select"
                    className="font-mono text-[11px] text-ink-2 whitespace-nowrap"
                  >
                    Filter Category:
                  </label>
                  <Select
                    id="asset-category-filter-select"
                    aria-label="Filter registered infrastructure assets by category"
                    size="sm"
                    mono
                    value={assetCategoryFilter}
                    onChange={(e) => setAssetCategoryFilter(e.target.value)}
                    options={[
                      {
                        value: 'ALL',
                        label: `All Asset Categories (${infrastructure.items.length})`,
                      },
                      { value: 'TIE_IN', label: 'Assumed 11 kV Tie-In Points' },
                      { value: 'SUBSTATION', label: '33/11 kV Substations' },
                      { value: 'DT', label: 'Distribution Transformers (DT)' },
                      { value: 'LINE', label: '33 kV / 11 kV Power Lines' },
                      { value: 'POLE_TOWER', label: 'Towers & Poles' },
                    ]}
                  />
                </div>
                {(assetSearch || assetCategoryFilter !== 'ALL') && (
                  <Button
                    size="xs"
                    variant="ghost"
                    leftIcon={X}
                    onClick={() => {
                      setAssetSearch('');
                      setAssetCategoryFilter('ALL');
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {filteredAssets.length === 0 ? (
              <EmptyState
                compact
                icon={Search}
                title={`No Registered Infrastructure Match (${assetCategoryFilter})`}
                description="Clear the search or category filter to view all registered assets."
                action={
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => {
                      setAssetSearch('');
                      setAssetCategoryFilter('ALL');
                    }}
                  >
                    Show All Assets
                  </Button>
                }
              />
            ) : (
              <div className="table-scroll-container">
                <table className="w-full text-left border-collapse text-body-sm">
                  <thead>
                    <tr className="bg-subtle border-b border-rule text-xs font-semibold text-ink-2">
                      <th className="py-2 px-2.5">Asset Type &amp; Symbology</th>
                      <th className="py-2 px-2.5">Asset Name</th>
                      <th className="py-2 px-2.5">Voltage / Rating</th>
                      <th className="py-2 px-2.5">Provenance &amp; Quality</th>
                      <th className="py-2 px-2.5">Source Note</th>
                      <th className="py-2 px-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule-subtle">
                    {filteredAssets.map((asset) => {
                      const spec = resolveInfraCategoryMeta(
                        asset.asset_type,
                        asset.provenance,
                        asset.voltage_kv,
                      );
                      return (
                        <tr
                          key={asset.id}
                          className="hover:bg-surface-hover"
                          title={`${spec.label} — ${spec.description}`}
                        >
                          <td className="py-2 px-2.5 font-mono text-xs font-semibold text-ink">
                            <span className="inline-flex items-center gap-2">
                              {spec.geometryKind === 'LINE' ? (
                                <span
                                  className="w-4 h-0 inline-block shrink-0"
                                  style={{
                                    borderBottomWidth: '3px',
                                    borderBottomStyle: 'solid',
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
                              <span>{asset.asset_type}</span>
                            </span>
                          </td>
                          <td className="py-2 px-2.5 font-medium text-ink">{asset.name}</td>
                          <td className="py-2 px-2.5 font-mono text-xs tabular-nums">
                            {asset.voltage_kv ? `${asset.voltage_kv} kV` : '—'}
                            {asset.rating_kva ? ` · ${asset.rating_kva} kVA` : ''}
                          </td>
                          <td className="py-2 px-2.5">
                            <QualityTag
                              kind={asset.quality_tag}
                              label={`${asset.provenance}`}
                            />
                          </td>
                          <td className="py-2 px-2.5 text-xs text-ink-2">
                            {asset.source_note}
                          </td>
                          <td className="py-2 px-2.5 text-right">
                            <Button
                              size="xs"
                              variant="danger-outline"
                              disabled={deletingAssetId === asset.id}
                              onClick={() => setPendingDeleteAsset(asset)}
                            >
                              {deletingAssetId === asset.id ? 'Removing…' : 'Remove'}
                            </Button>
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

        {/* Terrain-Weighted Distance & Obstacle Gap Analysis Matrix */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="small-caps-heading flex items-center gap-1.5">
              <Icon icon={Route} size="xs" className="text-ink-2" />
              <span>
                Terrain-Weighted Distance &amp; Obstacle Gap Analysis Matrix (UTM EPSG:32644)
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {gapAnalysis && gapAnalysis.has_existing_infra && (
                <div className="font-mono text-[11px] text-ink-2">
                  Mean Straight: <strong>{gapAnalysis.mean_d_straight_m} m</strong> · Mean
                  Terrain: <strong>{gapAnalysis.mean_d_terrain_m} m</strong> · Grid Ext.:{' '}
                  <strong>{gapAnalysis.grid_extension_candidates}</strong> · Mini-Grid:{' '}
                  <strong>{gapAnalysis.minigrid_candidates}</strong> · SHS:{' '}
                  <strong>{gapAnalysis.shs_candidates}</strong>
                </div>
              )}
              <Input
                type="search"
                size="sm"
                leftIcon={Search}
                aria-label="Search gap matrix clusters"
                placeholder="Search cluster..."
                value={gapSearch}
                onChange={(e) => setGapSearch(e.target.value)}
                containerClassName="w-44"
              />
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="gap-modality-filter-select"
                  className="font-mono text-[11px] text-ink-2 whitespace-nowrap"
                >
                  Modality Filter:
                </label>
                <Select
                  id="gap-modality-filter-select"
                  aria-label="Filter gap analysis matrix by recommended modality"
                  size="sm"
                  mono
                  value={modalityFilter}
                  onChange={(e) => setModalityFilter(e.target.value)}
                  options={[
                    {
                      value: 'ALL',
                      label: `All Modalities (${gapAnalysis?.clusters.length ?? 0})`,
                    },
                    { value: 'GRID', label: 'Grid Extension / Augmentation' },
                    { value: 'MINIGRID', label: 'Solar PV Mini-Grid' },
                    { value: 'SHS', label: 'Standalone Solar Home Systems (SHS)' },
                  ]}
                />
              </div>
            </div>
          </div>

          {!gapAnalysis || gapAnalysis.clusters.length === 0 ? (
            <EmptyState
              compact
              icon={Route}
              title="No Terrain Gap Matrix Rows Computed"
              description="Run Step 2 DBSCAN habitation clustering to evaluate terrain-weighted feeder distances and obstacle penalties."
            />
          ) : filteredGapClusters.length === 0 ? (
            <EmptyState
              compact
              icon={Search}
              title="No Matching Gap Matrix Clusters"
              description={`No habitation clusters match modality filter ${modalityFilter}${gapSearch ? ` and query "${gapSearch}"` : ''}.`}
              action={
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => {
                    setModalityFilter('ALL');
                    setGapSearch('');
                  }}
                >
                  Show All Clusters
                </Button>
              }
            />
          ) : (
            <div className="table-scroll-container">
              <table className="w-full text-left border-collapse text-body-sm">
                <thead>
                  <tr className="bg-subtle border-b border-rule text-xs font-semibold text-ink-2">
                    <th className="py-2 px-2.5">Cluster</th>
                    <th className="py-2 px-2.5">Nearest Tie-In / Asset</th>
                    <th className="py-2 px-2.5">Straight (m)</th>
                    <th className="py-2 px-2.5">Terrain Penalty</th>
                    <th className="py-2 px-2.5">Terrain Dist (m)</th>
                    <th className="py-2 px-2.5">Obstacles</th>
                    <th className="py-2 px-2.5">Preliminary Modality Affinity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule-subtle">
                  {filteredGapClusters.map((g) => (
                    <tr key={g.cluster_id} className="hover:bg-surface-hover">
                      <td className="py-2 px-2.5 font-semibold text-ink text-xs">
                        {g.cluster_label} · {g.cluster_name} ({g.est_households} HH)
                      </td>
                      <td className="py-2 px-2.5 text-xs">
                        {g.nearest_asset_name ? (
                          <span>
                            {g.nearest_asset_name}{' '}
                            <span className="text-ink-2">
                              ({g.nearest_asset_provenance})
                            </span>
                          </span>
                        ) : (
                          <span className="font-mono text-warn font-semibold">UNSET</span>
                        )}
                      </td>
                      <td className="py-2 px-2.5 font-mono text-xs tabular-nums">
                        {g.d_straight_m !== null ? `${g.d_straight_m.toFixed(0)} m` : 'UNSET'}
                      </td>
                      <td className="py-2 px-2.5 font-mono text-xs tabular-nums">
                        {g.terrain_penalty_factor.toFixed(2)}×
                      </td>
                      <td className="py-2 px-2.5 font-mono text-xs tabular-nums font-semibold">
                        {g.d_terrain_m !== null ? `${g.d_terrain_m.toFixed(0)} m` : 'UNSET'}
                      </td>
                      <td className="py-2 px-2.5 text-xs tabular-nums text-ink-2">
                        {g.slope_mean_deg.toFixed(1)}° · {(g.canopy_share * 100).toFixed(0)}%
                        canopy · {g.water_crossings_count} water x-ing
                      </td>
                      <td className="py-2 px-2.5">
                        <span className="text-xs px-2 py-0.5 rounded-xs border border-rule bg-paper font-semibold text-ink whitespace-nowrap">
                          {g.recommended_modality}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Split Grid: Project Assumptions Register + 7-Category Parametric Demand Engine */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-3 border-t border-rule">
          {/* Left 5 cols: Project Assumptions Register */}
          <div className="lg:col-span-5 bg-paper border border-rule rounded-xs p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule pb-2">
              <div>
                <span className="small-caps-heading flex items-center gap-1.5">
                  <Icon icon={SlidersHorizontal} size="xs" className="text-ink-2" />
                  <span>
                    Project Assumptions Register ({settings?.user_edited_count ?? 0} Overrides)
                  </span>
                </span>
                <span className="text-[11px] text-ink-2">
                  Normative REC / CEA / ESMAP MTF parameters
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={savingSettings || !settings || settings.items.length === 0}
                  onClick={() => setConfirmResetAssumptions(true)}
                >
                  Reset Defaults
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  isLoading={savingSettings}
                  loadingText="Saving…"
                  disabled={!settings || settings.items.length === 0}
                  onClick={() => void handleSaveAssumptions()}
                >
                  Save &amp; Recalculate
                </Button>
              </div>
            </div>

            {!settings || settings.items.length === 0 ? (
              <EmptyState
                compact
                icon={SlidersHorizontal}
                title="No Project Assumptions Loaded"
                description="Assumptions register populates once project metadata initializes."
              />
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {settings.items.map((item) => {
                  const currentVal = editedValues[item.key] ?? item.value;
                  return (
                    <div
                      key={item.key}
                      className="p-2.5 bg-sheet border border-rule rounded-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor={`setting-${item.key}`}
                          className="text-xs font-medium text-ink"
                        >
                          {item.label}
                        </label>
                        <QualityTag
                          kind={item.is_user_edited ? 'USER_ENTERED' : 'ESTIMATED'}
                          label={
                            item.is_user_edited
                              ? 'USER_ENTERED'
                              : `DEFAULT: ${item.default_value}`
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-[11px] text-ink-2 truncate"
                          title={`${item.citation} (Allowed: ${item.min_value}–${item.max_value} ${item.unit})`}
                        >
                          {item.citation}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Input
                            id={`setting-${item.key}`}
                            size="sm"
                            type="number"
                            step="any"
                            min={item.min_value}
                            max={item.max_value}
                            mono
                            unit={item.unit}
                            value={currentVal}
                            onChange={(e) =>
                              setEditedValues((prev) => ({
                                ...prev,
                                [item.key]: Number(e.target.value),
                              }))
                            }
                            containerClassName="w-32"
                            className="text-right"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right 7 cols: 7-Category Parametric Electricity Demand Forecast */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="small-caps-heading flex items-center gap-1.5">
                  <Icon icon={Activity} size="xs" className="text-accent" />
                  <span>
                    7-Category Parametric Electricity Demand &amp; {demand?.horizon_years ?? 10}
                    -Year Horizon Forecast
                  </span>
                </span>
                <span className="text-[11px] text-ink-2">
                  Coincident peak demand computed at cos φ = 0.85 lag and{' '}
                  {((demand?.annual_growth_rate ?? 0.045) * 100).toFixed(1)}%/yr compound load
                  growth
                </span>
              </div>
            </div>

            {demand ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <StatTile
                    label="Total Connected Load"
                    value={demand.total_connected_kw.toFixed(2)}
                    unit="kW"
                    quality="ESTIMATED"
                    subtitle={`${demand.total_households} Total HH`}
                  />
                  <StatTile
                    label="Base Coincident Peak"
                    value={demand.peak_kva_base.toFixed(2)}
                    unit="kVA"
                    quality="ESTIMATED"
                    subtitle={`${demand.peak_kw_base.toFixed(2)} kW`}
                  />
                  <StatTile
                    label={`Horizon Peak (+${demand.horizon_years} Yrs)`}
                    value={`${demand.peak_kva_horizon.toFixed(2)} kVA`}
                    quality="ESTIMATED"
                    tone="accent"
                    subtitle={`${demand.peak_kw_horizon.toFixed(2)} kW design`}
                  />
                  <StatTile
                    label="Annual Energy"
                    value={`${demand.annual_energy_mwh_base.toFixed(1)} → ${demand.annual_energy_mwh_horizon.toFixed(1)}`}
                    unit="MWh/yr"
                    quality="ESTIMATED"
                    subtitle="Base → Horizon"
                  />
                </div>

                <div className="table-scroll-container">
                  <table className="w-full text-left border-collapse text-body-sm">
                    <thead>
                      <tr className="bg-subtle border-b border-rule text-xs font-semibold text-ink-2">
                        <th className="py-2 px-2.5">Consumer Category</th>
                        <th className="py-2 px-2.5">Units</th>
                        <th className="py-2 px-2.5">Connected (kW)</th>
                        <th className="py-2 px-2.5">Max Demand (kW)</th>
                        <th className="py-2 px-2.5">Daily (kWh/d)</th>
                        <th className="py-2 px-2.5">Annual (MWh/yr)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rule-subtle">
                      {demand.category_totals.map((cat) => (
                        <tr key={cat.category} className="hover:bg-surface-hover">
                          <td className="py-2 px-2.5 font-medium text-ink">{cat.label}</td>
                          <td className="py-2 px-2.5 font-mono text-xs tabular-nums">
                            {cat.consumer_count}
                          </td>
                          <td className="py-2 px-2.5 font-mono text-xs tabular-nums">
                            {cat.connected_kw.toFixed(2)}
                          </td>
                          <td className="py-2 px-2.5 font-mono text-xs tabular-nums">
                            {cat.max_demand_kw.toFixed(2)}
                          </td>
                          <td className="py-2 px-2.5 font-mono text-xs tabular-nums">
                            {cat.energy_kwh_day.toFixed(1)}
                          </td>
                          <td className="py-2 px-2.5 font-mono text-xs tabular-nums font-semibold">
                            {cat.annual_energy_mwh.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <EmptyState
                compact
                icon={Activity}
                title="Demand Forecast Not Computed Yet"
                description="Save or reset project assumptions, or complete Step 2 habitation clustering to compute the 7-category load forecast."
              />
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog: Remove Registered Infrastructure Asset */}
      <ConfirmDialog
        open={pendingDeleteAsset !== null}
        onClose={() => setPendingDeleteAsset(null)}
        onConfirm={() => {
          if (!pendingDeleteAsset) return;
          const id = pendingDeleteAsset.id;
          setPendingDeleteAsset(null);
          void handleDeleteAsset(id);
        }}
        title="Remove Registered Infrastructure Asset?"
        description={
          pendingDeleteAsset ? (
            <div className="space-y-1">
              <p>
                Remove <strong>{pendingDeleteAsset.name}</strong> (
                <code className="code-pill">{pendingDeleteAsset.asset_type}</code>)?
              </p>
              <p className="text-2xs text-ink-3 font-mono">
                Terrain gap distances (d_straight_m, d_terrain_m) will be recomputed immediately
                across all habitation clusters.
              </p>
            </div>
          ) : null
        }
        confirmLabel="Remove Asset"
        variant="danger"
        isLoading={deletingAssetId !== null}
      />

      {/* Confirmation Dialog: Reset Assumptions Register */}
      <ConfirmDialog
        open={confirmResetAssumptions}
        onClose={() => setConfirmResetAssumptions(false)}
        onConfirm={() => {
          setConfirmResetAssumptions(false);
          void handleResetAssumptions();
        }}
        title="Reset All Assumptions to Normative REC / CEA Defaults?"
        description="This reverts every USER_ENTERED assumption override back to its normative REC/CEA default and recalculates the 7-category demand forecast."
        confirmLabel="Reset Defaults"
        variant="danger"
        isLoading={savingSettings}
      />
    </Panel>
  );
};
