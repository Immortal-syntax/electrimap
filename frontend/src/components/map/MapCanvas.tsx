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

import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { Button } from '../ui/Button';
import { QualityTag } from '../ui/QualityTag';

export type BasemapMode = 'survey_paper' | 'streets' | 'satellite_2016';

export interface MapCanvasProps {
  aoiGeometry?: GeoJSON.Geometry | null;
  boundarySource?: string;
  referenceBuildings?: GeoJSON.FeatureCollection | null;
  referenceRoutes?: GeoJSON.FeatureCollection | null;
  osmFeatures?: GeoJSON.FeatureCollection | null;
  customFeatures?: GeoJSON.FeatureCollection | null;
  settlementClusters?: GeoJSON.FeatureCollection | null;
  selectedClusterId?: string | null;
  onSelectCluster?: (clusterId: string) => void;
  infrastructureAssets?: GeoJSON.FeatureCollection | null;
  gapCorridors?: GeoJSON.FeatureCollection | null;
  networkLayout?: GeoJSON.FeatureCollection | null;
  placeTieInModeActive?: boolean;
  onPlaceTieInPoint?: (lon: number, lat: number) => void;
  rasterOverlayUrl?: string | null;
  rasterOpacity?: number;
  drawModeActive?: boolean;
  onDrawnPolygonChange?: (polygon: GeoJSON.Polygon | null, vertexCount: number) => void;
  heightClass?: string;
}

function buildBasemapStyle(mode: BasemapMode): maplibregl.StyleSpecification | string {
  if (mode === 'streets') {
    return 'https://tiles.openfreemap.org/styles/liberty';
  }
  if (mode === 'satellite_2016') {
    return {
      version: 8,
      sources: {
        'eox-s2-2016': {
          type: 'raster',
          tiles: [
            'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2016_3857/default/g/{z}/{y}/{x}.jpg',
          ],
          tileSize: 256,
          attribution:
            'Sentinel-2 cloudless 2016 by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016, CC BY 4.0)',
        },
      },
      layers: [
        {
          id: 'background-paper',
          type: 'background',
          paint: { 'background-color': '#F7F5F0' },
        },
        {
          id: 'eox-s2-layer',
          type: 'raster',
          source: 'eox-s2-2016',
          paint: { 'raster-opacity': 0.92 },
        },
      ],
    };
  }
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: 'background-paper',
        type: 'background',
        paint: { 'background-color': '#F7F5F0' },
      },
    ],
  };
}

function computeGeometryBbox(
  geom: GeoJSON.Geometry,
): [number, number, number, number] | null {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  const visitCoords = (coords: unknown): void => {
    if (!Array.isArray(coords)) return;
    if (
      coords.length >= 2 &&
      typeof coords[0] === 'number' &&
      typeof coords[1] === 'number'
    ) {
      const lon = coords[0];
      const lat = coords[1];
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      return;
    }
    for (const child of coords) {
      visitCoords(child);
    }
  };

  if ('coordinates' in geom) {
    visitCoords(geom.coordinates);
  }
  if (!Number.isFinite(minLon) || !Number.isFinite(minLat)) {
    return null;
  }
  return [minLon, minLat, maxLon, maxLat];
}

export const MapCanvas: React.FC<MapCanvasProps> = ({
  aoiGeometry = null,
  boundarySource = 'HARMONISED',
  referenceBuildings = null,
  referenceRoutes = null,
  osmFeatures = null,
  customFeatures = null,
  settlementClusters = null,
  selectedClusterId = null,
  onSelectCluster,
  infrastructureAssets = null,
  gapCorridors = null,
  networkLayout = null,
  placeTieInModeActive = false,
  onPlaceTieInPoint,
  rasterOverlayUrl = null,
  rasterOpacity = 0.65,
  drawModeActive = false,
  onDrawnPolygonChange,
  heightClass = 'h-[480px]',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onSelectClusterRef = useRef<((clusterId: string) => void) | undefined>(onSelectCluster);
  onSelectClusterRef.current = onSelectCluster;
  const placeTieInModeRef = useRef<boolean>(placeTieInModeActive);
  placeTieInModeRef.current = placeTieInModeActive;
  const onPlaceTieInPointRef = useRef<((lon: number, lat: number) => void) | undefined>(
    onPlaceTieInPoint,
  );
  onPlaceTieInPointRef.current = onPlaceTieInPoint;

  const [basemap, setBasemap] = useState<BasemapMode>('survey_paper');
  const [cursorCoords, setCursorCoords] = useState<{ lon: number; lat: number }>({
    lon: 82.732,
    lat: 18.567,
  });
  const [drawnVertices, setDrawnVertices] = useState<Array<[number, number]>>([]);
  const drawModeRef = useRef<boolean>(drawModeActive);
  drawModeRef.current = drawModeActive;

  useEffect(() => {
    if (!onDrawnPolygonChange) return;
    if (drawnVertices.length < 3) {
      onDrawnPolygonChange(null, drawnVertices.length);
      return;
    }
    const ring: Array<[number, number]> = [...drawnVertices, drawnVertices[0]!];
    onDrawnPolygonChange(
      {
        type: 'Polygon',
        coordinates: [ring],
      },
      drawnVertices.length,
    );
  }, [drawnVertices, onDrawnPolygonChange]);

  const syncLayers = (map: maplibregl.Map) => {
    if (!map.isStyleLoaded()) return;

    // 1. Optional Raster Overlay (DEM Slope / WorldCover / VIIRS)
    if (map.getLayer('aoi-raster-overlay-layer')) {
      map.removeLayer('aoi-raster-overlay-layer');
    }
    if (map.getSource('aoi-raster-overlay')) {
      map.removeSource('aoi-raster-overlay');
    }
    if (rasterOverlayUrl && aoiGeometry) {
      const bbox = computeGeometryBbox(aoiGeometry);
      if (bbox) {
        const [minLon, minLat, maxLon, maxLat] = bbox;
        map.addSource('aoi-raster-overlay', {
          type: 'image',
          url: rasterOverlayUrl,
          coordinates: [
            [minLon, maxLat],
            [maxLon, maxLat],
            [maxLon, minLat],
            [minLon, minLat],
          ],
        });
        map.addLayer({
          id: 'aoi-raster-overlay-layer',
          type: 'raster',
          source: 'aoi-raster-overlay',
          paint: {
            'raster-opacity': rasterOpacity,
          },
        });
      }
    }

    // 2. AOI Boundary Polygon
    const aoiFc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: aoiGeometry
        ? [
            {
              type: 'Feature',
              properties: { boundary_source: boundarySource },
              geometry: aoiGeometry,
            },
          ]
        : [],
    };

    const existingAoi = map.getSource('aoi-source') as maplibregl.GeoJSONSource | undefined;
    if (existingAoi) {
      existingAoi.setData(aoiFc);
    } else {
      map.addSource('aoi-source', { type: 'geojson', data: aoiFc });
      map.addLayer({
        id: 'aoi-fill',
        type: 'fill',
        source: 'aoi-source',
        paint: {
          'fill-color': '#0B5D57',
          'fill-opacity': 0.08,
        },
      });
      map.addLayer({
        id: 'aoi-halo',
        type: 'line',
        source: 'aoi-source',
        paint: {
          'line-color': '#FFFFFF',
          'line-width': 4,
        },
      });
      map.addLayer({
        id: 'aoi-outline',
        type: 'line',
        source: 'aoi-source',
        paint: {
          'line-color': '#1F2328',
          'line-width': 2,
          'line-dasharray':
            boundarySource === 'APPROXIMATE_BUFFER' ? [4, 3] : [1, 0],
        },
      });
    }

    // 3. Drawn vertices & polygon preview
    const drawnFeatures: GeoJSON.Feature[] = [];
    if (drawnVertices.length >= 3) {
      drawnFeatures.push({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[...drawnVertices, drawnVertices[0]!]],
        },
      });
    } else if (drawnVertices.length === 2) {
      drawnFeatures.push({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: drawnVertices,
        },
      });
    }
    for (const pt of drawnVertices) {
      drawnFeatures.push({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: pt,
        },
      });
    }
    const drawnFc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: drawnFeatures,
    };

    const existingDraw = map.getSource('draw-source') as maplibregl.GeoJSONSource | undefined;
    if (existingDraw) {
      existingDraw.setData(drawnFc);
    } else {
      map.addSource('draw-source', { type: 'geojson', data: drawnFc });
      map.addLayer({
        id: 'draw-fill',
        type: 'fill',
        source: 'draw-source',
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-color': '#0B5D57',
          'fill-opacity': 0.15,
        },
      });
      map.addLayer({
        id: 'draw-line',
        type: 'line',
        source: 'draw-source',
        filter: ['in', '$type', 'Polygon', 'LineString'],
        paint: {
          'line-color': '#0B5D57',
          'line-width': 2,
          'line-dasharray': [2, 2],
        },
      });
      map.addLayer({
        id: 'draw-points',
        type: 'circle',
        source: 'draw-source',
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 4.5,
          'circle-color': '#FFFFFF',
          'circle-stroke-color': '#0B5D57',
          'circle-stroke-width': 2,
        },
      });
    }

    // 4. OSM Roads, Waterways & Amenities
    const osmFc: GeoJSON.FeatureCollection = osmFeatures ?? {
      type: 'FeatureCollection',
      features: [],
    };
    const existingOsm = map.getSource('osm-features-source') as
      | maplibregl.GeoJSONSource
      | undefined;
    if (existingOsm) {
      existingOsm.setData(osmFc);
    } else {
      map.addSource('osm-features-source', { type: 'geojson', data: osmFc });
      map.addLayer({
        id: 'osm-waterway-line',
        type: 'line',
        source: 'osm-features-source',
        filter: ['==', ['get', 'category'], 'WATER'],
        paint: {
          'line-color': '#0064C8',
          'line-width': 2.5,
        },
      });
      map.addLayer({
        id: 'osm-road-line',
        type: 'line',
        source: 'osm-features-source',
        filter: ['==', ['get', 'category'], 'ROAD'],
        paint: {
          'line-color': '#8C6D46',
          'line-width': 2,
          'line-dasharray': [2, 1],
        },
      });
      map.addLayer({
        id: 'osm-amenity-points',
        type: 'circle',
        source: 'osm-features-source',
        filter: ['==', ['get', 'category'], 'AMENITY'],
        paint: {
          'circle-radius': 5.5,
          'circle-color': '#D97706',
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 1.5,
        },
      });
    }

    // 5. Building Footprints (colored by size_class)
    const bldFc: GeoJSON.FeatureCollection = referenceBuildings ?? {
      type: 'FeatureCollection',
      features: [],
    };
    const existingBld = map.getSource('ref-buildings') as
      | maplibregl.GeoJSONSource
      | undefined;
    if (existingBld) {
      existingBld.setData(bldFc);
    } else {
      map.addSource('ref-buildings', { type: 'geojson', data: bldFc });
      map.addLayer({
        id: 'ref-buildings-fill',
        type: 'fill',
        source: 'ref-buildings',
        paint: {
          'fill-color': [
            'match',
            ['get', 'size_class'],
            'RESIDENTIAL',
            '#0B5D57',
            'NON_RESIDENTIAL',
            '#B45309',
            'OUTBUILDING',
            '#5B5F66',
            '#5B5F66',
          ],
          'fill-opacity': 0.78,
        },
      });
    }

    // 6. Preliminary Feeder Routes
    const rtsFc: GeoJSON.FeatureCollection = referenceRoutes ?? {
      type: 'FeatureCollection',
      features: [],
    };
    const existingRts = map.getSource('ref-routes') as
      | maplibregl.GeoJSONSource
      | undefined;
    if (existingRts) {
      existingRts.setData(rtsFc);
    } else {
      map.addSource('ref-routes', { type: 'geojson', data: rtsFc });
      map.addLayer({
        id: 'ref-routes-line',
        type: 'line',
        source: 'ref-routes',
        paint: {
          'line-color': '#CC79A7',
          'line-width': 2.5,
          'line-dasharray': [3, 2],
        },
      });
    }

    // 7. Custom Uploaded Features (USER_ENTERED)
    const custFc: GeoJSON.FeatureCollection = customFeatures ?? {
      type: 'FeatureCollection',
      features: [],
    };
    const existingCust = map.getSource('custom-features-source') as
      | maplibregl.GeoJSONSource
      | undefined;
    if (existingCust) {
      existingCust.setData(custFc);
    } else {
      map.addSource('custom-features-source', { type: 'geojson', data: custFc });
      map.addLayer({
        id: 'custom-features-points',
        type: 'circle',
        source: 'custom-features-source',
        paint: {
          'circle-radius': 5,
          'circle-color': '#7C3AED',
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 1.5,
        },
      });
    }

    // 8. Habitation Settlement Clusters (Okabe-Ito 4-Tier Proxy Palette + Verification State)
    const clustFc: GeoJSON.FeatureCollection = settlementClusters ?? {
      type: 'FeatureCollection',
      features: [],
    };
    const existingClust = map.getSource('settlement-clusters-source') as
      | maplibregl.GeoJSONSource
      | undefined;
    if (existingClust) {
      existingClust.setData(clustFc);
    } else {
      map.addSource('settlement-clusters-source', { type: 'geojson', data: clustFc });
      map.addLayer({
        id: 'settlement-clusters-fill',
        type: 'fill',
        source: 'settlement-clusters-source',
        paint: {
          'fill-color': [
            'match',
            ['get', 'proxy_class'],
            'LIKELY_ELECTRIFIED',
            '#0072B2',
            'POTENTIALLY_UNDERSERVED',
            '#E69F00',
            'POTENTIALLY_UNSERVED',
            '#D55E00',
            '#6C757D',
          ],
          'fill-opacity': [
            'case',
            ['==', ['get', 'id'], selectedClusterId ?? ''],
            0.38,
            0.22,
          ],
        },
      });
      map.addLayer({
        id: 'settlement-clusters-unverified-line',
        type: 'line',
        source: 'settlement-clusters-source',
        filter: ['==', ['get', 'verification_state'], 'UNVERIFIED'],
        paint: {
          'line-color': [
            'match',
            ['get', 'proxy_class'],
            'LIKELY_ELECTRIFIED',
            '#0072B2',
            'POTENTIALLY_UNDERSERVED',
            '#E69F00',
            'POTENTIALLY_UNSERVED',
            '#D55E00',
            '#6C757D',
          ],
          'line-width': 2,
          'line-dasharray': [2, 2],
        },
      });
      map.addLayer({
        id: 'settlement-clusters-verified-line',
        type: 'line',
        source: 'settlement-clusters-source',
        filter: ['!=', ['get', 'verification_state'], 'UNVERIFIED'],
        paint: {
          'line-color': '#1F8A4C',
          'line-width': 3,
        },
      });
    }

    // 9. Gap Analysis Corridors (Straight-Line Vectors to Nearest Tie-In)
    const corrFc: GeoJSON.FeatureCollection = gapCorridors ?? {
      type: 'FeatureCollection',
      features: [],
    };
    const existingCorr = map.getSource('gap-corridors-source') as
      | maplibregl.GeoJSONSource
      | undefined;
    if (existingCorr) {
      existingCorr.setData(corrFc);
    } else {
      map.addSource('gap-corridors-source', { type: 'geojson', data: corrFc });
      map.addLayer({
        id: 'gap-corridors-line',
        type: 'line',
        source: 'gap-corridors-source',
        paint: {
          'line-color': '#64748B',
          'line-width': 1.5,
          'line-dasharray': [3, 3],
        },
      });
    }

    // 10. Existing Electrical Infrastructure & Tie-In Points
    const infraFc: GeoJSON.FeatureCollection = infrastructureAssets ?? {
      type: 'FeatureCollection',
      features: [],
    };
    const existingInfra = map.getSource('infra-assets-source') as
      | maplibregl.GeoJSONSource
      | undefined;
    if (existingInfra) {
      existingInfra.setData(infraFc);
    } else {
      map.addSource('infra-assets-source', { type: 'geojson', data: infraFc });
      map.addLayer({
        id: 'infra-assets-lines',
        type: 'line',
        source: 'infra-assets-source',
        filter: ['in', '$type', 'LineString', 'MultiLineString'],
        paint: {
          'line-color': '#B91C1C',
          'line-width': 3,
        },
      });
      map.addLayer({
        id: 'infra-assets-points',
        type: 'circle',
        source: 'infra-assets-source',
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 6.5,
          'circle-color': [
            'match',
            ['get', 'provenance'],
            'USER_ASSUMED',
            '#D97706',
            '#15803D',
          ],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2,
        },
      });
    }

    // 11. Milestone M5 Network Layout (11 kV HT Feeders, 415 V LT MST & DTs / Mini-Grid Hubs)
    const netFc: GeoJSON.FeatureCollection = networkLayout ?? {
      type: 'FeatureCollection',
      features: [],
    };
    const existingNet = map.getSource('network-layout-source') as
      | maplibregl.GeoJSONSource
      | undefined;
    if (existingNet) {
      existingNet.setData(netFc);
    } else {
      map.addSource('network-layout-source', { type: 'geojson', data: netFc });
      map.addLayer({
        id: 'network-layout-ht-lines',
        type: 'line',
        source: 'network-layout-source',
        filter: ['==', ['get', 'feature_kind'], 'HT_11KV_FEEDER'],
        paint: {
          'line-color': '#9B2C2C',
          'line-width': 3,
        },
      });
      map.addLayer({
        id: 'network-layout-lt-lines',
        type: 'line',
        source: 'network-layout-source',
        filter: ['==', ['get', 'feature_kind'], 'LT_415V_MST'],
        paint: {
          'line-color': '#0F766E',
          'line-width': 2,
        },
      });
      map.addLayer({
        id: 'network-layout-dt-points',
        type: 'circle',
        source: 'network-layout-source',
        filter: [
          'in',
          ['get', 'feature_kind'],
          ['literal', ['DISTRIBUTION_TRANSFORMER', 'MINIGRID_HUB']],
        ],
        paint: {
          'circle-radius': 6,
          'circle-color': [
            'match',
            ['get', 'feature_kind'],
            'MINIGRID_HUB',
            '#D97706',
            '#1E3A5F',
          ],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2,
        },
      });
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildBasemapStyle(basemap),
      center: [82.732, 18.567],
      zoom: 12.4,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(
      new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }),
      'bottom-left',
    );

    map.on('mousemove', (e: maplibregl.MapMouseEvent) => {
      setCursorCoords({
        lon: Number(e.lngLat.lng.toFixed(5)),
        lat: Number(e.lngLat.lat.toFixed(5)),
      });
    });

    map.on('click', (e: maplibregl.MapMouseEvent) => {
      if (placeTieInModeRef.current && onPlaceTieInPointRef.current) {
        onPlaceTieInPointRef.current(
          Number(e.lngLat.lng.toFixed(5)),
          Number(e.lngLat.lat.toFixed(5)),
        );
        return;
      }
      if (drawModeRef.current) {
        const pt: [number, number] = [
          Number(e.lngLat.lng.toFixed(5)),
          Number(e.lngLat.lat.toFixed(5)),
        ];
        setDrawnVertices((prev) => [...prev, pt]);
        return;
      }
      if (map.getLayer('settlement-clusters-fill') && onSelectClusterRef.current) {
        const hits = map.queryRenderedFeatures(e.point, {
          layers: ['settlement-clusters-fill'],
        });
        const firstHit = hits[0];
        const clusterId = firstHit?.properties?.['id'];
        if (typeof clusterId === 'string') {
          onSelectClusterRef.current(clusterId);
        }
      }
    });

    map.on('load', () => {
      syncLayers(map);
      if (aoiGeometry) {
        const bbox = computeGeometryBbox(aoiGeometry);
        if (bbox) {
          map.fitBounds(
            [
              [bbox[0], bbox[1]],
              [bbox[2], bbox[3]],
            ],
            { padding: 48, duration: 0 },
          );
        }
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) {
      syncLayers(map);
      if (aoiGeometry) {
        const bbox = computeGeometryBbox(aoiGeometry);
        if (bbox) {
          map.fitBounds(
            [
              [bbox[0], bbox[1]],
              [bbox[2], bbox[3]],
            ],
            { padding: 48, duration: 500 },
          );
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    aoiGeometry,
    boundarySource,
    drawnVertices,
    referenceBuildings,
    referenceRoutes,
    osmFeatures,
    customFeatures,
    settlementClusters,
    selectedClusterId,
    infrastructureAssets,
    gapCorridors,
    networkLayout,
    rasterOverlayUrl,
    rasterOpacity,
  ]);

  return (
    <div className="bg-sheet border border-rule-strong rounded-xs overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="p-2 border-b border-rule bg-paper/60 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="small-caps-heading">Survey Map Canvas</span>
          <QualityTag
            kind={boundarySource === 'APPROXIMATE_BUFFER' ? 'ASSUMED' : 'ESTIMATED'}
            label={`BOUNDARY: ${boundarySource}`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {drawModeActive && (
            <div className="flex items-center gap-1 mr-2">
              <span className="font-mono text-[11px] text-accent">
                Vertices: {drawnVertices.length}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={drawnVertices.length === 0}
                onClick={() => setDrawnVertices((prev) => prev.slice(0, -1))}
              >
                Undo Vertex
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={drawnVertices.length === 0}
                onClick={() => setDrawnVertices([])}
              >
                Clear
              </Button>
            </div>
          )}

          <div
            role="group"
            aria-label="Basemap switcher"
            className="inline-flex border border-rule-strong rounded-xs overflow-hidden bg-sheet"
          >
            <button
              type="button"
              onClick={() => setBasemap('survey_paper')}
              className={`px-2 py-1 text-xs font-medium ${
                basemap === 'survey_paper'
                  ? 'bg-accent text-white'
                  : 'text-ink-2 hover:bg-paper'
              }`}
            >
              Survey Paper
            </button>
            <button
              type="button"
              onClick={() => setBasemap('streets')}
              className={`px-2 py-1 text-xs font-medium border-l border-rule ${
                basemap === 'streets'
                  ? 'bg-accent text-white'
                  : 'text-ink-2 hover:bg-paper'
              }`}
            >
              Streets (OpenFreeMap)
            </button>
            <button
              type="button"
              onClick={() => setBasemap('satellite_2016')}
              className={`px-2 py-1 text-xs font-medium border-l border-rule ${
                basemap === 'satellite_2016'
                  ? 'bg-accent text-white'
                  : 'text-ink-2 hover:bg-paper'
              }`}
            >
              Sentinel-2 (EOX 2016 CC BY)
            </button>
          </div>
        </div>
      </div>

      {/* Viewport */}
      <div className={`relative w-full survey-grid-bg ${heightClass}`}>
        <div
          ref={containerRef}
          className={`h-full w-full ${
            drawModeActive || placeTieInModeActive ? 'cursor-crosshair' : ''
          }`}
        />

        {/* Preliminary Watermark */}
        <div className="pointer-events-none absolute top-2.5 left-2.5 bg-sheet/95 border border-dashed border-warn px-2 py-1 rounded-xs shadow-control">
          <div className="font-mono text-[10px] font-semibold text-warn uppercase tracking-wider">
            PRELIMINARY ENGINEERING MAP — NOT FIELD VERIFIED
          </div>
          {boundarySource === 'APPROXIMATE_BUFFER' && (
            <div className="font-mono text-[10px] text-error font-semibold">
              ≈ APPROXIMATE 1.5 KM BUFFER BOUNDARY (OFFICIAL VILLAGE POLYGON MISSING)
            </div>
          )}
        </div>
      </div>

      {/* Coordinate Readout */}
      <div className="px-3 py-1.5 border-t border-rule bg-sheet flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-ink-2">
        <div>
          CURSOR: {cursorCoords.lat.toFixed(5)}° N, {cursorCoords.lon.toFixed(5)}° E · Metric CRS:
          UTM Zone 44N (EPSG:32644)
        </div>
        <div>
          {placeTieInModeActive
            ? 'TIE-IN PLACEMENT MODE: Click map to place explicit USER_ASSUMED 11 kV tie-in point'
            : drawModeActive
              ? 'DRAW MODE: Click map to add polygon vertices (min 3 vertices)'
              : 'SRID: EPSG:4326 (WGS 84)'}
        </div>
      </div>
    </div>
  );
};
