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

import type { StyleSpecification } from 'maplibre-gl';
import type { BasemapMode } from './electricityGisData';

export const GLYPHS_URL = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';

/**
 * Shared MapLibre StyleSpecification generator for all 4 basemap modes
 * (`survey_paper`, `streets`, `terrain`, `satellite`).
 */
export function buildBasemapStyle(
  mode: BasemapMode,
  surveyBackgroundColor = '#F4F7FA',
): StyleSpecification {
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
        paint: { 'background-color': surveyBackgroundColor },
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

