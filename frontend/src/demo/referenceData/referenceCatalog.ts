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

import koraputBuildingsRaw from './koraputBuildings.json';
import koraputManifestRaw from './koraputManifest.json';
import koraputSampleRoutesRaw from './koraputSampleRoutes.json';
import koraputSolarRaw from './koraputSolar.json';
import koraputVillagesRaw from './koraputVillages.json';
import {
  DEFAULT_ELECTRIFICATION_GAPS_FC,
  DEFAULT_EXISTING_POWER_INFRA_FC,
  DEFAULT_PROPOSED_NETWORK_FC,
  DEFAULT_SETTLEMENTS_FC,
  DEFAULT_VILLAGE_ELECTRIFICATION_FC,
  buildMetricBufferPolygon,
} from '../../components/map/electricityGisData';
import type { DatasetProvenanceDto } from '../../components/ui/ProvenanceChip';

export const KORAPUT_BHEJA_POLYGON: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [82.695, 18.535],
      [82.768, 18.532],
      [82.774, 18.598],
      [82.702, 18.602],
      [82.69, 18.568],
      [82.695, 18.535],
    ],
  ],
};

function makeRectPolygon(
  minLon: number,
  minLat: number,
  maxLon: number,
  maxLat: number,
): GeoJSON.Polygon {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat],
      ],
    ],
  };
}

export interface ReferenceCensusInfo {
  census2011_code: string;
  name: string;
  total_pop: number;
  households: number;
  st_pop: number;
  sc_pop: number;
  amenities: Record<string, unknown>;
  power_supply_2011: Record<string, unknown>;
}

export interface ReferenceAdminUnitRecord {
  lgd_code: string;
  level: 'STATE' | 'DISTRICT' | 'BLOCK' | 'GP' | 'VILLAGE';
  name: string;
  parent_lgd_code: string | null;
  census2011_code: string | null;
  boundary_source: string;
  has_polygon_geometry: boolean;
  centroid_lon: number;
  centroid_lat: number;
  area_km2: number;
  metric_epsg: number;
  warnings: string[];
  geometry: GeoJSON.Geometry;
  census_info: ReferenceCensusInfo | null;
}

const CENSUS_BY_CODE: Record<string, ReferenceCensusInfo> = {
  '428914': {
    census2011_code: '428914',
    name: 'Bheja',
    total_pop: 562,
    households: 128,
    st_pop: 448,
    sc_pop: 42,
    amenities: {
      primary_school: 1,
      middle_school: 1,
      phc_sub_centre: 1,
      drinking_water_handpump: true,
      all_weather_road: false,
    },
    power_supply_2011: {
      domestic_available: true,
      agricultural_available: false,
      summer_hours_per_day: 4.0,
      winter_hours_per_day: 5.0,
    },
  },
  '428918': {
    census2011_code: '428918',
    name: 'Padwa',
    total_pop: 912,
    households: 210,
    st_pop: 740,
    sc_pop: 68,
    amenities: {
      primary_school: 2,
      middle_school: 1,
      phc_sub_centre: 1,
      drinking_water_handpump: true,
      all_weather_road: true,
    },
    power_supply_2011: {
      domestic_available: true,
      agricultural_available: true,
      summer_hours_per_day: 8.0,
      winter_hours_per_day: 9.0,
    },
  },
  '428922': {
    census2011_code: '428922',
    name: 'Maliaguda PVTG Forest Habitation',
    total_pop: 118,
    households: 26,
    st_pop: 114,
    sc_pop: 0,
    amenities: {
      primary_school: 0,
      middle_school: 0,
      phc_sub_centre: 0,
      drinking_water_handpump: true,
      all_weather_road: false,
    },
    power_supply_2011: {
      domestic_available: false,
      agricultural_available: false,
      summer_hours_per_day: 0.0,
      winter_hours_per_day: 0.0,
    },
  },
  '429005': {
    census2011_code: '429005',
    name: 'Pukali',
    total_pop: 710,
    households: 164,
    st_pop: 595,
    sc_pop: 38,
    amenities: {
      primary_school: 1,
      middle_school: 1,
      phc_sub_centre: 1,
      drinking_water_handpump: true,
      all_weather_road: true,
    },
    power_supply_2011: {
      domestic_available: true,
      agricultural_available: false,
      summer_hours_per_day: 5.0,
      winter_hours_per_day: 6.0,
    },
  },
};

export const REFERENCE_ADMIN_UNITS: ReferenceAdminUnitRecord[] = [
  {
    lgd_code: '21',
    level: 'STATE',
    name: 'Odisha',
    parent_lgd_code: null,
    census2011_code: '21',
    boundary_source: 'HARMONISED',
    has_polygon_geometry: true,
    centroid_lon: 84.42,
    centroid_lat: 20.15,
    area_km2: 155707,
    metric_epsg: 32645,
    warnings: [],
    geometry: makeRectPolygon(81.37, 17.78, 87.48, 22.57),
    census_info: null,
  },
  {
    lgd_code: '360',
    level: 'DISTRICT',
    name: 'Koraput',
    parent_lgd_code: '21',
    census2011_code: '398',
    boundary_source: 'HARMONISED',
    has_polygon_geometry: true,
    centroid_lon: 82.71,
    centroid_lat: 18.81,
    area_km2: 8807,
    metric_epsg: 32644,
    warnings: [],
    geometry: makeRectPolygon(82.08, 18.2, 83.38, 19.35),
    census_info: null,
  },
  {
    lgd_code: '3291',
    level: 'BLOCK',
    name: 'Nandapur',
    parent_lgd_code: '360',
    census2011_code: '03018',
    boundary_source: 'HARMONISED',
    has_polygon_geometry: true,
    centroid_lon: 82.73,
    centroid_lat: 18.57,
    area_km2: 1120,
    metric_epsg: 32644,
    warnings: [],
    geometry: makeRectPolygon(82.55, 18.42, 82.88, 18.72),
    census_info: null,
  },
  {
    lgd_code: '3294',
    level: 'BLOCK',
    name: 'Pottangi',
    parent_lgd_code: '360',
    census2011_code: '03020',
    boundary_source: 'HARMONISED',
    has_polygon_geometry: true,
    centroid_lon: 82.97,
    centroid_lat: 18.58,
    area_km2: 920,
    metric_epsg: 32644,
    warnings: [],
    geometry: makeRectPolygon(82.85, 18.45, 83.12, 18.74),
    census_info: null,
  },
  {
    lgd_code: '124901',
    level: 'GP',
    name: 'Bheja Gram Panchayat',
    parent_lgd_code: '3291',
    census2011_code: null,
    boundary_source: 'HARMONISED',
    has_polygon_geometry: true,
    centroid_lon: 82.732,
    centroid_lat: 18.567,
    area_km2: 59.6,
    metric_epsg: 32644,
    warnings: [],
    geometry: KORAPUT_BHEJA_POLYGON,
    census_info: null,
  },
  {
    lgd_code: '124902',
    level: 'GP',
    name: 'Padwa Gram Panchayat',
    parent_lgd_code: '3291',
    census2011_code: null,
    boundary_source: 'HARMONISED',
    has_polygon_geometry: true,
    centroid_lon: 82.65,
    centroid_lat: 18.505,
    area_km2: 65.4,
    metric_epsg: 32644,
    warnings: [],
    geometry: makeRectPolygon(82.61, 18.47, 82.69, 18.54),
    census_info: null,
  },
  {
    lgd_code: '124903',
    level: 'GP',
    name: 'Pukali Gram Panchayat',
    parent_lgd_code: '3294',
    census2011_code: null,
    boundary_source: 'HARMONISED',
    has_polygon_geometry: true,
    centroid_lon: 82.95,
    centroid_lat: 18.555,
    area_km2: 64.9,
    metric_epsg: 32644,
    warnings: [],
    geometry: makeRectPolygon(82.91, 18.52, 82.99, 18.59),
    census_info: null,
  },
  {
    lgd_code: '398712',
    level: 'VILLAGE',
    name: 'Bheja',
    parent_lgd_code: '124901',
    census2011_code: '428914',
    boundary_source: 'HARMONISED',
    has_polygon_geometry: true,
    centroid_lon: 82.732,
    centroid_lat: 18.567,
    area_km2: 59.6,
    metric_epsg: 32644,
    warnings: [],
    geometry: KORAPUT_BHEJA_POLYGON,
    census_info: CENSUS_BY_CODE['428914'] ?? null,
  },
  {
    lgd_code: '398715',
    level: 'VILLAGE',
    name: 'Padwa',
    parent_lgd_code: '124902',
    census2011_code: '428918',
    boundary_source: 'HARMONISED',
    has_polygon_geometry: true,
    centroid_lon: 82.65,
    centroid_lat: 18.505,
    area_km2: 35.1,
    metric_epsg: 32644,
    warnings: [],
    geometry: makeRectPolygon(82.62, 18.48, 82.68, 18.53),
    census_info: CENSUS_BY_CODE['428918'] ?? null,
  },
  {
    lgd_code: '398719',
    level: 'VILLAGE',
    name: 'Maliaguda PVTG Forest Habitation',
    parent_lgd_code: '124901',
    census2011_code: '428922',
    boundary_source: 'APPROXIMATE_BUFFER',
    has_polygon_geometry: false,
    centroid_lon: 82.755,
    centroid_lat: 18.585,
    area_km2: 7.07,
    metric_epsg: 32644,
    warnings: [
      'APPROXIMATE_BUFFER: Official revenue cadastral polygon unavailable for this hamlet; using a 1.5 km metric circular buffer around village coordinates.',
    ],
    geometry: buildMetricBufferPolygon(82.755, 18.585, 1500),
    census_info: CENSUS_BY_CODE['428922'] ?? null,
  },
  {
    lgd_code: '398801',
    level: 'VILLAGE',
    name: 'Pukali',
    parent_lgd_code: '124903',
    census2011_code: '429005',
    boundary_source: 'HARMONISED',
    has_polygon_geometry: true,
    centroid_lon: 82.95,
    centroid_lat: 18.555,
    area_km2: 35.0,
    metric_epsg: 32644,
    warnings: [],
    geometry: makeRectPolygon(82.92, 18.53, 82.98, 18.58),
    census_info: CENSUS_BY_CODE['429005'] ?? null,
  },
];

export const OPEN_DATASET_CATALOG: DatasetProvenanceDto[] = [
  {
    id: 'ds-buildings-google',
    key: 'google_open_buildings_v3',
    name: 'Google Open Buildings v3 + Microsoft ML Footprints',
    provider: 'Google Research / Microsoft Planetary Computer',
    url: 'https://sites.research.google/open-buildings/',
    licence: 'CC-BY-4.0 / CDLA-Permissive-2.0',
    licence_url: 'https://creativecommons.org/licenses/by/4.0/',
    attribution_text: 'Google Open Buildings v3 (2024)',
    spatial_resolution: '0.5 m VHR Polygon Footprints',
    temporal_coverage: '2024',
    version: 'v3',
    is_non_commercial: false,
    notes: 'Roof footprints extracted for Koraput reference study.',
  },
  {
    id: 'ds-dem-copernicus',
    key: 'copernicus_dem_glo30',
    name: 'Copernicus DEM GLO-30 (30 m Terrain)',
    provider: 'European Space Agency / Copernicus',
    url: 'https://spacedata.copernicus.eu/',
    licence: 'Copernicus Free Data Licence',
    licence_url: null,
    attribution_text: 'ESA Copernicus DEM GLO-30 (2023)',
    spatial_resolution: '30 m elevation & slope',
    temporal_coverage: '2023',
    version: 'GLO-30',
    is_non_commercial: false,
    notes: 'Hillside slope surface for least-cost feeder corridor weighting.',
  },
  {
    id: 'ds-worldcover',
    key: 'esa_worldcover_10m',
    name: 'ESA WorldCover 10 m Land Use & Canopy',
    provider: 'ESA WorldCover Consortium',
    url: 'https://esa-worldcover.org/',
    licence: 'CC-BY-4.0',
    licence_url: 'https://creativecommons.org/licenses/by/4.0/',
    attribution_text: 'ESA WorldCover 10m v200',
    spatial_resolution: '10 m land cover classes',
    temporal_coverage: '2021',
    version: 'v200',
    is_non_commercial: false,
    notes: 'Forest canopy, cropland, built-up, and water masks.',
  },
  {
    id: 'ds-viirs-nl',
    key: 'nasa_viirs_dnb_monthly',
    name: 'NASA Black Marble VIIRS DNB Nighttime Lights',
    provider: 'NASA Earthdata / Colorado School of Mines',
    url: 'https://blackmarble.gsfc.nasa.gov/',
    licence: 'Public Domain (NASA Open Data)',
    licence_url: null,
    attribution_text: 'NASA Earth Observatory / VIIRS DNB',
    spatial_resolution: '~500 m nocturnal radiance',
    temporal_coverage: '2024',
    version: 'v1',
    is_non_commercial: false,
    notes: 'Preliminary nighttime brightness cues used for Axis-1 proxy classification.',
  },
  {
    id: 'ds-nasa-power',
    key: 'nasa_power_solar_t2m',
    name: 'NASA POWER Renewable Energy Climatology',
    provider: 'NASA Langley Research Center',
    url: 'https://power.larc.nasa.gov/',
    licence: 'Public Domain (NASA Open Data)',
    licence_url: null,
    attribution_text: 'NASA POWER Project',
    spatial_resolution: '0.5 deg monthly GHI & T2M',
    temporal_coverage: '2024',
    version: 'v2',
    is_non_commercial: false,
    notes: '12-month GHI and ambient temperature for off-grid sizing.',
  },
  {
    id: 'ds-osm-census',
    key: 'osm_and_census_2011',
    name: 'OpenStreetMap Roads/Power Grid & Census 2011 DCHB',
    provider: 'OSM Contributors / ORGI Census of India',
    url: 'https://www.openstreetmap.org/',
    licence: 'ODbL / GODL-India',
    licence_url: 'https://opendatacommons.org/licenses/odbl/',
    attribution_text: 'OpenStreetMap Contributors / ORGI',
    spatial_resolution: 'Vector corridors & village tables',
    temporal_coverage: '2011-2024',
    version: '2024',
    is_non_commercial: false,
    notes: 'Existing roads, streams, mapped power lines, and Census 2011 household baseline.',
  },
];

export const KORAPUT_OSM_FEATURES_FC: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'osm-road-nandapur-bheja',
        feature_type: 'road',
        name: 'Nandapur–Bheja Panchayat Link Road (MDR-34)',
        highway: 'secondary',
        surface: 'asphalt',
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [82.696, 18.54],
          [82.708, 18.551],
          [82.718, 18.556],
          [82.731, 18.561],
          [82.74, 18.566],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'osm-road-maliaguda-track',
        feature_type: 'road',
        name: 'Podapadar–Maliaguda Unpaved Forest Track',
        highway: 'track',
        surface: 'unpaved',
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [82.738, 18.564],
          [82.742, 18.571],
          [82.748, 18.579],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'osm-stream-bheja-nala',
        feature_type: 'waterway',
        name: 'Bheja Seasonal Hill Stream (Nala)',
        waterway: 'stream',
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [82.734, 18.598],
          [82.733, 18.576],
          [82.729, 18.566],
          [82.725, 18.549],
          [82.721, 18.535],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'osm-school-bheja',
        feature_type: 'amenity',
        name: 'Govt. Primary School Bheja',
        amenity: 'school',
      },
      geometry: {
        type: 'Point',
        coordinates: [82.7165, 18.5558],
      },
    },
  ],
};

export function getKoraputReferenceBundle() {
  return {
    villages: koraputVillagesRaw as GeoJSON.FeatureCollection,
    buildings: koraputBuildingsRaw as GeoJSON.FeatureCollection,
    routes: koraputSampleRoutesRaw as GeoJSON.FeatureCollection,
    solar: koraputSolarRaw as {
      status: string;
      longitude: number;
      latitude: number;
      ghi_kwh_m2_day: Record<string, number>;
      t2m_deg_c: Record<string, number>;
      worst_month: string;
      worst_ghi_kwh_m2_day: number;
      annual_mean_ghi_kwh_m2_day: number;
    },
    manifest: koraputManifestRaw,
    existing_power_infra: DEFAULT_EXISTING_POWER_INFRA_FC,
    village_electrification: DEFAULT_VILLAGE_ELECTRIFICATION_FC,
    settlements: DEFAULT_SETTLEMENTS_FC,
    electrification_gaps: DEFAULT_ELECTRIFICATION_GAPS_FC,
    proposed_network: DEFAULT_PROPOSED_NETWORK_FC,
  };
}

export function getDemoSpikeSummary() {
  const routes = (koraputSampleRoutesRaw as GeoJSON.FeatureCollection).features.map((f) => {
    const props = (f.properties ?? {}) as Record<string, unknown>;
    return {
      target_name: String(props.target_name ?? 'Corridor'),
      length_km: Number(props.length_km ?? 0),
    };
  });
  return {
    milestone: 'DEMO',
    reference_geography: (koraputManifestRaw as { reference_geography?: unknown }).reference_geography ?? null,
    spikes: {
      S1_data_access: {
        status: 'PASSED',
        datasets_verified: OPEN_DATASET_CATALOG.length,
        epsg: 32644,
      },
      S2_least_cost_routing: {
        status: 'PASSED',
        elapsed_seconds: 0.42,
        routes,
      },
      S3_cartographic_pdf: {
        status: 'PASSED',
        pdf_size_bytes: 286720,
        sections_verified: ['Title Page', '24-Section Preliminary DPR'],
      },
      S4_maplibre_50k_webgl: {
        status: 'PASSED',
        feature_count: 50000,
        bbox: [82.68, 18.52, 82.78, 18.61],
      },
    },
  };
}
