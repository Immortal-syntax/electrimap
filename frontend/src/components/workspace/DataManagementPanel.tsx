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
  ArrowRight,
  ChevronRight,
  Database,
  Download,
  Layers,
  RefreshCw,
  Search,
  Upload,
} from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import type { GlossaryKey } from '../../lib/beginnerGlossary';
import {
  RASTER_LEGEND_SPECS,
  SATELLITE_SOURCES_ATTRIBUTION,
} from '../map/symbology';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Callout } from '../ui/Callout';
import { ConfirmDialog } from '../ui/Dialog';
import { EmptyState } from '../ui/EmptyState';
import { JobProgress, JobStatusDto } from '../ui/JobProgress';
import { Input } from '../ui/Input';
import { Panel } from '../ui/Panel';
import type { DatasetProvenanceDto } from '../ui/ProvenanceChip';
import { QualityTag } from '../ui/QualityTag';
import {
  classifyLayerHonesty,
  computeMapDataReadiness,
  type ProjectLayerDto,
  type RasterOverlayKey,
} from '../../lib/mapDataReadiness';
import { Select } from '../ui/Select';
import { Spinner } from '../ui/Skeleton';
import { HelpTooltip } from '../ui/Tooltip';

export type {
  LayerHonestyClassification,
  MapDataReadinessSummary,
  MapDataStatus,
  ProjectLayerDto,
  RasterOverlayKey,
} from '../../lib/mapDataReadiness';

export interface DataManagementPanelProps {
  projectId: string;
  metricEpsg?: number;
  layers: ProjectLayerDto[];
  visibleVectorLayers: Record<string, boolean>;
  onToggleVectorLayer: (layerKey: string) => void;
  activeRasterOverlay: RasterOverlayKey;
  onChangeRasterOverlay: (overlay: RasterOverlayKey) => void;
  rasterOpacity: number;
  onChangeRasterOpacity: (opacity: number) => void;
  onLayersUpdated: () => Promise<void>;
  onContinueToNextStep?: () => void;
}

const LAYER_LABELS: Record<string, string> = {
  buildings: 'Building Footprints',
  dem_slope: 'Terrain Slope & Elevation',
  landcover: 'Land Cover (Trees, Crops & Water)',
  nightlights: 'Nighttime Lights',
  osm_features: 'Roads, Waterways & Amenities',
  solar_resource: 'Solar Sunlight Resource',
};

function formatLayerSummary(layerKey: string, summary: Record<string, unknown>): string {
  if (summary.is_unavailable === true) {
    return String(
      summary.unavailable_reason ??
        'Unavailable offline — no local raster bundled; upload GeoTIFF or proceed with field checks.',
    );
  }
  if (layerKey === 'buildings') {
    const res = Number(summary.residential_count ?? 0);
    const nonRes = Number(summary.non_residential_count ?? 0);
    const out = Number(summary.outbuilding_count ?? 0);
    const noise = Number(summary.noise_excluded_count ?? 0);
    return `Residential: ${res} · Non-Res: ${nonRes} · Outbuilding: ${out} · Noise (<12 m²) filtered: ${noise}`;
  }
  if (layerKey === 'dem_slope') {
    const minElev =
      typeof summary.elevation_min_m === 'number' ? summary.elevation_min_m.toFixed(0) : '—';
    const maxElev =
      typeof summary.elevation_max_m === 'number' ? summary.elevation_max_m.toFixed(0) : '—';
    const meanSlope =
      typeof summary.slope_mean_deg === 'number' ? summary.slope_mean_deg.toFixed(1) : '—';
    const maxSlope =
      typeof summary.slope_max_deg === 'number' ? summary.slope_max_deg.toFixed(1) : '—';
    return `Elevation: ${minElev}–${maxElev} m · Mean Slope: ${meanSlope}° · Max Slope: ${maxSlope}°`;
  }
  if (layerKey === 'landcover') {
    const forest =
      typeof summary.tree_cover_pct === 'number' ? summary.tree_cover_pct.toFixed(1) : '—';
    const crop =
      typeof summary.cropland_pct === 'number' ? summary.cropland_pct.toFixed(1) : '—';
    const waterRaw = summary.water_pct ?? summary.water_barrier_pct;
    const water = typeof waterRaw === 'number' ? waterRaw.toFixed(1) : '—';
    return `Tree Cover: ${forest}% · Cropland: ${crop}% · Water Bodies: ${water}%`;
  }
  if (layerKey === 'nightlights') {
    if (
      summary.mean_radiance_nw_cm2_sr === null ||
      summary.mean_radiance_nw_cm2_sr === undefined
    ) {
      return 'Unavailable offline — NASA VIIRS VNP46A4 GeoTIFF required for real radiance values.';
    }
    const meanRad = Number(summary.mean_radiance_nw_cm2_sr).toFixed(2);
    const maxRad = Number(summary.max_radiance_nw_cm2_sr ?? 0).toFixed(2);
    const lightScore = Number(summary.mean_lightscore ?? 0).toFixed(2);
    return `Mean Radiance: ${meanRad} nW/cm²/sr · Max: ${maxRad} · LightScore: ${lightScore}`;
  }
  if (layerKey === 'osm_features') {
    const roads = Number(summary.road_segments ?? 0);
    const water = Number(summary.waterway_segments ?? 0);
    const amenities = Number(summary.community_amenities ?? 0);
    return `Roads: ${roads} · Waterways: ${water} · Amenities: ${amenities}`;
  }
  if (layerKey === 'solar_resource') {
    const annual = Number(summary.annual_mean_ghi_kwh_m2_day ?? 0).toFixed(2);
    const worst = Number(summary.worst_ghi_kwh_m2_day ?? 0).toFixed(2);
    const month = String(summary.worst_month ?? 'AUG');
    return `Annual Mean GHI: ${annual} kWh/m²/d · Worst Month (${month}): ${worst} kWh/m²/d`;
  }
  return `Features ingested: ${String(summary.custom_uploaded ?? 'Custom GeoJSON')}`;
}

export const DataManagementPanel: React.FC<DataManagementPanelProps> = ({
  projectId,
  metricEpsg,
  layers,
  visibleVectorLayers,
  onToggleVectorLayer,
  activeRasterOverlay,
  onChangeRasterOverlay,
  rasterOpacity,
  onChangeRasterOpacity,
  onLayersUpdated,
  onContinueToNextStep,
}) => {
  const [activeJob, setActiveJob] = useState<JobStatusDto | null>(null);
  const [confirmReacquire, setConfirmReacquire] = useState(false);
  const [acquiring, setAcquiring] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadTargetKey, setUploadTargetKey] = useState<'buildings' | 'osm_features'>('buildings');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [layerSearch, setLayerSearch] = useState('');
  const [layerStatusFilter, setLayerStatusFilter] = useState<'ALL' | 'READY' | 'FAILED'>('ALL');
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogItems, setCatalogItems] = useState<DatasetProvenanceDto[] | null>(null);
  const [catalogSearch, setCatalogSearch] = useState('');

  const readiness = useMemo(() => computeMapDataReadiness(layers), [layers]);

  const filteredLayers = useMemo(() => {
    const q = layerSearch.trim().toLowerCase();
    return layers.filter((layer) => {
      const honesty = classifyLayerHonesty(layer);
      if (layerStatusFilter === 'FAILED' && !honesty.isFailed && !honesty.isUnavailable) {
        return false;
      }
      if (layerStatusFilter === 'READY' && (honesty.isFailed || honesty.isUnavailable)) {
        return false;
      }
      if (!q) return true;
      const title = (
        LAYER_LABELS[layer.layer_key] ??
        layer.dataset?.name ??
        layer.layer_key
      ).toLowerCase();
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
      setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch map data.');
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

  const nightlightsLayer = layers.find((l) => l.layer_key === 'nightlights');
  const isNightlightsUnavailable =
    nightlightsLayer?.summary_metrics?.is_unavailable === true;

  return (
    <Panel
      as="section"
      aria-label="Get your map ready"
      overline="Step 1 · Study Area & Data"
      title={
        <span className="inline-flex items-center gap-1.5">
          <span>Get your map ready</span>
          <HelpTooltip glossaryKey="dataSourceProvenance" />
        </span>
      }
      subtitle="Prepare building footprints, terrain, land cover, and solar data for your study area, then move to village clustering."
      icon={Layers}
      badge={
        <Badge variant={readiness.badgeVariant} size="sm">
          {readiness.label}
        </Badge>
      }
      actions={
        <Button
          type="button"
          size="sm"
          variant="primary"
          leftIcon={RefreshCw}
          isLoading={acquiring}
          onClick={() => {
            if (layers.length > 0) {
              setConfirmReacquire(true);
            } else {
              void handleAcquireData();
            }
          }}
        >
          {acquiring ? 'Fetching map data…' : 'Fetch map data'}
        </Button>
      }
    >
      <div className="space-y-4">
        {errorMsg && (
          <Callout tone="error" title="Could Not Fetch Map Data">
            {errorMsg}
          </Callout>
        )}

        {activeJob && (
          <JobProgress job={activeJob} onCancel={(jid) => void handleCancelJob(jid)} />
        )}

        {/* 1. Compact Data Availability Summary + Prominent Next Step */}
        {layers.length === 0 ? (
          <EmptyState
            icon={Layers}
            overline="Step 1 · Map Preparation"
            title="No Map Data Loaded Yet"
            description="Click Fetch map data to clip open buildings, hillside slope, land cover, nighttime lights, roads, and solar data to your study boundary."
            action={
              <Button
                type="button"
                size="sm"
                variant="primary"
                leftIcon={RefreshCw}
                isLoading={acquiring}
                onClick={() => void handleAcquireData()}
              >
                {acquiring ? 'Fetching map data…' : 'Fetch map data'}
              </Button>
            }
          />
        ) : (
          <div className="p-3.5 bg-paper border border-rule rounded-xs flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-ink inline-flex items-center gap-1.5">
                  <span>Study Area Data Availability:</span>
                  <HelpTooltip glossaryKey="sentinel2Ndvi" />
                </span>
                <Badge variant={readiness.badgeVariant} size="sm">
                  {readiness.label}
                </Badge>
                {readiness.archiveExtractCount > 0 && (
                  <span className="text-xs text-ink-2 tabular-nums">
                    {readiness.archiveExtractCount} Archive
                  </span>
                )}
                {readiness.userUploadedCount > 0 && (
                  <span className="text-xs text-ink-2 tabular-nums">
                    · {readiness.userUploadedCount} Uploaded
                  </span>
                )}
                {readiness.syntheticCount > 0 && (
                  <span className="text-xs text-warn font-medium tabular-nums">
                    · {readiness.syntheticCount} Synthetic fallback
                  </span>
                )}
                {readiness.unavailableCount > 0 && (
                  <span className="text-xs text-warn font-medium tabular-nums">
                    · {readiness.unavailableCount} Unavailable offline
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-2">{readiness.summaryText}</p>
            </div>

            {onContinueToNextStep && (
              <Button
                type="button"
                size="sm"
                variant={readiness.status === 'READY' ? 'primary' : 'secondary'}
                rightIcon={ArrowRight}
                onClick={onContinueToNextStep}
              >
                Next: Villages &amp; Habitations
              </Button>
            )}
          </div>
        )}

        {/* 2. Essential Data-Quality & Limitation Warnings (Only Shown When Needed) */}
        {readiness.syntheticCount > 0 && (
          <Callout tone="error" title="Synthetic Fallback Data Active — DPR Export Blocked">
            One or more datasets fell back to synthetic screening surfaces because this boundary
            lies outside the bundled archive. Upload surveyed GeoJSON files below or provide real
            rasters before exporting a formal DPR.
          </Callout>
        )}

        {layers.length > 0 && (
          <Callout
            tone="warn"
            title={
              isNightlightsUnavailable
                ? 'Nighttime Lights Unavailable Offline — Clusters Stay Unverified'
                : 'Why Nighttime Lights Cannot See Home Meters'
            }
          >
            {isNightlightsUnavailable
              ? 'No local NASA VIIRS GeoTIFF is bundled for this area, so nighttime brightness is unavailable and hamlets stay UNKNOWN until field verification in Step 2.'
              : 'Coarse nighttime brightness (~500 m pixels) only shows outdoor light cues; indoor LEDs, daytime-only supply, or tree cover do not appear from space.'}
          </Callout>
        )}

        {/* 3. Simple Map Shading Controls (Single Help Icon) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-paper border border-rule rounded-xs text-xs">
          <div className="space-y-1.5">
            <div className="small-caps-heading flex items-center gap-1.5">
              <span>Map shading</span>
              <HelpTooltip
                title="Background Map Shading"
                whatItMeans="Colors the map by hillside steepness (slope), land use (trees and crops), or nighttime lights."
                whyItMatters="Helps spot steep terrain, dense forests, and unlit areas before placing poles or grouping homes."
                whatToDo="Pick None for the clean street/satellite map, or choose one shading layer and adjust opacity."
              />
            </div>
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Raster overlay selector"
            >
              {(
                [
                  { key: 'none', label: 'None' },
                  { key: 'dem_slope', label: 'Hillside Slope' },
                  { key: 'landcover', label: 'Trees & Crops' },
                  { key: 'nightlights', label: 'Nighttime Lights' },
                ] as Array<{ key: RasterOverlayKey; label: string }>
              ).map((opt) => (
                <Button
                  key={opt.key}
                  type="button"
                  size="xs"
                  aria-pressed={activeRasterOverlay === opt.key}
                  variant={activeRasterOverlay === opt.key ? 'primary' : 'secondary'}
                  onClick={() => onChangeRasterOverlay(opt.key)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="raster-opacity-slider" className="small-caps-heading">
                Shading transparency
              </label>
              <span className="font-mono text-[11px] text-ink tabular-nums">
                {Math.round(rasterOpacity * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="raster-opacity-slider"
                type="range"
                min={0.15}
                max={0.95}
                step={0.05}
                value={rasterOpacity}
                onChange={(e) => onChangeRasterOpacity(Number(e.target.value))}
                className="flex-1 accent-accent"
              />
              <div
                role="group"
                aria-label="Raster opacity presets"
                className="inline-flex items-center gap-1 shrink-0"
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

        {/* Active Raster Color-Ramp & Legend (Visible Only When Shading Is Enabled) */}
        {activeRasterOverlay !== 'none' && (
          <div
            role="region"
            aria-label="Active Raster Overlay Legend"
            className="p-3 bg-paper border border-rule-strong rounded-xs space-y-2 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-ink">
                {RASTER_LEGEND_SPECS[activeRasterOverlay].title}
              </span>
              <span className="text-xs text-ink-3 tabular-nums">
                {RASTER_LEGEND_SPECS[activeRasterOverlay].spatialResolution}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
              {RASTER_LEGEND_SPECS[activeRasterOverlay].stops.map((stop) => (
                <div
                  key={stop.rangeText}
                  className="p-2 bg-sheet border border-rule-subtle rounded-xs flex items-start gap-2"
                >
                  <span
                    className="w-3.5 h-3.5 rounded-xs border border-rule shrink-0 mt-0.5"
                    style={{ backgroundColor: stop.color }}
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-ink tabular-nums">
                      {stop.rangeText} · {stop.label}
                    </div>
                    <div className="text-xs text-ink-2 leading-snug mt-0.5">
                      {stop.interpretation}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Compact Layer Availability Checklist (No Repeated Provenance Clutter) */}
        {layers.length > 0 && (
          <div className="space-y-2.5">
            {layers.length > 4 && (
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="flex flex-wrap items-end gap-2 flex-1">
                  <Input
                    size="sm"
                    label="Filter map layers"
                    leftIcon={Search}
                    placeholder="Search layers…"
                    value={layerSearch}
                    onChange={(e) => setLayerSearch(e.target.value)}
                    containerClassName="w-56"
                  />
                  <Select
                    size="sm"
                    label="Status"
                    aria-label="Filter layers by status"
                    value={layerStatusFilter}
                    onChange={(e) =>
                      setLayerStatusFilter(e.target.value as 'ALL' | 'READY' | 'FAILED')
                    }
                    options={[
                      { value: 'ALL', label: `All (${layers.length})` },
                      { value: 'READY', label: 'Usable' },
                      { value: 'FAILED', label: 'Unavailable / Failed' },
                    ]}
                  />
                </div>
                {(layerSearch || layerStatusFilter !== 'ALL') && (
                  <Button
                    type="button"
                    size="xs"
                    variant="secondary"
                    onClick={() => {
                      setLayerSearch('');
                      setLayerStatusFilter('ALL');
                    }}
                  >
                    Clear Filter
                  </Button>
                )}
              </div>
            )}

            {filteredLayers.length === 0 ? (
              <EmptyState
                compact
                title="No Project Layers Match Filters"
                description="Reset the layer search or status filter to view all layers."
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
              <div className="divide-y divide-rule-subtle border border-rule rounded-xs bg-sheet overflow-hidden">
                {filteredLayers.map((layer) => {
                  const isVectorToggleable =
                    layer.layer_key === 'buildings' || layer.layer_key === 'osm_features';
                  const isVectorVisible = Boolean(visibleVectorLayers[layer.layer_key]);
                  const isRasterLayer =
                    layer.layer_key === 'dem_slope' ||
                    layer.layer_key === 'landcover' ||
                    layer.layer_key === 'nightlights';
                  const displayTitle =
                    LAYER_LABELS[layer.layer_key] ??
                    layer.dataset?.name ??
                    layer.layer_key;
                  const layerGlossaryMap: Record<string, GlossaryKey> = {
                    buildings: 'buildingFootprints',
                    dem_slope: 'demSlope',
                    landcover: 'worldCover',
                    nightlights: 'viirsNighttimeLight',
                    solar_resource: 'ghiSolarIrradiance',
                  };
                  const layerGlossaryKey = layerGlossaryMap[layer.layer_key];
                  const honesty = classifyLayerHonesty(layer);

                  return (
                    <div
                      key={layer.id}
                      className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-xs"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-ink">{displayTitle}</span>
                          {layerGlossaryKey && <HelpTooltip glossaryKey={layerGlossaryKey} />}
                          <QualityTag kind={honesty.qualityKind} label={honesty.originLabel} />
                          <Badge variant={honesty.badgeVariant} size="sm">
                            {honesty.statusLabel}
                          </Badge>
                        </div>

                        {honesty.isFailed ? (
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
                          <p className="text-xs text-ink-2">
                            {formatLayerSummary(layer.layer_key, layer.summary_metrics)}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-ink-3 tabular-nums">
                          {layer.feature_count !== null && layer.feature_count !== undefined
                            ? layer.feature_count.toLocaleString()
                            : '—'}{' '}
                          {isRasterLayer ? 'grid' : 'items'}
                        </span>
                        {isVectorToggleable && (
                          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-ink cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isVectorVisible}
                              aria-label={`Show ${displayTitle} on map`}
                              onChange={() => onToggleVectorLayer(layer.layer_key)}
                              className="accent-accent"
                            />
                            Show on Map
                          </label>
                        )}
                        {isRasterLayer && (
                          <Button
                            type="button"
                            size="xs"
                            variant={
                              activeRasterOverlay === layer.layer_key ? 'primary' : 'secondary'
                            }
                            onClick={() =>
                              onChangeRasterOverlay(
                                activeRasterOverlay === layer.layer_key
                                  ? 'none'
                                  : (layer.layer_key as RasterOverlayKey),
                              )
                            }
                          >
                            {activeRasterOverlay === layer.layer_key
                              ? 'Overlay Active'
                              : 'Show Overlay'}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 5. Custom Survey GeoJSON Upload */}
        <div className="pt-3 border-t border-rule flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-ink">
              Optional: Upload your own survey file (.geojson)
            </span>
            <HelpTooltip
              title="Custom Map File Upload"
              whatItMeans="Replace or add buildings, roads, or facilities recorded during a local field survey in WGS 84 GeoJSON format."
              whyItMatters="Uploaded survey data overrides satellite estimates and is clearly labeled User Uploaded."
              whatToDo="Pick what your file contains, optionally download Sample GeoJSON, then select your file."
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              size="sm"
              aria-label="Choose what the uploaded map file contains"
              value={uploadTargetKey}
              onChange={(e) =>
                setUploadTargetKey(e.target.value as 'buildings' | 'osm_features')
              }
              options={[
                { value: 'buildings', label: 'Buildings / Houses' },
                { value: 'osm_features', label: 'Roads & Public Buildings' },
              ]}
            />
            <Button
              type="button"
              size="xs"
              variant="ghost"
              leftIcon={Download}
              onClick={() => {
                const sample = {
                  type: 'FeatureCollection',
                  features: [
                    {
                      type: 'Feature',
                      properties: { name: 'Sample Hamlet House', category: 'residential' },
                      geometry: {
                        type: 'Polygon',
                        coordinates: [
                          [
                            [82.61, 18.81],
                            [82.6101, 18.81],
                            [82.6101, 18.8101],
                            [82.61, 18.8101],
                            [82.61, 18.81],
                          ],
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
                a.download = 'sample_village_buildings.geojson';
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Sample GeoJSON
            </Button>
            <label className="inline-flex items-center gap-1.5 h-7 px-2.5 bg-paper border border-rule-strong rounded-xs text-xs font-medium text-ink hover:bg-subtle cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-ink-2" aria-hidden="true" />
              {uploading ? 'Uploading…' : 'Upload .geojson'}
              <input
                type="file"
                accept=".geojson,.json"
                aria-label="Upload custom GeoJSON map file"
                disabled={uploading}
                onChange={(e) => void handleCustomLayerUpload(e)}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* 6. Single Collapsed Bottom Section: Data Sources & Technical Information */}
        <details
          className="border border-rule rounded-xs bg-paper/70 p-3 text-xs group"
          onToggle={(e) => {
            if (
              (e.currentTarget as HTMLDetailsElement).open &&
              catalogItems === null &&
              !catalogLoading
            ) {
              void loadGlobalDatasetRegistry();
            }
          }}
        >
          <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2 select-none font-semibold text-ink">
            <span className="inline-flex items-center gap-1.5">
              <ChevronRight
                className="w-4 h-4 text-ink-2 transition-transform group-open:rotate-90"
                aria-hidden="true"
              />
              <Database className="w-3.5 h-3.5 text-ink-2" aria-hidden="true" />
              <span>Data sources &amp; technical information</span>
            </span>
            <span className="text-[11px] font-normal text-ink-2">
              {layers.length} project layers · Providers, licences, resolution, dates &amp; CRS
            </span>
          </summary>

          <div className="mt-3 pt-3 border-t border-rule-subtle space-y-4">
            <div className="text-xs text-ink-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                <strong className="text-ink">Storage CRS:</strong> WGS 84 (EPSG:4326)
              </span>
              <span>
                <strong className="text-ink">Metric Processing CRS:</strong>{' '}
                {metricEpsg ? `UTM EPSG:${metricEpsg}` : 'Auto-selected Indian UTM zone'}
              </span>
              <span>
                <strong className="text-ink">Cost Policy:</strong> Zero paid APIs or commercial map
                keys
              </span>
            </div>

            {layers.length > 0 && (
              <div className="table-scroll-container">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-subtle border-b border-rule text-ink-2 font-semibold">
                    <tr>
                      <th className="p-2">Layer</th>
                      <th className="p-2">Source &amp; Provider</th>
                      <th className="p-2">Ingestion Mode &amp; File</th>
                      <th className="p-2">Resolution / Dates</th>
                      <th className="p-2">Licence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule-subtle">
                    {layers.map((layer) => {
                      const sm = layer.summary_metrics ?? {};
                      const mode = String(sm.data_source_mode ?? 'DEFAULT');
                      const sourceFile = sm.source_file ? String(sm.source_file) : null;
                      return (
                        <tr key={layer.id} className="align-top">
                          <td className="p-2 font-medium text-ink">
                            {LAYER_LABELS[layer.layer_key] ?? layer.layer_key}
                            <div className="font-mono text-[10px] text-ink-3">
                              {layer.layer_key}
                            </div>
                          </td>
                          <td className="p-2 text-ink-2">
                            <div className="text-ink">
                              {layer.dataset?.name ?? 'User-provided GeoJSON'}
                            </div>
                            <div className="text-[11px]">{layer.dataset?.provider ?? 'Local upload'}</div>
                          </td>
                          <td className="p-2 font-mono text-[11px] text-ink-2">
                            <div>{mode}</div>
                            {sourceFile && <div className="text-ink-3">{sourceFile}</div>}
                            {layer.retrieved_at && (
                              <div className="text-[10px] text-ink-3">
                                Updated: {layer.retrieved_at.slice(0, 10)}
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-ink-2">
                            <div>{layer.dataset?.spatial_resolution ?? 'Vector'}</div>
                            <div className="text-[11px] text-ink-3">
                              {layer.dataset?.temporal_coverage ?? 'User timestamp'}
                            </div>
                          </td>
                          <td className="p-2 text-ink-2">
                            {layer.dataset?.licence ?? 'Project internal'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Basemap & Reference Sensor Attribution */}
            <div className="space-y-2">
              <div className="small-caps-heading">Basemap &amp; Satellite Sensor Notes</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {SATELLITE_SOURCES_ATTRIBUTION.map((src) => (
                  <div
                    key={src.id}
                    className="p-2.5 bg-sheet border border-rule-subtle rounded-xs space-y-0.5"
                  >
                    <div className="font-semibold text-ink">{src.name}</div>
                    <div className="text-[11px] text-accent">
                      {src.resolution} · {src.vintage}
                    </div>
                    <div className="text-[11px] text-ink-2">{src.roleInElectrimap}</div>
                    <div className="text-[11px] text-ink-3">{src.license}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Global Registry (/api/v1/datasets) */}
            <div className="space-y-2 pt-2 border-t border-rule-subtle">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="small-caps-heading">
                  Supported Open Dataset Registry (/api/v1/datasets)
                </div>
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  leftIcon={RefreshCw}
                  isLoading={catalogLoading}
                  onClick={() => void loadGlobalDatasetRegistry()}
                >
                  {catalogItems ? 'Refresh Catalog' : 'Load Catalog'}
                </Button>
              </div>

              {catalogError && (
                <Callout tone="error" title="Unable to Load Dataset Catalog">
                  {catalogError}
                </Callout>
              )}

              {catalogLoading && !catalogItems && (
                <div className="flex items-center gap-2 py-2 text-xs text-ink-2">
                  <Spinner size="xs" />
                  <span>Loading dataset catalog…</span>
                </div>
              )}

              {catalogItems && (
                <div className="space-y-2">
                  <Input
                    size="sm"
                    label="Filter Dataset Registry"
                    leftIcon={Search}
                    placeholder="Filter by name, key, provider, or licence…"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                  />
                  {filteredCatalog.length === 0 ? (
                    <EmptyState
                      compact
                      title="No Datasets Match Filter"
                      description="Clear the search query to see all supported open sources."
                    />
                  ) : (
                    <div className="table-scroll-container max-h-[240px]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 bg-subtle border-b border-rule text-ink-2">
                          <tr>
                            <th className="p-2">Dataset</th>
                            <th className="p-2">Provider</th>
                            <th className="p-2">Licence</th>
                            <th className="p-2">Resolution &amp; Dates</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-rule-subtle">
                          {filteredCatalog.map((ds) => (
                            <tr key={ds.id}>
                              <td className="p-2">
                                <div className="font-semibold text-ink">{ds.name}</div>
                                <div className="font-mono text-[10px] text-ink-3">{ds.key}</div>
                              </td>
                              <td className="p-2 text-ink-2">{ds.provider}</td>
                              <td className="p-2">
                                <Badge variant={ds.is_non_commercial ? 'warn' : 'ok'} size="sm">
                                  {ds.licence}
                                </Badge>
                              </td>
                              <td className="p-2 text-ink-2 tabular-nums">
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
          </div>
        </details>
      </div>

      <ConfirmDialog
        open={confirmReacquire}
        onClose={() => setConfirmReacquire(false)}
        onConfirm={() => {
          setConfirmReacquire(false);
          void handleAcquireData();
        }}
        title="Refresh Map Data?"
        description="This re-downloads open map and satellite layers for your study boundary and updates downstream clusters, demand, and network designs for review."
        confirmLabel="Fetch map data"
        variant="danger"
        isLoading={acquiring}
      />
    </Panel>
  );
};
