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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import { Button } from '../ui/Button';
import { LayerSourceBadge, type ProxyElectrificationClass } from '../ui/Badge';
import { QualityTag } from '../ui/QualityTag';
import { HelpTooltip } from '../ui/Tooltip';
import {
  GisFeatureInspectorDrawer,
  buildInspectedFeatureFromMapProperties,
  buildInspectedFeatureFromSearchItem,
  formatQuickJumpLabel,
  type InspectedFeatureState,
} from './GisFeatureInspectorDrawer';
import { GisSymbologyLegend } from './GisSymbologyLegend';
import { RASTER_LEGEND_SPECS } from './symbology';
import { DEMO_PROJECT_ID } from '../layout/navigationConfig';
import {
  BasemapMode,
  DEFAULT_ELECTRIFICATION_GAPS_FC,
  DEFAULT_EXISTING_POWER_INFRA_FC,
  DEFAULT_PROPOSED_NETWORK_FC,
  DEFAULT_SETTLEMENTS_FC,
  DEFAULT_VILLAGE_ELECTRIFICATION_FC,
  INDIA_MAX_BOUNDS,
  KORAPUT_SEARCH_CATALOG,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  SearchableLocationItem,
  VIIRS_PERIOD_OPTIONS,
  ViirsObservationPeriod,
  VoltageFilterMode,
  computePolygonAreaM2,
  computePolylineLengthMeters,
} from './electricityGisData';

export type { BasemapMode, InspectedFeatureState };

const KORAPUT_DEFAULT_CENTER: [number, number] = [82.73, 18.565];
const KORAPUT_DEFAULT_ZOOM = 12.6;
const INDIA_DEFAULT_CENTER: [number, number] = [78.9629, 20.5937];
const INDIA_DEFAULT_ZOOM = 5.4;
const MVT_BUILDING_FEATURE_THRESHOLD = 5000;
const GLYPHS_URL = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';

function resolveMetricCrsLabel(metricEpsg?: number): string {
  if (!metricEpsg || Number.isNaN(metricEpsg)) return 'UTM 44N (EPSG:32644)';
  if (metricEpsg >= 32601 && metricEpsg <= 32660) {
    return `UTM ${metricEpsg - 32600}N (EPSG:${metricEpsg})`;
  }
  if (metricEpsg >= 32701 && metricEpsg <= 32760) {
    return `UTM ${metricEpsg - 32700}S (EPSG:${metricEpsg})`;
  }
  return `EPSG:${metricEpsg}`;
}

if (
  typeof maplibregl.setWorkerUrl === 'function' &&
  typeof window !== 'undefined'
) {
  maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
}

export interface MapCanvasProps {
  /** Optional owning Project UUID (non-demo projects isolate Koraput fixtures & enable MVT) */
  projectId?: string;
  /** Optional local metric UTM EPSG code (e.g. 32644) for telemetry footer */
  metricEpsg?: number;
  /** Step 1 AOI Wizard mode hides non-AOI measurement & cluster inspection controls */
  wizardMode?: boolean;
  /** Active AOI polygon/multipolygon GeoJSON geometry (`EPSG:4326`) */
  aoiGeometry?: GeoJSON.Geometry | null;
  /** Boundary source provenance (`HARMONISED`, `APPROXIMATE_BUFFER`, `USER_DRAWN`, `USER_UPLOAD`) */
  boundarySource?: string;
  /** Optional building footprints GeoJSON FeatureCollection */
  referenceBuildings?: GeoJSON.FeatureCollection | null;
  /** Optional OSM roads, waterways, and amenities GeoJSON FeatureCollection */
  osmFeatures?: GeoJSON.FeatureCollection | null;
  /** Optional 11 kV routing GeoJSON FeatureCollection */
  referenceRoutes?: GeoJSON.FeatureCollection | null;
  /** Optional Settlement Clusters GeoJSON FeatureCollection (M4) */
  settlementClusters?: GeoJSON.FeatureCollection | null;
  /** Optional Existing Infrastructure Assets GeoJSON FeatureCollection (M5) */
  infrastructureAssets?: GeoJSON.FeatureCollection | null;
  /** Optional Gap Analysis Unserved Corridor Lines GeoJSON FeatureCollection (M5) */
  gapCorridors?: GeoJSON.FeatureCollection | null;
  /** Optional Proposed Network Layout (HT 11 kV + LT 415 V + DTs) GeoJSON FeatureCollection (M6) */
  networkLayout?: GeoJSON.FeatureCollection | null;
  /** Whether interactive `USER_ASSUMED` 11 kV tie-in point placement mode is active */
  placeTieInModeActive?: boolean;
  /** Callback invoked when user clicks map in `placeTieInModeActive` */
  onPlaceTieInPoint?: (lon: number, lat: number) => void;
  /** Currently selected cluster ID for synchronized highlight */
  selectedClusterId?: string | null;
  /** Callback when a settlement cluster circle is clicked on the map */
  onSelectCluster?: (clusterId: string) => void;
  /** Optional raster overlay image URL (`dem_slope`, `landcover`, `nightlights`) */
  rasterOverlayUrl?: string | null;
  /** Raster overlay opacity (0.0 to 1.0) */
  rasterOpacity?: number;
  /** Active environmental raster overlay mode (synchronized with DataManagementPanel / WorkspacePage) */
  activeRasterOverlay?: 'none' | 'dem_slope' | 'landcover' | 'nightlights';
  /** Callback when planner switches the active environmental raster overlay inside the map workspace */
  onChangeRasterOverlay?: (
    next: 'none' | 'dem_slope' | 'landcover' | 'nightlights',
  ) => void;
  /** Callback when planner adjusts environmental raster opacity inside the map workspace */
  onChangeRasterOpacity?: (nextOpacity: number) => void;
  /** Whether interactive polygon drawing mode is active */
  drawModeActive?: boolean;
  /** Callback invoked whenever the user adds/clears vertices in draw mode */
  onDrawnPolygonChange?: (
    polygonGeoJson: GeoJSON.Polygon | null,
    vertexCount: number,
  ) => void;
  /** Optional height class override */
  heightClass?: string;
  /** Visual composition mode: full workbench vs compact overview hero */
  variant?: 'workbench' | 'overview';
  /** Optional callback to open the full `/map` GIS workstation from overview mode */
  onOpenFullMap?: () => void;
  /** Whether the collapsible GIS layer drawer opens expanded initially (default true) */
  defaultLayerPanelOpen?: boolean;
  /** Minimum zoom level allowed (defaults to MAP_MIN_ZOOM = 5.0 to prevent zooming out to world globe) */
  minZoom?: number;
  /** Maximum zoom level allowed (defaults to MAP_MAX_ZOOM = 20.0 for deep pole/structure inspection) */
  maxZoom?: number;
  /** Constraining bounding box in EPSG:4326 [[minLon, minLat], [maxLon, maxLat]] (defaults to INDIA_MAX_BOUNDS) */
  maxBounds?: [[number, number], [number, number]];
}

/**
 * Build a deterministic, 100% free (zero API key) MapLibre StyleSpecification
 * for all 4 basemap modes (`survey_paper`, `streets`, `terrain`, `satellite`).
 */
function buildBasemapStyle(mode: BasemapMode): StyleSpecification {
  if (mode === 'streets') {
    return {
      version: 8,
      glyphs: GLYPHS_URL,
      sources: {
        'osm-standard': {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          maxzoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors (ODbL)',
        },
      },
      layers: [
        {
          id: 'streets-bg',
          type: 'background',
          paint: { 'background-color': '#EFECE6' },
        },
        {
          id: 'streets-tiles',
          type: 'raster',
          source: 'osm-standard',
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    };
  }

  if (mode === 'terrain') {
    return {
      version: 8,
      glyphs: GLYPHS_URL,
      sources: {
        'opentopomap-tiles': {
          type: 'raster',
          tiles: [
            'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
            'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
            'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          maxzoom: 17,
          attribution:
            'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
        },
      },
      layers: [
        {
          id: 'terrain-bg',
          type: 'background',
          paint: { 'background-color': '#EAE5D9' },
        },
        {
          id: 'terrain-tiles',
          type: 'raster',
          source: 'opentopomap-tiles',
          minzoom: 0,
          maxzoom: 22,
          paint: {
            'raster-opacity': 0.9,
          },
        },
      ],
    };
  }

  if (mode === 'satellite') {
    return {
      version: 8,
      glyphs: GLYPHS_URL,
      sources: {
        'eox-s2': {
          type: 'raster',
          tiles: [
            'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
          ],
          tileSize: 256,
          maxzoom: 14,
          attribution:
            'Sentinel-2 cloudless 2020 - https://s2maps.eu by EOX IT Services GmbH (CC BY-NC-SA 4.0 · Contains modified Copernicus Sentinel data 2020)',
        },
      },
      layers: [
        {
          id: 's2-bg',
          type: 'background',
          paint: { 'background-color': '#0F172A' },
        },
        {
          id: 'eox-s2-layer',
          type: 'raster',
          source: 'eox-s2',
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    };
  }

  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sources: {
      'osm-survey': {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors (ODbL)',
      },
    },
    layers: [
      {
        id: 'survey-paper-bg',
        type: 'background',
        paint: { 'background-color': '#F4F7FA' },
      },
      {
        id: 'survey-paper-tiles',
        type: 'raster',
        source: 'osm-survey',
        minzoom: 0,
        maxzoom: 22,
        paint: {
          'raster-opacity': 0.72,
          'raster-saturation': -0.65,
          'raster-brightness-min': 0.12,
        },
      },
    ],
  };
}

function buildSurveyGraticuleGeoJson(
  bbox?: [number, number, number, number] | null,
  fallbackDemo = true,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  const rawMinLon = bbox ? bbox[0] : fallbackDemo ? 82.6 : 68.0;
  const rawMinLat = bbox ? bbox[1] : fallbackDemo ? 18.46 : 8.0;
  const rawMaxLon = bbox ? bbox[2] : fallbackDemo ? 82.84 : 96.0;
  const rawMaxLat = bbox ? bbox[3] : fallbackDemo ? 18.66 : 36.0;
  const span = Math.max(rawMaxLon - rawMinLon, rawMaxLat - rawMinLat, 0.02);
  const step = span > 10 ? 2.0 : span > 1.0 ? 0.25 : span > 0.35 ? 0.05 : 0.01;
  const pad = step * 2;
  const minLon = Math.floor((rawMinLon - pad) / step) * step;
  const maxLon = Math.ceil((rawMaxLon + pad) / step) * step;
  const minLat = Math.floor((rawMinLat - pad) / step) * step;
  const maxLat = Math.ceil((rawMaxLat + pad) / step) * step;

  for (let lon = minLon; lon <= maxLon + 1e-6; lon += step) {
    const roundedLon = Number(lon.toFixed(3));
    features.push({
      type: 'Feature',
      properties: { label: `${roundedLon.toFixed(2)}°E` },
      geometry: {
        type: 'LineString',
        coordinates: [
          [roundedLon, minLat],
          [roundedLon, maxLat],
        ],
      },
    });
  }
  for (let lat = minLat; lat <= maxLat + 1e-6; lat += step) {
    const roundedLat = Number(lat.toFixed(3));
    features.push({
      type: 'Feature',
      properties: { label: `${roundedLat.toFixed(2)}°N` },
      geometry: {
        type: 'LineString',
        coordinates: [
          [minLon, roundedLat],
          [maxLon, roundedLat],
        ],
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

function computeGeoJsonBbox(
  geojson: GeoJSON.Geometry | GeoJSON.FeatureCollection,
): [number, number, number, number] | null {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  function visitCoords(coords: unknown): void {
    if (!Array.isArray(coords)) return;
    if (
      coords.length >= 2 &&
      typeof coords[0] === 'number' &&
      typeof coords[1] === 'number'
    ) {
      const lon = coords[0];
      const lat = coords[1];
      if (Number.isFinite(lon) && Number.isFinite(lat)) {
        if (lon < minLon) minLon = lon;
        if (lat < minLat) minLat = lat;
        if (lon > maxLon) maxLon = lon;
        if (lat > maxLat) maxLat = lat;
      }
      return;
    }
    for (const item of coords) {
      visitCoords(item);
    }
  }

  if ('features' in geojson && Array.isArray(geojson.features)) {
    for (const feat of geojson.features) {
      if (feat && typeof feat === 'object' && 'geometry' in feat && feat.geometry) {
        visitCoords((feat.geometry as { coordinates?: unknown }).coordinates);
      }
    }
  } else if ('coordinates' in geojson) {
    visitCoords(geojson.coordinates);
  }

  if (!Number.isFinite(minLon) || !Number.isFinite(minLat)) {
    return null;
  }
  return [minLon, minLat, maxLon, maxLat];
}

function upsertGeoJsonSource(
  map: maplibregl.Map,
  sourceId: string,
  data: GeoJSON.GeoJSON,
): void {
  const existing = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
  if (existing && typeof existing.setData === 'function') {
    existing.setData(data);
  } else if (!existing) {
    map.addSource(sourceId, {
      type: 'geojson',
      data,
    });
  }
}

function setLayerVisibilitySafe(
  map: maplibregl.Map,
  layerIds: string[],
  visible: boolean,
): void {
  const val = visible ? 'visible' : 'none';
  for (const id of layerIds) {
    try {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', val);
      }
    } catch {
      // Ignore during style transition
    }
  }
}

export const MapCanvas: React.FC<MapCanvasProps> = ({
  projectId,
  metricEpsg,
  wizardMode = false,
  aoiGeometry = null,
  boundarySource = 'HARMONISED',
  referenceBuildings = null,
  osmFeatures = null,
  referenceRoutes = null,
  settlementClusters = null,
  infrastructureAssets = null,
  gapCorridors = null,
  networkLayout = null,
  placeTieInModeActive = false,
  onPlaceTieInPoint,
  selectedClusterId = null,
  onSelectCluster,
  rasterOverlayUrl = null,
  rasterOpacity = 0.65,
  activeRasterOverlay,
  onChangeRasterOverlay,
  onChangeRasterOpacity,
  drawModeActive = false,
  onDrawnPolygonChange,
  heightClass = 'h-[540px]',
  variant = 'workbench',
  onOpenFullMap,
  defaultLayerPanelOpen = true,
  minZoom = MAP_MIN_ZOOM,
  maxZoom = MAP_MAX_ZOOM,
  maxBounds = INDIA_MAX_BOUNDS,
}) => {
  const isDemoProject = !projectId || projectId === DEMO_PROJECT_ID;
  const usesMvtBuildings = Boolean(
    projectId &&
      !wizardMode &&
      (referenceBuildings?.features.length ?? 0) > MVT_BUILDING_FEATURE_THRESHOLD,
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const lastFittedBboxRef = useRef<string | null>(null);
  const lastRasterKeyRef = useRef<string | null>(null);
  const rasterLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initialBbox = aoiGeometry ? computeGeoJsonBbox(aoiGeometry) : null;
  const [basemap, setBasemap] = useState<BasemapMode>('survey_paper');
  const [cursorCoords, setCursorCoords] = useState<{ lon: number; lat: number }>(() =>
    initialBbox
      ? {
          lon: Number(((initialBbox[0] + initialBbox[2]) / 2).toFixed(5)),
          lat: Number(((initialBbox[1] + initialBbox[3]) / 2).toFixed(5)),
        }
      : isDemoProject
        ? { lon: KORAPUT_DEFAULT_CENTER[0], lat: KORAPUT_DEFAULT_CENTER[1] }
        : { lon: INDIA_DEFAULT_CENTER[0], lat: INDIA_DEFAULT_CENTER[1] },
  );
  const [zoomLevel, setZoomLevel] = useState<number>(
    initialBbox ? 11.5 : isDemoProject ? KORAPUT_DEFAULT_ZOOM : INDIA_DEFAULT_ZOOM,
  );
  const [drawnVertices, setDrawnVertices] = useState<Array<[number, number]>>([]);
  const [tileWarning, setTileWarning] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Specialised Electricity GIS Layer Controls (Layers A through F)
  const [layerPanelOpen, setLayerPanelOpen] = useState<boolean>(
    defaultLayerPanelOpen &&
      (typeof window === 'undefined' || window.innerWidth >= 1024),
  );
  const [beginnerGuideOpen, setBeginnerGuideOpen] = useState<boolean>(false);
  const [layerAEnabled, setLayerAEnabled] = useState<boolean>(true); // Existing Electricity Infrastructure
  const [voltageFilter, setVoltageFilter] = useState<VoltageFilterMode>('ALL');
  const [layerBEnabled, setLayerBEnabled] = useState<boolean>(false); // NASA VIIRS Nighttime Illumination
  const [viirsPeriod, setViirsPeriod] =
    useState<ViirsObservationPeriod>('2024_ANNUAL');
  const [viirsGlobalGibs, setViirsGlobalGibs] = useState<boolean>(false);
  const [viirsHalosEnabled, setViirsHalosEnabled] = useState<boolean>(true);
  const [viirsOpacity, setViirsOpacity] = useState<number>(0.75);
  const [localRasterOverlay, setLocalRasterOverlay] = useState<
    'none' | 'dem_slope' | 'landcover' | 'nightlights'
  >('none');
  const [localRasterOpacity, setLocalRasterOpacity] =
    useState<number>(rasterOpacity);
  const [rasterLoading, setRasterLoading] = useState<boolean>(false);
  const [rasterRetryToken, setRasterRetryToken] = useState<number>(0);
  const [layerCEnabled, setLayerCEnabled] = useState<boolean>(true); // Village Electrification Status
  const [layerDEnabled, setLayerDEnabled] = useState<boolean>(true); // Settlements, Demographics & Footprints
  const [layerEEnabled, setLayerEEnabled] = useState<boolean>(true); // Potential Electrification Gaps
  const [layerFEnabled, setLayerFEnabled] = useState<boolean>(true); // Proposed Electricity Network

  const effectiveRasterOverlay = activeRasterOverlay ?? localRasterOverlay;
  const effectiveEnvRasterOpacity = onChangeRasterOpacity
    ? rasterOpacity
    : localRasterOpacity;

  const activePeriodMeta =
    VIIRS_PERIOD_OPTIONS.find((p) => p.id === viirsPeriod) ??
    VIIRS_PERIOD_OPTIONS[0]!;

  const clearRasterLoadTimer = useCallback(() => {
    if (rasterLoadTimerRef.current !== null) {
      clearTimeout(rasterLoadTimerRef.current);
      rasterLoadTimerRef.current = null;
    }
  }, []);

  const beginRasterLoad = useCallback(() => {
    clearRasterLoadTimer();
    setRasterLoading(true);
    rasterLoadTimerRef.current = setTimeout(() => {
      setRasterLoading(false);
      rasterLoadTimerRef.current = null;
    }, 4000);
  }, [clearRasterLoadTimer]);

  const endRasterLoad = useCallback(() => {
    clearRasterLoadTimer();
    setRasterLoading(false);
  }, [clearRasterLoadTimer]);

  const handleSelectEnvRasterOverlay = (
    next: 'none' | 'dem_slope' | 'landcover' | 'nightlights',
  ) => {
    setLocalRasterOverlay(next);
    onChangeRasterOverlay?.(next);
    setTileWarning(null);
    if (next !== 'none' && (Boolean(rasterOverlayUrl) || next === 'nightlights')) {
      beginRasterLoad();
    } else if (next === 'none' && !layerBEnabled && basemap !== 'satellite') {
      endRasterLoad();
    }
  };

  const handleSelectEnvRasterOpacity = (nextOpacity: number) => {
    setLocalRasterOpacity(nextOpacity);
    onChangeRasterOpacity?.(nextOpacity);
  };

  // Phase 4: Geographic Filters, Vector Transparency, Reference Provenance & Viewport Controls
  const [settlementStatusFilter, setSettlementStatusFilter] = useState<
    'ALL' | ProxyElectrificationClass
  >('ALL');
  const [includeReferencePack, setIncludeReferencePack] = useState<boolean>(isDemoProject);
  const effectiveRefPack = isDemoProject && includeReferencePack;

  useEffect(() => {
    setIncludeReferencePack(isDemoProject);
  }, [isDemoProject]);
  const [vectorOpacity, setVectorOpacity] = useState<number>(0.9);
  const [expandedCanvas, setExpandedCanvas] = useState<boolean>(false);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);

  // Interactive Search & Measurement Tools
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchableLocationItem[]>([]);
  const [searchingExternal, setSearchingExternal] = useState<boolean>(false);
  const [measureModeActive, setMeasureModeActive] = useState<boolean>(false);
  const [measurePoints, setMeasurePoints] = useState<Array<[number, number]>>([]);
  const [inspectedFeature, setInspectedFeature] =
    useState<InspectedFeatureState | null>(null);
  const [hoveredFeatureHint, setHoveredFeatureHint] = useState<{
    title: string;
    subtitle: string;
    badge: string;
  } | null>(null);
  const [pendingTieInPoint, setPendingTieInPoint] = useState<{
    lon: number;
    lat: number;
  } | null>(null);

  useEffect(() => {
    if (!placeTieInModeActive) {
      setPendingTieInPoint(null);
    }
  }, [placeTieInModeActive]);

  useEffect(() => {
    if (!beginnerGuideOpen && !pendingTieInPoint) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pendingTieInPoint) setPendingTieInPoint(null);
        else if (beginnerGuideOpen) setBeginnerGuideOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [beginnerGuideOpen, pendingTieInPoint]);

  const fitToActiveAoi = useCallback(
    (mapInstance?: maplibregl.Map | null) => {
      const map = mapInstance ?? mapRef.current;
      if (!map) return;
      const targetGeom =
        aoiGeometry ??
        (settlementClusters && settlementClusters.features.length > 0
          ? settlementClusters
          : referenceBuildings && referenceBuildings.features.length > 0
            ? referenceBuildings
            : isDemoProject
              ? DEFAULT_VILLAGE_ELECTRIFICATION_FC
              : null);
      if (targetGeom) {
        const bbox = computeGeoJsonBbox(targetGeom);
        if (bbox) {
          try {
            map.fitBounds(
              [
                [bbox[0], bbox[1]],
                [bbox[2], bbox[3]],
              ],
              { padding: 44, duration: 450, maxZoom: 15.5 },
            );
          } catch {
            // Ignore in headless tests
          }
          return;
        }
      }
      try {
        map.flyTo({
          center: isDemoProject ? KORAPUT_DEFAULT_CENTER : INDIA_DEFAULT_CENTER,
          zoom: isDemoProject ? KORAPUT_DEFAULT_ZOOM : INDIA_DEFAULT_ZOOM,
          duration: 450,
        });
      } catch {
        // Ignore in headless tests
      }
    },
    [aoiGeometry, settlementClusters, referenceBuildings, isDemoProject],
  );

  // Merge OSM existing power infrastructure with any planner-added `infrastructureAssets`
  const mergedLayerAInfra = React.useMemo<GeoJSON.FeatureCollection>(() => {
    const matchesVoltageFilter = (f: GeoJSON.Feature) => {
      if (voltageFilter === 'ALL') return true;
      const cat = String(f.properties?.infra_category ?? '');
      const kv = Number(f.properties?.voltage_kv ?? 0);
      if (voltageFilter === '33KV_TRANSMISSION') {
        return kv >= 33 || cat === 'TRANSMISSION_LINE' || cat === 'SUBSTATION';
      }
      if (voltageFilter === '11KV_DISTRIBUTION') {
        return kv === 11 || cat === 'DISTRIBUTION_LINE_11KV';
      }
      if (voltageFilter === 'SUBSTATIONS_AND_DTS') {
        return cat === 'SUBSTATION' || cat === 'TRANSFORMER' || cat === 'TIE_IN';
      }
      if (voltageFilter === 'TOWERS_AND_POLES') {
        return cat === 'TOWER' || cat === 'POLE';
      }
      return true;
    };

    const baseFeatures = effectiveRefPack
      ? DEFAULT_EXISTING_POWER_INFRA_FC.features.filter(matchesVoltageFilter)
      : [];

    const extraFeatures: GeoJSON.Feature[] = (
      infrastructureAssets?.features ?? []
    )
      .map((feat) => ({
        ...feat,
        properties: {
          ...feat.properties,
          infra_category:
            feat.properties?.asset_type === 'SUBSTATION'
              ? 'SUBSTATION'
              : feat.properties?.asset_type === 'DT'
                ? 'TRANSFORMER'
                : feat.properties?.asset_type === 'POLE'
                  ? 'POLE'
                  : feat.properties?.asset_type === 'TIE_IN'
                    ? 'TIE_IN'
                    : 'DISTRIBUTION_LINE_11KV',
        },
      }))
      .filter(matchesVoltageFilter);

    return {
      type: 'FeatureCollection',
      features: [...baseFeatures, ...extraFeatures],
    };
  }, [voltageFilter, infrastructureAssets, effectiveRefPack]);

  const effectiveSettlementsFc = React.useMemo<GeoJSON.FeatureCollection>(() => {
    let rawFeatures: GeoJSON.Feature[] = [];
    if (settlementClusters && settlementClusters.features.length > 0) {
      const normalizedHulls = settlementClusters.features.map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          cluster_code:
            f.properties?.cluster_code ?? f.properties?.label ?? 'CL',
        },
      }));
      const hasPoints = normalizedHulls.some(
        (f) => f.geometry?.type === 'Point',
      );
      rawFeatures =
        hasPoints || !effectiveRefPack
          ? normalizedHulls
          : [...normalizedHulls, ...DEFAULT_SETTLEMENTS_FC.features];
    } else {
      rawFeatures = effectiveRefPack ? DEFAULT_SETTLEMENTS_FC.features : [];
    }

    const filteredFeatures =
      settlementStatusFilter === 'ALL'
        ? rawFeatures
        : rawFeatures.filter(
            (f) =>
              String(f.properties?.proxy_class ?? 'UNKNOWN') ===
              settlementStatusFilter,
          );

    return {
      type: 'FeatureCollection',
      features: filteredFeatures,
    };
  }, [settlementClusters, effectiveRefPack, settlementStatusFilter]);

  const effectiveGapsFc = React.useMemo<GeoJSON.FeatureCollection>(() => {
    if (gapCorridors && gapCorridors.features.length > 0) {
      return {
        type: 'FeatureCollection',
        features: effectiveRefPack
          ? [
              ...gapCorridors.features,
              ...DEFAULT_ELECTRIFICATION_GAPS_FC.features,
            ]
          : gapCorridors.features,
      };
    }
    return {
      type: 'FeatureCollection',
      features: effectiveRefPack
        ? DEFAULT_ELECTRIFICATION_GAPS_FC.features
        : [],
    };
  }, [gapCorridors, effectiveRefPack]);

  const effectiveProposedFc = React.useMemo<GeoJSON.FeatureCollection>(() => {
    const normalizedScenarioFeatures: GeoJSON.Feature[] = (
      networkLayout?.features ?? []
    ).map((f) => {
      const fk = String(f.properties?.feature_kind ?? '');
      const inferredLayerType =
        f.properties?.layer_type ??
        (fk === 'LT_415V_MST'
          ? 'LT_415V_PROPOSED'
          : fk === 'DISTRIBUTION_TRANSFORMER'
            ? 'DT_PROPOSED'
            : fk === 'SOLAR_MINIGRID'
              ? 'MINIGRID_PROPOSED'
              : 'HT_11KV_PROPOSED');
      return {
        ...f,
        properties: {
          ...f.properties,
          layer_type: inferredLayerType,
          name:
            f.properties?.name ??
            `${String(f.properties?.cluster_label ?? 'Cluster')} · ${fk}`,
          voltage_kv:
            f.properties?.voltage_kv ??
            (inferredLayerType === 'LT_415V_PROPOSED' ? 0.415 : 11.0),
          rating_kva:
            f.properties?.rating_kva ?? f.properties?.total_dt_rating_kva,
        },
      };
    });

    const routeFeatures: GeoJSON.Feature[] = (
      referenceRoutes?.features ?? []
    ).map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        layer_type: f.properties?.layer_type ?? 'HT_11KV_PROPOSED',
        status: 'PROPOSED_PRELIMINARY',
        voltage_kv: f.properties?.voltage_kv ?? 11.0,
      },
    }));

    return {
      type: 'FeatureCollection',
      features: [
        ...(effectiveRefPack ? DEFAULT_PROPOSED_NETWORK_FC.features : []),
        ...normalizedScenarioFeatures,
        ...routeFeatures,
      ],
    };
  }, [networkLayout, referenceRoutes, effectiveRefPack]);

  const syncLayers = useCallback(
    (map: maplibregl.Map) => {
      try {
        if (!map.getStyle()) return;
      } catch {
        return;
      }

      // 0. Engineering Survey Graticule
      try {
        const graticuleFc = buildSurveyGraticuleGeoJson(
          aoiGeometry ? computeGeoJsonBbox(aoiGeometry) : null,
          isDemoProject,
        );
        upsertGeoJsonSource(map, 'survey-graticule', graticuleFc);
        if (!map.getLayer('survey-graticule-lines')) {
          map.addLayer({
            id: 'survey-graticule-lines',
            type: 'line',
            source: 'survey-graticule',
            paint: {
              'line-color': basemap === 'satellite' ? '#94A3B8' : '#C8C2B4',
              'line-width': 0.6,
              'line-opacity': basemap === 'survey_paper' ? 0.45 : 0.22,
            },
          });
        }
      } catch {
        // Ignore mid-transition
      }

      const firstVectorLayerId = map.getLayer('village-status-fill')
        ? 'village-status-fill'
        : undefined;

      // 1. Layer B: Nighttime Illumination (NASA VIIRS Black Marble / DNB + Workbench Raster Overlays)
      try {
        // Global NASA GIBS VIIRS Nighttime Lights WMTS tile layer
        if (layerBEnabled && viirsGlobalGibs) {
          if (!map.getSource('nasa-gibs-viirs')) {
            map.addSource('nasa-gibs-viirs', {
              type: 'raster',
              tiles: [
                'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_CityLights_2012/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg',
              ],
              tileSize: 256,
              maxzoom: 8,
              attribution:
                'NASA Earth Observatory / NOAA Suomi NPP VIIRS_CityLights_2012 (Public Domain · z ≤ 8)',
            });
            map.addLayer(
              {
                id: 'nasa-gibs-viirs-layer',
                type: 'raster',
                source: 'nasa-gibs-viirs',
                minzoom: 0,
                maxzoom: 8,
                paint: { 'raster-opacity': viirsOpacity },
              },
              firstVectorLayerId,
            );
          } else if (map.getLayer('nasa-gibs-viirs-layer')) {
            map.setPaintProperty(
              'nasa-gibs-viirs-layer',
              'raster-opacity',
              viirsOpacity,
            );
          }
        } else {
          if (map.getLayer('nasa-gibs-viirs-layer')) {
            map.removeLayer('nasa-gibs-viirs-layer');
          }
          if (map.getSource('nasa-gibs-viirs')) {
            map.removeSource('nasa-gibs-viirs');
          }
        }

        const inferredRasterUrl =
          rasterOverlayUrl ??
          (isDemoProject && effectiveRasterOverlay === 'nightlights'
            ? `/api/v1/spikes/viirs-overlay?period=${viirsPeriod}`
            : isDemoProject && layerBEnabled
              ? `/api/v1/spikes/viirs-overlay?period=${viirsPeriod}`
              : null);
        const baseOverlayUrl =
          inferredRasterUrl &&
          effectiveRasterOverlay === 'nightlights' &&
          !inferredRasterUrl.includes('period=')
            ? `${inferredRasterUrl}${inferredRasterUrl.includes('?') ? '&' : '?'}period=${viirsPeriod}`
            : inferredRasterUrl;
        const activeOverlayUrl = baseOverlayUrl
          ? rasterRetryToken > 0
            ? `${baseOverlayUrl}${baseOverlayUrl.includes('?') ? '&' : '?'}retry=${rasterRetryToken}`
            : baseOverlayUrl
          : null;
        const effectiveOpacity =
          effectiveRasterOverlay !== 'none'
            ? effectiveEnvRasterOpacity
            : viirsOpacity;

        if (activeOverlayUrl) {
          const aoiBbox = aoiGeometry ? computeGeoJsonBbox(aoiGeometry) : null;
          const minLon = aoiBbox ? aoiBbox[0] : 82.615;
          const minLat = aoiBbox ? aoiBbox[1] : 18.475;
          const maxLon = aoiBbox ? aoiBbox[2] : 82.785;
          const maxLat = aoiBbox ? aoiBbox[3] : 18.605;
          const bounds: [
            [number, number],
            [number, number],
            [number, number],
            [number, number],
          ] = [
            [minLon, maxLat],
            [maxLon, maxLat],
            [maxLon, minLat],
            [minLon, minLat],
          ];
          const nextRasterKey = `${activeOverlayUrl}|${bounds.flat().join(',')}`;
          const existingRaster = map.getSource('project-raster') as
            | maplibregl.ImageSource
            | undefined;
          if (!existingRaster) {
            map.addSource('project-raster', {
              type: 'image',
              url: activeOverlayUrl,
              coordinates: bounds,
            });
            map.addLayer(
              {
                id: 'project-raster-layer',
                type: 'raster',
                source: 'project-raster',
                paint: {
                  'raster-opacity': effectiveOpacity,
                },
              },
              firstVectorLayerId,
            );
            lastRasterKeyRef.current = nextRasterKey;
          } else {
            if (
              lastRasterKeyRef.current !== nextRasterKey &&
              typeof existingRaster.updateImage === 'function'
            ) {
              existingRaster.updateImage({
                url: activeOverlayUrl,
                coordinates: bounds,
              });
              lastRasterKeyRef.current = nextRasterKey;
            }
            if (map.getLayer('project-raster-layer')) {
              map.setPaintProperty(
                'project-raster-layer',
                'raster-opacity',
                effectiveOpacity,
              );
            }
          }
        } else {
          lastRasterKeyRef.current = null;
          if (map.getLayer('project-raster-layer')) {
            map.removeLayer('project-raster-layer');
          }
          if (map.getSource('project-raster')) {
            map.removeSource('project-raster');
          }
        }

        // Vector VIIRS Nighttime Radiance Glow Halos (strictly derived from active settlement points)
        const periodRadField = activePeriodMeta.radianceField;
        const viirsSourceFc: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: effectiveSettlementsFc.features.filter(
            (f) => f.geometry?.type === 'Point',
          ),
        };
        const glowTextExpr: maplibregl.DataDrivenPropertyValueSpecification<string> =
          [
            'case',
            ['has', periodRadField],
            [
              'concat',
              'VIIRS: ',
              ['to-string', ['get', periodRadField]],
              ' nW/cm²/sr',
            ],
            'VIIRS: Not sampled',
          ];
        upsertGeoJsonSource(map, 'viirs-radiance-source', viirsSourceFc);
        if (!map.getLayer('viirs-radiance-glow-outer')) {
          map.addLayer(
            {
              id: 'viirs-radiance-glow-outer',
              type: 'circle',
              source: 'viirs-radiance-source',
              paint: {
                'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['coalesce', ['get', periodRadField], ['get', 'lightscore_mean'], 0.05],
                  0.05,
                  10,
                  0.5,
                  16,
                  2.0,
                  24,
                  5.0,
                  34,
                  12.0,
                  42,
                ],
                'circle-color': [
                  'interpolate',
                  ['linear'],
                  ['coalesce', ['get', periodRadField], ['get', 'lightscore_mean'], 0.05],
                  0.05,
                  '#3B0F70',
                  0.5,
                  '#8C2981',
                  2.0,
                  '#DE4968',
                  5.0,
                  '#FE9F6D',
                  12.0,
                  '#FCFDBF',
                ],
                'circle-blur': 0.75,
                'circle-opacity': viirsOpacity * 0.65,
              },
            },
            firstVectorLayerId,
          );
          map.addLayer(
            {
              id: 'viirs-radiance-glow-label',
              type: 'symbol',
              source: 'viirs-radiance-source',
              minzoom: 12.2,
              layout: {
                'text-field': glowTextExpr as unknown as string,
                'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
                'text-size': 10,
                'text-offset': [0, -1.8],
                'text-anchor': 'bottom',
                'text-allow-overlap': false,
                'text-optional': true,
                'text-padding': 8,
              },
              paint: {
                'text-color': '#FEF08A',
                'text-halo-color': '#1E1B4B',
                'text-halo-width': 1.8,
              },
            },
          );
        } else {
          if (map.getLayer('viirs-radiance-glow-outer')) {
            map.setPaintProperty(
              'viirs-radiance-glow-outer',
              'circle-opacity',
              viirsOpacity * 0.65,
            );
          }
          if (map.getLayer('viirs-radiance-glow-label')) {
            try {
              map.setLayoutProperty(
                'viirs-radiance-glow-label',
                'text-field',
                glowTextExpr,
              );
            } catch {
              // Ignore layout property update error in mock map
            }
          }
        }
        setLayerVisibilitySafe(
          map,
          ['viirs-radiance-glow-outer', 'viirs-radiance-glow-label'],
          layerBEnabled && viirsHalosEnabled,
        );
      } catch {
        // Ignore raster update error
      }

      // 2. Layer C: Village Electrification Status (Census 2011 DCHB + LGD) & Active AOI Boundary
      try {
        const effectiveVillagesFc: GeoJSON.FeatureCollection =
          effectiveRefPack
            ? DEFAULT_VILLAGE_ELECTRIFICATION_FC
            : { type: 'FeatureCollection', features: [] };
        upsertGeoJsonSource(
          map,
          'village-electrification',
          effectiveVillagesFc,
        );
        if (!map.getLayer('village-status-fill')) {
          map.addLayer({
            id: 'village-status-fill',
            type: 'fill',
            source: 'village-electrification',
            paint: {
              'fill-color': [
                'match',
                ['get', 'electrification_status'],
                'ELECTRIFIED_GRID_CONNECTED',
                '#0072B2',
                'PARTIALLY_ELECTRIFIED_UNDERSERVED',
                '#E69F00',
                'REPORTED_UNELECTRIFIED_HABITATION',
                '#D55E00',
                '#52504A',
              ],
              'fill-opacity': 0.14,
            },
          });
          map.addLayer({
            id: 'village-status-outline',
            type: 'line',
            source: 'village-electrification',
            paint: {
              'line-color': [
                'match',
                ['get', 'electrification_status'],
                'ELECTRIFIED_GRID_CONNECTED',
                '#1B6E3A',
                'PARTIALLY_ELECTRIFIED_UNDERSERVED',
                '#E69F00',
                'REPORTED_UNELECTRIFIED_HABITATION',
                '#D55E00',
                '#64748B',
              ],
              'line-width': 2.2,
              'line-dasharray': [3, 2],
            },
          });
          map.addLayer({
            id: 'village-status-label',
            type: 'symbol',
            source: 'village-electrification',
            layout: {
              'text-field': [
                'concat',
                ['get', 'village_name'],
                ' (LGD ',
                ['get', 'lgd_code'],
                ' · ',
                ['to-string', ['coalesce', ['get', 'total_pop'], '']],
                ' pop)',
              ],
              'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
              'text-size': 11,
              'text-allow-overlap': false,
              'text-optional': true,
              'text-padding': 6,
              'text-max-width': 11,
            },
            paint: {
              'text-color': '#1E293B',
              'text-halo-color': 'rgba(255, 255, 255, 0.94)',
              'text-halo-width': 1.8,
            },
          });
        }
        setLayerVisibilitySafe(
          map,
          ['village-status-fill', 'village-status-outline', 'village-status-label'],
          layerCEnabled,
        );

        // Active AOI Polygon
        const aoiFc: GeoJSON.FeatureCollection = aoiGeometry
          ? {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: { boundary_source: boundarySource },
                  geometry: aoiGeometry,
                },
              ],
            }
          : { type: 'FeatureCollection', features: [] };

        upsertGeoJsonSource(map, 'aoi-source', aoiFc);
        if (!map.getLayer('aoi-fill')) {
          map.addLayer({
            id: 'aoi-fill',
            type: 'fill',
            source: 'aoi-source',
            paint: {
              'fill-color':
                boundarySource === 'APPROXIMATE_BUFFER' ? '#D97706' : '#0F172A',
              'fill-opacity': 0.08 * vectorOpacity,
            },
          });
        } else {
          map.setPaintProperty('aoi-fill', 'fill-opacity', 0.08 * vectorOpacity);
        }
        const outlineColor =
          boundarySource === 'APPROXIMATE_BUFFER' ? '#D97706' : '#0F172A';
        if (!map.getLayer('aoi-outline')) {
          const linePaint: maplibregl.LineLayerSpecification['paint'] = {
            'line-color': outlineColor,
            'line-width': 2.5,
            'line-opacity': vectorOpacity,
          };
          if (boundarySource === 'APPROXIMATE_BUFFER') {
            linePaint['line-dasharray'] = [4, 3];
          }
          map.addLayer({
            id: 'aoi-outline',
            type: 'line',
            source: 'aoi-source',
            paint: linePaint,
          });
        } else {
          map.setPaintProperty('aoi-outline', 'line-color', outlineColor);
          map.setPaintProperty('aoi-outline', 'line-opacity', vectorOpacity);
        }
        setLayerVisibilitySafe(map, ['aoi-fill', 'aoi-outline'], layerCEnabled);
      } catch {
        // Ignore AOI sync error
      }

      // 3. Layer D: Population, Settlements, Building Footprints & OSM Community Loads
      try {
        if (osmFeatures) {
          upsertGeoJsonSource(map, 'osm-features', osmFeatures);
          if (!map.getLayer('osm-lines')) {
            map.addLayer({
              id: 'osm-lines',
              type: 'line',
              source: 'osm-features',
              filter: ['==', ['geometry-type'], 'LineString'],
              paint: {
                'line-color': [
                  'match',
                  ['get', 'category'],
                  'ROAD',
                  '#6E6A61',
                  'WATERWAY',
                  '#0F5499',
                  '#9E998E',
                ],
                'line-width': 1.6,
              },
            });
            map.addLayer({
              id: 'osm-points',
              type: 'circle',
              source: 'osm-features',
              filter: ['==', ['geometry-type'], 'Point'],
              paint: {
                'circle-radius': 5,
                'circle-color': '#8A3FFC',
                'circle-stroke-color': '#FFFFFF',
                'circle-stroke-width': 1.2,
              },
            });
          }
        }
        setLayerVisibilitySafe(
          map,
          ['osm-lines', 'osm-points'],
          Boolean(osmFeatures) && layerDEnabled,
        );

        if (usesMvtBuildings && projectId) {
          if (!map.getSource('buildings-mvt')) {
            map.addSource('buildings-mvt', {
              type: 'vector',
              tiles: [`/api/v1/tiles/${projectId}/buildings/{z}/{x}/{y}.mvt`],
              minzoom: 10,
              maxzoom: 18,
            });
          }
          if (!map.getLayer('buildings-mvt-fill')) {
            map.addLayer({
              id: 'buildings-mvt-fill',
              type: 'fill',
              source: 'buildings-mvt',
              'source-layer': 'buildings',
              paint: {
                'fill-color': '#D97706',
                'fill-opacity': 0.72 * vectorOpacity,
                'fill-outline-color': '#78350F',
              },
            });
          }
        }
        if (referenceBuildings && !usesMvtBuildings) {
          upsertGeoJsonSource(map, 'ref-buildings', referenceBuildings);
          if (!map.getLayer('ref-buildings-fill')) {
            map.addLayer({
              id: 'ref-buildings-fill',
              type: 'fill',
              source: 'ref-buildings',
              paint: {
                'fill-color': [
                  'match',
                  ['get', 'size_class'],
                  'NON_RESIDENTIAL',
                  '#8A3FFC',
                  'OUTBUILDING',
                  '#9E998E',
                  'NOISE',
                  '#C8C2B4',
                  '#D97706',
                ],
                'fill-opacity': [
                  'case',
                  ['==', ['get', 'is_excluded'], true],
                  0.25,
                  0.75,
                ],
                'fill-outline-color': '#78350F',
              },
            });
          }
        }
        setLayerVisibilitySafe(
          map,
          ['ref-buildings-fill'],
          Boolean(referenceBuildings) && !usesMvtBuildings && layerDEnabled,
        );
        setLayerVisibilitySafe(
          map,
          ['buildings-mvt-fill'],
          usesMvtBuildings && layerDEnabled,
        );

        upsertGeoJsonSource(map, 'settlement-clusters', effectiveSettlementsFc);
        if (!map.getLayer('clusters-hull-fill')) {
          map.addLayer({
            id: 'clusters-hull-fill',
            type: 'fill',
            source: 'settlement-clusters',
            filter: ['==', ['geometry-type'], 'Polygon'],
            paint: {
              'fill-color': [
                'case',
                [
                  'in',
                  ['get', 'verification_state'],
                  ['literal', ['VERIFIED', 'VERIFIED_BY_EVIDENCE', 'SURVEY_VERIFIED']],
                ],
                '#009E73',
                [
                  'match',
                  ['get', 'proxy_class'],
                  'LIKELY_ELECTRIFIED',
                  '#0072B2',
                  'POTENTIALLY_UNDERSERVED',
                  '#E69F00',
                  'POTENTIALLY_UNSERVED',
                  '#D55E00',
                  '#64748B',
                ],
              ],
              'fill-opacity': 0.16,
            },
          });
          map.addLayer({
            id: 'clusters-hull-outline',
            type: 'line',
            source: 'settlement-clusters',
            filter: ['==', ['geometry-type'], 'Polygon'],
            paint: {
              'line-color': [
                'case',
                [
                  'in',
                  ['get', 'verification_state'],
                  ['literal', ['VERIFIED', 'VERIFIED_BY_EVIDENCE', 'SURVEY_VERIFIED']],
                ],
                '#009E73',
                [
                  'match',
                  ['get', 'proxy_class'],
                  'LIKELY_ELECTRIFIED',
                  '#0072B2',
                  'POTENTIALLY_UNDERSERVED',
                  '#E69F00',
                  'POTENTIALLY_UNSERVED',
                  '#D55E00',
                  '#64748B',
                ],
              ],
              'line-width': 2.2,
              'line-dasharray': [
                'case',
                [
                  'in',
                  ['get', 'verification_state'],
                  ['literal', ['VERIFIED', 'VERIFIED_BY_EVIDENCE', 'SURVEY_VERIFIED']],
                ],
                ['literal', [1]],
                ['literal', [3, 2]],
              ],
            },
          });
          map.addLayer({
            id: 'clusters-centroid-circle',
            type: 'circle',
            source: 'settlement-clusters',
            filter: ['==', ['geometry-type'], 'Point'],
            paint: {
              'circle-radius': [
                'case',
                ['==', ['get', 'id'], selectedClusterId ?? ''],
                11,
                8,
              ],
              'circle-color': [
                'case',
                [
                  'in',
                  ['get', 'verification_state'],
                  ['literal', ['VERIFIED', 'VERIFIED_BY_EVIDENCE', 'SURVEY_VERIFIED']],
                ],
                '#009E73',
                [
                  'match',
                  ['get', 'proxy_class'],
                  'LIKELY_ELECTRIFIED',
                  '#0072B2',
                  'POTENTIALLY_UNDERSERVED',
                  '#E69F00',
                  'POTENTIALLY_UNSERVED',
                  '#D55E00',
                  '#64748B',
                ],
              ],
              'circle-stroke-color': [
                'case',
                [
                  'in',
                  ['get', 'verification_state'],
                  ['literal', ['VERIFIED', 'VERIFIED_BY_EVIDENCE', 'SURVEY_VERIFIED']],
                ],
                '#0F172A',
                '#FFFFFF',
              ],
              'circle-stroke-width': [
                'case',
                [
                  'in',
                  ['get', 'verification_state'],
                  ['literal', ['VERIFIED', 'VERIFIED_BY_EVIDENCE', 'SURVEY_VERIFIED']],
                ],
                3.0,
                1.8,
              ],
            },
          });
          map.addLayer({
            id: 'clusters-label',
            type: 'symbol',
            source: 'settlement-clusters',
            minzoom: 12.0,
            filter: ['==', ['geometry-type'], 'Point'],
            layout: {
              'text-field': [
                'concat',
                ['coalesce', ['get', 'cluster_code'], ['get', 'label'], 'CL'],
                ' · ',
                ['coalesce', ['get', 'name'], 'Habitation'],
                ' (',
                [
                  'to-string',
                  [
                    'coalesce',
                    ['get', 'estimated_households'],
                    ['get', 'est_households'],
                    '',
                  ],
                ],
                ' HH)',
              ],
              'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
              'text-size': 10.5,
              'text-offset': [0, 1.3],
              'text-anchor': 'top',
              'text-allow-overlap': false,
              'text-optional': true,
              'text-padding': 8,
              'text-max-width': 12,
            },
            paint: {
              'text-color': '#141413',
              'text-halo-color': 'rgba(255, 255, 255, 0.94)',
              'text-halo-width': 1.8,
            },
          });
        }
        setLayerVisibilitySafe(
          map,
          [
            'clusters-hull-fill',
            'clusters-hull-outline',
            'clusters-centroid-circle',
            'clusters-label',
          ],
          layerDEnabled,
        );
      } catch {
        // Ignore Layer D error
      }

      // 4. Layer A: Existing Electricity Infrastructure (33 kV, 11 kV, Substations, DTs, Towers, Poles)
      try {
        upsertGeoJsonSource(map, 'layer-a-existing-infra', mergedLayerAInfra);
        if (!map.getLayer('layer-a-33kv-lines')) {
          // 33 kV Sub-Transmission Lines (Bold Purple)
          map.addLayer({
            id: 'layer-a-33kv-lines',
            type: 'line',
            source: 'layer-a-existing-infra',
            filter: [
              'all',
              ['==', ['geometry-type'], 'LineString'],
              ['>=', ['coalesce', ['get', 'voltage_kv'], 11], 33],
            ],
            paint: {
              'line-color': '#6D28D9',
              'line-width': 3.8,
            },
          });
          // 11 kV Primary Distribution Lines (Solid Deep Crimson)
          map.addLayer({
            id: 'layer-a-11kv-lines',
            type: 'line',
            source: 'layer-a-existing-infra',
            filter: [
              'all',
              ['==', ['geometry-type'], 'LineString'],
              ['<', ['coalesce', ['get', 'voltage_kv'], 11], 33],
            ],
            paint: {
              'line-color': '#991B1B',
              'line-width': 2.8,
            },
          });
          // Substations (Large Purple/Gold Nodes)
          map.addLayer({
            id: 'layer-a-substations',
            type: 'circle',
            source: 'layer-a-existing-infra',
            filter: ['==', ['get', 'infra_category'], 'SUBSTATION'],
            paint: {
              'circle-radius': 10.0,
              'circle-color': '#4C1D95',
              'circle-stroke-color': '#FDE047',
              'circle-stroke-width': 2.8,
            },
          });
          // Existing Distribution Transformers & Tie-Ins (Teal / Amber Nodes)
          map.addLayer({
            id: 'layer-a-transformers',
            type: 'circle',
            source: 'layer-a-existing-infra',
            filter: [
              'in',
              ['get', 'infra_category'],
              ['literal', ['TRANSFORMER', 'TIE_IN']],
            ],
            paint: {
              'circle-radius': [
                'match',
                ['get', 'provenance'],
                'USER_ASSUMED',
                8.0,
                7.5,
              ],
              'circle-color': [
                'match',
                ['get', 'provenance'],
                'USER_ASSUMED',
                '#D97706',
                '#0F766E',
              ],
              'circle-stroke-color': [
                'match',
                ['get', 'provenance'],
                'USER_ASSUMED',
                '#FEF08A',
                '#FFFFFF',
              ],
              'circle-stroke-width': 2.2,
            },
          });
          // Towers and Poles (Distinct Slate Support Nodes)
          map.addLayer({
            id: 'layer-a-towers-poles',
            type: 'circle',
            source: 'layer-a-existing-infra',
            filter: [
              'in',
              ['get', 'infra_category'],
              ['literal', ['TOWER', 'POLE']],
            ],
            paint: {
              'circle-radius': [
                'match',
                ['get', 'infra_category'],
                'TOWER',
                5.8,
                4.2,
              ],
              'circle-color': [
                'match',
                ['get', 'infra_category'],
                'TOWER',
                '#334155',
                '#64748B',
              ],
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': 1.5,
            },
          });
          // Labels for Substations, Transformers & Tie-Ins with Voltage Context
          map.addLayer({
            id: 'layer-a-labels',
            type: 'symbol',
            source: 'layer-a-existing-infra',
            minzoom: 13.0,
            filter: [
              'in',
              ['get', 'infra_category'],
              ['literal', ['SUBSTATION', 'TRANSFORMER', 'TIE_IN']],
            ],
            layout: {
              'text-field': [
                'concat',
                ['coalesce', ['get', 'name'], 'Grid Asset'],
                ' [',
                ['to-string', ['coalesce', ['get', 'voltage_kv'], 11]],
                ' kV]',
              ],
              'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
              'text-size': 10,
              'text-offset': [0, -1.6],
              'text-anchor': 'bottom',
              'text-allow-overlap': false,
              'text-optional': true,
              'text-padding': 8,
              'text-max-width': 13,
            },
            paint: {
              'text-color': '#1E1B4B',
              'text-halo-color': 'rgba(255, 255, 255, 0.94)',
              'text-halo-width': 1.8,
            },
          });
        }
        setLayerVisibilitySafe(
          map,
          [
            'layer-a-33kv-lines',
            'layer-a-11kv-lines',
            'layer-a-substations',
            'layer-a-transformers',
            'layer-a-towers-poles',
            'layer-a-labels',
          ],
          layerAEnabled,
        );
      } catch {
        // Ignore Layer A error
      }

      // 5. Layer E: Potential Electrification Gaps (Multi-Evidence Corridors)
      try {
        upsertGeoJsonSource(map, 'gap-corridors', effectiveGapsFc);
        if (!map.getLayer('gap-corridors-line')) {
          map.addLayer({
            id: 'gap-corridors-line',
            type: 'line',
            source: 'gap-corridors',
            paint: {
              'line-color': [
                'match',
                ['get', 'gap_severity'],
                'HIGH_UNSERVED_CANDIDATE',
                '#DC2626',
                'MODERATE_UNDERSERVED_CANDIDATE',
                '#D97706',
                '#7C3AED',
              ],
              'line-width': 2.8,
              'line-dasharray': [2, 2],
            },
          });
        }
        setLayerVisibilitySafe(map, ['gap-corridors-line'], layerEEnabled);
      } catch {
        // Ignore Layer E error
      }

      // 6. Layer F: Proposed Electricity Network Extensions (11 kV HT + 415 V LT + Proposed DTs + Mini-Grid)
      try {
        upsertGeoJsonSource(map, 'network-layout', effectiveProposedFc);
        if (!map.getLayer('network-ht-lines')) {
          map.addLayer({
            id: 'network-ht-lines',
            type: 'line',
            source: 'network-layout',
            filter: ['==', ['get', 'layer_type'], 'HT_11KV_PROPOSED'],
            paint: {
              'line-color': '#DC2626',
              'line-width': 3.2,
              'line-dasharray': [4, 2],
            },
          });
          map.addLayer({
            id: 'network-lt-lines',
            type: 'line',
            source: 'network-layout',
            filter: ['==', ['get', 'layer_type'], 'LT_415V_PROPOSED'],
            paint: {
              'line-color': '#0284C7',
              'line-width': 2.6,
              'line-dasharray': [2, 1.5],
            },
          });
          map.addLayer({
            id: 'network-dt-points',
            type: 'circle',
            source: 'network-layout',
            filter: [
              'in',
              ['get', 'layer_type'],
              ['literal', ['DT_PROPOSED', 'MINIGRID_PROPOSED']],
            ],
            paint: {
              'circle-radius': 7.8,
              'circle-color': [
                'match',
                ['get', 'layer_type'],
                'MINIGRID_PROPOSED',
                '#0284C7',
                '#DC2626',
              ],
              'circle-stroke-color': '#FEF08A',
              'circle-stroke-width': 2.4,
            },
          });
          map.addLayer({
            id: 'network-proposed-labels',
            type: 'symbol',
            source: 'network-layout',
            minzoom: 12.8,
            filter: [
              'in',
              ['get', 'layer_type'],
              ['literal', ['DT_PROPOSED', 'MINIGRID_PROPOSED']],
            ],
            layout: {
              'text-field': [
                'concat',
                '[PRELIMINARY] ',
                ['coalesce', ['get', 'name'], 'Proposed Node'],
              ],
              'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
              'text-size': 9.5,
              'text-offset': [0, -1.3],
              'text-anchor': 'bottom',
              'text-allow-overlap': false,
              'text-optional': true,
              'text-padding': 6,
            },
            paint: {
              'text-color': '#991B1B',
              'text-halo-color': '#FEF9C3',
              'text-halo-width': 1.5,
            },
          });
        }
        setLayerVisibilitySafe(
          map,
          [
            'network-ht-lines',
            'network-lt-lines',
            'network-dt-points',
            'network-proposed-labels',
          ],
          layerFEnabled,
        );
      } catch {
        // Ignore Layer F error
      }

      // 7. Interactive Distance & Area Measurement Overlay + Draft AOI Drawing
      try {
        const activePts = measureModeActive ? measurePoints : drawnVertices;
        const draftFeatures: GeoJSON.Feature[] = [];
        if (activePts.length >= 3) {
          const ring = [...activePts, activePts[0]!];
          draftFeatures.push({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [ring],
            },
          });
        } else if (activePts.length === 2) {
          draftFeatures.push({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: activePts,
            },
          });
        }
        for (const pt of activePts) {
          draftFeatures.push({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: pt,
            },
          });
        }

        upsertGeoJsonSource(map, 'draft-draw', {
          type: 'FeatureCollection',
          features: draftFeatures,
        });
        if (!map.getLayer('draft-draw-fill')) {
          map.addLayer({
            id: 'draft-draw-fill',
            type: 'fill',
            source: 'draft-draw',
            filter: ['==', ['geometry-type'], 'Polygon'],
            paint: {
              'fill-color': '#0F5499',
              'fill-opacity': 0.16,
            },
          });
          map.addLayer({
            id: 'draft-draw-line',
            type: 'line',
            source: 'draft-draw',
            paint: {
              'line-color': '#0F5499',
              'line-width': 2.4,
              'line-dasharray': [2, 2],
            },
          });
          map.addLayer({
            id: 'draft-draw-points',
            type: 'circle',
            source: 'draft-draw',
            filter: ['==', ['geometry-type'], 'Point'],
            paint: {
              'circle-radius': 5.5,
              'circle-color': '#0F5499',
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': 1.8,
            },
          });
        }
      } catch {
        // Ignore draft polygon error
      }

      // 8. Dynamic Vector Layer Transparency (Phase 4 Opacity Control)
      try {
        if (map.getLayer('village-status-fill')) {
          map.setPaintProperty(
            'village-status-fill',
            'fill-opacity',
            Number((0.12 * vectorOpacity).toFixed(3)),
          );
        }
        if (map.getLayer('ref-buildings-fill')) {
          map.setPaintProperty(
            'ref-buildings-fill',
            'fill-opacity',
            Number((0.75 * vectorOpacity).toFixed(3)),
          );
        }
        if (map.getLayer('buildings-mvt-fill')) {
          map.setPaintProperty(
            'buildings-mvt-fill',
            'fill-opacity',
            Number((0.72 * vectorOpacity).toFixed(3)),
          );
        }
        if (map.getLayer('clusters-hull-fill')) {
          map.setPaintProperty(
            'clusters-hull-fill',
            'fill-opacity',
            Number((0.22 * vectorOpacity).toFixed(3)),
          );
        }
        for (const circleLayerId of [
          'clusters-centroid-circle',
          'layer-a-substations',
          'layer-a-transformers',
          'layer-a-towers-poles',
          'network-dt-points',
          'osm-points',
        ]) {
          if (map.getLayer(circleLayerId)) {
            map.setPaintProperty(circleLayerId, 'circle-opacity', vectorOpacity);
            map.setPaintProperty(
              circleLayerId,
              'circle-stroke-opacity',
              vectorOpacity,
            );
          }
        }
        for (const lineLayerId of [
          'layer-a-33kv-lines',
          'layer-a-11kv-lines',
          'network-ht-lines',
          'network-lt-lines',
          'gap-corridors-line',
          'village-status-outline',
          'clusters-hull-outline',
          'osm-lines',
        ]) {
          if (map.getLayer(lineLayerId)) {
            map.setPaintProperty(lineLayerId, 'line-opacity', vectorOpacity);
          }
        }
      } catch {
        // Ignore paint property update error during style reload
      }

      if (
        typeof (map as { triggerRepaint?: () => void }).triggerRepaint ===
        'function'
      ) {
        (map as { triggerRepaint: () => void }).triggerRepaint();
      }
    },
    [
      basemap,
      aoiGeometry,
      boundarySource,
      projectId,
      isDemoProject,
      usesMvtBuildings,
      effectiveRefPack,
      referenceBuildings,
      osmFeatures,
      effectiveSettlementsFc,
      mergedLayerAInfra,
      effectiveGapsFc,
      effectiveProposedFc,
      selectedClusterId,
      rasterOverlayUrl,
      effectiveRasterOverlay,
      effectiveEnvRasterOpacity,
      rasterRetryToken,
      activePeriodMeta.radianceField,
      drawnVertices,
      measureModeActive,
      measurePoints,
      layerAEnabled,
      layerBEnabled,
      viirsPeriod,
      viirsGlobalGibs,
      viirsHalosEnabled,
      viirsOpacity,
      layerCEnabled,
      layerDEnabled,
      layerEEnabled,
      layerFEnabled,
      vectorOpacity,
    ],
  );

  const syncLayersRef = useRef(syncLayers);
  syncLayersRef.current = syncLayers;

  const interactionRef = useRef({
    drawModeActive,
    measureModeActive,
    onDrawnPolygonChange,
    placeTieInModeActive,
    onPlaceTieInPoint,
    onSelectCluster,
    viirsRadianceField: activePeriodMeta.radianceField,
    hasActiveSatelliteOrRaster:
      basemap === 'satellite' ||
      layerBEnabled ||
      effectiveRasterOverlay !== 'none',
  });
  interactionRef.current = {
    drawModeActive,
    measureModeActive,
    onDrawnPolygonChange,
    placeTieInModeActive,
    onPlaceTieInPoint,
    onSelectCluster,
    viirsRadianceField: activePeriodMeta.radianceField,
    hasActiveSatelliteOrRaster:
      basemap === 'satellite' ||
      layerBEnabled ||
      effectiveRasterOverlay !== 'none',
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const aoiBbox = aoiGeometry ? computeGeoJsonBbox(aoiGeometry) : null;
    const initialCenter: [number, number] = aoiBbox
      ? [(aoiBbox[0] + aoiBbox[2]) / 2, (aoiBbox[1] + aoiBbox[3]) / 2]
      : isDemoProject
        ? KORAPUT_DEFAULT_CENTER
        : INDIA_DEFAULT_CENTER;
    const initialZoom = aoiBbox
      ? 11.5
      : isDemoProject
        ? KORAPUT_DEFAULT_ZOOM
        : INDIA_DEFAULT_ZOOM;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildBasemapStyle(basemap),
      center: initialCenter,
      zoom: initialZoom,
      minZoom,
      maxZoom,
      maxBounds,
      renderWorldCopies: false,
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true, showZoom: true }),
      'top-right',
    );
    map.addControl(
      new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }),
      'bottom-left',
    );
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-right',
    );

    map.on('mousemove', (e: maplibregl.MapMouseEvent) => {
      if (e?.lngLat) {
        setCursorCoords({
          lon: Number(e.lngLat.lng.toFixed(5)),
          lat: Number(e.lngLat.lat.toFixed(5)),
        });
      }
      const canvasEl = map.getCanvas?.();
      if (
        interactionRef.current.placeTieInModeActive ||
        interactionRef.current.drawModeActive ||
        interactionRef.current.measureModeActive
      ) {
        if (canvasEl?.style) canvasEl.style.cursor = 'crosshair';
        setHoveredFeatureHint(null);
        return;
      }

      try {
        const hoverLayers = [
          'layer-a-substations',
          'layer-a-transformers',
          'layer-a-towers-poles',
          'layer-a-33kv-lines',
          'layer-a-11kv-lines',
          'network-dt-points',
          'network-ht-lines',
          'network-lt-lines',
          'clusters-centroid-circle',
          'clusters-hull-fill',
          'ref-buildings-fill',
          'buildings-mvt-fill',
          'viirs-radiance-glow-outer',
          'gap-corridors-line',
          'village-status-fill',
        ].filter((id) => Boolean(map.getLayer(id)));

        if (hoverLayers.length > 0 && e?.point) {
          const hits = map.queryRenderedFeatures(e.point, {
            layers: hoverLayers,
          });
          if (hits && hits.length > 0) {
            if (canvasEl?.style) canvasEl.style.cursor = 'pointer';
            const top = hits[0]!;
            const p = top.properties ?? {};
            const lid = top.layer.id;
            const title = String(
              p.name ??
                p.cluster_code ??
                p.gap_code ??
                (lid === 'ref-buildings-fill' || lid === 'buildings-mvt-fill'
                  ? `Structure ${String(p.id ?? '')}`.trim()
                  : undefined) ??
                (p.village_name ? `Village ${String(p.village_name)}` : 'GIS Feature'),
            );
            const subtitle = lid.startsWith('network-')
              ? `${String(p.layer_type ?? 'PROPOSED')} · PRELIMINARY (NOT INSTALLED)`
              : lid.startsWith('layer-a-')
                ? `${String(p.infra_category ?? p.asset_type ?? 'GRID')} · ${String(p.voltage_kv ?? '')} kV`
                : lid === 'viirs-radiance-glow-outer'
                  ? p[interactionRef.current.viirsRadianceField] !== undefined
                    ? `VIIRS DNB: ${String(p[interactionRef.current.viirsRadianceField])} nW/cm²/sr · ${String(p.proxy_class ?? 'PROXY')}`
                    : `VIIRS DNB: Not sampled · ${String(p.proxy_class ?? 'PROXY')}`
                  : lid === 'ref-buildings-fill' || lid === 'buildings-mvt-fill'
                    ? `${p.area_m2 !== undefined ? `${Number(p.area_m2).toFixed(1)} m²` : 'Building'} · Structure Footprint`
                    : lid.startsWith('clusters-')
                      ? `${String(p.proxy_class ?? 'PROXY')} · ${String(p.estimated_households ?? p.est_households ?? '')} HH`
                      : lid === 'village-status-fill'
                        ? `LGD ${String(p.lgd_code ?? '')} · ${String(p.total_pop ?? '')} Pop`
                        : String(p.gap_severity ?? 'GAP CORRIDOR');
            const badge = lid.startsWith('network-')
              ? 'PRELIMINARY'
              : lid === 'viirs-radiance-glow-outer'
                ? 'VIIRS RADIANCE'
                : lid === 'ref-buildings-fill' || lid === 'buildings-mvt-fill'
                  ? 'FOOTPRINT PROXY'
                  : String(p.provenance ?? p.verification_state ?? 'CLICK TO INSPECT');
            setHoveredFeatureHint({ title, subtitle, badge });
          } else {
            if (canvasEl?.style) canvasEl.style.cursor = '';
            setHoveredFeatureHint(null);
          }
        }
      } catch {
        // Ignore hover query errors in headless tests
      }
    });

    map.on('zoomend', () => {
      setZoomLevel(Number(map.getZoom().toFixed(2)));
    });

    map.on('dataloading', (evt) => {
      const sid = 'sourceId' in evt ? evt.sourceId : undefined;
      if (
        sid === 'eox-s2' ||
        sid === 'nasa-gibs-viirs' ||
        sid === 'project-raster' ||
        interactionRef.current.hasActiveSatelliteOrRaster
      ) {
        beginRasterLoad();
      }
    });

    map.on(
      'sourcedata',
      (evt: { sourceId?: string; isSourceLoaded?: boolean }) => {
        if (
          evt?.isSourceLoaded &&
          (evt.sourceId === 'eox-s2' ||
            evt.sourceId === 'nasa-gibs-viirs' ||
            evt.sourceId === 'project-raster')
        ) {
          endRasterLoad();
        }
      },
    );

    map.on('idle', () => {
      endRasterLoad();
    });

    map.on(
      'error',
      (err: {
        error?: { message?: string; status?: number };
        sourceId?: string;
      }) => {
        const msg = err?.error?.message ?? '';
        const status = err?.error?.status;
        if (msg.includes('AbortError') || msg.toLowerCase().includes('aborted')) {
          return;
        }
        const looksLikeTileOrRasterFailure =
          (typeof status === 'number' && status >= 400) ||
          /404|403|500|502|503|Failed to fetch|NetworkError|timeout|Load failed|image|tile/i.test(
            msg,
          );
        if (looksLikeTileOrRasterFailure) {
          endRasterLoad();
          const sourceLabel =
            err?.sourceId === 'nasa-gibs-viirs'
              ? 'NASA GIBS VIIRS_CityLights_2012 tile server'
              : err?.sourceId === 'eox-s2'
                ? 'EOX Sentinel-2 2020 tile server'
                : err?.sourceId === 'project-raster'
                  ? 'AOI raster overlay image'
                  : 'External satellite/tile server';
          setTileWarning(
            `${sourceLabel} temporarily unreachable (${status ? `HTTP ${status}` : msg || 'network error'}); displaying local survey coordinate grid and GIS vector overlays.`,
          );
        }
      },
    );

    map.on('click', (e: maplibregl.MapMouseEvent) => {
      if (!e?.lngLat) return;
      const lon = Number(e.lngLat.lng.toFixed(6));
      const lat = Number(e.lngLat.lat.toFixed(6));

      if (interactionRef.current.placeTieInModeActive) {
        setPendingTieInPoint({ lon, lat });
        return;
      }

      if (interactionRef.current.measureModeActive) {
        setMeasurePoints((prev) => [...prev, [lon, lat]]);
        return;
      }

      if (interactionRef.current.drawModeActive) {
        const pt: [number, number] = [lon, lat];
        setDrawnVertices((prev) => {
          const next = [...prev, pt];
          if (next.length >= 3) {
            const ring = [...next, next[0]!];
            interactionRef.current.onDrawnPolygonChange?.(
              {
                type: 'Polygon',
                coordinates: [ring],
              },
              next.length,
            );
          } else {
            interactionRef.current.onDrawnPolygonChange?.(null, next.length);
          }
          return next;
        });
        return;
      }

      // Query interactive electricity GIS layers for contextual feature inspection
      const candidateLayers = [
        'layer-a-substations',
        'layer-a-transformers',
        'layer-a-towers-poles',
        'layer-a-33kv-lines',
        'layer-a-11kv-lines',
        'network-dt-points',
        'network-ht-lines',
        'network-lt-lines',
        'clusters-centroid-circle',
        'clusters-hull-fill',
        'viirs-radiance-glow-outer',
        'gap-corridors-line',
        'ref-buildings-fill',
        'buildings-mvt-fill',
        'village-status-fill',
      ].filter((id) => Boolean(map.getLayer(id)));

      if (candidateLayers.length === 0) return;
      const hits = map.queryRenderedFeatures(e.point, {
        layers: candidateLayers,
      });
      if (!hits || hits.length === 0) return;

      const topHit = hits[0]!;
      const props = (topHit.properties ?? {}) as Record<string, unknown>;
      const layerId = topHit.layer.id;

      if (
        (layerId === 'clusters-centroid-circle' ||
          layerId === 'clusters-hull-fill') &&
        props.id &&
        interactionRef.current.onSelectCluster
      ) {
        interactionRef.current.onSelectCluster(String(props.id));
      }

      const isProjectLayer =
        (layerId.startsWith('clusters-') &&
          Boolean(settlementClusters && settlementClusters.features.length > 0)) ||
        (layerId.startsWith('network-') &&
          Boolean(networkLayout && networkLayout.features.length > 0)) ||
        (layerId === 'gap-corridors-line' &&
          Boolean(gapCorridors && gapCorridors.features.length > 0));

      setInspectedFeature(
        buildInspectedFeatureFromMapProperties(
          layerId,
          props,
          [lon, lat],
          isProjectLayer,
        ),
      );
    });

    map.on('load', () => {
      map.resize();
      syncLayersRef.current(map);
    });

    map.on('style.load', () => {
      syncLayersRef.current(map);
    });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        try {
          map.resize();
        } catch {
          // Ignore after unmount
        }
      });
      resizeObserver.observe(containerRef.current);
    }

    mapRef.current = map;

    return () => {
      clearRasterLoadTimer();
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    syncLayers(map);
    if (!map.isStyleLoaded()) {
      const handleReady = () => {
        syncLayersRef.current(map);
      };
      map.once('load', handleReady);
      map.once('idle', handleReady);
      return () => {
        map.off('load', handleReady);
        map.off('idle', handleReady);
      };
    }
  }, [syncLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !aoiGeometry) return;
    const bbox = computeGeoJsonBbox(aoiGeometry);
    if (!bbox) return;
    const bboxKey = bbox.map((n) => n.toFixed(4)).join(',');
    if (lastFittedBboxRef.current === bboxKey) return;
    lastFittedBboxRef.current = bboxKey;
    try {
      map.fitBounds(
        [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]],
        ],
        { padding: 44, duration: 400, maxZoom: 15.5 },
      );
    } catch {
      // Ignore in unit tests
    }
  }, [aoiGeometry]);

  const handleBasemapChange = (nextMode: BasemapMode) => {
    setBasemap(nextMode);
    setTileWarning(null);
    lastRasterKeyRef.current = null;
    if (nextMode === 'satellite') {
      beginRasterLoad();
    } else if (!layerBEnabled && effectiveRasterOverlay === 'none') {
      endRasterLoad();
    }
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(buildBasemapStyle(nextMode));
    const reSync = () => {
      syncLayersRef.current(map);
    };
    map.once('style.load', reSync);
    map.once('idle', reSync);
    setTimeout(reSync, 60);
  };

  // Combine project clusters/infrastructure with static Koraput catalog (demo project only)
  const combinedSearchCatalog = React.useMemo<SearchableLocationItem[]>(() => {
    const dynamicItems: SearchableLocationItem[] = [];
    for (const feat of settlementClusters?.features ?? []) {
      const props = feat.properties ?? {};
      const id = String(props.id ?? '');
      if (!id || !feat.geometry || (isDemoProject && KORAPUT_SEARCH_CATALOG.some((c) => c.id === id))) {
        continue;
      }
      const bbox = computeGeoJsonBbox(feat.geometry);
      if (!bbox) continue;
      dynamicItems.push({
        id,
        label: `${String(props.cluster_code ?? props.label ?? 'CL')} · ${String(props.name ?? 'Project Habitation Cluster')}`,
        category:
          props.proxy_class === 'POTENTIALLY_UNSERVED' ||
          props.proxy_class === 'POTENTIALLY_UNDERSERVED'
            ? 'GAP_ZONE'
            : 'SETTLEMENT',
        lon: Number(((bbox[0] + bbox[2]) / 2).toFixed(5)),
        lat: Number(((bbox[1] + bbox[3]) / 2).toFixed(5)),
        zoom: 14.8,
        summary: `Project Cluster · ${String(props.estimated_households ?? props.building_count ?? 'N/A')} Est. HH · ${String(props.proxy_class ?? 'UNKNOWN')}`,
      });
    }
    for (const feat of infrastructureAssets?.features ?? []) {
      const props = feat.properties ?? {};
      const id = String(props.id ?? '');
      const cat = String(props.asset_type ?? props.infra_category ?? '').toUpperCase();
      if (!id || !feat.geometry || (!cat.includes('SUBSTATION') && !cat.includes('TRANSFORMER') && !cat.includes('TIE_IN'))) {
        continue;
      }
      const bbox = computeGeoJsonBbox(feat.geometry);
      if (!bbox) continue;
      dynamicItems.push({
        id,
        label: String(props.name ?? `${cat} Asset`),
        category: 'SUBSTATION',
        lon: Number(((bbox[0] + bbox[2]) / 2).toFixed(5)),
        lat: Number(((bbox[1] + bbox[3]) / 2).toFixed(5)),
        zoom: 15.0,
        summary: `${cat} · ${String(props.provenance ?? 'PROJECT')}`,
      });
    }
    return isDemoProject ? [...dynamicItems, ...KORAPUT_SEARCH_CATALOG] : dynamicItems;
  }, [settlementClusters, infrastructureAssets, isDemoProject]);

  const handleSearchInput = (val: string) => {
    setSearchQuery(val);
    const q = val.trim().toLowerCase();
    if (!q) {
      setSearchResults([]);
      return;
    }
    const localHits = combinedSearchCatalog.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q),
    );
    setSearchResults(localHits);
  };

  const handleRunOpenStreetMapSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearchError(null);
    const localHits = combinedSearchCatalog.filter(
      (item) =>
        item.label.toLowerCase().includes(q.toLowerCase()) ||
        item.summary.toLowerCase().includes(q.toLowerCase()),
    );
    if (localHits.length > 0) {
      setSearchResults(localHits);
      return;
    }
    setSearchingExternal(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&limit=4&q=${encodeURIComponent(q)}`,
      );
      if (res.ok) {
        const raw = (await res.json()) as Array<{
          place_id: number;
          display_name: string;
          lon: string;
          lat: string;
        }>;
        const mapped: SearchableLocationItem[] = raw.map((r) => ({
          id: `nom-${r.place_id}`,
          label: r.display_name,
          category: 'VILLAGE',
          lon: Number(r.lon),
          lat: Number(r.lat),
          zoom: 13.5,
          summary: 'OpenStreetMap Nominatim Geocoding Result (ODbL · Free)',
        }));
        setSearchResults(mapped);
        if (mapped.length === 0) {
          setSearchError(`No locations matched "${q}" in India (OSM Nominatim).`);
        }
      } else {
        setSearchError(
          `OSM Nominatim location search returned HTTP ${res.status}. Try panning manually or searching loaded assets.`,
        );
      }
    } catch {
      setSearchError(
        'Offline or OSM Nominatim geocoding server unreachable; showing local workspace results only.',
      );
    } finally {
      setSearchingExternal(false);
    }
  };

  const handleFlyToCoordinates = useCallback(
    (lon: number, lat: number, targetZoom = 14.8) => {
      setCursorCoords({ lon, lat });
      setZoomLevel(targetZoom);
      const map = mapRef.current;
      if (!map) return;
      try {
        map.flyTo({
          center: [lon, lat],
          zoom: targetZoom,
          duration: 500,
        });
      } catch {
        // Ignore in headless tests
      }
    },
    [],
  );

  const handleSelectSearchLocation = (loc: SearchableLocationItem) => {
    setSearchResults([]);
    setSearchQuery(loc.label);
    setActiveLocationId(loc.id);
    setInspectedFeature(buildInspectedFeatureFromSearchItem(loc));
    if (
      (loc.category === 'SETTLEMENT' || loc.category === 'GAP_ZONE') &&
      onSelectCluster
    ) {
      onSelectCluster(loc.id);
    }
    handleFlyToCoordinates(loc.lon, loc.lat, loc.zoom);
  };

  const handleClearDraw = () => {
    setDrawnVertices([]);
    onDrawnPolygonChange?.(null, 0);
  };

  const measuredLengthMeters = computePolylineLengthMeters(measurePoints);
  const measuredAreaM2 = computePolygonAreaM2(measurePoints);

  const hasProjectInfra = Boolean(
    infrastructureAssets && infrastructureAssets.features.length > 0,
  );
  const hasProjectClusters = Boolean(
    settlementClusters && settlementClusters.features.length > 0,
  );
  const hasProjectNetwork = Boolean(
    networkLayout && networkLayout.features.length > 0,
  );
  const hasProjectBuildings = Boolean(
    (referenceBuildings && referenceBuildings.features.length > 0) ||
      usesMvtBuildings,
  );
  const hasProjectGaps = Boolean(
    gapCorridors && gapCorridors.features.length > 0,
  );

  const activeLayerCount = [
    layerAEnabled && (isDemoProject || hasProjectInfra),
    layerBEnabled && (isDemoProject || Boolean(rasterOverlayUrl)),
    layerCEnabled && (isDemoProject || Boolean(aoiGeometry) || hasProjectClusters),
    layerDEnabled && (isDemoProject || hasProjectClusters || hasProjectBuildings),
    layerEEnabled && (isDemoProject || hasProjectGaps),
    layerFEnabled && (isDemoProject || hasProjectNetwork),
  ].filter(Boolean).length;

  const effectiveHeightClass = expandedCanvas ? 'h-[720px]' : heightClass;

  return (
    <div className="bg-sheet border border-rule-subtle rounded-xl shadow-card overflow-hidden flex flex-col">
      {variant === 'workbench' && (
        <>
          {/* Row 1: Top Specialised Electricity GIS Command & Navigation Bar */}
          <div className="px-4 py-2.5 border-b border-rule-subtle flex flex-wrap items-center justify-between gap-2.5 bg-sheet/95 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setLayerPanelOpen((prev) => !prev)}
                className="h-8 px-3 text-xs font-medium rounded-sm border border-rule bg-paper/80 text-ink hover:bg-accent-tint/50 transition-colors whitespace-nowrap"
                title="Toggle Specialised Electricity GIS Layer Manager (Layers A–F)"
              >
                {layerPanelOpen
                  ? '◀ Hide GIS Layers (A–F)'
                  : '▶ Open GIS Layers (A–F)'}
              </button>

              {/* Village, Substation & Coordinate Search Bar */}
              <div className="relative flex items-center">
                <input
                  type="search"
                  aria-label="Search villages, substations, or habitations"
                  placeholder="Search village, LGD, substation..."
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleRunOpenStreetMapSearch();
                    }
                  }}
                  className="h-8 w-44 sm:w-60 px-3 text-xs bg-paper/80 border border-rule rounded-l-sm text-ink focus:bg-sheet focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleRunOpenStreetMapSearch()}
                  className="h-8 px-3 text-xs font-medium bg-sheet border border-l-0 border-rule rounded-r-sm text-ink-2 hover:text-ink hover:bg-paper transition-colors whitespace-nowrap"
                >
                  {searchingExternal ? '...' : 'Find'}
                </button>

                {searchResults.length > 0 && (
                  <div className="absolute top-9 left-0 z-30 w-80 sm:w-96 bg-sheet border border-rule-subtle rounded-md shadow-overlay divide-y divide-rule-subtle max-h-64 overflow-y-auto">
                    {searchResults.map((loc) => (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => handleSelectSearchLocation(loc)}
                        className="w-full text-left p-2.5 hover:bg-accent-tint/40 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-xs font-semibold text-ink truncate">
                            {loc.label}
                          </span>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-paper border border-rule-subtle text-ink-2 shrink-0">
                            {loc.category}
                          </span>
                        </div>
                        <div className="text-xs text-ink-2 mt-0.5">
                          {loc.summary}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Basemap Switcher (4 Free Options), Camera Controls & GIS Utilities */}
            <div className="flex flex-wrap items-center gap-1.5 max-w-full">
              <div
                role="group"
                aria-label="Basemap switcher"
                className="inline-flex flex-wrap max-w-full gap-0.5 rounded-sm border border-rule-subtle bg-paper p-0.5"
              >
                {(
                  [
                    { id: 'survey_paper', label: 'Survey Sheet' },
                    { id: 'streets', label: 'Streets (OSM)' },
                    { id: 'terrain', label: 'Terrain (Topo)' },
                    { id: 'satellite', label: 'Sentinel-2 Satellite' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={basemap === opt.id}
                    onClick={() => handleBasemapChange(opt.id)}
                    className={`h-7 px-2.5 text-xs font-medium rounded-xs transition-colors whitespace-nowrap ${
                      basemap === opt.id
                        ? 'bg-accent text-white shadow-xs'
                        : 'text-ink-2 hover:text-ink hover:bg-sheet/80'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {!wizardMode && (
                <button
                  type="button"
                  aria-pressed={measureModeActive}
                  onClick={() => {
                    setMeasureModeActive((prev) => !prev);
                    setMeasurePoints([]);
                  }}
                  className={`h-8 px-3 text-xs font-medium rounded-sm border transition-colors whitespace-nowrap ${
                    measureModeActive
                      ? 'bg-info text-white border-info shadow-xs'
                      : 'bg-sheet text-ink-2 border-rule hover:text-ink hover:bg-paper'
                  }`}
                >
                  {measureModeActive
                    ? 'Measuring (Click Map)'
                    : 'Measure Span / Area'}
                </button>
              )}

              <button
                type="button"
                aria-pressed={beginnerGuideOpen}
                onClick={() => setBeginnerGuideOpen((prev) => !prev)}
                className={`h-8 px-3 text-xs font-medium rounded-sm border transition-colors whitespace-nowrap ${
                  beginnerGuideOpen
                    ? 'bg-accent text-white border-accent shadow-xs'
                    : 'bg-sheet text-ink-2 border-rule hover:text-ink hover:bg-paper'
                }`}
                title="Open plain-language guide to map colors, symbols, and layers"
              >
                ? Map Guide
              </button>

              <button
                type="button"
                aria-pressed={expandedCanvas}
                onClick={() => setExpandedCanvas((prev) => !prev)}
                className="h-8 px-3 text-xs font-medium rounded-sm border border-rule bg-sheet text-ink-2 hover:text-ink hover:bg-paper whitespace-nowrap transition-colors"
                title="Toggle expanded map canvas height"
              >
                {expandedCanvas ? 'Standard Height' : 'Expand Map'}
              </button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => fitToActiveAoi()}
                title="Zoom and center map on the active village or study boundary"
              >
                Center on Study Area
              </Button>

              {drawModeActive && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-accent bg-accent-tint px-3 py-1 rounded-full border border-accent/25">
                    Draw Mode: Click map to add vertices ({drawnVertices.length} pts)
                  </span>
                  {drawnVertices.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleClearDraw}>
                      Clear Polygon
                    </Button>
                  )}
                </div>
              )}

              {placeTieInModeActive && (
                <span className="text-xs text-warn bg-warn-tint px-3 py-1 rounded-full border border-warn/30 font-semibold">
                  Tie-In Mode: Click map to place Assumed 11 kV Tie-In Point
                </span>
              )}
            </div>
          </div>

          {/* Row 2: Compact Quick-Select & Feature Inspection Bar */}
          {!wizardMode && (
            <div
              role="toolbar"
              aria-label="Quick-jump geographic locations and features"
              className="px-4 py-2 bg-paper/70 border-b border-rule-subtle flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                <label
                  htmlFor="map-quick-jump-select"
                  className="text-xs font-medium text-ink-2 whitespace-nowrap shrink-0"
                >
                  Inspect Location / Asset:
                </label>
                <select
                  id="map-quick-jump-select"
                  aria-label="Inspect location or asset"
                  value={activeLocationId ?? ''}
                  onChange={(e) => {
                    const chosen = combinedSearchCatalog.find(
                      (loc) => loc.id === e.target.value,
                    );
                    if (chosen) handleSelectSearchLocation(chosen);
                  }}
                  className="h-8 w-full sm:w-auto sm:min-w-[260px] max-w-full px-2.5 text-xs bg-sheet border border-rule rounded-xs text-ink"
                >
                  <option value="">
                    {combinedSearchCatalog.length > 0
                      ? 'Select settlement, substation, or gap feature...'
                      : 'No project clusters or grid assets loaded yet'}
                  </option>
                  {combinedSearchCatalog.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {formatQuickJumpLabel(loc)}
                    </option>
                  ))}
                </select>
              </div>
              {inspectedFeature && (
                <button
                  type="button"
                  onClick={() => {
                    setInspectedFeature(null);
                    setActiveLocationId(null);
                  }}
                  className="text-xs font-medium text-ink-2 underline hover:text-ink whitespace-nowrap shrink-0"
                >
                  Clear Selection
                </button>
              )}
            </div>
          )}

          {searchError && (
            <div
              role="alert"
              className="px-4 py-1.5 bg-warn-tint border-b border-rule-subtle text-xs text-warn flex items-center justify-between gap-2"
            >
              <span>{searchError}</span>
              <button
                type="button"
                onClick={() => setSearchError(null)}
                className="underline font-medium shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

        </>
      )}

      {/* Active Distance & Area Measurement Bar */}
      {measureModeActive && (
        <div className="px-3 py-2 bg-info-tint border-b border-rule flex flex-wrap items-center justify-between gap-2 text-xs text-info">
          <div>
            <strong>Measurement Active:</strong> Click points on the map (
            <span className="tabular-nums">{measurePoints.length}</span> pts) · Line Span:{' '}
            <strong className="font-mono tabular-nums">
              {measuredLengthMeters.toFixed(1)} m (
              {(measuredLengthMeters / 1000).toFixed(3)} km)
            </strong>
            {measurePoints.length >= 3 && (
              <>
                {' '}
                · Enclosed Area:{' '}
                <strong className="font-mono tabular-nums">
                  {(measuredAreaM2 / 10000).toFixed(2)} ha (
                  {(measuredAreaM2 / 1e6).toFixed(3)} km²)
                </strong>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 font-medium">
            <button
              type="button"
              onClick={() => setMeasurePoints([])}
              className="underline"
            >
              Reset Points
            </button>
            <button
              type="button"
              onClick={() => {
                setMeasureModeActive(false);
                setMeasurePoints([]);
              }}
              className="underline"
            >
              Exit Measure Mode
            </button>
          </div>
        </div>
      )}

      {tileWarning && (
        <div
          role="alert"
          className="px-3 py-1.5 bg-warn-tint border-b border-rule text-xs text-warn flex flex-wrap items-center justify-between gap-2"
        >
          <span>{tileWarning}</span>
          <div className="flex items-center gap-3 font-medium">
            <button
              type="button"
              onClick={() => {
                setTileWarning(null);
                lastRasterKeyRef.current = null;
                setRasterRetryToken((c) => c + 1);
                beginRasterLoad();
                const map = mapRef.current;
                if (map) syncLayersRef.current(map);
              }}
              className="underline font-semibold"
            >
              Retry Overlay
            </button>
            <button
              type="button"
              onClick={() => setTileWarning(null)}
              className="underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Central GIS Workspace Grid: Layer Panel (Left) + Map Viewport (Center) + Feature Inspector (Right) */}
      <div className="relative flex flex-col lg:flex-row w-full">
        {/* Dedicated Grouped Layer Management & Geographic Filter Panel */}
        {layerPanelOpen && (
          <aside
            aria-label="Specialised Electricity GIS Layers"
            className="w-full lg:w-[300px] shrink-0 border-b lg:border-b-0 lg:border-r border-rule-subtle bg-paper/85 p-3.5 space-y-3 max-h-[540px] lg:max-h-[calc(100vh-19.5rem)] overflow-y-auto text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-rule-subtle pb-2.5">
              <span className="text-xs font-semibold text-ink">
                Electricity GIS Layers (A–F)
              </span>
              <QualityTag kind="ESTIMATED" label="100% FREE OPEN DATA" />
            </div>

            {/* Master Visibility Controls */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setLayerAEnabled(true);
                  setLayerBEnabled(true);
                  setLayerCEnabled(true);
                  setLayerDEnabled(true);
                  setLayerEEnabled(true);
                  setLayerFEnabled(true);
                }}
                className="flex-1 h-8 px-2.5 text-xs font-medium bg-sheet border border-rule rounded-sm text-ink hover:bg-accent-tint/60 whitespace-nowrap transition-colors"
              >
                Show All (A–F)
              </button>
              <button
                type="button"
                onClick={() => {
                  setLayerAEnabled(false);
                  setLayerBEnabled(false);
                  setLayerCEnabled(false);
                  setLayerDEnabled(false);
                  setLayerEEnabled(false);
                  setLayerFEnabled(false);
                }}
                className="flex-1 h-8 px-2.5 text-xs font-medium bg-sheet border border-rule rounded-sm text-ink-2 hover:text-ink hover:bg-paper whitespace-nowrap transition-colors"
              >
                Hide All Overlays
              </button>
            </div>

            {/* Global Vector Opacity & Reference Pack Provenance Control */}
            <div className="p-3 bg-sheet border border-rule-subtle rounded-md shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs text-ink font-medium">
                <span className="tabular-nums">
                  Overlay Transparency: {Math.round(vectorOpacity * 100)}%
                </span>
                <input
                  type="range"
                  aria-label="Vector overlay layer transparency"
                  min={0.2}
                  max={1.0}
                  step={0.05}
                  value={vectorOpacity}
                  onChange={(e) => setVectorOpacity(Number(e.target.value))}
                  className="w-24"
                />
              </div>
              {isDemoProject && (
                <label className="flex items-center justify-between gap-2 text-xs text-ink-2 cursor-pointer pt-1.5 border-t border-rule-subtle">
                  <span className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      aria-label="Include Koraput Reference Pack layers"
                      checked={includeReferencePack}
                      onChange={(e) => setIncludeReferencePack(e.target.checked)}
                    />
                    <span>Include Koraput Reference Pack</span>
                  </span>
                  <LayerSourceBadge source="REFERENCE_DEMO" />
                </label>
              )}
            </div>

            {/* GROUP 1: Power Grid & Proposed Network (Layers A & F) */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-ink-2 px-0.5 pt-1">
                Group 1 · Grid Infrastructure &amp; Routing
              </div>

              {/* Layer A: Electricity Infrastructure */}
              <div className="p-3 bg-sheet border border-rule-subtle rounded-md shadow-xs space-y-1.5">
                <div className="flex flex-wrap items-start justify-between gap-1.5">
                  <label className="flex items-start gap-2 cursor-pointer font-semibold text-ink">
                    <input
                      type="checkbox"
                      aria-label="Toggle Layer A Existing Electricity Infrastructure"
                      checked={layerAEnabled}
                      onChange={(e) => setLayerAEnabled(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span className="inline-flex items-center gap-1">
                      <span>Layer A · Existing Electricity Infrastructure</span>
                      <HelpTooltip glossaryKey="existingLinesDt" />
                    </span>
                  </label>
                  <LayerSourceBadge
                    source={hasProjectInfra ? 'PROJECT' : isDemoProject ? 'REFERENCE_DEMO' : 'PROJECT'}
                  />
                </div>
                <p className="text-xs text-ink-2 leading-relaxed">
                  Mapped OpenStreetMap <code>power=*</code> lines, 33/11 kV
                  substations, distribution transformers (DTs), lattice towers,
                  and poles ({mergedLayerAInfra.features.length} features).
                </p>
                {layerAEnabled && (
                  <div className="space-y-1.5 pt-1.5 border-t border-rule-subtle">
                    <label
                      htmlFor="voltage-filter-select"
                      className="block text-xs font-medium text-ink-2"
                    >
                      Filter by Voltage / Category
                    </label>
                    <select
                      id="voltage-filter-select"
                      value={voltageFilter}
                      onChange={(e) =>
                        setVoltageFilter(e.target.value as VoltageFilterMode)
                      }
                      className="w-full h-8 px-2 text-xs bg-paper border border-rule rounded-xs text-ink"
                    >
                      <option value="ALL">
                        All Voltages (33 kV + 11 kV + Substations + Poles)
                      </option>
                      <option value="33KV_TRANSMISSION">
                        33 kV Sub-Transmission &amp; Substations
                      </option>
                      <option value="11KV_DISTRIBUTION">
                        11 kV Primary Distribution Feeders
                      </option>
                      <option value="SUBSTATIONS_AND_DTS">
                        Substations &amp; Transformers Only
                      </option>
                      <option value="TOWERS_AND_POLES">
                        Electricity Towers &amp; Poles Only
                      </option>
                    </select>
                    {mergedLayerAInfra.features.length === 0 && (
                      <div className="p-2 bg-paper border border-dashed border-rule text-xs text-ink-2">
                        {isDemoProject
                          ? 'No project infrastructure uploaded for this filter. Enable Koraput Reference Pack or place an Assumed 11 kV Tie-In.'
                          : 'No project grid infrastructure mapped for this filter. Upload GIS infrastructure files or place an Assumed 11 kV Tie-In.'}
                      </div>
                    )}
                    <div className="text-xs text-warn leading-relaxed">
                      ⚠ Absence of mapped OSM lines does not prove absence of
                      ground lines.
                    </div>
                  </div>
                )}
              </div>

              {/* Layer F: Proposed Electricity Network */}
              <div className="p-3 bg-sheet border border-rule-subtle rounded-md shadow-xs space-y-1.5">
                <div className="flex flex-wrap items-start justify-between gap-1.5">
                  <label className="flex items-start gap-2 cursor-pointer font-semibold text-ink">
                    <input
                      type="checkbox"
                      aria-label="Toggle Layer F Proposed Electricity Network"
                      checked={layerFEnabled}
                      onChange={(e) => setLayerFEnabled(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>Layer F · Proposed Electricity Network</span>
                  </label>
                  <LayerSourceBadge
                    source={hasProjectNetwork ? 'PROJECT' : isDemoProject ? 'REFERENCE_DEMO' : 'PROJECT'}
                  />
                </div>
                <p className="text-xs text-ink-2 leading-relaxed">
                  Preliminary proposed 11 kV HT spurs, 415 V LT AB-cable lines,
                  25 kVA DT, and 18.5 kWp Solar Mini-Grid candidate (
                  {effectiveProposedFc.features.length} elements).
                </p>
              </div>
            </div>

            {/* GROUP 2: Satellite Imagery, Nighttime Illumination & Environmental Rasters (Layer B) */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-ink-2 px-0.5 pt-1 flex flex-wrap items-center justify-between gap-1.5">
                <span>Group 2 · Satellite Nighttime Illumination &amp; Rasters</span>
                {rasterLoading && (
                  <span className="text-xs text-accent animate-pulse shrink-0 whitespace-nowrap">
                    Loading Raster...
                  </span>
                )}
              </div>

              {/* Layer B: Nighttime Illumination (NASA VIIRS Black Marble) */}
              <div className="p-3 bg-sheet border border-rule-subtle rounded-md shadow-xs space-y-1.5">
                <div className="flex flex-wrap items-start justify-between gap-1.5">
                  <label className="flex items-start gap-2 cursor-pointer font-semibold text-ink">
                    <input
                      type="checkbox"
                      aria-label="Toggle Layer B NASA VIIRS Nighttime Illumination"
                      checked={layerBEnabled}
                      onChange={(e) => {
                        setLayerBEnabled(e.target.checked);
                        setTileWarning(null);
                        if (e.target.checked) {
                          beginRasterLoad();
                        } else if (
                          effectiveRasterOverlay === 'none' &&
                          basemap !== 'satellite'
                        ) {
                          endRasterLoad();
                        }
                      }}
                      className="mt-0.5"
                    />
                    <span className="inline-flex items-center gap-1">
                      <span>Layer B · NASA VIIRS Nighttime Illumination</span>
                      <HelpTooltip glossaryKey="viirsNighttimeLight" />
                    </span>
                  </label>
                  <LayerSourceBadge source="EXTERNAL_TILES" />
                </div>
                <p className="text-xs text-ink-2 leading-relaxed">
                  Satellite nighttime radiance (<code>nW/cm²/sr</code>). Indirect
                  proxy only — cannot detect indoor household meters, low-wattage
                  LED bulbs, or daytime solar kits.
                </p>
                {layerBEnabled && (
                  <div className="space-y-2 pt-2 border-t border-rule-subtle">
                    {/* Transparency Slider + Quick Preset Buttons */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-medium text-ink">
                        <span className="tabular-nums">
                          Overlay Opacity: {Math.round(viirsOpacity * 100)}%
                        </span>
                        <input
                          type="range"
                          aria-label="VIIRS nighttime layer transparency"
                          min={0.15}
                          max={1.0}
                          step={0.05}
                          value={viirsOpacity}
                          onChange={(e) => setViirsOpacity(Number(e.target.value))}
                          className="w-24"
                        />
                      </div>
                      <div
                        role="group"
                        aria-label="VIIRS opacity presets"
                        className="flex items-center gap-1"
                      >
                        <span className="text-xs text-ink-3 mr-1">
                          Presets:
                        </span>
                        {[0.25, 0.5, 0.75, 1.0].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setViirsOpacity(preset)}
                            className={`px-2 py-0.5 text-xs font-mono tabular-nums rounded-xs border transition-colors ${
                              Math.abs(viirsOpacity - preset) < 0.03
                                ? 'bg-accent text-white border-accent font-semibold'
                                : 'bg-paper text-ink-2 border-rule hover:text-ink'
                            }`}
                          >
                            {Math.round(preset * 100)}%
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Inline Brightness & Intensity Scale Legend */}
                    <div className="p-2 bg-paper border border-rule-subtle rounded-xs space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-ink">
                          VIIRS Brightness Scale (nW/cm²/sr)
                        </span>
                        <span className="text-ink-3">Public Domain</span>
                      </div>
                      <div
                        aria-label="VIIRS Radiance Continuous Colorbar"
                        className="h-2 w-full rounded-full border border-rule-subtle"
                        style={{
                          background: `linear-gradient(to right, ${RASTER_LEGEND_SPECS.nightlights.stops
                            .map((s) => s.color)
                            .join(', ')})`,
                        }}
                      />
                      <div className="space-y-1 text-xs text-ink-2">
                        {RASTER_LEGEND_SPECS.nightlights.stops.map((stop) => (
                          <div
                            key={stop.rangeText}
                            className="space-y-0.5"
                            title={stop.interpretation}
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-3 h-2.5 inline-block rounded-xs border border-rule shrink-0"
                                style={{ backgroundColor: stop.color }}
                              />
                              <span className="font-mono tabular-nums font-semibold text-ink w-16 shrink-0">
                                {stop.rangeText}
                              </span>
                              <span className="truncate font-medium text-ink-2">{stop.label}</span>
                            </div>
                            {stop.interpretation && (
                              <div className="text-[11px] text-ink-3 pl-[4.75rem]">
                                {stop.interpretation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-warn pt-1.5 border-t border-rule-subtle leading-relaxed">
                        ⚠ Dark pixels are NEVER proof of zero electricity —
                        tree canopy, indoor bulbs, and daytime-only supply are
                        not visible to nighttime satellites.
                      </div>
                    </div>

                    <details className="pt-1.5 border-t border-rule-subtle">
                      <summary className="text-xs font-medium text-ink-2 cursor-pointer select-none hover:text-ink">
                        Advanced Night-Light Options
                      </summary>
                      <div className="space-y-2 pt-2">
                        <div>
                          <label
                            htmlFor="viirs-period-select"
                            className="block text-xs font-medium text-ink-2 mb-1"
                          >
                            Observation Composite Date
                          </label>
                          <select
                            id="viirs-period-select"
                            value={viirsPeriod}
                            onChange={(e) => {
                              setViirsPeriod(
                                e.target.value as ViirsObservationPeriod,
                              );
                              setTileWarning(null);
                              if (!viirsGlobalGibs) {
                                beginRasterLoad();
                              }
                            }}
                            className="w-full h-8 px-2 text-xs bg-paper border border-rule rounded-xs text-ink"
                          >
                            {VIIRS_PERIOD_OPTIONS.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Observation Window, Resolution & Provenance Metadata Card */}
                        <div className="p-2 bg-paper border border-rule-subtle rounded-xs space-y-1 text-xs text-ink-2">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold text-ink">
                              {activePeriodMeta.observationWindow}
                            </span>
                            <QualityTag
                              kind="ASSUMED"
                              label="Illustrative Preview"
                            />
                          </div>
                          <div>Sensor: {activePeriodMeta.sensorResolution}</div>
                          <div className="text-ink-3 leading-relaxed">
                            Note: {activePeriodMeta.compositeNote}. Local study
                            image is an illustrative pre-feasibility proxy — not
                            live multi-year orbital imagery.
                          </div>
                        </div>

                        {/* Independent Sub-Toggles for Settlement Radiance Halos & Global GIBS Tiles */}
                        <div className="space-y-1.5 pt-1">
                          <label className="flex items-center gap-1.5 text-xs text-ink-2 cursor-pointer">
                            <input
                              type="checkbox"
                              aria-label="Show Radiometric Settlement Glow Halos"
                              checked={viirsHalosEnabled}
                              onChange={(e) => setViirsHalosEnabled(e.target.checked)}
                            />
                            <span>
                              Show Radiometric Settlement Glow Halos (nW/cm²/sr)
                            </span>
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-ink-2 cursor-pointer">
                            <input
                              type="checkbox"
                              aria-label="Include Global NASA GIBS 2012 Tiles"
                              checked={viirsGlobalGibs}
                              onChange={(e) => {
                                setViirsGlobalGibs(e.target.checked);
                                setTileWarning(null);
                                beginRasterLoad();
                              }}
                            />
                            <span>
                              Include Global NASA GIBS 2012 Nighttime Lights (z ≤ 8)
                            </span>
                          </label>
                        </div>
                      </div>
                    </details>
                  </div>
                )}
              </div>

              {/* Environmental & Satellite Raster Overlay Selector (DEM Slope / ESA WorldCover / VIIRS) */}
              <div className="p-3 bg-sheet border border-rule-subtle rounded-md shadow-xs space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <label
                    htmlFor="map-raster-overlay-select"
                    className="font-semibold text-ink text-xs inline-flex items-center gap-1"
                  >
                    <span>Environmental &amp; Terrain Raster Overlay</span>
                    <HelpTooltip glossaryKey="demSlope" />
                    <HelpTooltip glossaryKey="worldCover" />
                  </label>
                  <QualityTag kind="ASSUMED" label="Illustrative Surface" />
                </div>
                <select
                  id="map-raster-overlay-select"
                  aria-label="Select environmental or satellite raster overlay"
                  value={effectiveRasterOverlay}
                  onChange={(e) =>
                    handleSelectEnvRasterOverlay(
                      e.target.value as
                        | 'none'
                        | 'dem_slope'
                        | 'landcover'
                        | 'nightlights',
                    )
                  }
                  className="w-full h-8 px-2 text-xs bg-paper border border-rule rounded-xs text-ink"
                >
                  <option value="none">None (Vector &amp; Basemap Only)</option>
                  <option value="dem_slope">
                    Copernicus DEM GLO-30 Slope (° · 30 m)
                  </option>
                  <option value="landcover">
                    ESA WorldCover 10 m Classification (CC BY 4.0)
                  </option>
                  <option value="nightlights">
                    VIIRS DNB Nighttime Radiance Raster (nW/cm²/sr)
                  </option>
                </select>

                {effectiveRasterOverlay !== 'none' ? (
                  <div className="space-y-1.5 pt-1.5 border-t border-rule-subtle">
                    <div className="flex items-center justify-between text-xs font-medium text-ink">
                      <span>
                        Raster Opacity:{' '}
                        <span className="font-mono tabular-nums">
                          {Math.round(effectiveEnvRasterOpacity * 100)}%
                        </span>
                      </span>
                      <input
                        type="range"
                        aria-label="Environmental raster overlay transparency"
                        min={0.15}
                        max={0.95}
                        step={0.05}
                        value={effectiveEnvRasterOpacity}
                        onChange={(e) =>
                          handleSelectEnvRasterOpacity(Number(e.target.value))
                        }
                        className="w-24"
                      />
                    </div>
                    <div className="p-2 bg-paper border border-rule-subtle rounded-xs space-y-1 text-xs">
                      <div className="font-semibold text-ink">
                        {RASTER_LEGEND_SPECS[effectiveRasterOverlay].title}
                      </div>
                      <div className="text-ink-3">
                        {
                          RASTER_LEGEND_SPECS[effectiveRasterOverlay]
                            .spatialResolution
                        }{' '}
                        · {RASTER_LEGEND_SPECS[effectiveRasterOverlay].license}
                      </div>
                      {!rasterOverlayUrl &&
                        (effectiveRasterOverlay === 'dem_slope' ||
                          effectiveRasterOverlay === 'landcover') && (
                          <div className="p-1.5 bg-warn-tint border border-warn/30 rounded-xs text-warn leading-relaxed">
                            Legend preview active. Open a project study area in Step 1 to render
                            clipped {effectiveRasterOverlay} imagery.
                          </div>
                        )}
                      <div className="space-y-1 pt-0.5">
                        {RASTER_LEGEND_SPECS[effectiveRasterOverlay].stops.map(
                          (st) => (
                            <div key={st.rangeText} className="space-y-0.5">
                              <div className="flex items-center gap-1.5 text-ink-2">
                                <span
                                  className="w-3 h-2.5 inline-block rounded-xs border border-rule shrink-0"
                                  style={{ backgroundColor: st.color }}
                                />
                                <span className="font-mono tabular-nums font-semibold text-ink w-16 shrink-0">
                                  {st.rangeText}
                                </span>
                                <span className="truncate font-medium">{st.label}</span>
                              </div>
                              {st.interpretation && (
                                <div className="text-[11px] text-ink-3 pl-[4.75rem]">
                                  {st.interpretation}
                                </div>
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  !layerBEnabled && (
                    <div className="p-2 bg-paper border border-dashed border-rule rounded-xs text-xs text-ink-2 leading-relaxed">
                      No raster overlay active. Enable{' '}
                      <strong>Layer B (NASA VIIRS)</strong> above or select{' '}
                      <strong>DEM Slope (30 m)</strong> /{' '}
                      <strong>ESA WorldCover (10 m)</strong> to inspect terrain
                      and illumination surfaces.
                    </div>
                  )
                )}
              </div>
            </div>

            {/* GROUP 3: Villages, Settlements & Electrification Gaps (Layers C, D & E) */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-ink-2 px-0.5 pt-1">
                Group 3 · Villages, Settlements &amp; Gaps
              </div>

              {/* Layer C: Village Electrification Status */}
              <div className="p-3 bg-sheet border border-rule-subtle rounded-md shadow-xs space-y-1.5">
                <div className="flex flex-wrap items-start justify-between gap-1.5">
                  <label className="flex items-start gap-2 cursor-pointer font-semibold text-ink">
                    <input
                      type="checkbox"
                      aria-label="Toggle Layer C Village Electrification Status"
                      checked={layerCEnabled}
                      onChange={(e) => setLayerCEnabled(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>Layer C · Village Electrification Status</span>
                  </label>
                  <LayerSourceBadge
                    source={isDemoProject ? 'REFERENCE_DEMO' : 'PROJECT'}
                  />
                </div>
                <p className="text-xs text-ink-2 leading-relaxed">
                  Census 2011 DCHB domestic power availability hours &amp; AOI
                  boundaries. Verified current household meter counts require
                  DISCOM consumer ledgers.
                </p>
              </div>

              {/* Layer D: Population & Settlements */}
              <div className="p-3 bg-sheet border border-rule-subtle rounded-md shadow-xs space-y-1.5">
                <div className="flex flex-wrap items-start justify-between gap-1.5">
                  <label className="flex items-start gap-2 cursor-pointer font-semibold text-ink">
                    <input
                      type="checkbox"
                      aria-label="Toggle Layer D Settlements Population and Footprints"
                      checked={layerDEnabled}
                      onChange={(e) => setLayerDEnabled(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>Layer D · Settlements, Population &amp; Footprints</span>
                  </label>
                  <div className="flex items-center gap-1">
                    {usesMvtBuildings && (
                      <QualityTag kind="ESTIMATED" label="MVT TILES" />
                    )}
                    <LayerSourceBadge
                      source={hasProjectClusters ? 'PROJECT' : isDemoProject ? 'REFERENCE_DEMO' : 'PROJECT'}
                    />
                  </div>
                </div>
                <p className="text-xs text-ink-2 leading-relaxed">
                  {isDemoProject ? (
                    <>
                      Habitation clusters (<code>CL-01</code> to <code>CL-04</code>
                      ), 143 building footprints, ST population share, and rural
                      schools/PHC ({effectiveSettlementsFc.features.length} shown).
                    </>
                  ) : (
                    <>
                      AOI building structures (
                      {referenceBuildings?.features.length ?? 0}) &amp; DBSCAN
                      habitation clusters ({effectiveSettlementsFc.features.length}{' '}
                      shown).
                    </>
                  )}
                </p>
                {layerDEnabled && (
                  <div className="space-y-1.5 pt-1.5 border-t border-rule-subtle">
                    <label
                      htmlFor="settlement-status-filter-select"
                      className="block text-xs font-medium text-ink-2"
                    >
                      Filter by Estimated Electrification Status
                    </label>
                    <select
                      id="settlement-status-filter-select"
                      aria-label="Filter settlements by electrification status"
                      value={settlementStatusFilter}
                      onChange={(e) =>
                        setSettlementStatusFilter(
                          e.target.value as 'ALL' | ProxyElectrificationClass,
                        )
                      }
                      className="w-full h-8 px-2 text-xs bg-paper border border-rule rounded-xs text-ink"
                    >
                      <option value="ALL">
                        All Habitation Clusters (All Estimates)
                      </option>
                      <option value="LIKELY_ELECTRIFIED">
                        Likely Connected (Grid &lt;500m + Night Light)
                      </option>
                      <option value="POTENTIALLY_UNDERSERVED">
                        Potentially Underserved (Partial Supply)
                      </option>
                      <option value="POTENTIALLY_UNSERVED">
                        Potentially Unserved (&gt;1.5 km From Grid)
                      </option>
                      <option value="UNKNOWN">
                        Unknown (Insufficient Satellite Evidence)
                      </option>
                    </select>
                  </div>
                )}
              </div>

              {/* Layer E: Potential Electrification Gaps */}
              <div className="p-3 bg-sheet border border-rule-subtle rounded-md shadow-xs space-y-1.5">
                <div className="flex flex-wrap items-start justify-between gap-1.5">
                  <label className="flex items-start gap-2 cursor-pointer font-semibold text-ink">
                    <input
                      type="checkbox"
                      aria-label="Toggle Layer E Potential Electrification Gaps"
                      checked={layerEEnabled}
                      onChange={(e) => setLayerEEnabled(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>Layer E · Potential Electrification Gaps</span>
                  </label>
                  <LayerSourceBadge
                    source={
                      gapCorridors && gapCorridors.features.length > 0
                        ? 'PROJECT'
                        : isDemoProject
                          ? 'REFERENCE_DEMO'
                          : 'PROJECT'
                    }
                  />
                </div>
                <p className="text-xs text-ink-2 leading-relaxed">
                  Multi-evidence investigation corridors combining grid distance
                  (&gt;1.6 km), low VIIRS radiance, and household density (
                  {effectiveGapsFc.features.length} corridors).
                </p>
              </div>
            </div>
          </aside>
        )}

        {/* Center Interactive MapLibre GL JS Viewport */}
        <div
          className={`relative flex-1 w-full ${effectiveHeightClass} bg-[#EFF3F8] overflow-hidden`}
          style={{ minHeight: variant === 'overview' ? '440px' : '420px' }}
        >
          <div
            ref={containerRef}
            aria-label="ElectriMap Interactive GIS Map Canvas"
            className="absolute inset-0 w-full h-full"
            style={{ width: '100%', height: '100%' }}
          />

          {/* Compact Overview Hero Floating HUD Bar */}
          {variant === 'overview' && (
            <div className="pointer-events-none absolute top-3 left-3 right-14 z-20 flex flex-wrap items-center justify-between gap-2">
              <div className="pointer-events-auto map-hud-surface rounded-lg border border-rule-subtle shadow-control p-1 flex flex-wrap items-center gap-1 text-xs max-w-full">
                <button
                  type="button"
                  onClick={() => setLayerPanelOpen((prev) => !prev)}
                  className={`h-7 px-2.5 rounded-sm font-medium transition-colors ${
                    layerPanelOpen
                      ? 'bg-accent text-white shadow-xs'
                      : 'text-ink-2 hover:text-ink hover:bg-sheet'
                  }`}
                >
                  {layerPanelOpen ? 'Hide Layers' : 'Layers (A–F)'}
                </button>
                <div className="h-4 w-px bg-rule-subtle" aria-hidden="true" />
                {(
                  [
                    { id: 'survey_paper', label: 'Survey' },
                    { id: 'satellite', label: 'Satellite' },
                    { id: 'terrain', label: 'Terrain' },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => handleBasemapChange(mode.id)}
                    className={`h-7 px-2.5 rounded-sm font-medium transition-colors ${
                      basemap === mode.id
                        ? 'bg-sheet text-accent shadow-xs font-semibold'
                        : 'text-ink-2 hover:text-ink hover:bg-sheet/70'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setLayerBEnabled((prev) => !prev)}
                  className={`h-7 px-2.5 rounded-sm font-medium transition-colors ${
                    layerBEnabled
                      ? 'bg-warn text-white shadow-xs'
                      : 'text-ink-2 hover:text-ink hover:bg-sheet/70'
                  }`}
                >
                  VIIRS Lights
                </button>
                <button
                  type="button"
                  onClick={() => fitToActiveAoi()}
                  className="h-7 px-2.5 rounded-sm font-medium text-ink-2 hover:text-ink hover:bg-sheet/70 transition-colors"
                  title="Zoom and center map on the active village or study boundary"
                >
                  Center on Study Area
                </button>
                <button
                  type="button"
                  aria-pressed={beginnerGuideOpen}
                  onClick={() => setBeginnerGuideOpen((prev) => !prev)}
                  className={`h-7 px-2.5 rounded-sm font-medium transition-colors ${
                    beginnerGuideOpen
                      ? 'bg-accent text-white shadow-xs'
                      : 'text-ink-2 hover:text-ink hover:bg-sheet/70'
                  }`}
                  title="Open plain-language guide to map colors, symbols, and layers"
                >
                  ? Map Guide
                </button>
              </div>

              {onOpenFullMap && (
                <button
                  type="button"
                  onClick={onOpenFullMap}
                  className="pointer-events-auto hidden sm:inline-flex h-8 px-3.5 rounded-full bg-accent text-white text-xs font-semibold shadow-control hover:bg-accent-hover transition-colors whitespace-nowrap items-center"
                >
                  Open Full GIS Workspace →
                </button>
              )}
            </div>
          )}

          {/* Preliminary Engineering Watermark Banner */}
          <div
            className={`pointer-events-none absolute left-3 z-10 bg-sheet/90 backdrop-blur-md border border-rule-subtle px-3 py-1 rounded-full shadow-xs max-w-[calc(100%-4.5rem)] ${
              variant === 'overview' ? 'bottom-11' : 'top-3'
            }`}
          >
            <div className="text-2xs sm:text-xs text-warn font-semibold truncate">
              PRELIMINARY ENGINEERING ESTIMATE — FIELD SURVEY REQUIRED
            </div>
          </div>

          {/* Interactive Tie-In Placement Guidance Banner */}
          {placeTieInModeActive && !pendingTieInPoint && (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 z-20 bg-info-tint/95 border border-info/40 text-info px-3.5 py-1.5 rounded-full shadow-control text-xs font-medium max-w-[92%] truncate"
            >
              Click anywhere on the map to mark your proposed 11 kV grid connection point
            </div>
          )}

          {/* Two-Step Assumed 11 kV Tie-In Point Confirmation Card */}
          {placeTieInModeActive && pendingTieInPoint && (
            <div
              role="dialog"
              aria-label="Confirm Grid Connection Point"
              className="absolute bottom-14 left-1/2 -translate-x-1/2 z-30 w-[min(24rem,calc(100%-1.5rem))] bg-sheet/95 backdrop-blur-md border border-accent rounded-lg shadow-overlay p-4 text-xs space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-ink">
                    Confirm Grid Connection Point?
                  </h4>
                  <p className="text-ink-2 mt-0.5">
                    Selected coordinates:{' '}
                    <span className="font-mono text-ink font-semibold tabular-nums">
                      {pendingTieInPoint.lat.toFixed(5)}°N, {pendingTieInPoint.lon.toFixed(5)}°E
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Cancel connection point placement"
                  onClick={() => setPendingTieInPoint(null)}
                  className="text-ink-2 hover:text-ink px-1.5 py-0.5 rounded-xs border border-rule-subtle"
                >
                  ×
                </button>
              </div>
              <p className="text-ink-2 leading-relaxed">
                This saves a planner-assumed starting pole (11 kV tie-in) used for preliminary line
                routing until official utility GIS coordinates are uploaded.
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  onClick={() => setPendingTieInPoint(null)}
                >
                  Pick Different Spot
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="primary"
                  onClick={() => {
                    onPlaceTieInPoint?.(pendingTieInPoint.lon, pendingTieInPoint.lat);
                    setPendingTieInPoint(null);
                  }}
                >
                  Save Connection Point
                </Button>
              </div>
            </div>
          )}

          {/* Floating Plain-English Map Guide Overlay */}
          {beginnerGuideOpen && (
            <div
              role="dialog"
              aria-label="How to Read the Electrification GIS Map"
              className="absolute top-14 right-3 z-30 w-[min(23rem,calc(100%-1.5rem))] max-h-[76%] overflow-y-auto bg-sheet/95 backdrop-blur-md border border-rule-strong rounded-lg shadow-overlay p-4 text-xs space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2 border-b border-rule-subtle pb-2">
                <span className="font-semibold text-ink text-sm">
                  Map Guide: Colors, Lines &amp; Symbols
                </span>
                <button
                  type="button"
                  onClick={() => setBeginnerGuideOpen(false)}
                  aria-label="Close map guide"
                  className="text-ink-2 hover:text-ink px-2 py-0.5 rounded-xs border border-rule-subtle text-xs font-medium"
                >
                  × Close
                </button>
              </div>
              <div className="space-y-2 text-xs text-ink-2 leading-relaxed">
                <div className="p-2.5 bg-paper/80 border border-rule-subtle rounded-md">
                  <strong className="text-ink block mb-0.5">
                    1. Existing vs. Proposed Lines
                  </strong>
                  <strong>Solid purple (33 kV)</strong> and{' '}
                  <strong>solid dark-red (11 kV)</strong> lines show mapped existing
                  grid lines. <strong>Dashed red (11 kV)</strong> and{' '}
                  <strong>dashed blue (415 V)</strong> lines show preliminary
                  proposed routes — planning estimates only, not installed lines.
                </div>
                <div className="p-2.5 bg-paper/80 border border-rule-subtle rounded-md">
                  <strong className="text-ink block mb-0.5">
                    2. What Nighttime Light (VIIRS) Means
                  </strong>
                  NASA VIIRS measures outdoor night brightness in{' '}
                  <code>nW/cm²/sr</code>.{' '}
                  <strong>A dark spot does NOT prove a village has no electricity</strong>{' '}
                  — satellites cannot see indoor bulbs, meters, or daytime solar
                  systems.
                </div>
                <div className="p-2.5 bg-paper/80 border border-rule-subtle rounded-md">
                  <strong className="text-ink block mb-0.5">
                    3. Hamlets &amp; Potential Gaps
                  </strong>
                  Colored dots group nearby detected roofs into hamlets; dashed
                  amber/red corridors flag habitations far from mapped 11 kV lines.
                  Click any symbol to inspect details and data sources.
                </div>
              </div>
            </div>
          )}

          {/* Interactive Map Hover Tooltip Pill */}
          {hoveredFeatureHint && !inspectedFeature && (
            <div
              role="status"
              aria-label="Hovered GIS Feature Tooltip"
              className="pointer-events-none absolute bottom-12 left-3 z-20 bg-sheet/95 backdrop-blur-md border border-accent/40 px-3.5 py-2.5 rounded-md shadow-control max-w-xs text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-ink truncate">
                  {hoveredFeatureHint.title}
                </span>
                <span className="text-xs font-medium px-2 py-0.5 bg-paper border border-rule-subtle rounded-full text-ink-2 shrink-0">
                  {hoveredFeatureHint.badge}
                </span>
              </div>
              <div className="text-xs text-ink-2 truncate mt-0.5">
                {hoveredFeatureHint.subtitle} · Click to inspect details
              </div>
            </div>
          )}

          {/* Contextual Feature Inspector Panel (Opens on Clicking Any Map Feature or Quick-Select Item) */}
          <GisFeatureInspectorDrawer
            feature={inspectedFeature}
            onClose={() => {
              setInspectedFeature(null);
              setActiveLocationId(null);
            }}
            onFlyToFeature={handleFlyToCoordinates}
            onSelectClusterInWorkbench={onSelectCluster}
          />
        </div>
      </div>

      {/* Unified Electrical GIS Symbology Legend & Coordinate Telemetry Bar */}
      <GisSymbologyLegend
        lon={cursorCoords.lon}
        lat={cursorCoords.lat}
        zoom={zoomLevel}
        metricCrsLabel={resolveMetricCrsLabel(metricEpsg)}
        activeLayerCount={activeLayerCount}
        totalLayerCount={6}
        activeBasemap={basemap}
        layerBEnabled={layerBEnabled}
        viirsPeriodLabel={activePeriodMeta.label}
        activeRasterOverlay={effectiveRasterOverlay}
        showSettlementProxyPills={isDemoProject || hasProjectClusters}
      />
    </div>
  );
};
