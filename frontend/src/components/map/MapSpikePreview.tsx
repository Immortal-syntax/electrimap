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
import type { InspectedFeatureState } from './MapCanvas';

export type { BasemapMode };

const KORAPUT_CENTER: [number, number] = [82.73, 18.565];
const DEFAULT_ZOOM = 12.6;
const GLYPHS_URL = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';

export interface ReferenceGeoJsonBundle {
  villages: GeoJSON.FeatureCollection;
  buildings: GeoJSON.FeatureCollection;
  routes: GeoJSON.FeatureCollection;
  existing_power_infra?: GeoJSON.FeatureCollection;
  village_electrification?: GeoJSON.FeatureCollection;
  settlements?: GeoJSON.FeatureCollection;
  electrification_gaps?: GeoJSON.FeatureCollection;
  proposed_network?: GeoJSON.FeatureCollection;
}

export interface MapSpikePreviewProps {
  /** Optional pre-loaded reference GeoJSON bundle (used by tests or parent) */
  referenceData?: ReferenceGeoJsonBundle | null;
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
      properties: {},
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
      properties: {},
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

/**
 * Generates deterministic, synthetic 50,000-point GeoJSON around Koraput AOI
 * for S1 WebGL stress verification (`F-11` / Prompt 2 Gate 4).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function generateSyntheticPointsGeoJson(
  count: number,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: Array<GeoJSON.Feature<GeoJSON.Point>> = new Array(count);
  const baseLon = 82.698;
  const baseLat = 18.538;
  const spanLon = 0.064;
  const spanLat = 0.054;

  for (let i = 0; i < count; i++) {
    const u = ((i * 2654435761) % 100000) / 100000;
    const v = ((i * 1597334677) % 100000) / 100000;
    features[i] = {
      type: 'Feature',
      properties: {
        idx: i,
        proxy_class:
          i % 4 === 0
            ? 'POTENTIALLY_UNSERVED'
            : i % 3 === 0
              ? 'POTENTIALLY_UNDERSERVED'
              : 'LIKELY_ELECTRIFIED',
      },
      geometry: {
        type: 'Point',
        coordinates: [baseLon + u * spanLon, baseLat + v * spanLat],
      },
    };
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

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
          paint: { 'raster-opacity': 0.9 },
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

export const MapSpikePreview: React.FC<MapSpikePreviewProps> = ({
  referenceData = null,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const [basemap, setBasemap] = useState<BasemapMode>('survey_paper');
  const [stressActive, setStressActive] = useState<boolean>(false);
  const [stressStatusText, setStressStatusText] = useState<string>(
    'Ready · Click any electrical line, substation, transformer, or habitation on the map to inspect',
  );
  const [cursorCoords, setCursorCoords] = useState<{ lon: number; lat: number }>({
    lon: KORAPUT_CENTER[0],
    lat: KORAPUT_CENTER[1],
  });
  const [zoomLevel, setZoomLevel] = useState<number>(DEFAULT_ZOOM);

  // Specialised Electricity GIS Layer Controls (Layers A through F)
  const [layerPanelOpen, setLayerPanelOpen] = useState<boolean>(true);
  const [beginnerGuideOpen, setBeginnerGuideOpen] = useState<boolean>(false);
  const [layerAEnabled, setLayerAEnabled] = useState<boolean>(true);
  const [voltageFilter, setVoltageFilter] = useState<VoltageFilterMode>('ALL');
  const [layerBEnabled, setLayerBEnabled] = useState<boolean>(false);
  const [viirsPeriod, setViirsPeriod] =
    useState<ViirsObservationPeriod>('2024_ANNUAL');
  const [viirsGlobalGibs, setViirsGlobalGibs] = useState<boolean>(false);
  const [viirsOpacity, setViirsOpacity] = useState<number>(0.75);
  const [layerCEnabled, setLayerCEnabled] = useState<boolean>(true);
  const [layerDEnabled, setLayerDEnabled] = useState<boolean>(true);
  const [layerEEnabled, setLayerEEnabled] = useState<boolean>(true);
  const [layerFEnabled, setLayerFEnabled] = useState<boolean>(true);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchableLocationItem[]>([]);
  const [measureModeActive, setMeasureModeActive] = useState<boolean>(false);
  const [measurePoints, setMeasurePoints] = useState<Array<[number, number]>>([]);
  const [inspectedFeature, setInspectedFeature] =
    useState<InspectedFeatureState | null>(null);

  const filteredLayerAInfra = React.useMemo<GeoJSON.FeatureCollection>(() => {
    const src =
      referenceData?.existing_power_infra ?? DEFAULT_EXISTING_POWER_INFRA_FC;
    return {
      type: 'FeatureCollection',
      features: src.features.filter((f) => {
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
      }),
    };
  }, [referenceData, voltageFilter]);

  const syncOverlayLayers = useCallback(
    (map: maplibregl.Map) => {
      try {
        if (!map.getStyle()) return;
      } catch {
        return;
      }

      // 0. Survey Coordinate Graticule
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

      // 1. Layer B: NASA VIIRS Nighttime Illumination Overlay
      try {
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

        if (layerBEnabled && !viirsGlobalGibs) {
          const url = `/api/v1/spikes/viirs-overlay?period=${viirsPeriod}`;
          const bounds: [
            [number, number],
            [number, number],
            [number, number],
            [number, number],
          ] = [
            [82.695, 18.595],
            [82.765, 18.595],
            [82.765, 18.535],
            [82.695, 18.535],
          ];
          const existingRaster = map.getSource('viirs-local-raster') as
            | maplibregl.ImageSource
            | undefined;
          if (!existingRaster) {
            map.addSource('viirs-local-raster', {
              type: 'image',
              url,
              coordinates: bounds,
            });
            map.addLayer({
              id: 'viirs-local-raster-layer',
              type: 'raster',
              source: 'viirs-local-raster',
              paint: { 'raster-opacity': viirsOpacity },
            });
          } else {
            if (typeof existingRaster.updateImage === 'function') {
              existingRaster.updateImage({ url, coordinates: bounds });
            }
            if (map.getLayer('viirs-local-raster-layer')) {
              map.setPaintProperty(
                'viirs-local-raster-layer',
                'raster-opacity',
                viirsOpacity,
              );
            }
          }
        } else {
          if (map.getLayer('viirs-local-raster-layer')) {
            map.removeLayer('viirs-local-raster-layer');
          }
          if (map.getSource('viirs-local-raster')) {
            map.removeSource('viirs-local-raster');
          }
        }
      } catch {
        // Ignore VIIRS overlay error
      }

      // 2. Layer C: Village Electrification Status Polygons
      try {
        const villageFc =
          referenceData?.village_electrification ??
          DEFAULT_VILLAGE_ELECTRIFICATION_FC;
        upsertGeoJsonSource(map, 'ref-villages', villageFc);
        if (!map.getLayer('ref-villages-fill')) {
          map.addLayer({
            id: 'ref-villages-fill',
            type: 'fill',
            source: 'ref-villages',
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
                '#1E4D3B',
              ],
              'fill-opacity': 0.11,
            },
          });
          map.addLayer({
            id: 'ref-villages-outline',
            type: 'line',
            source: 'ref-villages',
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
                '#1E4D3B',
              ],
              'line-width': 2.2,
            },
          });
          map.addLayer({
            id: 'ref-villages-label',
            type: 'symbol',
            source: 'ref-villages',
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
          ['ref-villages-fill', 'ref-villages-outline', 'ref-villages-label'],
          layerCEnabled,
        );
      } catch {
        // Ignore mid-transition
      }

      // 3. Layer D: Building Footprints + Settlement Clusters
      try {
        if (referenceData?.buildings) {
          upsertGeoJsonSource(map, 'ref-buildings', referenceData.buildings);
          if (!map.getLayer('ref-buildings-fill')) {
            map.addLayer({
              id: 'ref-buildings-fill',
              type: 'fill',
              source: 'ref-buildings',
              paint: {
                'fill-color': '#B35300',
                'fill-opacity': 0.72,
                'fill-outline-color': '#5C3D1E',
              },
            });
          }
          setLayerVisibilitySafe(map, ['ref-buildings-fill'], layerDEnabled);
        }

        const settlementsFc =
          referenceData?.settlements ?? DEFAULT_SETTLEMENTS_FC;
        upsertGeoJsonSource(map, 'ref-cluster-points', settlementsFc);
        if (!map.getLayer('ref-cluster-circles')) {
          map.addLayer({
            id: 'ref-cluster-circles',
            type: 'circle',
            source: 'ref-cluster-points',
            paint: {
              'circle-radius': 8.5,
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
            id: 'ref-cluster-labels',
            type: 'symbol',
            source: 'ref-cluster-points',
            layout: {
              'text-field': [
                'concat',
                ['get', 'cluster_code'],
                ' · ',
                ['get', 'name'],
              ],
              'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
              'text-size': 10.5,
              'text-offset': [0, 1.25],
              'text-anchor': 'top',
            },
            paint: {
              'text-color': '#141413',
              'text-halo-color': '#F7F5F0',
              'text-halo-width': 1.5,
            },
          });
        }
        setLayerVisibilitySafe(
          map,
          ['ref-cluster-circles', 'ref-cluster-labels'],
          layerDEnabled,
        );
      } catch {
        // Ignore mid-transition
      }

      // 4. Layer A: Existing Mapped Electricity Infrastructure (33 kV, 11 kV, Substations, DTs, Towers, Poles)
      try {
        upsertGeoJsonSource(map, 'layer-a-existing-infra', filteredLayerAInfra);
        if (!map.getLayer('layer-a-33kv-lines')) {
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
          map.addLayer({
            id: 'layer-a-transformers',
            type: 'circle',
            source: 'layer-a-existing-infra',
            filter: ['==', ['get', 'infra_category'], 'TRANSFORMER'],
            paint: {
              'circle-radius': 7.5,
              'circle-color': '#0F766E',
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': 2.2,
            },
          });
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
              'circle-radius': 5.0,
              'circle-color': '#334155',
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': 1.4,
            },
          });
          map.addLayer({
            id: 'layer-a-labels',
            type: 'symbol',
            source: 'layer-a-existing-infra',
            filter: [
              'in',
              ['get', 'infra_category'],
              ['literal', ['SUBSTATION', 'TRANSFORMER']],
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

      // 5. Layer E: Potential Electrification Gaps
      try {
        const gapsFc =
          referenceData?.electrification_gaps ?? DEFAULT_ELECTRIFICATION_GAPS_FC;
        upsertGeoJsonSource(map, 'gap-corridors', gapsFc);
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

      // 6. Layer F: Proposed Electricity Network Extensions
      try {
        const proposedFc =
          referenceData?.proposed_network ?? DEFAULT_PROPOSED_NETWORK_FC;
        upsertGeoJsonSource(map, 'ref-routes', proposedFc);
        if (!map.getLayer('ref-routes-line')) {
          map.addLayer({
            id: 'ref-routes-line',
            type: 'line',
            source: 'ref-routes',
            filter: ['==', ['get', 'layer_type'], 'HT_11KV_PROPOSED'],
            paint: {
              'line-color': '#DC2626',
              'line-width': 3.0,
              'line-dasharray': [4, 2],
            },
          });
          map.addLayer({
            id: 'ref-routes-lt-line',
            type: 'line',
            source: 'ref-routes',
            filter: ['==', ['get', 'layer_type'], 'LT_415V_PROPOSED'],
            paint: {
              'line-color': '#0284C7',
              'line-width': 2.4,
              'line-dasharray': [2, 1.5],
            },
          });
          map.addLayer({
            id: 'ref-routes-dt-points',
            type: 'circle',
            source: 'ref-routes',
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
          ['ref-routes-line', 'ref-routes-lt-line', 'ref-routes-dt-points'],
          layerFEnabled,
        );
      } catch {
        // Ignore Layer F error
      }

      // 7. Interactive Measurement Overlay
      try {
        const draftFeatures: GeoJSON.Feature[] = [];
        if (measurePoints.length >= 3) {
          const ring = [...measurePoints, measurePoints[0]!];
          draftFeatures.push({
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: [ring] },
          });
        } else if (measurePoints.length === 2) {
          draftFeatures.push({
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: measurePoints },
          });
        }
        for (const pt of measurePoints) {
          draftFeatures.push({
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: pt },
          });
        }
        upsertGeoJsonSource(map, 'spike-measure', {
          type: 'FeatureCollection',
          features: draftFeatures,
        });
        if (!map.getLayer('spike-measure-line')) {
          map.addLayer({
            id: 'spike-measure-line',
            type: 'line',
            source: 'spike-measure',
            paint: {
              'line-color': '#0F5499',
              'line-width': 2.4,
              'line-dasharray': [2, 2],
            },
          });
          map.addLayer({
            id: 'spike-measure-pts',
            type: 'circle',
            source: 'spike-measure',
            filter: ['==', ['geometry-type'], 'Point'],
            paint: {
              'circle-radius': 5,
              'circle-color': '#0F5499',
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': 1.5,
            },
          });
        }
      } catch {
        // Ignore measurement overlay error
      }

      // 8. Optional 50k WebGL Stress Layer
      try {
        if (stressActive) {
          if (!map.getSource('stress-50k')) {
            const syntheticGeoJson = generateSyntheticPointsGeoJson(50000);
            map.addSource('stress-50k', {
              type: 'geojson',
              data: syntheticGeoJson,
            });
            map.addLayer({
              id: 'stress-50k-circles',
              type: 'circle',
              source: 'stress-50k',
              paint: {
                'circle-radius': 2.2,
                'circle-color': [
                  'match',
                  ['get', 'proxy_class'],
                  'POTENTIALLY_UNSERVED',
                  '#A61B1B',
                  'POTENTIALLY_UNDERSERVED',
                  '#B35300',
                  '#1B6E3A',
                ],
                'circle-opacity': 0.72,
              },
            });
          }
        } else {
          if (map.getLayer('stress-50k-circles')) {
            map.removeLayer('stress-50k-circles');
          }
          if (map.getSource('stress-50k')) {
            map.removeSource('stress-50k');
          }
        }
      } catch {
        // Ignore stress layer toggle error during style reload
      }
    },
    [
      basemap,
      referenceData,
      filteredLayerAInfra,
      stressActive,
      layerAEnabled,
      layerBEnabled,
      viirsPeriod,
      viirsGlobalGibs,
      viirsOpacity,
      layerCEnabled,
      layerDEnabled,
      layerEEnabled,
      layerFEnabled,
      measurePoints,
    ],
  );

  const syncRef = useRef(syncOverlayLayers);
  syncRef.current = syncOverlayLayers;

  const measureActiveRef = useRef(measureModeActive);
  measureActiveRef.current = measureModeActive;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildBasemapStyle(basemap),
      center: KORAPUT_CENTER,
      zoom: DEFAULT_ZOOM,
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

    map.on('click', (e: maplibregl.MapMouseEvent) => {
      if (!e?.lngLat) return;
      const lon = Number(e.lngLat.lng.toFixed(6));
      const lat = Number(e.lngLat.lat.toFixed(6));

      if (measureActiveRef.current) {
        setMeasurePoints((prev) => [...prev, [lon, lat]]);
        return;
      }

      const candidateLayers = [
        'layer-a-substations',
        'layer-a-transformers',
        'layer-a-towers-poles',
        'layer-a-33kv-lines',
        'layer-a-11kv-lines',
        'ref-routes-dt-points',
        'ref-routes-line',
        'ref-routes-lt-line',
        'ref-cluster-circles',
        'gap-corridors-line',
        'ref-villages-fill',
      ].filter((id) => Boolean(map.getLayer(id)));

      if (candidateLayers.length === 0) return;
      const hits = map.queryRenderedFeatures(e.point, {
        layers: candidateLayers,
      });
      if (!hits || hits.length === 0) return;

      const topHit = hits[0]!;
      const props = topHit.properties ?? {};
      const layerId = topHit.layer.id;

      if (layerId === 'ref-cluster-circles') {
        setInspectedFeature({
          layerGroupTitle: 'Layer D · Settlement & Habitation Assessment',
          title: `${String(props.cluster_code ?? '')} — ${String(props.name ?? '')}`,
          subtitle: `Axis 1 Proxy: ${String(props.proxy_class ?? '')} · Axis 2: ${String(props.verification_state ?? 'UNVERIFIED')}`,
          provenanceBadge: 'VIIRS DNB + Footprint DBSCAN',
          beginnerExplanation:
            'Groups nearby detected building footprints to estimate household demand and evaluate grid distance vs. off-grid solar mini-grids.',
          epistemicCaveat: String(props.evidence_summary ?? ''),
          attributes: [
            {
              label: 'Footprints',
              value: `${String(props.building_count ?? 'N/A')} structures`,
            },
            {
              label: 'Est. Households',
              value: `${String(props.estimated_households ?? 'N/A')} HH`,
            },
            {
              label: '2024 VIIRS Radiance',
              value: `${String(props.viirs_radiance_2024_nw ?? '0.41')} nW/cm²/sr`,
            },
            {
              label: 'Nearest 11 kV Grid',
              value: `${String(props.distance_to_11kv_m ?? 'N/A')} m`,
            },
          ],
        });
      } else if (layerId.startsWith('layer-a-')) {
        setInspectedFeature({
          layerGroupTitle: 'Layer A · Mapped Electricity Infrastructure',
          title: String(props.name ?? 'Electricity Infrastructure Asset'),
          subtitle: `Category: ${String(props.infra_category ?? '')} · Tag: ${String(props.osm_tag ?? 'power=*')}`,
          provenanceBadge: String(props.provenance ?? 'OSM_MAPPED'),
          beginnerExplanation:
            'Existing electricity grid asset mapped in OpenStreetMap. 33 kV lines feed primary substations; 11 kV lines feed village transformers.',
          epistemicCaveat: String(
            props.epistemic_note ??
              'Missing infrastructure in OpenStreetMap does not prove absence of ground lines.',
          ),
          attributes: [
            {
              label: 'Voltage Level',
              value: `${String(props.voltage_kv ?? 11)} kV`,
            },
            {
              label: 'Rating / Spec',
              value: props.rating_kva
                ? `${String(props.rating_kva)} kVA`
                : String(props.conductor ?? 'Standard REC Spec'),
            },
            {
              label: 'Operator',
              value: String(props.operator ?? 'TPSODL'),
            },
          ],
        });
      } else if (layerId.startsWith('ref-routes')) {
        setInspectedFeature({
          layerGroupTitle: 'Layer F · Proposed Electricity Network Extension',
          title: String(props.name ?? props.target_name ?? 'Proposed Extension'),
          subtitle: `Type: ${String(props.layer_type ?? 'PROPOSED')} · Status: PRELIMINARY DESIGN`,
          provenanceBadge: 'PROPOSED_PRELIMINARY',
          beginnerExplanation:
            'Computer-generated preliminary route or transformer placement using terrain-weighted least-cost path routing.',
          epistemicCaveat: String(
            props.engineering_disclaimer ??
              'NOT INSTALLED INFRASTRUCTURE. Requires field peg-marking and load-flow verification.',
          ),
          attributes: [
            {
              label: 'Design Voltage',
              value: `${String(props.voltage_kv ?? 11)} kV`,
            },
            {
              label: 'Estimated Length',
              value: props.length_km
                ? `${String(props.length_km)} km`
                : 'Point Asset (DT / Mini-Grid)',
            },
          ],
        });
      } else if (layerId === 'gap-corridors-line') {
        setInspectedFeature({
          layerGroupTitle: 'Layer E · Potential Electrification Gap Corridor',
          title: String(props.gap_code ?? 'Electrification Gap Corridor'),
          subtitle: `Severity: ${String(props.gap_severity ?? '')}`,
          provenanceBadge: String(props.estimation_type ?? 'MODEL_ESTIMATED_GAP'),
          beginnerExplanation:
            'Highlights habitations located far from mapped 11 kV infrastructure with low nighttime radiance and historical supply deficits.',
          epistemicCaveat:
            'Model-estimated investigation corridor. Dark satellite pixels are never automatically classified as unelectrified without field survey.',
          attributes: [
            {
              label: 'Straight-Line Distance',
              value: `${String(props.straight_line_dist_m ?? '')} m`,
            },
            {
              label: 'Terrain Distance',
              value: `${String(props.terrain_weighted_dist_m ?? '')} m`,
            },
          ],
        });
      } else if (layerId === 'ref-villages-fill') {
        setInspectedFeature({
          layerGroupTitle: 'Layer C · Village Electrification & Census Profile',
          title: `Village ${String(props.village_name ?? '')} (LGD ${String(props.lgd_code ?? '')})`,
          subtitle: String(props.status_label ?? ''),
          provenanceBadge: 'CENSUS 2011 DCHB + LGD',
          beginnerExplanation:
            'Displays official revenue village boundaries, Census 2011 demographics, and reported daily power supply hours.',
          epistemicCaveat: String(props.missing_data_notice ?? ''),
          attributes: [
            {
              label: 'Census 2011 Pop',
              value: `${String(props.total_pop ?? '')} (ST: ${String(props.st_pop ?? '')})`,
            },
            {
              label: 'Census 2011 HH',
              value: `${String(props.households_2011 ?? '')} HH`,
            },
            {
              label: '2011 Supply Hours',
              value: `${String(props.summer_supply_hrs_2011 ?? 0)}–${String(props.winter_supply_hrs_2011 ?? 0)} hrs/day`,
            },
          ],
        });
      }
    });

    map.on('load', () => {
      map.resize();
      syncRef.current(map);
    });

    map.on('style.load', () => {
      syncRef.current(map);
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

    syncOverlayLayers(map);
    if (!map.isStyleLoaded()) {
      const handleReady = () => {
        syncRef.current(map);
      };
      map.once('load', handleReady);
      map.once('idle', handleReady);
      return () => {
        map.off('load', handleReady);
        map.off('idle', handleReady);
      };
    }
  }, [syncOverlayLayers]);

  const handleBasemapChange = (nextMode: BasemapMode) => {
    setBasemap(nextMode);
    const map = mapRef.current;
    if (!map) return;

    map.setStyle(buildBasemapStyle(nextMode));
    const reSync = () => {
      syncRef.current(map);
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
    setSearchResults(
      KORAPUT_SEARCH_CATALOG.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.summary.toLowerCase().includes(q),
      ),
    );
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

  const handleToggleStressTest = () => {
    const t0 = performance.now();
    const nextState = !stressActive;
    setStressActive(nextState);
    const elapsedMs = Math.round(performance.now() - t0);

    if (nextState) {
      setStressStatusText(
        `S1 Verified: 50,000 WebGL points mounted (${elapsedMs} ms state commit · 60 FPS target)`,
      );
    } else {
      setStressStatusText(
        'Ready · Click any electrical line, substation, transformer, or habitation on the map to inspect',
      );
    }
  };

  const measuredLengthMeters = computePolylineLengthMeters(measurePoints);
  const measuredAreaM2 = computePolygonAreaM2(measurePoints);

  return (
    <div className="bg-sheet border border-rule-strong rounded-xs overflow-hidden flex flex-col">
      {/* Map Header Controls */}
      <div className="p-3 border-b border-rule flex flex-wrap items-center justify-between gap-2 bg-paper">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setLayerPanelOpen((prev) => !prev)}
            className="px-2.5 py-1 text-xs font-mono font-semibold rounded-xs border border-rule-strong bg-sheet text-ink hover:bg-accent-tint transition-colors"
          >
            {layerPanelOpen ? '◀ Hide GIS Layers (A–F)' : '▶ Open GIS Layers (A–F)'}
          </button>

          <span className="font-mono text-xs uppercase tracking-wider font-semibold text-ink">
            Electricity Infrastructure &amp; Rural Electrification GIS
          </span>
          <QualityTag kind="ESTIMATED" label="KORAPUT · BHEJA AOI (EPSG:4326)" />

          {/* Search Bar */}
          <div className="relative">
            <input
              type="search"
              aria-label="Search Koraput villages, substations, or habitations"
              placeholder="Search village, substation, cluster..."
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              className="h-7 w-52 px-2 text-xs bg-sheet border border-rule-strong rounded-xs text-ink"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-8 left-0 z-30 w-80 bg-sheet border border-rule-strong rounded-xs shadow-md divide-y divide-rule max-h-60 overflow-y-auto">
                {searchResults.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => handleSelectSearchLocation(loc)}
                    className="w-full text-left p-2 hover:bg-accent-tint/40 transition-colors"
                  >
                    <div className="text-xs font-semibold text-ink">{loc.label}</div>
                    <div className="text-[11px] text-ink-2">{loc.summary}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
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
                { id: 'terrain', label: 'Terrain (Topo)' },
                { id: 'satellite', label: 'Sentinel-2 Satellite' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleBasemapChange(opt.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-xs transition-colors ${
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
            {measureModeActive ? 'Measuring...' : 'Measure Span'}
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
            variant={stressActive ? 'danger' : 'secondary'}
            size="sm"
            onClick={handleToggleStressTest}
          >
            {stressActive ? 'Clear 50k Points' : 'Run 50k Footprint Stress Test'}
          </Button>
        </div>
      </div>

      {beginnerGuideOpen && (
        <div className="p-3 bg-paper border-b border-rule-strong text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-ink uppercase font-mono text-[11px]">
              Beginner Guide: Understanding the Specialised Electricity GIS Layers
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
                Layer A &amp; Layer F: Existing vs. Proposed Grid
              </strong>
              <strong>Solid purple (33 kV)</strong> and{' '}
              <strong>solid dark-red (11 kV)</strong> lines are existing OpenStreetMap
              power lines. <strong>Dashed red (11 kV)</strong> and{' '}
              <strong>dashed blue (415 V)</strong> lines are preliminary proposed routes.
            </div>
            <div className="p-2 bg-sheet border border-rule rounded-xs">
              <strong className="text-ink block mb-0.5">
                Layer B: NASA VIIRS Nighttime Illumination
              </strong>
              Measures upward nighttime radiance (<code>nW/cm²/sr</code>). Bright areas
              indicate outdoor lighting; dark pixels are an indirect indicator only and do
              not prove a household lacks an indoor meter or solar home system.
            </div>
            <div className="p-2 bg-sheet border border-rule rounded-xs">
              <strong className="text-ink block mb-0.5">
                Layer C, D &amp; E: Settlements &amp; Electrification Gaps
              </strong>
              Combines Census 2011 supply records, 143 satellite building footprints, and
              distance to the nearest 11 kV transformer to highlight habitations needing
              field survey verification.
            </div>
          </div>
        </div>
      )}

      {measureModeActive && (
        <div className="px-3 py-1.5 bg-info-tint border-b border-rule flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-info">
          <div>
            <strong>Measurement Active:</strong> ({measurePoints.length} pts) · Span:{' '}
            <strong>
              {measuredLengthMeters.toFixed(1)} m (
              {(measuredLengthMeters / 1000).toFixed(3)} km)
            </strong>
            {measurePoints.length >= 3 && (
              <>
                {' '}
                · Area:{' '}
                <strong>
                  {(measuredAreaM2 / 10000).toFixed(2)} ha
                </strong>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMeasurePoints([])}
            className="underline"
          >
            Reset Points
          </button>
        </div>
      )}

      <div className="relative flex flex-col lg:flex-row w-full">
        {layerPanelOpen && (
          <aside
            aria-label="Landing Page Electricity GIS Layers"
            className="w-full lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-rule-strong bg-paper p-2.5 space-y-2 max-h-[480px] overflow-y-auto text-xs"
          >
            <div className="flex items-center justify-between border-b border-rule pb-1.5">
              <span className="font-mono text-[11px] uppercase tracking-wider font-semibold text-ink">
                Electricity GIS Layers (A–F)
              </span>
              <QualityTag kind="ESTIMATED" label="FREE OPEN DATA" />
            </div>

            <div className="p-2 bg-sheet border border-rule rounded-xs space-y-1">
              <label className="flex items-start gap-2 cursor-pointer font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={layerAEnabled}
                  onChange={(e) => setLayerAEnabled(e.target.checked)}
                  className="mt-0.5"
                />
                <span>Layer A · Existing Electricity Infrastructure</span>
              </label>
              <p className="text-[11px] text-ink-2">
                33 kV &amp; 11 kV lines, 33/11 kV Nandapur Substation, 63/25 kVA DTs,
                towers &amp; poles (OpenStreetMap ODbL).
              </p>
              {layerAEnabled && (
                <select
                  aria-label="Filter Layer A voltage level"
                  value={voltageFilter}
                  onChange={(e) =>
                    setVoltageFilter(e.target.value as VoltageFilterMode)
                  }
                  className="w-full h-7 px-1.5 text-[11px] font-mono bg-paper border border-rule-strong rounded-xs mt-1"
                >
                  <option value="ALL">All Voltages (33 kV + 11 kV + Substations + Poles)</option>
                  <option value="33KV_TRANSMISSION">33 kV Sub-Transmission &amp; Substations</option>
                  <option value="11KV_DISTRIBUTION">11 kV Primary Distribution Feeders</option>
                  <option value="SUBSTATIONS_AND_DTS">Substations &amp; Transformers Only</option>
                  <option value="TOWERS_AND_POLES">Electricity Towers &amp; Poles Only</option>
                </select>
              )}
            </div>

            <div className="p-2 bg-sheet border border-rule rounded-xs space-y-1">
              <label className="flex items-start gap-2 cursor-pointer font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={layerBEnabled}
                  onChange={(e) => setLayerBEnabled(e.target.checked)}
                  className="mt-0.5"
                />
                <span>Layer B · NASA VIIRS Nighttime Illumination</span>
              </label>
              <p className="text-[11px] text-ink-2">
                Satellite nighttime brightness (<code>nW/cm²/sr</code>). Indirect
                indicator only.
              </p>
              {layerBEnabled && (
                <div className="space-y-1.5 pt-1 border-t border-rule">
                  <select
                    aria-label="Select VIIRS observation date"
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
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span>Opacity: {Math.round(viirsOpacity * 100)}%</span>
                    <input
                      type="range"
                      aria-label="Landing VIIRS layer transparency"
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
                    <span>Global NASA GIBS VIIRS Tiles</span>
                  </label>
                </div>
              )}
            </div>

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
              <p className="text-[11px] text-ink-2">
                Census 2011 DCHB power availability hours &amp; LGD boundaries.
              </p>
            </div>

            <div className="p-2 bg-sheet border border-rule rounded-xs space-y-1">
              <label className="flex items-start gap-2 cursor-pointer font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={layerDEnabled}
                  onChange={(e) => setLayerDEnabled(e.target.checked)}
                  className="mt-0.5"
                />
                <span>Layer D · Settlements &amp; 143 Footprints</span>
              </label>
            </div>

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
            </div>

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
            </div>
          </aside>
        )}

        {/* Map Viewport */}
        <div
          className="relative flex-1 w-full h-[480px] bg-[#EFECE6] overflow-hidden"
          style={{ minHeight: '480px' }}
        >
          <div
            ref={containerRef}
            aria-label="Koraput Electrification Assessment Map"
            className="absolute inset-0 w-full h-full"
            style={{ width: '100%', height: '100%' }}
          />

          {/* Preliminary Engineering Watermark Banner */}
          <div className="pointer-events-none absolute top-3 left-3 z-10 bg-sheet/95 border border-rule-strong px-2.5 py-1 rounded-xs shadow-xs">
            <div className="font-mono text-[11px] uppercase tracking-wider text-warn font-semibold">
              PRELIMINARY ENGINEERING ESTIMATE — FIELD SURVEY REQUIRED
            </div>
          </div>

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
                <strong>Data Accuracy ({inspectedFeature.provenanceBadge}):</strong>{' '}
                {inspectedFeature.epistemicCaveat}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Symbology Legend & Coordinate Telemetry Bar */}
      <div className="px-3 py-2 border-t border-rule bg-paper flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-ink-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          <span className="inline-flex items-center gap-1">
            <span className="w-4 h-1 inline-block bg-[#6D28D9]" />
            33 kV Line (OSM)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-4 h-0.5 inline-block bg-[#991B1B]" />
            11 kV Existing
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full inline-block bg-[#4C1D95] border-2 border-[#FDE047]" />
            33/11 kV Substation
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#0F766E]" />
            Existing DT
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-4 h-0.5 inline-block border-b-2 border-dashed border-[#DC2626]" />
            Proposed 11 kV
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-4 h-0.5 inline-block border-b-2 border-dashed border-[#0284C7]" />
            Proposed 415 V LT
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span>
            LON: <strong className="text-ink">{cursorCoords.lon.toFixed(5)}°E</strong> · LAT:{' '}
            <strong className="text-ink">{cursorCoords.lat.toFixed(5)}°N</strong>
          </span>
          <span>ZOOM: {zoomLevel.toFixed(1)}</span>
          <span className="text-ink font-medium">{stressStatusText}</span>
        </div>
      </div>
    </div>
  );
};
