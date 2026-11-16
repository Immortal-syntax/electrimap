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

import type { DatasetProvenanceDto } from '../components/ui/ProvenanceChip';
import type { QualityTagKind } from '../components/ui/QualityTag';

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

export type MapDataStatus = 'READY' | 'PARTIAL' | 'ACTION_NEEDED';

export interface MapDataReadinessSummary {
  status: MapDataStatus;
  label: 'Ready' | 'Partially available' | 'Action needed';
  badgeVariant: 'ok' | 'warn' | 'error';
  totalCount: number;
  usableCount: number;
  failedCount: number;
  unavailableCount: number;
  syntheticCount: number;
  userUploadedCount: number;
  archiveExtractCount: number;
  proxyReferenceCount: number;
  summaryText: string;
}

export interface LayerHonestyClassification {
  isFailed: boolean;
  isUnavailable: boolean;
  isSynthetic: boolean;
  isUserUploaded: boolean;
  isArchiveExtract: boolean;
  statusLabel: string;
  originLabel: string;
  qualityKind: QualityTagKind;
  badgeVariant: 'ok' | 'warn' | 'error' | 'neutral';
}

const ARCHIVE_SOURCE_MODES = new Set([
  'LOCAL_GEOTIFF_EXTRACT',
  'LOCAL_GEOJSON_EXTRACT',
  'LOCAL_OSM_EXTRACT',
  'NASA_POWER_LOCAL_EXTRACT',
]);

export function classifyLayerHonesty(layer: ProjectLayerDto): LayerHonestyClassification {
  const sm = layer.summary_metrics ?? {};
  const mode = String(sm.data_source_mode ?? '');
  const isFailed = layer.status === 'FAILED' || Boolean(layer.error_message);
  const isUnavailable = sm.is_unavailable === true;
  const isSynthetic = sm.is_synthetic_fallback === true;
  const isUserUploaded =
    Boolean(layer.cache_key?.includes('user_upload')) || mode === 'USER_UPLOAD';
  const isArchiveExtract = ARCHIVE_SOURCE_MODES.has(mode);

  if (isFailed) {
    return {
      isFailed: true,
      isUnavailable: false,
      isSynthetic: false,
      isUserUploaded,
      isArchiveExtract: false,
      statusLabel: 'Action needed',
      originLabel: 'Ingestion Failed',
      qualityKind: 'UNSET',
      badgeVariant: 'error',
    };
  }
  if (isUnavailable) {
    return {
      isFailed: false,
      isUnavailable: true,
      isSynthetic: false,
      isUserUploaded: false,
      isArchiveExtract: false,
      statusLabel: 'Unavailable',
      originLabel: 'Unavailable Offline',
      qualityKind: 'UNSET',
      badgeVariant: 'warn',
    };
  }
  if (isSynthetic) {
    return {
      isFailed: false,
      isUnavailable: false,
      isSynthetic: true,
      isUserUploaded: false,
      isArchiveExtract: false,
      statusLabel: 'Synthetic fallback',
      originLabel: 'Synthetic Fallback',
      qualityKind: 'ASSUMED',
      badgeVariant: 'warn',
    };
  }
  if (isUserUploaded) {
    return {
      isFailed: false,
      isUnavailable: false,
      isSynthetic: false,
      isUserUploaded: true,
      isArchiveExtract: false,
      statusLabel: 'Ready',
      originLabel: 'User Uploaded',
      qualityKind: 'USER_ENTERED',
      badgeVariant: 'ok',
    };
  }
  if (isArchiveExtract) {
    return {
      isFailed: false,
      isUnavailable: false,
      isSynthetic: false,
      isUserUploaded: false,
      isArchiveExtract: true,
      statusLabel: 'Ready',
      originLabel: 'Downloaded Archive',
      qualityKind: 'ESTIMATED',
      badgeVariant: 'ok',
    };
  }
  return {
    isFailed: false,
    isUnavailable: false,
    isSynthetic: false,
    isUserUploaded: false,
    isArchiveExtract: false,
    statusLabel: layer.status === 'READY' ? 'Ready' : layer.status,
    originLabel: 'Reference Proxy',
    qualityKind: 'PROXY',
    badgeVariant: layer.status === 'READY' ? 'ok' : 'warn',
  };
}

export function computeMapDataReadiness(layers: ProjectLayerDto[]): MapDataReadinessSummary {
  const totalCount = layers.length;
  if (totalCount === 0) {
    return {
      status: 'ACTION_NEEDED',
      label: 'Action needed',
      badgeVariant: 'warn',
      totalCount: 0,
      usableCount: 0,
      failedCount: 0,
      unavailableCount: 0,
      syntheticCount: 0,
      userUploadedCount: 0,
      archiveExtractCount: 0,
      proxyReferenceCount: 0,
      summaryText: 'No map data loaded yet. Fetch map data for your study boundary to begin.',
    };
  }

  let usableCount = 0;
  let failedCount = 0;
  let unavailableCount = 0;
  let syntheticCount = 0;
  let userUploadedCount = 0;
  let archiveExtractCount = 0;
  let proxyReferenceCount = 0;

  for (const layer of layers) {
    const info = classifyLayerHonesty(layer);
    if (info.isFailed) {
      failedCount += 1;
    } else if (info.isUnavailable) {
      unavailableCount += 1;
    } else {
      if (info.isSynthetic) {
        syntheticCount += 1;
      } else {
        usableCount += 1;
      }
      if (info.isUserUploaded) {
        userUploadedCount += 1;
      } else if (info.isArchiveExtract) {
        archiveExtractCount += 1;
      } else if (!info.isSynthetic) {
        proxyReferenceCount += 1;
      }
    }
  }

  if (failedCount > 0 || (usableCount === 0 && syntheticCount === 0)) {
    return {
      status: 'ACTION_NEEDED',
      label: 'Action needed',
      badgeVariant: 'error',
      totalCount,
      usableCount,
      failedCount,
      unavailableCount,
      syntheticCount,
      userUploadedCount,
      archiveExtractCount,
      proxyReferenceCount,
      summaryText:
        failedCount > 0
          ? `${failedCount} layer(s) failed to load (${usableCount} usable) — retry failed layers before continuing.`
          : 'No usable map layers are loaded yet — fetch map data or upload surveyed GeoJSON.',
    };
  }

  if (unavailableCount > 0 || syntheticCount > 0 || usableCount < totalCount) {
    const gaps: string[] = [];
    if (unavailableCount > 0) gaps.push(`${unavailableCount} unavailable offline`);
    if (syntheticCount > 0) gaps.push(`${syntheticCount} synthetic fallback`);
    return {
      status: 'PARTIAL',
      label: 'Partially available',
      badgeVariant: 'warn',
      totalCount,
      usableCount,
      failedCount,
      unavailableCount,
      syntheticCount,
      userUploadedCount,
      archiveExtractCount,
      proxyReferenceCount,
      summaryText: `${usableCount} of ${totalCount} layers available (${gaps.join(', ')}). Review limitations below before proceeding.`,
    };
  }

  return {
    status: 'READY',
    label: 'Ready',
    badgeVariant: 'ok',
    totalCount,
    usableCount,
    failedCount,
    unavailableCount,
    syntheticCount,
    userUploadedCount,
    archiveExtractCount,
    proxyReferenceCount,
    summaryText: `All ${totalCount} study-area layers loaded cleanly and are ready for Step 2.`,
  };
}

