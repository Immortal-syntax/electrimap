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
import { Database, Layers, RefreshCw, Search, Upload } from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import {
  RASTER_LEGEND_SPECS,
  SATELLITE_SOURCES_ATTRIBUTION,
} from '../map/symbology';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Callout } from '../ui/Callout';
import { EmptyState } from '../ui/EmptyState';
import { JobProgress, JobStatusDto } from '../ui/JobProgress';
import { Input } from '../ui/Input';
import { Panel } from '../ui/Panel';
import { DatasetProvenanceDto, ProvenanceChip } from '../ui/ProvenanceChip';
import { QualityTag } from '../ui/QualityTag';
import { Select } from '../ui/Select';
import { Spinner } from '../ui/Skeleton';

export interface ProjectLayerDto {
  id: string;
  project_id: string;
  layer_key: string;
  status: string;
  retrieved_at: string | null;
  feature_count: number | null;
  bbox: number[] | null;
  summary_metrics: Record<string, unknown>;
  error_message: string | null;
  cache_key: string | null;
  dataset: DatasetProvenanceDto | null;
}

export type RasterOverlayKey = 'none' | 'dem_slope' | 'landcover' | 'nightlights';

export interface DataManagementPanelProps {
  projectId: string;
  layers: ProjectLayerDto[];
  visibleVectorLayers: Record<string, boolean>;
  onToggleVectorLayer: (layerKey: string) => void;
  activeRasterOverlay: RasterOverlayKey;
  onChangeRasterOverlay: (overlay: RasterOverlayKey) => void;
  rasterOpacity: number;
  onChangeRasterOpacity: (opacity: number) => void;
  onLayersUpdated: () => Promise<void>;
}

const LAYER_LABELS: Record<string, string> = {
  buildings: 'Building Footprints (Google-MS-OSM Open Buildings)',
  dem_slope: 'Copernicus DEM GLO-30 & Terrain Slope (°)',
  landcover: 'ESA WorldCover 10 m Land Use / Land Cover',
  nightlights: 'VIIRS / HREA Nighttime Radiance Composite',
  osm_features: 'OpenStreetMap Roads, Waterways & Rural Amenities',
  solar_resource: 'NASA POWER Solar GHI & Temperature Climatology',
};

function formatLayerSummary(layerKey: string, summary: Record<string, unknown>): string {
  if (layerKey === 'buildings') {
    const res = Number(summary.residential_count ?? 0);
    const nonRes = Number(summary.non_residential_count ?? 0);
    const out = Number(summary.outbuilding_count ?? 0);
    const noise = Number(summary.noise_excluded_count ?? 0);
    return `Residential: ${res} · Non-Res: ${nonRes} · Outbuilding: ${out} · Noise (<8 m²) filtered: ${noise}`;
  }
  if (layerKey === 'dem_slope') {
    const minElev = Number(summary.elevation_min_m ?? 0).toFixed(0);
    const maxElev = Number(summary.elevation_max_m ?? 0).toFixed(0);
    const meanSlope = Number(summary.slope_mean_deg ?? 0).toFixed(1);
    const maxSlope = Number(summary.slope_max_deg ?? 0).toFixed(1);
    return `Elevation: ${minElev}–${maxElev} m · Mean Slope: ${meanSlope}° · Max Slope: ${maxSlope}°`;
  }
  if (layerKey === 'landcover') {
    const forest = Number(summary.tree_cover_pct ?? 0).toFixed(1);
    const crop = Number(summary.cropland_pct ?? 0).toFixed(1);
    const water = Number(summary.water_pct ?? 0).toFixed(1);
    return `Tree Cover: ${forest}% · Cropland: ${crop}% · Water Bodies: ${water}%`;
  }
  if (layerKey === 'nightlights') {
    const meanRad = Number(summary.mean_radiance_nw_cm2_sr ?? 0).toFixed(2);
    const maxRad = Number(summary.max_radiance_nw_cm2_sr ?? 0).toFixed(2);
    const lightScore = Number(summary.mean_lightscore ?? 0).toFixed(2);
    return `Mean Radiance: ${meanRad} nW/cm²/sr · Max: ${maxRad} · Mean LightScore: ${lightScore}`;
  }
  if (layerKey === 'osm_features') {
    const roads = Number(summary.road_segments ?? 0);
    const water = Number(summary.waterway_segments ?? 0);
    const amenities = Number(summary.community_amenities ?? 0);
    return `Road Segments: ${roads} · Waterways: ${water} · Community Amenities: ${amenities}`;
  }
  if (layerKey === 'solar_resource') {
    const annual = Number(summary.annual_mean_ghi_kwh_m2_day ?? 0).toFixed(2);
    const worst = Number(summary.worst_ghi_kwh_m2_day ?? 0).toFixed(2);
    const month = String(summary.worst_month ?? 'Jul');
    return `Annual Mean GHI: ${annual} kWh/m²/day · Design Worst Month (${month}): ${worst} kWh/m²/day`;
  }
  return `Features ingested: ${String(summary.custom_uploaded ?? 'Custom GeoJSON')}`;
}

export const DataManagementPanel: React.FC<DataManagementPanelProps> = ({
  projectId,
  layers,
  visibleVectorLayers,
  onToggleVectorLayer,
  activeRasterOverlay,
  onChangeRasterOverlay,
  rasterOpacity,
  onChangeRasterOpacity,
  onLayersUpdated,
}) => {
  const [activeJob, setActiveJob] = useState<JobStatusDto | null>(null);
  const [acquiring, setAcquiring] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadTargetKey, setUploadTargetKey] = useState<'buildings' | 'osm_features'>('buildings');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [layerSearch, setLayerSearch] = useState('');
  const [layerStatusFilter, setLayerStatusFilter] = useState<'ALL' | 'READY' | 'FAILED'>('ALL');
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogItems, setCatalogItems] = useState<DatasetProvenanceDto[] | null>(null);
  const [catalogSearch, setCatalogSearch] = useState('');

  const filteredLayers = useMemo(() => {
    const q = layerSearch.trim().toLowerCase();
    return layers.filter((layer) => {
      const isFailed = layer.status === 'FAILED' || Boolean(layer.error_message);
      if (layerStatusFilter === 'FAILED' && !isFailed) return false;
      if (layerStatusFilter === 'READY' && isFailed) return false;
      if (!q) return true;
      const title = (LAYER_LABELS[layer.layer_key] ?? layer.dataset?.name ?? layer.layer_key).toLowerCase();
      return (
        title.includes(q) ||
        layer.layer_key.toLowerCase().includes(q) ||
        (layer.dataset?.provider ?? '').toLowerCase().includes(q) ||
        (layer.dataset?.licence ?? '').toLowerCase().includes(q)
      );
    });
  }, [layers, layerSearch, layerStatusFilter]);

  const filteredCatalog = useMemo(() => {
    const items = catalogItems ?? [];
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (ds) =>
        ds.name.toLowerCase().includes(q) ||
        ds.key.toLowerCase().includes(q) ||
        ds.provider.toLowerCase().includes(q) ||
        ds.licence.toLowerCase().includes(q),
    );
  }, [catalogItems, catalogSearch]);

  const loadGlobalDatasetRegistry = async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const items = await apiRequest<DatasetProvenanceDto[]>('/api/v1/datasets');
      setCatalogItems(items);
    } catch (err) {
      setCatalogError(
        err instanceof Error ? err.message : 'Unable to load open dataset registry.',
      );
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleToggleCatalog = () => {
    const nextOpen = !catalogOpen;
    setCatalogOpen(nextOpen);
    if (nextOpen && catalogItems === null && !catalogLoading) {
      void loadGlobalDatasetRegistry();
    }
  };

  const handleAcquireData = async () => {
    setAcquiring(true);
    setErrorMsg(null);
    try {
      const job = await apiRequest<JobStatusDto>(
        `/api/v1/projects/${projectId}/data/acquire`,
        {
          method: 'POST',
        },
      );
      setActiveJob(job);
      await onLayersUpdated();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to acquire open GIS layers.');
    } finally {
      setAcquiring(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      const updated = await apiRequest<JobStatusDto>(`/api/v1/jobs/${jobId}/cancel`, {
        method: 'POST',
      });
      setActiveJob(updated);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to cancel job.');
    }
  };

  const handleCustomLayerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErrorMsg(null);
    try {
      const form = new FormData();
      form.append('layer_key', uploadTargetKey);
      form.append('file', file);

      await apiRequest<ProjectLayerDto>(`/api/v1/projects/${projectId}/layers/upload`, {
        method: 'POST',
        body: form,
      });
      await onLayersUpdated();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Custom GIS layer upload failed.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <Panel
      as="section"
      aria-label="Geospatial Layer Registry and Provenance"
      overline="Step 1 · Geospatial Ingestion & Satellite Sources"
      title="Geospatial Layer Registry & Provenance"
      subtitle="Every open dataset is clipped to the project AOI and tagged with explicit licence, spatial resolution, and acquisition origin."
      icon={Layers}
      badge={<QualityTag kind="ESTIMATED" label="6-LAYER OPEN PIPELINE" />}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            leftIcon={Database}
            onClick={handleToggleCatalog}
          >
            {catalogOpen ? 'Hide Global Dataset Registry' : 'Open Dataset Registry'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            leftIcon={RefreshCw}
            isLoading={acquiring}
            onClick={() => void handleAcquireData()}
          >
            {acquiring ? 'Acquiring Layers…' : 'Acquire / Refresh Open GIS Layers'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {errorMsg && (
          <Callout tone="error" title="Data Ingestion Error">
            {errorMsg}
          </Callout>
        )}

        {activeJob && (
          <JobProgress job={activeJob} onCancel={(jid) => void handleCancelJob(jid)} />
        )}

        {/* Satellite Imagery, Nighttime Illumination & Remote-Sensing Attribution Header */}
        <div className="p-3.5 bg-paper border border-rule-subtle rounded-xs space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="small-caps-heading">
              Satellite Imagery, Nighttime Illumination &amp; Open Remote-Sensing Sources
            </span>
            <QualityTag kind="ESTIMATED" label="ZERO PAID API KEYS · OPEN LICENCES" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs">
            {SATELLITE_SOURCES_ATTRIBUTION.map((src) => (
              <div
                key={src.id}
                className="p-2.5 bg-sheet border border-rule-subtle rounded-xs space-y-1"
              >
                <div className="font-semibold text-ink">{src.name}</div>
                <div className="text-xs font-medium text-accent">
                  {src.resolution} · {src.vintage}
                </div>
                <div className="text-xs text-ink-3">{src.license}</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-warn bg-warn-tint border border-warn/30 px-3 py-2 rounded-xs leading-relaxed">
            <strong>Epistemic Limitation of Satellite &amp; Nighttime Radiance Data:</strong>{' '}
            NASA VIIRS measures upward outdoor nighttime light (~500 m resolution at ~01:30 AM
            LT). Low or zero nighttime illumination is NEVER definitive proof that electricity is
            unavailable — indoor household meters, low-wattage LED bulbs, dense tree canopy, and
            daytime-only solar/agricultural supply cannot be seen by nighttime satellites.
          </div>
        </div>

        {/* Raster Overlay & Vector Layer Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-paper border border-rule rounded-xs text-xs">
          <div className="space-y-1.5">
            <div className="small-caps-heading">Active Raster Map Overlay</div>
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Raster overlay selector"
            >
              {(
                [
                  { key: 'none', label: 'None' },
                  { key: 'dem_slope', label: 'Copernicus DEM Slope (°)' },
                  { key: 'landcover', label: 'ESA WorldCover 10 m' },
                  { key: 'nightlights', label: 'VIIRS Nighttime Lights' },
                ] as Array<{ key: RasterOverlayKey; label: string }>
              ).map((opt) => (
                <Button
                  key={opt.key}
                  type="button"
                  size="xs"
                  variant={activeRasterOverlay === opt.key ? 'primary' : 'secondary'}
                  onClick={() => onChangeRasterOverlay(opt.key)}
                  className="font-mono"
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="raster-opacity-slider" className="small-caps-heading">
                Raster Overlay Opacity
              </label>
              <span className="font-mono text-[11px] text-ink tabular-nums">
                {Math.round(rasterOpacity * 100)}%
              </span>
            </div>
            <input
              id="raster-opacity-slider"
              type="range"
              min={0.15}
              max={0.95}
              step={0.05}
              value={rasterOpacity}
              onChange={(e) => onChangeRasterOpacity(Number(e.target.value))}
              className="w-full accent-accent"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-2 font-mono">
              <span>Vector layers can be toggled individually on the cards below.</span>
              <div
                role="group"
                aria-label="Raster opacity presets"
                className="inline-flex items-center gap-1"
              >
                {[0.25, 0.5, 0.75, 0.95].map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    size="xs"
                    variant={Math.abs(rasterOpacity - preset) < 0.03 ? 'primary' : 'secondary'}
                    onClick={() => onChangeRasterOpacity(preset)}
                    className="font-mono"
                  >
                    {Math.round(preset * 100)}%
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Active Raster Color-Ramp & Intensity Legend */}
        {activeRasterOverlay !== 'none' && (
          <div
            role="region"
            aria-label="Active Raster Overlay Legend"
            className="p-3 bg-paper border border-rule-strong rounded-xs space-y-2 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-ink">
                  {RASTER_LEGEND_SPECS[activeRasterOverlay].title}
                </span>
                <span className="ml-2 font-mono text-[11px] text-ink-2">
                  ({RASTER_LEGEND_SPECS[activeRasterOverlay].sensorAndVintage})
                </span>
              </div>
              <span className="text-xs text-ink-3 tabular-nums">
                {RASTER_LEGEND_SPECS[activeRasterOverlay].spatialResolution} ·{' '}
                {RASTER_LEGEND_SPECS[activeRasterOverlay].license}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
              {RASTER_LEGEND_SPECS[activeRasterOverlay].stops.map((stop) => (
                <div
                  key={stop.rangeText}
                  className="p-2.5 bg-sheet border border-rule-subtle rounded-xs flex items-start gap-2"
                >
                  <span
                    className="w-4 h-4 rounded-xs border border-rule shrink-0 mt-0.5"
                    style={{ backgroundColor: stop.color }}
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-ink tabular-nums">
                      {stop.rangeText} · {stop.label}
                    </div>
                    <div className="text-xs text-ink-2 leading-relaxed mt-0.5">
                      {stop.interpretation}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-xs text-ink-2 pt-2 border-t border-rule-subtle leading-relaxed">
              <strong>Interpretation Caveat:</strong>{' '}
              {RASTER_LEGEND_SPECS[activeRasterOverlay].epistemicNote}
            </div>
          </div>
        )}

        {/* Layer Cards, Filter Bar or Structured Empty State */}
        {layers.length === 0 ? (
          <EmptyState
            icon={Layers}
            overline="Open GIS Pipeline"
            title="No Geospatial or Satellite Layers Ingested Yet"
            description="Run the 6-Layer Open GIS Pipeline to clip Building Footprints, Copernicus DEM GLO-30 Slope, ESA WorldCover 10 m, NASA VIIRS Nighttime Radiance, OpenStreetMap Roads/Amenities, and NASA POWER Solar GHI to your project Area of Interest."
            action={
              <Button
                type="button"
                size="sm"
                variant="primary"
                leftIcon={RefreshCw}
                isLoading={acquiring}
                onClick={() => void handleAcquireData()}
              >
                {acquiring ? 'Acquiring Layers…' : 'Acquire Open GIS Layers Now'}
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end p-2.5 bg-subtle border border-rule rounded-xs">
              <div className="sm:col-span-6">
                <Input
                  size="sm"
                  label="Search Project Layers"
                  leftIcon={Search}
                  placeholder="Filter by layer name, key, provider, or licence…"
                  value={layerSearch}
                  onChange={(e) => setLayerSearch(e.target.value)}
                />
              </div>
              <div className="sm:col-span-4">
                <Select
                  size="sm"
                  label="Ingestion Status"
                  aria-label="Filter layers by status"
                  value={layerStatusFilter}
                  onChange={(e) =>
                    setLayerStatusFilter(e.target.value as 'ALL' | 'READY' | 'FAILED')
                  }
                  options={[
                    { value: 'ALL', label: `All Layers (${layers.length})` },
                    { value: 'READY', label: 'Ready / Ingested' },
                    { value: 'FAILED', label: 'Failed Only' },
                  ]}
                />
              </div>
              <div className="sm:col-span-2 flex items-center justify-end gap-2">
                {(layerSearch || layerStatusFilter !== 'ALL') && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setLayerSearch('');
                      setLayerStatusFilter('ALL');
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {filteredLayers.length === 0 ? (
              <EmptyState
                compact
                title="No Project Layers Match Filters"
                description="Reset the layer search or ingestion status filter to view all ingested layers."
                action={
                  <Button
                    type="button"
                    size="xs"
                    variant="secondary"
                    onClick={() => {
                      setLayerSearch('');
                      setLayerStatusFilter('ALL');
                    }}
                  >
                    Reset Layer Filters
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredLayers.map((layer) => {
                  const isVectorToggleable =
                    layer.layer_key === 'buildings' || layer.layer_key === 'osm_features';
                  const isVectorVisible = Boolean(visibleVectorLayers[layer.layer_key]);
                  const isRasterLayer =
                    layer.layer_key === 'dem_slope' ||
                    layer.layer_key === 'landcover' ||
                    layer.layer_key === 'nightlights';
                  const displayTitle =
                    LAYER_LABELS[layer.layer_key] ?? layer.dataset?.name ?? layer.layer_key;
                  const isFailed =
                    layer.status === 'FAILED' || Boolean(layer.error_message);

                  return (
                    <div
                      key={layer.id}
                      className="p-3 bg-paper border border-rule-strong rounded-xs space-y-2 flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-xs text-ink">{displayTitle}</span>
                            <QualityTag
                              kind={
                                layer.cache_key?.includes('user_upload') ? 'ASSUMED' : 'ESTIMATED'
                              }
                              label={layer.status}
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-ink-2 tabular-nums">
                              {(layer.feature_count ?? 1).toLocaleString()}{' '}
                              {isRasterLayer ? 'raster' : 'features'}
                            </span>
                            {isVectorToggleable && (
                              <label className="inline-flex items-center gap-1 text-[11px] font-mono text-ink cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isVectorVisible}
                                  onChange={() => onToggleVectorLayer(layer.layer_key)}
                                  className="accent-accent"
                                />
                                Map Layer
                              </label>
                            )}
                            {isRasterLayer && (
                              <Button
                                type="button"
                                size="xs"
                                variant={
                                  activeRasterOverlay === layer.layer_key
                                    ? 'primary'
                                    : 'secondary'
                                }
                                onClick={() =>
                                  onChangeRasterOverlay(
                                    activeRasterOverlay === layer.layer_key
                                      ? 'none'
                                      : (layer.layer_key as RasterOverlayKey),
                                  )
                                }
                                className="font-mono"
                              >
                                {activeRasterOverlay === layer.layer_key
                                  ? 'Overlay Active'
                                  : 'Show Overlay'}
                              </Button>
                            )}
                          </div>
                        </div>

                        {isFailed ? (
                          <div
                            role="alert"
                            className="p-2 bg-error-tint border border-error/40 rounded-xs text-[11px] font-mono text-error flex items-center justify-between gap-2"
                          >
                            <span>
                              Layer Ingestion Failed:{' '}
                              {layer.error_message ??
                                'Could not process raster/vector source for AOI.'}
                            </span>
                            <Button
                              type="button"
                              size="xs"
                              variant="danger-outline"
                              onClick={() => void handleAcquireData()}
                              className="shrink-0"
                            >
                              Retry Pipeline
                            </Button>
                          </div>
                        ) : (
                          <div className="font-mono text-[11px] text-ink-2 bg-subtle px-2 py-1 rounded-xs border border-rule/80">
                            {formatLayerSummary(layer.layer_key, layer.summary_metrics)}
                          </div>
                        )}
                      </div>

                      <ProvenanceChip dataset={layer.dataset} cacheKey={layer.cache_key} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Collapsible Global Open Dataset Registry (/api/v1/datasets) */}
        {catalogOpen && (
          <div className="p-3 bg-paper border border-rule-strong rounded-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule pb-2">
              <div>
                <div className="small-caps-heading">
                  Global Open Dataset Provenance Catalog (/api/v1/datasets)
                </div>
                <p className="text-[11px] text-ink-2">
                  Canonical metadata, licences, and resolution notes for every supported open GIS
                  source.
                </p>
              </div>
              <Button
                type="button"
                size="xs"
                variant="secondary"
                leftIcon={RefreshCw}
                isLoading={catalogLoading}
                onClick={() => void loadGlobalDatasetRegistry()}
              >
                Refresh Catalog
              </Button>
            </div>

            {catalogError && (
              <Callout
                tone="error"
                title="Unable to Load Dataset Catalog"
                action={
                  <Button
                    type="button"
                    size="xs"
                    variant="secondary"
                    onClick={() => void loadGlobalDatasetRegistry()}
                  >
                    Retry
                  </Button>
                }
              >
                {catalogError}
              </Callout>
            )}

            {catalogLoading && !catalogItems && (
              <div className="flex items-center gap-2 py-4 text-xs text-ink-2">
                <Spinner size="sm" />
                <span>Loading open dataset catalog…</span>
              </div>
            )}

            {catalogItems && (
              <div className="space-y-2.5">
                <Input
                  size="sm"
                  label="Search Open Dataset Catalog"
                  leftIcon={Search}
                  placeholder="Filter by dataset name, key, provider, or licence…"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                />

                {filteredCatalog.length === 0 ? (
                  <EmptyState
                    compact
                    title="No Datasets Match Filter"
                    description="Clear the dataset catalog search to inspect all registered open sources."
                    action={
                      <Button
                        type="button"
                        size="xs"
                        variant="secondary"
                        onClick={() => setCatalogSearch('')}
                      >
                        Clear Search
                      </Button>
                    }
                  />
                ) : (
                  <div className="table-scroll-container max-h-[280px]">
                    <table className="w-full text-left border-collapse text-body-sm">
                      <thead className="sticky top-0 bg-subtle border-b border-rule text-xs font-semibold text-ink-2 z-10">
                        <tr>
                          <th className="p-2.5">Dataset &amp; Key</th>
                          <th className="p-2.5">Provider</th>
                          <th className="p-2.5">Licence</th>
                          <th className="p-2.5">Resolution &amp; Vintage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rule-subtle">
                        {filteredCatalog.map((ds) => (
                          <tr key={ds.id} className="hover:bg-subtle/60">
                            <td className="p-2.5">
                              <div className="font-semibold text-ink">{ds.name}</div>
                              <div className="font-mono text-xs text-ink-3">{ds.key}</div>
                            </td>
                            <td className="p-2.5 text-ink-2 text-xs">{ds.provider}</td>
                            <td className="p-2.5">
                              <Badge
                                variant={ds.is_non_commercial ? 'warn' : 'ok'}
                                size="sm"
                              >
                                {ds.licence}
                              </Badge>
                            </td>
                            <td className="p-2.5 text-xs text-ink-2 tabular-nums">
                              {ds.spatial_resolution ?? 'N/A'} ·{' '}
                              {ds.temporal_coverage ?? 'Continuous'}
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
        )}

        {/* Custom GIS Layer Upload (USER_ENTERED) */}
        <div className="pt-3 border-t border-rule flex flex-wrap items-end justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="small-caps-heading">Upload Custom GIS Vector Layer (USER_ENTERED)</div>
            <p className="text-xs text-ink-2">
              Upload field-surveyed GeoJSON footprints or infrastructure features. Validated in WGS
              84 and tagged as <code>USER_ENTERED</code>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              size="sm"
              aria-label="Custom layer target"
              value={uploadTargetKey}
              onChange={(e) =>
                setUploadTargetKey(e.target.value as 'buildings' | 'osm_features')
              }
              options={[
                { value: 'buildings', label: 'Building Footprints (buildings)' },
                { value: 'osm_features', label: 'Roads / Amenities (osm_features)' },
              ]}
              mono
            />
            <label className="inline-flex items-center gap-1.5 h-7 px-2.5 bg-paper border border-rule-strong rounded-xs text-xs font-medium text-ink hover:bg-subtle cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-ink-2" aria-hidden="true" />
              {uploading ? 'Uploading…' : 'Upload .geojson'}
              <input
                type="file"
                accept=".geojson,.json"
                disabled={uploading}
                onChange={(e) => void handleCustomLayerUpload(e)}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>
    </Panel>
  );
};
