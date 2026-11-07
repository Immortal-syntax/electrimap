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
import { QualityTag } from '../ui/QualityTag';
import {
  BasemapMode,
  DEFAULT_ELECTRIFICATION_GAPS_FC,
  DEFAULT_EXISTING_POWER_INFRA_FC,
  DEFAULT_PROPOSED_NETWORK_FC,
  DEFAULT_SETTLEMENTS_FC,
  DEFAULT_VILLAGE_ELECTRIFICATION_FC,
  KORAPUT_SEARCH_CATALOG,
  SearchableLocationItem,
  VIIRS_PERIOD_OPTIONS,
  ViirsObservationPeriod,
  VoltageFilterMode,
  computePolygonAreaM2,
  computePolylineLengthMeters,
} from './electricityGisData';

export type { BasemapMode };

const KORAPUT_DEFAULT_CENTER: [number, number] = [82.73, 18.565];
const KORAPUT_DEFAULT_ZOOM = 12.6;
const GLYPHS_URL = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';

export interface MapCanvasProps {
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
  /** Whether interactive polygon drawing mode is active */
  drawModeActive?: boolean;
  /** Callback invoked whenever the user adds/clears vertices in draw mode */
  onDrawnPolygonChange?: (
    polygonGeoJson: GeoJSON.Polygon | null,
    vertexCount: number,
  ) => void;
  /** Optional height class override */
  heightClass?: string;
}

export interface InspectedFeatureState {
  layerGroupTitle: string;
  title: string;
  subtitle: string;
  provenanceBadge: string;
  beginnerExplanation: string;
  epistemicCaveat: string;
  attributes: Array<{ label: string; value: string }>;
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
            'Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2020)',
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
        paint: { 'background-color': '#F7F5F0' },
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

function buildSurveyGraticuleGeoJson(): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  const minLon = 82.6;
  const maxLon = 82.84;
  const minLat = 18.46;
  const maxLat = 18.66;
  const step = 0.01;

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

const SURVEY_GRATICULE_FC = buildSurveyGraticuleGeoJson();

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
  drawModeActive = false,
  onDrawnPolygonChange,
  heightClass = 'h-[540px]',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const lastFittedBboxRef = useRef<string | null>(null);

  const [basemap, setBasemap] = useState<BasemapMode>('survey_paper');
  const [cursorCoords, setCursorCoords] = useState<{ lon: number; lat: number }>({
    lon: KORAPUT_DEFAULT_CENTER[0],
    lat: KORAPUT_DEFAULT_CENTER[1],
  });
  const [zoomLevel, setZoomLevel] = useState<number>(KORAPUT_DEFAULT_ZOOM);
  const [drawnVertices, setDrawnVertices] = useState<Array<[number, number]>>([]);
  const [tileWarning, setTileWarning] = useState<string | null>(null);

  // Specialised Electricity GIS Layer Controls (Layers A through F)
  const [layerPanelOpen, setLayerPanelOpen] = useState<boolean>(true);
  const [beginnerGuideOpen, setBeginnerGuideOpen] = useState<boolean>(false);
  const [layerAEnabled, setLayerAEnabled] = useState<boolean>(true); // Existing Electricity Infrastructure
  const [voltageFilter, setVoltageFilter] = useState<VoltageFilterMode>('ALL');
  const [layerBEnabled, setLayerBEnabled] = useState<boolean>(false); // NASA VIIRS Nighttime Illumination
  const [viirsPeriod, setViirsPeriod] =
    useState<ViirsObservationPeriod>('2024_ANNUAL');
  const [viirsGlobalGibs, setViirsGlobalGibs] = useState<boolean>(false);
  const [viirsOpacity, setViirsOpacity] = useState<number>(0.75);
  const [layerCEnabled, setLayerCEnabled] = useState<boolean>(true); // Village Electrification Status
  const [layerDEnabled, setLayerDEnabled] = useState<boolean>(true); // Settlements, Demographics & Footprints
  const [layerEEnabled, setLayerEEnabled] = useState<boolean>(true); // Potential Electrification Gaps
  const [layerFEnabled, setLayerFEnabled] = useState<boolean>(true); // Proposed Electricity Network

  // Interactive Search & Measurement Tools
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchableLocationItem[]>([]);
  const [searchingExternal, setSearchingExternal] = useState<boolean>(false);
  const [measureModeActive, setMeasureModeActive] = useState<boolean>(false);
  const [measurePoints, setMeasurePoints] = useState<Array<[number, number]>>([]);
  const [inspectedFeature, setInspectedFeature] =
    useState<InspectedFeatureState | null>(null);

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
            : DEFAULT_VILLAGE_ELECTRIFICATION_FC);
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
          center: KORAPUT_DEFAULT_CENTER,
          zoom: KORAPUT_DEFAULT_ZOOM,
          duration: 450,
        });
      } catch {
        // Ignore in headless tests
      }
    },
    [aoiGeometry, settlementClusters, referenceBuildings],
  );

  // Merge OSM existing power infrastructure with any planner-added `infrastructureAssets`
  const mergedLayerAInfra = React.useMemo<GeoJSON.FeatureCollection>(() => {
    const baseFeatures = DEFAULT_EXISTING_POWER_INFRA_FC.features.filter((f) => {
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
        return cat === 'SUBSTATION' || cat === 'TRANSFORMER';
      }
      if (voltageFilter === 'TOWERS_AND_POLES') {
        return cat === 'TOWER' || cat === 'POLE';
      }
      return true;
    });

    const extraFeatures: GeoJSON.Feature[] = (
      infrastructureAssets?.features ?? []
    ).map((feat) => ({
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
    }));

    return {
      type: 'FeatureCollection',
      features: [...baseFeatures, ...extraFeatures],
    };
  }, [voltageFilter, infrastructureAssets]);

  const effectiveSettlementsFc = React.useMemo<GeoJSON.FeatureCollection>(() => {
    if (settlementClusters && settlementClusters.features.length > 0) {
      return settlementClusters;
    }
    return DEFAULT_SETTLEMENTS_FC;
  }, [settlementClusters]);

  const effectiveGapsFc = React.useMemo<GeoJSON.FeatureCollection>(() => {
    if (gapCorridors && gapCorridors.features.length > 0) {
      return gapCorridors;
    }
    return DEFAULT_ELECTRIFICATION_GAPS_FC;
  }, [gapCorridors]);

  const effectiveProposedFc = React.useMemo<GeoJSON.FeatureCollection>(() => {
    if (networkLayout && networkLayout.features.length > 0) {
      return networkLayout;
    }
    if (referenceRoutes && referenceRoutes.features.length > 0) {
      return {
        type: 'FeatureCollection',
        features: [
          ...referenceRoutes.features.map((f) => ({
            ...f,
            properties: {
              ...f.properties,
              layer_type: 'HT_11KV_PROPOSED',
              status: 'PROPOSED_PRELIMINARY',
              voltage_kv: 11.0,
            },
          })),
          ...DEFAULT_PROPOSED_NETWORK_FC.features.filter(
            (f) => f.properties?.layer_type !== 'HT_11KV_PROPOSED',
          ),
        ],
      };
    }
    return DEFAULT_PROPOSED_NETWORK_FC;
  }, [networkLayout, referenceRoutes]);

  const syncLayers = useCallback(
    (map: maplibregl.Map) => {
      try {
        if (!map.getStyle()) return;
      } catch {
        return;
      }

      // 0. Engineering Survey Graticule
      try {
        upsertGeoJsonSource(map, 'survey-graticule', SURVEY_GRATICULE_FC);
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
                'NASA Earth Observatory / NOAA Suomi NPP VIIRS Black Marble (Public Domain)',
            });
            map.addLayer({
              id: 'nasa-gibs-viirs-layer',
              type: 'raster',
              source: 'nasa-gibs-viirs',
              paint: { 'raster-opacity': viirsOpacity },
            });
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

        const activeOverlayUrl =
          rasterOverlayUrl ??
          (layerBEnabled && !viirsGlobalGibs
            ? `/api/v1/spikes/viirs-overlay?period=${viirsPeriod}`
            : null);
        const effectiveOpacity = rasterOverlayUrl ? rasterOpacity : viirsOpacity;

        if (activeOverlayUrl) {
          const aoiBbox = aoiGeometry ? computeGeoJsonBbox(aoiGeometry) : null;
          const minLon = aoiBbox ? aoiBbox[0] : 82.695;
          const minLat = aoiBbox ? aoiBbox[1] : 18.535;
          const maxLon = aoiBbox ? aoiBbox[2] : 82.765;
          const maxLat = aoiBbox ? aoiBbox[3] : 18.595;
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
          const existingRaster = map.getSource('project-raster') as
            | maplibregl.ImageSource
            | undefined;
          if (!existingRaster) {
            map.addSource('project-raster', {
              type: 'image',
              url: activeOverlayUrl,
              coordinates: bounds,
            });
            map.addLayer({
              id: 'project-raster-layer',
              type: 'raster',
              source: 'project-raster',
              paint: {
                'raster-opacity': effectiveOpacity,
              },
            });
          } else {
            if (typeof existingRaster.updateImage === 'function') {
              existingRaster.updateImage({
                url: activeOverlayUrl,
                coordinates: bounds,
              });
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
          if (map.getLayer('project-raster-layer')) {
            map.removeLayer('project-raster-layer');
          }
          if (map.getSource('project-raster')) {
            map.removeSource('project-raster');
          }
        }
      } catch {
        // Ignore raster update error
      }

      // 2. Layer C: Village Electrification Status (Census 2011 DCHB + LGD) & Active AOI Boundary
      try {
        upsertGeoJsonSource(
          map,
          'village-electrification',
          DEFAULT_VILLAGE_ELECTRIFICATION_FC,
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
                '#1B6E3A',
                'PARTIALLY_ELECTRIFIED_UNDERSERVED',
                '#B35300',
                'REPORTED_UNELECTRIFIED_HABITATION',
                '#A61B1B',
                '#52504A',
              ],
              'fill-opacity': 0.11,
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
                '#B35300',
                'REPORTED_UNELECTRIFIED_HABITATION',
                '#A61B1B',
                '#52504A',
              ],
              'line-width': 2.0,
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
                ')',
              ],
              'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
              'text-size': 11,
            },
            paint: {
              'text-color': '#1E293B',
              'text-halo-color': '#F7F5F0',
              'text-halo-width': 1.6,
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
                boundarySource === 'APPROXIMATE_BUFFER' ? '#A35C00' : '#1E4D3B',
              'fill-opacity': 0.08,
            },
          });
        }
        const outlineColor =
          boundarySource === 'APPROXIMATE_BUFFER' ? '#A35C00' : '#1E4D3B';
        if (!map.getLayer('aoi-outline')) {
          const linePaint: maplibregl.LineLayerSpecification['paint'] = {
            'line-color': outlineColor,
            'line-width': 2.5,
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
        }
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
          setLayerVisibilitySafe(map, ['osm-lines', 'osm-points'], layerDEnabled);
        }

        if (referenceBuildings) {
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
                  '#B35300',
                ],
                'fill-opacity': [
                  'case',
                  ['==', ['get', 'is_excluded'], true],
                  0.25,
                  0.75,
                ],
                'fill-outline-color': '#5C3D1E',
              },
            });
          }
          setLayerVisibilitySafe(map, ['ref-buildings-fill'], layerDEnabled);
        }

        upsertGeoJsonSource(map, 'settlement-clusters', effectiveSettlementsFc);
        if (!map.getLayer('clusters-hull-fill')) {
          map.addLayer({
            id: 'clusters-hull-fill',
            type: 'fill',
            source: 'settlement-clusters',
            filter: ['==', ['geometry-type'], 'Polygon'],
            paint: {
              'fill-color': [
                'match',
                ['get', 'proxy_class'],
                'LIKELY_ELECTRIFIED',
                '#1B6E3A',
                'POTENTIALLY_UNDERSERVED',
                '#B35300',
                'POTENTIALLY_UNSERVED',
                '#A61B1B',
                '#52504A',
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
                'match',
                ['get', 'proxy_class'],
                'LIKELY_ELECTRIFIED',
                '#1B6E3A',
                'POTENTIALLY_UNDERSERVED',
                '#B35300',
                'POTENTIALLY_UNSERVED',
                '#A61B1B',
                '#52504A',
              ],
              'line-width': 2.0,
            },
          });
          map.addLayer({
            id: 'clusters-centroid-circle',
            type: 'circle',
            source: 'settlement-clusters',
            paint: {
              'circle-radius': [
                'case',
                ['==', ['get', 'id'], selectedClusterId ?? ''],
                11,
                8,
              ],
              'circle-color': [
                'match',
                ['get', 'proxy_class'],
                'LIKELY_ELECTRIFIED',
                '#1B6E3A',
                'POTENTIALLY_UNDERSERVED',
                '#B35300',
                'POTENTIALLY_UNSERVED',
                '#A61B1B',
                '#52504A',
              ],
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': 2.2,
            },
          });
          map.addLayer({
            id: 'clusters-label',
            type: 'symbol',
            source: 'settlement-clusters',
            layout: {
              'text-field': [
                'concat',
                ['get', 'cluster_code'],
                ' · ',
                ['get', 'name'],
              ],
              'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
              'text-size': 10.5,
              'text-offset': [0, 1.3],
              'text-anchor': 'top',
            },
            paint: {
              'text-color': '#141413',
              'text-halo-color': '#F7F5F0',
              'text-halo-width': 1.6,
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
              'line-width': 3.6,
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
              'circle-radius': 9.5,
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
              'circle-radius': 7.5,
              'circle-color': [
                'match',
                ['get', 'provenance'],
                'USER_ASSUMED',
                '#D97706',
                '#0F766E',
              ],
              'circle-stroke-color': '#FFFFFF',
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
                5.5,
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
              'circle-stroke-width': 1.4,
            },
          });
          // Labels for Substations & Transformers
          map.addLayer({
            id: 'layer-a-labels',
            type: 'symbol',
            source: 'layer-a-existing-infra',
            filter: [
              'in',
              ['get', 'infra_category'],
              ['literal', ['SUBSTATION', 'TRANSFORMER', 'TIE_IN']],
            ],
            layout: {
              'text-field': ['get', 'name'],
              'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
              'text-size': 10,
              'text-offset': [0, -1.3],
              'text-anchor': 'bottom',
            },
            paint: {
              'text-color': '#1E1B4B',
              'text-halo-color': '#FFFFFF',
              'text-halo-width': 1.5,
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
              'line-width': 2.4,
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
              'line-width': 3.0,
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
              'line-width': 2.4,
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
              'circle-radius': 7.5,
              'circle-color': [
                'match',
                ['get', 'layer_type'],
                'MINIGRID_PROPOSED',
                '#0284C7',
                '#DC2626',
              ],
              'circle-stroke-color': '#FEF08A',
              'circle-stroke-width': 2.2,
            },
          });
        }
        setLayerVisibilitySafe(
          map,
          ['network-ht-lines', 'network-lt-lines', 'network-dt-points'],
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
    },
    [
      basemap,
      aoiGeometry,
      boundarySource,
      referenceBuildings,
      osmFeatures,
      effectiveSettlementsFc,
      mergedLayerAInfra,
      effectiveGapsFc,
      effectiveProposedFc,
      selectedClusterId,
      rasterOverlayUrl,
      rasterOpacity,
      drawnVertices,
      measureModeActive,
      measurePoints,
      layerAEnabled,
      layerBEnabled,
      viirsPeriod,
      viirsGlobalGibs,
      viirsOpacity,
      layerCEnabled,
      layerDEnabled,
      layerEEnabled,
      layerFEnabled,
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
  });
  interactionRef.current = {
    drawModeActive,
    measureModeActive,
    onDrawnPolygonChange,
    placeTieInModeActive,
    onPlaceTieInPoint,
    onSelectCluster,
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildBasemapStyle(basemap),
      center: KORAPUT_DEFAULT_CENTER,
      zoom: KORAPUT_DEFAULT_ZOOM,
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
    });

    map.on('zoomend', () => {
      setZoomLevel(Number(map.getZoom().toFixed(2)));
    });

    map.on('error', (err: { error?: { message?: string } }) => {
      const msg = err?.error?.message ?? '';
      if (msg && (msg.includes('404') || msg.includes('Failed to fetch'))) {
        setTileWarning(
          'External tile server temporarily unreachable; displaying local survey coordinate grid and GIS vector overlays.',
        );
      }
    });

    map.on('click', (e: maplibregl.MapMouseEvent) => {
      if (!e?.lngLat) return;
      const lon = Number(e.lngLat.lng.toFixed(6));
      const lat = Number(e.lngLat.lat.toFixed(6));

      if (interactionRef.current.placeTieInModeActive) {
        interactionRef.current.onPlaceTieInPoint?.(lon, lat);
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
        'gap-corridors-line',
        'ref-buildings-fill',
        'village-status-fill',
      ].filter((id) => Boolean(map.getLayer(id)));

      if (candidateLayers.length === 0) return;
      const hits = map.queryRenderedFeatures(e.point, {
        layers: candidateLayers,
      });
      if (!hits || hits.length === 0) return;

      const topHit = hits[0]!;
      const props = topHit.properties ?? {};
      const layerId = topHit.layer.id;

      if (
        layerId === 'clusters-centroid-circle' ||
        layerId === 'clusters-hull-fill'
      ) {
        if (props.id && interactionRef.current.onSelectCluster) {
          interactionRef.current.onSelectCluster(String(props.id));
        }
        setInspectedFeature({
          layerGroupTitle: 'Layer D · Settlement & Habitation Assessment',
          title: `${String(props.cluster_code ?? 'Cluster')} — ${String(props.name ?? 'Habitation')}`,
          subtitle: `Axis 1 Proxy: ${String(props.proxy_class ?? 'UNKNOWN')} · Axis 2: ${String(props.verification_state ?? 'UNVERIFIED')}`,
          provenanceBadge: 'VIIRS DNB + Footprint DBSCAN',
          beginnerExplanation:
            'A habitation cluster groups nearby detected building footprints (within 100 m in UTM coordinates) to estimate household electricity demand and check whether existing grid lines reach the community.',
          epistemicCaveat: String(
            props.evidence_summary ??
              'Satellite proxy classification only; requires Gram Sabha or DISCOM feeder verification.',
          ),
          attributes: [
            {
              label: 'Detected Structures',
              value: `${String(props.building_count ?? 'N/A')} footprints`,
            },
            {
              label: 'Estimated Households',
              value: `${String(props.estimated_households ?? 'N/A')} HH`,
            },
            {
              label: '2024 VIIRS Radiance',
              value: `${String(props.viirs_radiance_2024_nw ?? props.mean_radiance ?? '0.41')} nW/cm²/sr`,
            },
            {
              label: '2020 Baseline Radiance',
              value: `${String(props.viirs_radiance_2020_nw ?? '0.28')} nW/cm²/sr`,
            },
            {
              label: 'Nearest 11 kV Grid',
              value: `${String(props.distance_to_11kv_m ?? 'N/A')} m`,
            },
            {
              label: 'Preliminary Mode',
              value: String(props.preliminary_mode ?? 'Pending Evaluation'),
            },
          ],
        });
      } else if (layerId.startsWith('layer-a-')) {
        setInspectedFeature({
          layerGroupTitle: 'Layer A · Mapped Electricity Infrastructure',
          title: String(props.name ?? 'Electricity Infrastructure Asset'),
          subtitle: `Category: ${String(props.infra_category ?? props.asset_type ?? 'GRID_ASSET')} · Tag: ${String(props.osm_tag ?? 'power=*')}`,
          provenanceBadge: String(props.provenance ?? 'OSM_MAPPED'),
          beginnerExplanation:
            'This is existing electricity grid infrastructure mapped in OpenStreetMap or uploaded from utility records. 33 kV lines carry bulk power to substations; 11 kV lines distribute power to village transformers.',
          epistemicCaveat: String(
            props.epistemic_note ??
              'Missing infrastructure in OpenStreetMap must never be interpreted as proof that infrastructure does not exist on the ground.',
          ),
          attributes: [
            {
              label: 'Nominal Voltage',
              value: `${String(props.voltage_kv ?? 11)} kV`,
            },
            {
              label: 'Transformer Rating',
              value: props.rating_kva ? `${String(props.rating_kva)} kVA` : 'Linear / Support Asset',
            },
            {
              label: 'Conductor / Spec',
              value: String(props.conductor ?? 'Standard REC Rural Spec'),
            },
            {
              label: 'Operator / Source',
              value: String(props.operator ?? props.source_note ?? 'TPSODL / OpenStreetMap'),
            },
          ],
        });
      } else if (layerId.startsWith('network-')) {
        setInspectedFeature({
          layerGroupTitle: 'Layer F · Proposed Electricity Network Extension',
          title: String(props.name ?? 'Proposed Network Element'),
          subtitle: `Type: ${String(props.layer_type ?? 'PROPOSED')} · Status: PRELIMINARY DESIGN`,
          provenanceBadge: 'PROPOSED_PRELIMINARY',
          beginnerExplanation:
            'This is a computer-generated preliminary route or transformer placement designed to connect unserved or underserved habitations using terrain-weighted least-cost routing.',
          epistemicCaveat: String(
            props.engineering_disclaimer ??
              'NOT INSTALLED INFRASTRUCTURE. Preliminary engineering estimate requiring field peg-marking and DISCOM load-flow study.',
          ),
          attributes: [
            {
              label: 'Design Voltage',
              value: `${String(props.voltage_kv ?? 11)} kV`,
            },
            {
              label: 'Route Length',
              value: props.length_km
                ? `${String(props.length_km)} km (${String(props.length_m ?? '')} m)`
                : 'Point Asset (DT / Mini-Grid)',
            },
            {
              label: 'Conductor / Rating',
              value: String(
                props.conductor ??
                  (props.rating_kva ? `${String(props.rating_kva)} kVA` : 'ACSR Weasel'),
              ),
            },
          ],
        });
      } else if (layerId === 'gap-corridors-line') {
        setInspectedFeature({
          layerGroupTitle: 'Layer E · Potential Electrification Gap Corridor',
          title: String(props.gap_code ?? 'Unserved / Underserved Gap Corridor'),
          subtitle: `Severity: ${String(props.gap_severity ?? 'CANDIDATE_GAP')}`,
          provenanceBadge: String(props.estimation_type ?? 'MODEL_ESTIMATED_GAP'),
          beginnerExplanation:
            'A Potential Electrification Gap highlights a settlement where multiple indicators (distance from existing 11 kV lines, Census supply history, and low nighttime light) suggest households may lack reliable grid power.',
          epistemicCaveat:
            'Model-estimated investigation corridor. Dark satellite pixels are never automatically classified as unelectrified without field survey confirmation.',
          attributes: [
            {
              label: 'Target Habitation',
              value: String(props.target_cluster ?? 'Cluster'),
            },
            {
              label: 'Straight-Line Distance',
              value: `${String(props.straight_line_dist_m ?? 'N/A')} m`,
            },
            {
              label: 'Terrain-Weighted Distance',
              value: `${String(props.terrain_weighted_dist_m ?? 'N/A')} m`,
            },
            {
              label: 'Recommended Action',
              value: String(props.recommended_action ?? 'Field survey verification'),
            },
          ],
        });
      } else if (layerId === 'village-status-fill') {
        setInspectedFeature({
          layerGroupTitle: 'Layer C · Village Electrification & Census Profile',
          title: `Village ${String(props.village_name ?? '')} (LGD ${String(props.lgd_code ?? '')})`,
          subtitle: String(props.status_label ?? ''),
          provenanceBadge: 'CENSUS 2011 DCHB + LGD',
          beginnerExplanation:
            'Displays official revenue village boundaries, Census 2011 demographics, Scheduled Tribe (ST) population share, and historical power supply availability hours.',
          epistemicCaveat: String(
            props.missing_data_notice ??
              'Post-2011 household-level connection progress requires verified DISCOM billing ledgers.',
          ),
          attributes: [
            {
              label: 'Census 2011 Population',
              value: `${String(props.total_pop ?? 'N/A')} (ST: ${String(props.st_pop ?? 'N/A')})`,
            },
            {
              label: 'Census 2011 Households',
              value: `${String(props.households_2011 ?? 'N/A')} HH`,
            },
            {
              label: '2026 Detected Footprints',
              value: `${String(props.detected_footprints_2026 ?? 'N/A')} structures`,
            },
            {
              label: 'Census 2011 Power Supply',
              value: `Summer: ${String(props.summer_supply_hrs_2011 ?? 0)} hrs/day · Winter: ${String(props.winter_supply_hrs_2011 ?? 0)} hrs/day`,
            },
          ],
        });
      }
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

  const handleSearchInput = (val: string) => {
    setSearchQuery(val);
    const q = val.trim().toLowerCase();
    if (!q) {
      setSearchResults([]);
      return;
    }
    const localHits = KORAPUT_SEARCH_CATALOG.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q),
    );
    setSearchResults(localHits);
  };

  const handleRunOpenStreetMapSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    const localHits = KORAPUT_SEARCH_CATALOG.filter(
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
      }
    } catch {
      // Fallback smoothly offline
    } finally {
      setSearchingExternal(false);
    }
  };

  const handleSelectSearchLocation = (loc: SearchableLocationItem) => {
    setSearchResults([]);
    setSearchQuery(loc.label);
    const map = mapRef.current;
    if (!map) return;
    try {
      map.flyTo({
        center: [loc.lon, loc.lat],
        zoom: loc.zoom,
        duration: 500,
      });
    } catch {
      // Ignore in headless tests
    }
  };

  const handleClearDraw = () => {
    setDrawnVertices([]);
    onDrawnPolygonChange?.(null, 0);
  };

  const measuredLengthMeters = computePolylineLengthMeters(measurePoints);
  const measuredAreaM2 = computePolygonAreaM2(measurePoints);

  return (
    <div className="bg-sheet border border-rule-strong rounded-xs overflow-hidden flex flex-col">
      {/* Top Specialised Electricity GIS Command Bar */}
      <div className="p-2.5 border-b border-rule flex flex-wrap items-center justify-between gap-2 bg-paper">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setLayerPanelOpen((prev) => !prev)}
            className="px-2.5 py-1 text-xs font-mono font-semibold rounded-xs border border-rule-strong bg-sheet text-ink hover:bg-accent-tint transition-colors"
            title="Toggle Specialised Electricity GIS Layer Manager (Layers A–F)"
          >
            {layerPanelOpen ? '◀ Hide GIS Layers (A–F)' : '▶ Open GIS Layers (A–F)'}
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
              className="h-7 w-48 sm:w-60 px-2 text-xs bg-sheet border border-rule-strong rounded-l-xs text-ink"
            />
            <button
              type="button"
              onClick={() => void handleRunOpenStreetMapSearch()}
              className="h-7 px-2 text-xs font-mono bg-sheet border border-l-0 border-rule-strong rounded-r-xs text-ink-2 hover:text-ink"
            >
              {searchingExternal ? '...' : 'Find'}
            </button>

            {searchResults.length > 0 && (
              <div className="absolute top-8 left-0 z-30 w-80 bg-sheet border border-rule-strong rounded-xs shadow-md divide-y divide-rule max-h-60 overflow-y-auto">
                {searchResults.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => handleSelectSearchLocation(loc)}
                    className="w-full text-left p-2 hover:bg-accent-tint/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-ink truncate">
                        {loc.label}
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-xs bg-paper border border-rule text-ink-2">
                        {loc.category}
                      </span>
                    </div>
                    <div className="text-[11px] text-ink-2 mt-0.5">{loc.summary}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Basemap Switcher (4 Free Options) & GIS Utilities */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div
            role="group"
            aria-label="Basemap switcher"
            className="inline-flex rounded-xs border border-rule-strong bg-sheet p-0.5"
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
                onClick={() => handleBasemapChange(opt.id)}
                className={`px-2 py-1 text-xs font-medium rounded-xs transition-colors ${
                  basemap === opt.id
                    ? 'bg-accent text-white'
                    : 'text-ink-2 hover:text-ink hover:bg-paper'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setMeasureModeActive((prev) => !prev);
              setMeasurePoints([]);
            }}
            className={`px-2 py-1 text-xs font-mono rounded-xs border transition-colors ${
              measureModeActive
                ? 'bg-info text-white border-info'
                : 'bg-sheet text-ink-2 border-rule-strong hover:text-ink'
            }`}
          >
            {measureModeActive ? 'Measuring (Click Map)' : 'Measure Span / Area'}
          </button>

          <button
            type="button"
            onClick={() => setBeginnerGuideOpen((prev) => !prev)}
            className={`px-2 py-1 text-xs font-mono rounded-xs border transition-colors ${
              beginnerGuideOpen
                ? 'bg-accent text-white border-accent'
                : 'bg-sheet text-ink-2 border-rule-strong hover:text-ink'
            }`}
          >
            ? Beginner Guide
          </button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fitToActiveAoi()}
            title="Zoom and center map on active Area of Interest"
          >
            Fit AOI
          </Button>

          {drawModeActive && (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-accent bg-accent-tint px-2 py-1 rounded-xs border border-accent/30">
                Draw Mode: Click map to add vertices ({drawnVertices.length} pts)
              </span>
              {drawnVertices.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleClearDraw}>
                  Clear Polygon
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Beginner-Friendly Plain-English Guide Drawer */}
      {beginnerGuideOpen && (
        <div className="p-3 bg-paper border-b border-rule-strong text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-ink uppercase font-mono text-[11px]">
              Beginner Guide: How to Read the Electricity GIS Map
            </span>
            <button
              type="button"
              onClick={() => setBeginnerGuideOpen(false)}
              className="text-ink-2 underline font-mono text-[11px]"
            >
              Close Guide
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px] text-ink-2">
            <div className="p-2 bg-sheet border border-rule rounded-xs">
              <strong className="text-ink block mb-0.5">
                1. Existing vs. Proposed Lines
              </strong>
              <strong>Solid purple (33 kV)</strong> and{' '}
              <strong>solid dark-red (11 kV)</strong> lines show mapped existing grid
              lines from OpenStreetMap. <strong>Dashed red (11 kV)</strong> and{' '}
              <strong>dashed blue (415 V)</strong> lines show preliminary proposed routes
              — they are planning estimates, not installed lines.
            </div>
            <div className="p-2 bg-sheet border border-rule rounded-xs">
              <strong className="text-ink block mb-0.5">
                2. What Nighttime Illumination (VIIRS) Means
              </strong>
              NASA VIIRS measures upward outdoor light at night in{' '}
              <code>nW/cm²/sr</code>. Bright areas indicate street or outdoor lighting.
              <strong> A dark pixel does NOT prove a village has no electricity</strong>{' '}
              — satellites cannot see indoor household bulbs, meters, or daytime solar
              systems.
            </div>
            <div className="p-2 bg-sheet border border-rule rounded-xs">
              <strong className="text-ink block mb-0.5">
                3. Potential Electrification Gaps
              </strong>
              Amber/red dashed corridors highlight habitations (like Podapadar Tola &amp;
              Maliaguda PVTG) located far (&gt;1.5 km) from mapped 11 kV transformers
              with low nighttime radiance. Click any symbol on the map to inspect its
              full data source and caveats.
            </div>
          </div>
        </div>
      )}

      {/* Active Distance & Area Measurement Bar */}
      {measureModeActive && (
        <div className="px-3 py-1.5 bg-info-tint border-b border-rule flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-info">
          <div>
            <strong>Measurement Active:</strong> Click points on the map ({measurePoints.length}{' '}
            pts) · Line Span:{' '}
            <strong>
              {measuredLengthMeters.toFixed(1)} m (
              {(measuredLengthMeters / 1000).toFixed(3)} km)
            </strong>
            {measurePoints.length >= 3 && (
              <>
                {' '}
                · Enclosed Area:{' '}
                <strong>
                  {(measuredAreaM2 / 10000).toFixed(2)} ha (
                  {(measuredAreaM2 / 1e6).toFixed(3)} km²)
                </strong>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
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
        <div className="px-3 py-1 bg-warn-tint border-b border-rule text-[11px] font-mono text-warn flex items-center justify-between">
          <span>{tileWarning}</span>
          <button
            type="button"
            onClick={() => setTileWarning(null)}
            className="underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Central GIS Workspace Grid: Layer Panel (Left) + Map Viewport (Center) + Feature Inspector (Right) */}
      <div className="relative flex flex-col lg:flex-row w-full">
        {/* Dedicated Layer Management Panel (Layers A through F) */}
        {layerPanelOpen && (
          <aside
            aria-label="Specialised Electricity GIS Layers"
            className="w-full lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-rule-strong bg-paper p-2.5 space-y-2 max-h-[540px] overflow-y-auto text-xs"
          >
            <div className="flex items-center justify-between border-b border-rule pb-1.5">
              <span className="font-mono text-[11px] uppercase tracking-wider font-semibold text-ink">
                Electricity GIS Layers (A–F)
              </span>
              <QualityTag kind="ESTIMATED" label="100% FREE OPEN DATA" />
            </div>

            {/* Layer A: Electricity Infrastructure */}
            <div className="p-2 bg-sheet border border-rule rounded-xs space-y-1.5">
              <label className="flex items-start gap-2 cursor-pointer font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={layerAEnabled}
                  onChange={(e) => setLayerAEnabled(e.target.checked)}
                  className="mt-0.5"
                />
                <span>Layer A · Existing Electricity Infrastructure</span>
              </label>
              <p className="text-[11px] text-ink-2 leading-snug">
                Mapped OpenStreetMap <code>power=*</code> lines, 33/11 kV substations,
                distribution transformers (DTs), lattice towers, and poles.
              </p>
              {layerAEnabled && (
                <div className="space-y-1 pt-1 border-t border-rule">
                  <label
                    htmlFor="voltage-filter-select"
                    className="block font-mono text-[10px] uppercase text-ink-2"
                  >
                    Filter by Voltage / Category
                  </label>
                  <select
                    id="voltage-filter-select"
                    value={voltageFilter}
                    onChange={(e) =>
                      setVoltageFilter(e.target.value as VoltageFilterMode)
                    }
                    className="w-full h-7 px-1.5 text-[11px] font-mono bg-paper border border-rule-strong rounded-xs"
                  >
                    <option value="ALL">All Voltages (33 kV + 11 kV + Substations + Poles)</option>
                    <option value="33KV_TRANSMISSION">33 kV Sub-Transmission &amp; Substations</option>
                    <option value="11KV_DISTRIBUTION">11 kV Primary Distribution Feeders</option>
                    <option value="SUBSTATIONS_AND_DTS">Substations &amp; Transformers Only</option>
                    <option value="TOWERS_AND_POLES">Electricity Towers &amp; Poles Only</option>
                  </select>
                  <div className="text-[10px] font-mono text-warn">
                    ⚠ Absence of mapped OSM lines does not prove absence of ground lines.
                  </div>
                </div>
              )}
            </div>

            {/* Layer B: Nighttime Illumination (NASA VIIRS Black Marble) */}
            <div className="p-2 bg-sheet border border-rule rounded-xs space-y-1.5">
              <label className="flex items-start gap-2 cursor-pointer font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={layerBEnabled}
                  onChange={(e) => setLayerBEnabled(e.target.checked)}
                  className="mt-0.5"
                />
                <span>Layer B · NASA VIIRS Nighttime Illumination</span>
              </label>
              <p className="text-[11px] text-ink-2 leading-snug">
                Satellite nighttime radiance (<code>nW/cm²/sr</code>). Indirect proxy
                only — cannot detect indoor household meters.
              </p>
              {layerBEnabled && (
                <div className="space-y-1.5 pt-1 border-t border-rule">
                  <div>
                    <label
                      htmlFor="viirs-period-select"
                      className="block font-mono text-[10px] uppercase text-ink-2"
                    >
                      Observation Composite Date
                    </label>
                    <select
                      id="viirs-period-select"
                      value={viirsPeriod}
                      onChange={(e) =>
                        setViirsPeriod(e.target.value as ViirsObservationPeriod)
                      }
                      className="w-full h-7 px-1.5 text-[11px] font-mono bg-paper border border-rule-strong rounded-xs"
                    >
                      {VIIRS_PERIOD_OPTIONS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span>Overlay Opacity: {Math.round(viirsOpacity * 100)}%</span>
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
                  <label className="flex items-center gap-1.5 text-[11px] text-ink-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={viirsGlobalGibs}
                      onChange={(e) => setViirsGlobalGibs(e.target.checked)}
                    />
                    <span>Include Global NASA GIBS VIIRS Tiles</span>
                  </label>
                </div>
              )}
            </div>

            {/* Layer C: Village Electrification Status */}
            <div className="p-2 bg-sheet border border-rule rounded-xs space-y-1">
              <label className="flex items-start gap-2 cursor-pointer font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={layerCEnabled}
                  onChange={(e) => setLayerCEnabled(e.target.checked)}
                  className="mt-0.5"
                />
                <span>Layer C · Village Electrification Status</span>
              </label>
              <p className="text-[11px] text-ink-2 leading-snug">
                Census 2011 DCHB domestic power availability hours &amp; LGD boundaries.
                Verified current household meter counts require DISCOM consumer ledgers.
              </p>
            </div>

            {/* Layer D: Population & Settlements */}
            <div className="p-2 bg-sheet border border-rule rounded-xs space-y-1">
              <label className="flex items-start gap-2 cursor-pointer font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={layerDEnabled}
                  onChange={(e) => setLayerDEnabled(e.target.checked)}
                  className="mt-0.5"
                />
                <span>Layer D · Settlements, Population &amp; Footprints</span>
              </label>
              <p className="text-[11px] text-ink-2 leading-snug">
                Habitation clusters (<code>CL-01</code> to <code>CL-04</code>), 143
                building footprints, ST population share, and rural schools/PHC.
              </p>
            </div>

            {/* Layer E: Potential Electrification Gaps */}
            <div className="p-2 bg-sheet border border-rule rounded-xs space-y-1">
              <label className="flex items-start gap-2 cursor-pointer font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={layerEEnabled}
                  onChange={(e) => setLayerEEnabled(e.target.checked)}
                  className="mt-0.5"
                />
                <span>Layer E · Potential Electrification Gaps</span>
              </label>
              <p className="text-[11px] text-ink-2 leading-snug">
                Multi-evidence investigation corridors combining grid distance (&gt;1.6
                km), low VIIRS radiance, and household density.
              </p>
            </div>

            {/* Layer F: Proposed Electricity Network */}
            <div className="p-2 bg-sheet border border-rule rounded-xs space-y-1">
              <label className="flex items-start gap-2 cursor-pointer font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={layerFEnabled}
                  onChange={(e) => setLayerFEnabled(e.target.checked)}
                  className="mt-0.5"
                />
                <span>Layer F · Proposed Electricity Network</span>
              </label>
              <p className="text-[11px] text-ink-2 leading-snug">
                Preliminary proposed 11 kV HT spurs, 415 V LT AB-cable lines, 25 kVA DT,
                and 18.5 kWp Solar Mini-Grid candidate.
              </p>
            </div>
          </aside>
        )}

        {/* Center Interactive MapLibre GL JS Viewport */}
        <div
          className={`relative flex-1 w-full ${heightClass} bg-[#EFECE6] overflow-hidden`}
          style={{ minHeight: '480px' }}
        >
          <div
            ref={containerRef}
            aria-label="ElectriMap Interactive GIS Map Canvas"
            className="absolute inset-0 w-full h-full"
            style={{ width: '100%', height: '100%' }}
          />

          {/* Preliminary Engineering Watermark Banner */}
          <div className="pointer-events-none absolute top-2.5 left-2.5 z-10 bg-sheet/95 border border-rule-strong px-2.5 py-1 rounded-xs shadow-xs">
            <div className="font-mono text-[10px] uppercase tracking-wider text-warn font-semibold">
              PRELIMINARY ENGINEERING ESTIMATE — FIELD SURVEY REQUIRED
            </div>
          </div>

          {/* Contextual Feature Inspector Panel (Opens on Clicking Any Map Feature) */}
          {inspectedFeature && (
            <div
              role="region"
              aria-label="Selected GIS Feature Inspector"
              className="absolute bottom-3 right-3 z-20 w-80 sm:w-96 max-h-[85%] overflow-y-auto bg-sheet/98 border-2 border-accent rounded-xs shadow-lg p-3 space-y-2 text-xs"
            >
              <div className="flex items-start justify-between gap-2 border-b border-rule pb-1.5">
                <div>
                  <div className="font-mono text-[10px] uppercase text-accent font-semibold">
                    {inspectedFeature.layerGroupTitle}
                  </div>
                  <h3 className="text-sm font-semibold text-ink mt-0.5">
                    {inspectedFeature.title}
                  </h3>
                  <div className="font-mono text-[11px] text-ink-2">
                    {inspectedFeature.subtitle}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectedFeature(null)}
                  className="px-1.5 py-0.5 text-xs font-mono bg-paper border border-rule rounded-xs text-ink-2 hover:text-ink"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5 bg-paper p-2 rounded-xs border border-rule font-mono text-[11px]">
                {inspectedFeature.attributes.map((attr) => (
                  <div key={attr.label}>
                    <div className="text-[10px] text-ink-3 uppercase">{attr.label}</div>
                    <div className="font-semibold text-ink">{attr.value}</div>
                  </div>
                ))}
              </div>

              <div className="text-[11px] text-ink-2 leading-snug">
                <strong className="text-ink">What this means:</strong>{' '}
                {inspectedFeature.beginnerExplanation}
              </div>

              <div className="p-2 bg-warn-tint border border-warn/40 rounded-xs text-[11px] text-warn font-medium">
                <strong>Data Accuracy &amp; Provenance ({inspectedFeature.provenanceBadge}):</strong>{' '}
                {inspectedFeature.epistemicCaveat}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Comprehensive Electrical GIS Symbology Legend & Coordinate Telemetry Bar */}
      <div className="px-3 py-2 border-t border-rule bg-paper flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-ink-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1" title="Mapped 33 kV Sub-Transmission Line (OSM)">
            <span className="w-4 h-1 inline-block bg-[#6D28D9]" />
            33 kV Line (OSM)
          </span>
          <span className="inline-flex items-center gap-1" title="Mapped 11 kV Primary Distribution Feeder">
            <span className="w-4 h-0.5 inline-block bg-[#991B1B]" />
            11 kV Existing
          </span>
          <span className="inline-flex items-center gap-1" title="33/11 kV Primary Distribution Substation">
            <span className="w-3 h-3 rounded-full inline-block bg-[#4C1D95] border-2 border-[#FDE047]" />
            33/11 kV Substation
          </span>
          <span className="inline-flex items-center gap-1" title="Existing Distribution Transformer (DT)">
            <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#0F766E]" />
            Existing DT
          </span>
          <span className="inline-flex items-center gap-1" title="Preliminary Proposed 11 kV HT Extension">
            <span className="w-4 h-0.5 inline-block border-b-2 border-dashed border-[#DC2626]" />
            Proposed 11 kV
          </span>
          <span className="inline-flex items-center gap-1" title="Preliminary Proposed 415 V LT AB-Cable">
            <span className="w-4 h-0.5 inline-block border-b-2 border-dashed border-[#0284C7]" />
            Proposed 415 V LT
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#1B6E3A]" />
            Likely Electrified (Proxy)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#B35300]" />
            Underserved (Proxy)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#A61B1B]" />
            Unserved Gap (Proxy)
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>
            LON: <strong className="text-ink">{cursorCoords.lon.toFixed(5)}°E</strong> · LAT:{' '}
            <strong className="text-ink">{cursorCoords.lat.toFixed(5)}°N</strong>
          </span>
          <span>ZOOM: {zoomLevel.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
};
