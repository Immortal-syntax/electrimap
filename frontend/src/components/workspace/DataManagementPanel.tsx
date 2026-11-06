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
import { JobProgress, JobStatusDto } from '../ui/JobProgress';
import { DatasetProvenanceDto, ProvenanceChip } from '../ui/ProvenanceChip';
import { QualityTag } from '../ui/QualityTag';

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
    <div className="bg-sheet border border-rule-strong rounded-xs p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3">
        <div>
          <div className="small-caps-heading">Geospatial Layer Registry &amp; Provenance</div>
          <p className="text-xs text-ink-2">
            Every open dataset is clipped to the project AOI and tagged with explicit licence,
            spatial resolution, and acquisition origin.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            disabled={acquiring}
            onClick={() => void handleAcquireData()}
          >
            {acquiring ? 'Acquiring Layers…' : 'Acquire / Refresh Open GIS Layers'}
          </Button>
        </div>
      </div>

      {errorMsg && (
        <Callout tone="error" title="Data Ingestion Error">
          {errorMsg}
        </Callout>
      )}

      {activeJob && (
        <JobProgress job={activeJob} onCancel={(jid) => void handleCancelJob(jid)} />
      )}

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
              <button
                key={opt.key}
                type="button"
                onClick={() => onChangeRasterOverlay(opt.key)}
                className={`px-2 py-1 rounded-xs border font-mono text-[11px] ${
                  activeRasterOverlay === opt.key
                    ? 'bg-accent text-white border-accent'
                    : 'bg-sheet text-ink-2 border-rule-strong hover:bg-paper'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="raster-opacity-slider" className="small-caps-heading">
              Raster Overlay Opacity
            </label>
            <span className="font-mono text-[11px] text-ink">
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
          <div className="text-[11px] text-ink-2 font-mono">
            Vector layers can be toggled individually on the cards below.
          </div>
        </div>
      </div>

      {/* Layer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {layers.map((layer) => {
          const isVectorToggleable =
            layer.layer_key === 'buildings' || layer.layer_key === 'osm_features';
          const isVectorVisible = Boolean(visibleVectorLayers[layer.layer_key]);
          const isRasterLayer =
            layer.layer_key === 'dem_slope' ||
            layer.layer_key === 'landcover' ||
            layer.layer_key === 'nightlights';
          const displayTitle =
            LAYER_LABELS[layer.layer_key] ?? layer.dataset?.name ?? layer.layer_key;

          return (
            <div
              key={layer.id}
              className="p-3 bg-sheet border border-rule-strong rounded-xs space-y-2 flex flex-col justify-between"
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-ink">{displayTitle}</span>
                    <QualityTag
                      kind={layer.cache_key?.includes('user_upload') ? 'ASSUMED' : 'ESTIMATED'}
                      label={layer.status}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-ink-2">
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
                      <button
                        type="button"
                        onClick={() =>
                          onChangeRasterOverlay(
                            activeRasterOverlay === layer.layer_key
                              ? 'none'
                              : (layer.layer_key as RasterOverlayKey),
                          )
                        }
                        className={`px-1.5 py-0.5 rounded-xs border font-mono text-[10px] ${
                          activeRasterOverlay === layer.layer_key
                            ? 'bg-accent text-white border-accent'
                            : 'bg-paper text-ink-2 border-rule'
                        }`}
                      >
                        {activeRasterOverlay === layer.layer_key ? 'Overlay Active' : 'Show Overlay'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="font-mono text-[11px] text-ink-2 bg-paper/80 px-2 py-1 rounded-xs border border-rule/80">
                  {formatLayerSummary(layer.layer_key, layer.summary_metrics)}
                </div>
              </div>

              <ProvenanceChip dataset={layer.dataset} cacheKey={layer.cache_key} />
            </div>
          );
        })}
      </div>

      {/* Custom GIS Layer Upload (USER_ENTERED) */}
      <div className="pt-2 border-t border-rule flex flex-wrap items-end justify-between gap-3 text-xs">
        <div className="space-y-1">
          <div className="small-caps-heading">Upload Custom GIS Vector Layer (USER_ENTERED)</div>
          <p className="text-[11px] text-ink-2">
            Upload field-surveyed GeoJSON footprints or infrastructure features. Validated in WGS 84
            and tagged as <code>USER_ENTERED</code>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Custom layer target"
            value={uploadTargetKey}
            onChange={(e) =>
              setUploadTargetKey(e.target.value as 'buildings' | 'osm_features')
            }
            className="px-2 py-1 text-xs bg-paper border border-rule-strong rounded-xs font-mono"
          >
            <option value="buildings">Building Footprints (buildings)</option>
            <option value="osm_features">Roads / Amenities (osm_features)</option>
          </select>
          <label className="px-2.5 py-1 bg-sheet border border-rule-strong rounded-xs text-xs font-medium text-ink hover:bg-paper cursor-pointer">
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
  );
};
