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

export interface ReferenceGeoJsonBundle {
  villages: GeoJSON.FeatureCollection;
  buildings: GeoJSON.FeatureCollection;
  routes: GeoJSON.FeatureCollection;
}

export interface MapSpikePreviewProps {
  referenceData: ReferenceGeoJsonBundle | null;
}

type BasemapMode = 'survey_paper' | 'streets' | 'satellite_2016';

function buildBaseStyle(mode: BasemapMode): maplibregl.StyleSpecification | string {
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

function generate50kBuildingsGeoJson(): {
  collection: GeoJSON.FeatureCollection;
  elapsedMs: number;
} {
  const t0 = performance.now();
  const count = 50000;
  const features: GeoJSON.Feature[] = new Array(count);

  const centers: Array<[number, number, string]> = [
    [82.712, 18.555, 'LIKELY_ELECTRIFIED'],
    [82.735, 18.568, 'POTENTIALLY_UNDERSERVED'],
    [82.755, 18.582, 'POTENTIALLY_UNSERVED'],
    [82.762, 18.593, 'UNKNOWN'],
  ];

  let seed = 20261106;
  const nextRand = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < count; i++) {
    const center = centers[i % centers.length]!;
    const u1 = Math.max(1e-7, nextRand());
    const u2 = nextRand();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    const z1 = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);

    const lon = Number((center[0] + z0 * 0.011).toFixed(5));
    const lat = Number((center[1] + z1 * 0.009).toFixed(5));

    features[i] = {
      type: 'Feature',
      properties: {
        id: i + 1,
        proxy_class: center[2],
        area_m2: Math.round(18 + nextRand() * 65),
      },
      geometry: {
        type: 'Point',
        coordinates: [lon, lat],
      },
    };
  }

  const elapsedMs = Math.round(performance.now() - t0);
  return {
    collection: {
      type: 'FeatureCollection',
      features,
    },
    elapsedMs,
  };
}

export const MapSpikePreview: React.FC<MapSpikePreviewProps> = ({ referenceData }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const [basemap, setBasemap] = useState<BasemapMode>('survey_paper');
  const [stress50kActive, setStress50kActive] = useState<boolean>(false);
  const [stress50kMs, setStress50kMs] = useState<number | null>(null);
  const [cursorCoords, setCursorCoords] = useState<{ lon: number; lat: number }>({
    lon: 82.73,
    lat: 18.565,
  });

  const syncOverlayLayers = (
    map: maplibregl.Map,
    refBundle: ReferenceGeoJsonBundle | null,
    enable50k: boolean,
  ) => {
    if (!map.isStyleLoaded()) return;

    if (refBundle) {
      if (!map.getSource('ref-villages')) {
        map.addSource('ref-villages', {
          type: 'geojson',
          data: refBundle.villages,
        });
        map.addLayer({
          id: 'ref-villages-fill',
          type: 'fill',
          source: 'ref-villages',
          paint: {
            'fill-color': '#0B5D57',
            'fill-opacity': 0.06,
          },
        });
        map.addLayer({
          id: 'ref-villages-halo',
          type: 'line',
          source: 'ref-villages',
          paint: {
            'line-color': '#FFFFFF',
            'line-width': 4,
          },
        });
        map.addLayer({
          id: 'ref-villages-outline',
          type: 'line',
          source: 'ref-villages',
          paint: {
            'line-color': '#1F2328',
            'line-width': 2,
          },
        });
      }

      if (!map.getSource('ref-buildings')) {
        map.addSource('ref-buildings', {
          type: 'geojson',
          data: refBundle.buildings,
        });
        map.addLayer({
          id: 'ref-buildings-fill',
          type: 'fill',
          source: 'ref-buildings',
          paint: {
            'fill-color': '#5B5F66',
            'fill-opacity': 0.75,
          },
        });
        map.addLayer({
          id: 'ref-buildings-outline',
          type: 'line',
          source: 'ref-buildings',
          paint: {
            'line-color': '#1F2328',
            'line-width': 1,
          },
        });
      }

      if (!map.getSource('ref-routes')) {
        map.addSource('ref-routes', {
          type: 'geojson',
          data: refBundle.routes,
        });
        map.addLayer({
          id: 'ref-routes-halo',
          type: 'line',
          source: 'ref-routes',
          paint: {
            'line-color': '#FFFFFF',
            'line-width': 5,
          },
        });
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
    }

    if (enable50k) {
      if (!map.getSource('spike-50k-buildings')) {
        const { collection, elapsedMs } = generate50kBuildingsGeoJson();
        setStress50kMs(elapsedMs);
        map.addSource('spike-50k-buildings', {
          type: 'geojson',
          data: collection,
        });
        map.addLayer({
          id: 'spike-50k-circle',
          type: 'circle',
          source: 'spike-50k-buildings',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 14, 3.5, 17, 6],
            'circle-color': [
              'match',
              ['get', 'proxy_class'],
              'LIKELY_ELECTRIFIED',
              '#0072B2',
              'POTENTIALLY_UNDERSERVED',
              '#E69F00',
              'POTENTIALLY_UNSERVED',
              '#D55E00',
              '#8C8C8C',
            ],
            'circle-opacity': 0.78,
            'circle-stroke-width': 0.5,
            'circle-stroke-color': '#1F2328',
          },
        });
      }
    } else {
      if (map.getLayer('spike-50k-circle')) {
        map.removeLayer('spike-50k-circle');
      }
      if (map.getSource('spike-50k-buildings')) {
        map.removeSource('spike-50k-buildings');
      }
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildBaseStyle(basemap),
      center: [82.73, 18.565],
      zoom: 12.6,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left');

    map.on('mousemove', (e: maplibregl.MapMouseEvent) => {
      setCursorCoords({
        lon: Number(e.lngLat.lng.toFixed(5)),
        lat: Number(e.lngLat.lat.toFixed(5)),
      });
    });

    map.on('load', () => {
      syncOverlayLayers(map, referenceData, stress50kActive);
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
      syncOverlayLayers(map, referenceData, stress50kActive);
    } else {
      map.once('styledata', () => {
        syncOverlayLayers(map, referenceData, stress50kActive);
      });
    }
  }, [referenceData, stress50kActive]);

  return (
    <section
      aria-label="MapLibre GL JS Reference AOI and Spike S4 Canvas"
      className="bg-sheet border border-rule-strong rounded-xs overflow-hidden flex flex-col"
    >
      {/* Map Header Bar */}
      <div className="p-2.5 border-b border-rule flex flex-wrap items-center justify-between gap-2 bg-paper/60">
        <div className="flex items-center gap-2">
          <span className="small-caps-heading">
            GIS Canvas · Village Bheja (Nandapur Block, Koraput, Odisha)
          </span>
          <QualityTag kind="ESTIMATED" label="AOI + S2 LEAST-COST FEEDERS" />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div
            role="group"
            aria-label="Basemap switcher"
            className="inline-flex border border-rule-strong rounded-xs overflow-hidden bg-sheet"
          >
            <button
              type="button"
              onClick={() => setBasemap('survey_paper')}
              className={`px-2.5 py-1 text-xs font-medium ${
                basemap === 'survey_paper' ? 'bg-accent text-white' : 'text-ink-2 hover:bg-paper'
              }`}
            >
              Survey Paper (Offline)
            </button>
            <button
              type="button"
              onClick={() => setBasemap('streets')}
              className={`px-2.5 py-1 text-xs font-medium border-l border-rule ${
                basemap === 'streets' ? 'bg-accent text-white' : 'text-ink-2 hover:bg-paper'
              }`}
            >
              Streets (OpenFreeMap)
            </button>
            <button
              type="button"
              onClick={() => setBasemap('satellite_2016')}
              className={`px-2.5 py-1 text-xs font-medium border-l border-rule ${
                basemap === 'satellite_2016' ? 'bg-accent text-white' : 'text-ink-2 hover:bg-paper'
              }`}
            >
              Sentinel-2 (EOX 2016 CC BY)
            </button>
          </div>

          <Button
            size="sm"
            variant={stress50kActive ? 'primary' : 'secondary'}
            onClick={() => setStress50kActive((prev) => !prev)}
          >
            {stress50kActive
              ? `✓ S4: 50,000 Buildings Active (${stress50kMs ?? 0} ms)`
              : 'Run Spike S4: Render 50,000 Buildings (WebGL)'}
          </Button>
        </div>
      </div>

      {/* Map Viewport */}
      <div className="relative h-[440px] w-full survey-grid-bg">
        <div ref={containerRef} className="h-full w-full" />

        {/* Preliminary Engineering Watermark Stamp */}
        <div className="pointer-events-none absolute top-3 left-3 bg-sheet/95 border border-dashed border-warn px-2.5 py-1 rounded-xs shadow-control">
          <div className="font-mono text-[11px] font-semibold text-warn uppercase tracking-wider">
            PRELIMINARY ENGINEERING LAYOUT — NOT FIELD VERIFIED
          </div>
          <div className="font-mono text-[10px] text-ink-2">
            CRS: WGS 84 (EPSG:4326) · Metric Computation: UTM Zone 44N (EPSG:32644)
          </div>
        </div>

        {/* Map Legend Overlay */}
        <div
          aria-label="Map Legend"
          className="absolute bottom-8 right-3 bg-sheet/95 border border-rule-strong rounded-xs p-2.5 shadow-control text-xs space-y-1.5 max-w-[260px]"
        >
          <div className="small-caps-heading border-b border-rule pb-1">
            Symbology (Okabe-Ito Safe)
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-4 h-0.5 bg-ink" />
            <span>AOI Boundary (Village Bheja)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-4 h-0 border-t-2 border-dashed border-[#CC79A7]" />
            <span>Proposed 11 kV Feeder (S2 MCP)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 bg-[#5B5F66]/80 border border-ink" />
            <span>Detected Footprints (143 ref)</span>
          </div>
          {stress50kActive && (
            <div className="pt-1 border-t border-rule space-y-1 text-[11px]">
              <div className="font-mono font-semibold text-accent">
                S4 Stress Layer: 50,000 Points
              </div>
              <div className="grid grid-cols-2 gap-1">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#0072B2]" /> Likely Elec.
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#E69F00]" /> Underserved
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#D55E00]" /> Unserved
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#8C8C8C]" /> Unknown
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Coordinate & Provenance Footer Readout */}
      <div className="px-3 py-1.5 border-t border-rule bg-sheet flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-ink-2">
        <div>
          CURSOR: {cursorCoords.lat.toFixed(5)}° N, {cursorCoords.lon.toFixed(5)}° E · UTM 44N
          (EPSG:32644)
        </div>
        <div>
          PROVENANCE: Copernicus DEM 30m · ESA WorldCover 10m · VIIRS DNB · NASA POWER GHI
        </div>
      </div>
    </section>
  );
};

