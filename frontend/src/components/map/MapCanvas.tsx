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

export type BasemapMode = 'survey_paper' | 'streets' | 'satellite';

const KORAPUT_DEFAULT_CENTER: [number, number] = [82.6815, 18.5685];
const KORAPUT_DEFAULT_ZOOM = 13.2;
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

/**
 * Build a deterministic, self-contained MapLibre StyleSpecification for each basemap mode.
 * Including `glyphs` in every mode ensures symbol/label layers (`clusters-label`) never fail
 * MapLibre GL JS v6 style validation.
 */
function buildBasemapStyle(mode: BasemapMode): StyleSpecification {
  if (mode === 'streets') {
    return {
      version: 8,
      glyphs: GLYPHS_URL,
      sources: {
        'carto-voyager': {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
            'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
            'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          maxzoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
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
          source: 'carto-voyager',
          minzoom: 0,
          maxzoom: 22,
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
      'carto-positron': {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
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
        source: 'carto-positron',
        minzoom: 0,
        maxzoom: 22,
        paint: {
          'raster-opacity': 0.85,
          'raster-saturation': -0.35,
          'raster-contrast': 0.05,
        },
      },
    ],
  };
}

/**
 * Generate a local engineering coordinate graticule (`EPSG:4326`) around Koraput / AOI
 * so the survey sheet displays coordinate grid lines even in offline environments.
 */
function buildSurveyGraticuleGeoJson(): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  const minLon = 82.55;
  const maxLon = 82.82;
  const minLat = 18.45;
  const maxLat = 18.7;
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

/** Compute `[minLon, minLat, maxLon, maxLat]` from any GeoJSON geometry or FeatureCollection */
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
  heightClass = 'h-[480px]',
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
            // Ignore fitBounds error in headless/stubbed test environments
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

  const syncLayers = useCallback(
    (map: maplibregl.Map) => {
      try {
        if (!map.getStyle()) return;
      } catch {
        return;
      }

      // 0. Engineering Survey Graticule (subtle coordinate grid lines)
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
        // Ignore if style is mid-transition
      }

      // 1. Optional Raster Overlay (`dem_slope`, `landcover`, `nightlights`)
      try {
        if (rasterOverlayUrl) {
          const aoiBbox = aoiGeometry ? computeGeoJsonBbox(aoiGeometry) : null;
          const minLon = aoiBbox ? aoiBbox[0] : 82.655;
          const minLat = aoiBbox ? aoiBbox[1] : 18.545;
          const maxLon = aoiBbox ? aoiBbox[2] : 82.705;
          const maxLat = aoiBbox ? aoiBbox[3] : 18.59;
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
              url: rasterOverlayUrl,
              coordinates: bounds,
            });
            map.addLayer({
              id: 'project-raster-layer',
              type: 'raster',
              source: 'project-raster',
              paint: {
                'raster-opacity': rasterOpacity,
              },
            });
          } else {
            if (typeof existingRaster.updateImage === 'function') {
              existingRaster.updateImage({
                url: rasterOverlayUrl,
                coordinates: bounds,
              });
            }
            if (map.getLayer('project-raster-layer')) {
              map.setPaintProperty(
                'project-raster-layer',
                'raster-opacity',
                rasterOpacity,
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
        // Ignore raster update error during style reload
      }

      // 2. AOI Boundary Polygon
      try {
        const aoiFc: GeoJSON.FeatureCollection = aoiGeometry
          ? {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: { boundary_source: boundarySource },
                  geometry: aoiGeometry as unknown as GeoJSON.Geometry,
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
              'fill-opacity': 0.1,
            },
          });
        }
        const outlineColor =
          boundarySource === 'APPROXIMATE_BUFFER' ? '#A35C00' : '#1E4D3B';
        if (!map.getLayer('aoi-outline')) {
          const linePaint: maplibregl.LineLayerSpecification['paint'] = {
            'line-color': outlineColor,
            'line-width': 2.4,
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
        // Ignore AOI layer sync error during transition
      }

      // 3. OSM Roads, Waterways, and Community Amenities
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
                'line-width': [
                  'match',
                  ['get', 'category'],
                  'ROAD',
                  1.8,
                  'WATERWAY',
                  1.5,
                  1.0,
                ],
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
        } else if (map.getSource('osm-features')) {
          upsertGeoJsonSource(map, 'osm-features', {
            type: 'FeatureCollection',
            features: [],
          });
        }
      } catch {
        // Ignore OSM layer error
      }

      // 4. Detected Building Footprints
      try {
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
                'fill-opacity': ['case', ['==', ['get', 'is_excluded'], true], 0.25, 0.72],
                'fill-outline-color': '#5C3D1E',
              },
            });
          }
        } else if (map.getSource('ref-buildings')) {
          upsertGeoJsonSource(map, 'ref-buildings', {
            type: 'FeatureCollection',
            features: [],
          });
        }
      } catch {
        // Ignore buildings layer error
      }

      // 5. Settlement Clusters (M4: Two-Axis Symbology + Convex Hull Polygons)
      try {
        if (settlementClusters) {
          upsertGeoJsonSource(map, 'settlement-clusters', settlementClusters);
          if (!map.getLayer('clusters-hull-fill')) {
            map.addLayer({
              id: 'clusters-hull-fill',
              type: 'fill',
              source: 'settlement-clusters',
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
                'fill-opacity': 0.14,
              },
            });
            map.addLayer({
              id: 'clusters-hull-outline',
              type: 'line',
              source: 'settlement-clusters',
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
                  10,
                  7,
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
                'circle-stroke-color': [
                  'match',
                  ['get', 'verification_state'],
                  'VERIFIED',
                  '#FFFFFF',
                  '#141413',
                ],
                'circle-stroke-width': [
                  'case',
                  ['==', ['get', 'id'], selectedClusterId ?? ''],
                  3.0,
                  1.8,
                ],
              },
            });
            map.addLayer({
              id: 'clusters-label',
              type: 'symbol',
              source: 'settlement-clusters',
              layout: {
                'text-field': ['get', 'cluster_code'],
                'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
                'text-size': 10,
                'text-offset': [0, 1.3],
                'text-anchor': 'top',
              },
              paint: {
                'text-color': '#141413',
                'text-halo-color': '#F7F5F0',
                'text-halo-width': 1.5,
              },
            });
          } else if (map.getLayer('clusters-centroid-circle')) {
            map.setPaintProperty('clusters-centroid-circle', 'circle-radius', [
              'case',
              ['==', ['get', 'id'], selectedClusterId ?? ''],
              10,
              7,
            ]);
          }
        }
      } catch {
        // Ignore clusters layer error
      }

      // 6. Existing Infrastructure Assets & User-Assumed Tie-In Points (M5)
      try {
        if (infrastructureAssets) {
          upsertGeoJsonSource(map, 'infrastructure-assets', infrastructureAssets);
          if (!map.getLayer('infra-lines')) {
            map.addLayer({
              id: 'infra-lines',
              type: 'line',
              source: 'infrastructure-assets',
              filter: ['==', ['geometry-type'], 'LineString'],
              paint: {
                'line-color': '#7A1C1C',
                'line-width': 2.6,
              },
            });
            map.addLayer({
              id: 'infra-points',
              type: 'circle',
              source: 'infrastructure-assets',
              filter: ['==', ['geometry-type'], 'Point'],
              paint: {
                'circle-radius': 7,
                'circle-color': [
                  'match',
                  ['get', 'provenance'],
                  'UPLOADED_GIS',
                  '#1B6E3A',
                  'USER_ASSUMED',
                  '#A35C00',
                  '#7A1C1C',
                ],
                'circle-stroke-color': '#FFFFFF',
                'circle-stroke-width': 2.0,
              },
            });
          }
        }
      } catch {
        // Ignore infra layer error
      }

      // 7. Electrification Gap Corridors (M5: Cluster-to-Tie-In Measurement Lines)
      try {
        if (gapCorridors) {
          upsertGeoJsonSource(map, 'gap-corridors', gapCorridors);
          if (!map.getLayer('gap-corridors-line')) {
            map.addLayer({
              id: 'gap-corridors-line',
              type: 'line',
              source: 'gap-corridors',
              paint: {
                'line-color': [
                  'match',
                  ['get', 'recommended_mode'],
                  'GRID_EXTENSION_CANDIDATE',
                  '#7A1C1C',
                  'SOLAR_MINIGRID_CANDIDATE',
                  '#0F5499',
                  'SHS_CANDIDATE',
                  '#8A3FFC',
                  '#52504A',
                ],
                'line-width': 1.8,
                'line-dasharray': [3, 2],
              },
            });
          }
        }
      } catch {
        // Ignore gap corridors layer error
      }

      // 8. Proposed Network Layout (M6: 11 kV HT + 415 V LT + DTs)
      try {
        if (networkLayout) {
          upsertGeoJsonSource(map, 'network-layout', networkLayout);
          if (!map.getLayer('network-ht-lines')) {
            map.addLayer({
              id: 'network-ht-lines',
              type: 'line',
              source: 'network-layout',
              filter: ['==', ['get', 'layer_type'], 'HT_11KV_PROPOSED'],
              paint: {
                'line-color': '#7A1C1C',
                'line-width': 2.8,
                'line-dasharray': [4, 2],
              },
            });
            map.addLayer({
              id: 'network-lt-lines',
              type: 'line',
              source: 'network-layout',
              filter: ['==', ['get', 'layer_type'], 'LT_415V_PROPOSED'],
              paint: {
                'line-color': '#0F5499',
                'line-width': 2.0,
              },
            });
            map.addLayer({
              id: 'network-dt-points',
              type: 'circle',
              source: 'network-layout',
              filter: ['==', ['get', 'layer_type'], 'DT_PROPOSED'],
              paint: {
                'circle-radius': 6.5,
                'circle-color': '#7A1C1C',
                'circle-stroke-color': '#F7F5F0',
                'circle-stroke-width': 2.0,
              },
            });
          }
        } else if (referenceRoutes) {
          upsertGeoJsonSource(map, 'ref-routes', referenceRoutes);
          if (!map.getLayer('ref-routes-line')) {
            map.addLayer({
              id: 'ref-routes-line',
              type: 'line',
              source: 'ref-routes',
              paint: {
                'line-color': '#7A1C1C',
                'line-width': 2.2,
                'line-dasharray': [4, 2],
              },
            });
          }
        }
      } catch {
        // Ignore network layout error
      }

      // 9. User-Drawn Vertices & Draft Polygon
      try {
        const draftFeatures: GeoJSON.Feature[] = [];
        if (drawnVertices.length >= 3) {
          const ring = [...drawnVertices, drawnVertices[0]!];
          draftFeatures.push({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [ring],
            },
          });
        } else if (drawnVertices.length === 2) {
          draftFeatures.push({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: drawnVertices,
            },
          });
        }
        for (const pt of drawnVertices) {
          draftFeatures.push({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: pt,
            },
          });
        }

        const draftFc: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: draftFeatures,
        };
        upsertGeoJsonSource(map, 'draft-draw', draftFc);
        if (!map.getLayer('draft-draw-fill')) {
          map.addLayer({
            id: 'draft-draw-fill',
            type: 'fill',
            source: 'draft-draw',
            filter: ['==', ['geometry-type'], 'Polygon'],
            paint: {
              'fill-color': '#1E4D3B',
              'fill-opacity': 0.18,
            },
          });
          map.addLayer({
            id: 'draft-draw-line',
            type: 'line',
            source: 'draft-draw',
            paint: {
              'line-color': '#1E4D3B',
              'line-width': 2,
              'line-dasharray': [2, 2],
            },
          });
          map.addLayer({
            id: 'draft-draw-points',
            type: 'circle',
            source: 'draft-draw',
            filter: ['==', ['geometry-type'], 'Point'],
            paint: {
              'circle-radius': 5,
              'circle-color': '#1E4D3B',
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': 1.5,
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
      referenceRoutes,
      settlementClusters,
      infrastructureAssets,
      gapCorridors,
      networkLayout,
      selectedClusterId,
      rasterOverlayUrl,
      rasterOpacity,
      drawnVertices,
    ],
  );

  // Maintain a ref to the freshest `syncLayers` callback so MapLibre event listeners never run stale closures
  const syncLayersRef = useRef(syncLayers);
  syncLayersRef.current = syncLayers;

  const drawStateRef = useRef({
    drawModeActive,
    onDrawnPolygonChange,
    placeTieInModeActive,
    onPlaceTieInPoint,
    onSelectCluster,
  });
  drawStateRef.current = {
    drawModeActive,
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
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

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

      if (drawStateRef.current.placeTieInModeActive) {
        drawStateRef.current.onPlaceTieInPoint?.(lon, lat);
        return;
      }

      if (!drawStateRef.current.drawModeActive) {
        if (
          drawStateRef.current.onSelectCluster &&
          map.getLayer('clusters-centroid-circle')
        ) {
          const hits = map.queryRenderedFeatures(e.point, {
            layers: ['clusters-centroid-circle', 'clusters-hull-fill'],
          });
          if (hits.length > 0 && hits[0]?.properties?.id) {
            drawStateRef.current.onSelectCluster(String(hits[0].properties.id));
          }
        }
        return;
      }

      const pt: [number, number] = [lon, lat];
      setDrawnVertices((prev) => {
        const next = [...prev, pt];
        if (next.length >= 3) {
          const ring = [...next, next[0]!];
          drawStateRef.current.onDrawnPolygonChange?.(
            {
              type: 'Polygon',
              coordinates: [ring],
            },
            next.length,
          );
        } else {
          drawStateRef.current.onDrawnPolygonChange?.(null, next.length);
        }
        return next;
      });
    });

    map.on('load', () => {
      map.resize();
      syncLayersRef.current(map);
    });

    map.on('style.load', () => {
      syncLayersRef.current(map);
    });

    // ResizeObserver ensures the WebGL canvas always matches its flex/grid container dimensions
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

  // Synchronize all GeoJSON and raster layers whenever props change
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

  // Automatically fit map bounds whenever `aoiGeometry` arrives or changes to a new village/AOI
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

  const handleClearDraw = () => {
    setDrawnVertices([]);
    onDrawnPolygonChange?.(null, 0);
  };

  return (
    <div className="bg-sheet border border-rule-strong rounded-xs overflow-hidden flex flex-col">
      {/* Top Toolbar */}
      <div className="p-2.5 border-b border-rule flex flex-wrap items-center justify-between gap-2 bg-paper">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider font-semibold text-ink">
            GIS Canvas (EPSG:4326)
          </span>
          {boundarySource === 'APPROXIMATE_BUFFER' ? (
            <QualityTag kind="ASSUMED" label="APPROXIMATE 1.5 KM BUFFER" />
          ) : (
            <QualityTag kind="ESTIMATED" label={`BOUNDARY: ${boundarySource}`} />
          )}
        </div>

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

      {/* Map Viewport with guaranteed explicit minimum height and absolute inner canvas */}
      <div
        className={`relative w-full ${heightClass} bg-[#EFECE6] overflow-hidden`}
        style={{ minHeight: '460px' }}
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
      </div>

      {/* Symbology Legend & Coordinate Status Bar */}
      <div className="px-3 py-1.5 border-t border-rule bg-paper flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-ink-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 inline-block border-2 border-[#1E4D3B] bg-[#1E4D3B]/15" />
            AOI Boundary
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 inline-block bg-[#B35300]" />
            Footprints
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
            Unserved (Proxy)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3.5 h-0.5 inline-block bg-[#7A1C1C]" />
            11 kV HT
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3.5 h-0.5 inline-block bg-[#0F5499]" />
            415 V LT
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
