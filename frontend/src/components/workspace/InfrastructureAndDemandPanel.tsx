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
  Download,
  Route,
  Search,
  SlidersHorizontal,
  Upload,
  X,
} from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import { formatModalityLabel } from '../../lib/beginnerGlossary';
import { DEMO_PROJECT_ID } from '../layout/navigationConfig';
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
import { HelpTooltip } from '../ui/Tooltip';
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
  metricEpsg?: number;
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
  metricEpsg,
  infrastructure,
  gapAnalysis,
  settings,
  demand,
  placeTieInModeActive,
  onTogglePlaceTieInMode,
  onInfrastructureAndDemandUpdated,
}) => {
  const isDemoProject = projectId === DEMO_PROJECT_ID;
  const utmLabel = metricEpsg ? `UTM (EPSG:${metricEpsg})` : 'Local UTM';
  const powerFactorVal =
    settings?.items.find(
      (item) => item.key === 'power_factor_cos_phi' || item.key === 'power_factor',
    )?.value ?? 0.85;
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
        'Added assumed 11 kV starting connection point and updated terrain distances.',
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to place connection point.',
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
      setStatusMessage('Removed power asset and updated village distance table.');
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to remove power asset.',
      );
    } finally {
      setDeletingAssetId(null);
    }
  };

  const handleDownloadSampleInfraGeoJson = () => {
    const sample = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            asset_type: 'TIE_IN',
            name: 'Sample 11 kV Connection Point',
            voltage_kv: 11.0,
          },
          geometry: {
            type: 'Point',
            coordinates: [82.7265, 18.5645],
          },
        },
        {
          type: 'Feature',
          properties: {
            asset_type: 'LINE_11KV',
            name: 'Sample Existing 11 kV Feeder Line',
            voltage_kv: 11.0,
          },
          geometry: {
            type: 'LineString',
            coordinates: [
              [82.722, 18.562],
              [82.7265, 18.5645],
            ],
          },
        },
      ],
    };
    const blob = new Blob([JSON.stringify(sample, null, 2)], {
      type: 'application/geo+json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_power_lines.geojson';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
      setStatusMessage(`Uploaded power grid map file '${file.name}'.`);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Power grid GeoJSON upload failed.',
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
      overline="Step 3 · Power Grid & Electricity Demand"
      title={
        <span className="inline-flex items-center gap-1.5">
          <span>Existing Power Lines, Distance Gaps &amp; Electricity Demand</span>
          <HelpTooltip glossaryKey="existingLinesDt" />
        </span>
      }
      subtitle={`Add existing power lines or mark a starting connection point on the map so ElectriMap can measure real walking/terrain distance (${utmLabel}) and forecast community electricity demand.`}
      icon={Cable}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={placeTieInModeActive ? 'primary' : 'secondary'}
            onClick={onTogglePlaceTieInMode}
          >
            {placeTieInModeActive
              ? '✓ Click Map to Mark Starting Point (Cancel)'
              : '+ Click Map to Mark Starting Point'}
          </Button>
          {isDemoProject && (
            <Button
              size="sm"
              variant="secondary"
              isLoading={placingRefTieIn}
              loadingText="Adding Point…"
              onClick={() => void handlePlaceReferenceTieIn()}
            >
              Add Sample Connection Point (Assumed)
            </Button>
          )}
          <label className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-paper border border-rule-strong rounded-xs cursor-pointer hover:bg-sheet transition-colors">
            <Icon icon={Upload} size="xs" className="text-ink-2" />
            <span>{uploadingGeoJson ? 'Uploading…' : 'Upload Power Grid (.geojson)'}</span>
            <input
              type="file"
              accept=".geojson,.json"
              aria-label="Upload Utility GIS"
              disabled={uploadingGeoJson}
              onChange={(e) => void handleUploadInfraGeoJson(e)}
              className="sr-only"
            />
          </label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            leftIcon={Download}
            onClick={handleDownloadSampleInfraGeoJson}
          >
            Sample GeoJSON
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Phase 5: Electricity Infrastructure Symbology & Data-Source Reference Bar */}
        <div className="p-3.5 bg-paper border border-rule-subtle rounded-xs space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-ink">
                Power Grid Map Legend &amp; Data Source Key
              </span>
              <LayerSourceBadge source={hasInfra ? 'PROJECT' : 'REFERENCE_DEMO'} />
            </div>
            <span className="text-xs text-ink-2">
              Solid line = Existing grid · Dashed line = Planned new line
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
            <strong className="text-ink">How power reaches villages:</strong> Regional 33 kV lines
            feed main substations, 11 kV lines carry power to villages, and 415 V cables supply
            homes. Missing public map data never proves real power lines are absent on the ground.
          </p>
        </div>

        {errorMessage && (
          <Callout tone="error" title="Power Grid / Demand Error">
            {errorMessage}
          </Callout>
        )}
        {statusMessage && (
          <Callout tone="info" title="Power Grid & Demand Updated">
            {statusMessage}
          </Callout>
        )}

        {/* Honest Warning when no infrastructure is present */}
        {!hasInfra && (
          <Callout
            tone="warn"
            title="No Existing Power Lines Added Yet — Grid Distances Not Measured"
          >
            <div className="space-y-1.5">
              <p>
                ElectriMap never invents fake power lines. Because no utility lines, transformers,
                or starting tap points are added yet, straight and terrain distances stay{' '}
                <strong>Not measured</strong> until you provide a starting point.{' '}
                <HelpTooltip glossaryKey="tiedInPoint" />
              </p>
              <p>
                {isDemoProject ? (
                  <>
                    Click <strong>Add Sample Connection Point (Assumed)</strong>, click on the map,
                    or upload a <code>.geojson</code> file above (download{' '}
                    <strong>Sample GeoJSON</strong> to see the format).
                  </>
                ) : (
                  <>
                    Click <strong>+ Click Map to Mark Starting Point</strong> or upload a{' '}
                    <code>.geojson</code> utility file above (download{' '}
                    <strong>Sample GeoJSON</strong> to see the format).
                  </>
                )}
              </p>
            </div>
          </Callout>
        )}

        {/* Existing Infrastructure Assets Table */}
        {hasInfra && infrastructure && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="small-caps-heading">
                Added Power Grid Assets &amp; Starting Points ({filteredAssets.length} of{' '}
                {infrastructure.items.length})
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
                    Filter:
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
                        label: `All Asset Types (${infrastructure.items.length})`,
                      },
                      { value: 'TIE_IN', label: 'Assumed 11 kV Connection Points' },
                      { value: 'SUBSTATION', label: '33/11 kV Substations' },
                      { value: 'DT', label: 'Village Transformers (DT)' },
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
                title={`No Matching Power Assets (${assetCategoryFilter})`}
                description="Clear the search or category filter to view all added power assets."
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
                      <th className="py-2 px-2.5">Asset Type &amp; Symbol</th>
                      <th className="py-2 px-2.5">Asset Name</th>
                      <th className="py-2 px-2.5">Voltage / Capacity</th>
                      <th className="py-2 px-2.5">Source &amp; Status</th>
                      <th className="py-2 px-2.5">Note</th>
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
                      const provenanceLabel =
                        asset.provenance === 'USER_ASSUMED'
                          ? 'Assumed Point'
                          : asset.provenance === 'UTILITY_RECORD'
                            ? 'Uploaded Utility Map'
                            : asset.provenance;
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
                              <span>{spec.shortLabel}</span>
                            </span>
                          </td>
                          <td className="py-2 px-2.5 font-medium text-ink">{asset.name}</td>
                          <td className="py-2 px-2.5 font-mono text-xs tabular-nums">
                            {asset.voltage_kv ? `${asset.voltage_kv} kV` : '—'}
                            {asset.rating_kva ? ` · ${asset.rating_kva} kVA` : ''}
                          </td>
                          <td className="py-2 px-2.5">
                            <QualityTag kind={asset.quality_tag} label={provenanceLabel} />
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
              <span>Distance to Grid &amp; Suggested Supply Option ({utmLabel})</span>
              <HelpTooltip glossaryKey="terrainCostSurface" />
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {gapAnalysis && gapAnalysis.has_existing_infra && (
                <div className="font-mono text-[11px] text-ink-2">
                  Straight Avg:{' '}
                  <strong>
                    {gapAnalysis.mean_d_straight_m !== null &&
                    gapAnalysis.mean_d_straight_m !== undefined
                      ? `${gapAnalysis.mean_d_straight_m} m`
                      : 'Unset'}
                  </strong>{' '}
                  · Terrain Avg:{' '}
                  <strong>
                    {gapAnalysis.mean_d_terrain_m !== null &&
                    gapAnalysis.mean_d_terrain_m !== undefined
                      ? `${gapAnalysis.mean_d_terrain_m} m`
                      : 'Unset'}
                  </strong>{' '}
                  · Grid:{' '}
                  <strong>{gapAnalysis.grid_extension_candidates}</strong> · Mini-Grid:{' '}
                  <strong>{gapAnalysis.minigrid_candidates}</strong> · Home Solar:{' '}
                  <strong>{gapAnalysis.shs_candidates}</strong>
                </div>
              )}
              <Input
                type="search"
                size="sm"
                leftIcon={Search}
                aria-label="Search gap matrix clusters"
                placeholder="Search village..."
                value={gapSearch}
                onChange={(e) => setGapSearch(e.target.value)}
                containerClassName="w-44"
              />
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="gap-modality-filter-select"
                  className="font-mono text-[11px] text-ink-2 whitespace-nowrap"
                >
                  Option:
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
                      label: `All Options (${gapAnalysis?.clusters.length ?? 0})`,
                    },
                    { value: 'GRID', label: 'Grid Extension / Upgrade' },
                    { value: 'MINIGRID', label: 'Solar Mini-Grid' },
                    { value: 'SHS', label: 'Home Solar Systems' },
                  ]}
                />
              </div>
            </div>
          </div>

          {!gapAnalysis || gapAnalysis.clusters.length === 0 ? (
            <EmptyState
              compact
              icon={Route}
              title="No Village Distances Calculated Yet"
              description="Group homes into village clusters in Step 2 first to calculate distances and terrain difficulty."
            />
          ) : filteredGapClusters.length === 0 ? (
            <EmptyState
              compact
              icon={Search}
              title="No Matching Village Rows"
              description={`No village clusters match filter "${modalityFilter}"${gapSearch ? ` and search "${gapSearch}"` : ''}.`}
              action={
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => {
                    setModalityFilter('ALL');
                    setGapSearch('');
                  }}
                >
                  Show All Villages
                </Button>
              }
            />
          ) : (
            <div className="table-scroll-container">
              <table className="w-full text-left border-collapse text-body-sm">
                <thead>
                  <tr className="bg-subtle border-b border-rule text-xs font-semibold text-ink-2">
                    <th className="py-2 px-2.5">Village Cluster</th>
                    <th className="py-2 px-2.5">Nearest Grid Point</th>
                    <th className="py-2 px-2.5">Straight Dist.</th>
                    <th className="py-2 px-2.5">Terrain Factor</th>
                    <th className="py-2 px-2.5">Effective Dist.</th>
                    <th className="py-2 px-2.5">Slope, Trees &amp; Rivers</th>
                    <th className="py-2 px-2.5">
                      <span className="inline-flex items-center gap-1">
                        <span>Suggested Supply Option</span>
                        <HelpTooltip glossaryKey="distributionModality" />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule-subtle">
                  {filteredGapClusters.map((g) => (
                    <tr key={g.cluster_id} className="hover:bg-surface-hover">
                      <td className="py-2 px-2.5 font-semibold text-ink text-xs">
                        {g.cluster_label} · {g.cluster_name} ({g.est_households} homes)
                      </td>
                      <td className="py-2 px-2.5 text-xs">
                        {g.nearest_asset_name ? (
                          <span>
                            {g.nearest_asset_name}{' '}
                            <span className="text-ink-2">
                              (
                              {g.nearest_asset_provenance === 'USER_ASSUMED'
                                ? 'Assumed'
                                : g.nearest_asset_provenance === 'UTILITY_RECORD'
                                  ? 'Utility Map'
                                  : g.nearest_asset_provenance}
                              )
                            </span>
                          </span>
                        ) : (
                          <span className="font-mono text-warn font-semibold">Not set</span>
                        )}
                      </td>
                      <td className="py-2 px-2.5 font-mono text-xs tabular-nums">
                        {g.d_straight_m !== null ? `${g.d_straight_m.toFixed(0)} m` : 'Not set'}
                      </td>
                      <td className="py-2 px-2.5 font-mono text-xs tabular-nums">
                        {g.terrain_penalty_factor.toFixed(2)}×
                      </td>
                      <td className="py-2 px-2.5 font-mono text-xs tabular-nums font-semibold">
                        {g.d_terrain_m !== null ? `${g.d_terrain_m.toFixed(0)} m` : 'Not set'}
                      </td>
                      <td className="py-2 px-2.5 text-xs tabular-nums text-ink-2">
                        {g.slope_mean_deg.toFixed(1)}° slope · {(g.canopy_share * 100).toFixed(0)}%
                        trees · {g.water_crossings_count} stream crossings
                      </td>
                      <td className="py-2 px-2.5">
                        <span className="text-xs px-2 py-0.5 rounded-xs border border-rule bg-paper font-semibold text-ink whitespace-nowrap">
                          {formatModalityLabel(g.recommended_modality)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Community Electricity Demand Forecast (Front & Center) */}
        <div className="space-y-4 pt-3 border-t border-rule">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="small-caps-heading flex items-center gap-1.5">
                  <Icon icon={Activity} size="xs" className="text-accent" />
                  <span>
                    Community Electricity Demand &amp; {demand?.horizon_years ?? 10}-Year Growth
                    Forecast
                  </span>
                  <HelpTooltip glossaryKey="serviceLoadTier" />
                </span>
                <span className="text-[11px] text-ink-2 inline-flex items-center gap-1.5 flex-wrap">
                  <span>
                    Peak demand uses power factor {powerFactorVal.toFixed(2)} and{' '}
                    {((demand?.annual_growth_rate ?? 0.045) * 100).toFixed(1)}%/yr growth
                  </span>
                  <HelpTooltip glossaryKey="loadFactorPowerFactor" />
                </span>
              </div>
            </div>

            {demand ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <StatTile
                    label="Total Connected Appliances"
                    value={demand.total_connected_kw.toFixed(2)}
                    unit="kW"
                    quality="ESTIMATED"
                    subtitle={`${demand.total_households} Homes`}
                  />
                  <StatTile
                    label="Peak Demand Today"
                    value={demand.peak_kva_base.toFixed(2)}
                    unit="kVA"
                    quality="ESTIMATED"
                    subtitle={`${demand.peak_kw_base.toFixed(2)} kW`}
                  />
                  <StatTile
                    label={`Year-${demand.horizon_years} Design Peak`}
                    value={`${demand.peak_kva_horizon.toFixed(2)} kVA`}
                    quality="ESTIMATED"
                    tone="accent"
                    subtitle={`${demand.peak_kw_horizon.toFixed(2)} kW future peak`}
                  />
                  <StatTile
                    label="Annual Electricity Used"
                    value={`${demand.annual_energy_mwh_base.toFixed(1)} → ${demand.annual_energy_mwh_horizon.toFixed(1)}`}
                    unit="MWh/yr"
                    quality="ESTIMATED"
                    subtitle="Today → Horizon Year"
                  />
                </div>

                <div className="table-scroll-container">
                  <table className="w-full text-left border-collapse text-body-sm">
                    <thead>
                      <tr className="bg-subtle border-b border-rule text-xs font-semibold text-ink-2">
                        <th className="py-2 px-2.5">Consumer Type</th>
                        <th className="py-2 px-2.5">Connections</th>
                        <th className="py-2 px-2.5">Connected (kW)</th>
                        <th className="py-2 px-2.5">Peak Demand (kW)</th>
                        <th className="py-2 px-2.5">Daily (kWh/day)</th>
                        <th className="py-2 px-2.5">Yearly (MWh/yr)</th>
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
                title="Demand Forecast Not Calculated Yet"
                description="Save engineering settings below or finish Step 2 village clustering to compute community electricity demand."
              />
            )}
          </div>

          {/* Collapsible Advanced Engineering Assumptions (FTU-19 Progressive Disclosure) */}
          <details className="bg-paper border border-rule rounded-xs p-3.5">
            <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2 select-none">
              <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                <Icon icon={SlidersHorizontal} size="xs" className="text-ink-2" />
                <span>
                  Advanced Electricity Load Assumptions (
                  {settings?.user_edited_count ?? 0} Customized · Standard Govt. Defaults Pre-Loaded)
                </span>
              </div>
              <span className="text-[11px] font-medium text-accent">
                Expand to view or customize
              </span>
            </summary>

            <div className="space-y-3 mt-3 pt-3 border-t border-rule-subtle">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-ink-2">
                  Default REC / CEA / ESMAP planning parameters used across demand and feeder
                  calculations.
                </span>
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
                  title="No Engineering Assumptions Loaded"
                  description="Default assumptions load automatically once project details initialize."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
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
                                ? 'Custom Value'
                                : `Default: ${item.default_value}`
                            }
                          />
                        </div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-[11px] text-ink-2 leading-snug">
                            <span>{item.citation}</span>
                            <span className="block text-[10px] text-ink-3 font-mono">
                              Allowed: {item.min_value}–{item.max_value} {item.unit}
                            </span>
                          </div>
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
          </details>
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
        title="Remove Added Power Asset?"
        description={
          pendingDeleteAsset ? (
            <div className="space-y-1">
              <p>
                Remove <strong>{pendingDeleteAsset.name}</strong> (
                <code className="code-pill">{pendingDeleteAsset.asset_type}</code>)?
              </p>
              <p className="text-2xs text-ink-3 font-mono">
                Village distances to the nearest power line will be updated right away.
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
        title="Reset Assumptions to Standard Government Defaults?"
        description="This reverts every custom electricity assumption back to standard REC/CEA defaults and updates the demand forecast."
        confirmLabel="Reset Defaults"
        variant="danger"
        isLoading={savingSettings}
      />
    </Panel>
  );
};
