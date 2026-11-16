// Copyright 2026 Swayam Kumar
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Centralized GIS & Single-Line Diagram (SLD) Symbology Tokens.
 *
 * Strictly separates existing vs. proposed infrastructure and encodes
 * epistemic honesty for proxy-based settlement electrification classifications.
 */

export type LayerSourceClass =
  | 'PROJECT'
  | 'REFERENCE_DEMO'
  | 'SYNTHETIC_PLACEHOLDER'
  | 'EXTERNAL_TILES'

export interface LayerSourceMetadata {
  code: LayerSourceClass
  shortLabel: string
  fullLabel: string
  description: string
  isFieldVerified: boolean
}

export const LAYER_SOURCE_META: Record<LayerSourceClass, LayerSourceMetadata> = {
  PROJECT: {
    code: 'PROJECT',
    shortLabel: 'PROJECT DATA',
    fullLabel: 'Project Survey & Computed Layer',
    description: 'Derived from uploaded project datasets or deterministic engineering solvers.',
    isFieldVerified: false,
  },
  REFERENCE_DEMO: {
    code: 'REFERENCE_DEMO',
    shortLabel: 'REF · DEMO',
    fullLabel: 'Bundled Reference / Demo Layer',
    description: 'Static regional reference pack bundled for pre-feasibility context.',
    isFieldVerified: false,
  },
  SYNTHETIC_PLACEHOLDER: {
    code: 'SYNTHETIC_PLACEHOLDER',
    shortLabel: 'ILLUSTRATIVE · SYNTHETIC',
    fullLabel: 'Illustrative Reference Layer (Synthetic)',
    description: 'Algorithmically generated visualization layer; not ground-truth measurement.',
    isFieldVerified: false,
  },
  EXTERNAL_TILES: {
    code: 'EXTERNAL_TILES',
    shortLabel: 'PUBLIC TILES',
    fullLabel: 'External Open Basemap Tiles',
    description: 'Third-party open cartographic or satellite imagery tiles.',
    isFieldVerified: false,
  },
}

export const GIS_SYMBOLOGY = {
  aoi: {
    stroke: '#1E40AF',
    fill: '#1E40AF',
    fillOpacity: 0.06,
    strokeWidth: 2,
    dashArray: [5, 3] as [number, number],
  },
  infrastructure: {
    substation33kv: '#4C1D95',
    substation33kvStroke: '#FDE047',
    substation11kv: '#0F172A',
    line33kvExisting: '#6D28D9',
    ht11kvExisting: '#991B1B',
    ht11kvProposed: '#DC2626',
    ltExisting: '#047857',
    ltProposed: '#0284C7',
    dtExisting: '#0F766E',
    dtProposed: '#DC2626',
    minigridProposed: '#0284C7',
    towerExisting: '#334155',
    poleExisting: '#64748B',
    poleProposed: '#38BDF8',
    tieInUserAssumed: '#D97706',
  },
  settlements: {
    FIELD_VERIFIED_ELECTRIFIED: '#009E73',
    LIKELY_ELECTRIFIED: '#0072B2',
    POTENTIALLY_UNDERSERVED: '#E69F00',
    POTENTIALLY_UNSERVED: '#D55E00',
    UNKNOWN: '#64748B',
  },
  electrificationGap: {
    fill: '#E11D48',
    stroke: '#9F1239',
    fillOpacity: 0.16,
  },
  demandCluster: {
    GRID_EXTENSION: '#0284C7',
    SOLAR_MICROGRID: '#D97706',
    STANDALONE_SHS: '#0D9488',
    UNASSIGNED: '#475569',
  },
  viirsPrintRamp: [
    { thresholdNw: 0, color: '#0B1120', label: '< 0.2 nW (Near Dark / No Signal)' },
    { thresholdNw: 0.5, color: '#1E3A8A', label: '0.5–1.5 nW (Low Radiance)' },
    { thresholdNw: 1.5, color: '#0284C7', label: '1.5–5.0 nW (Moderate Radiance)' },
    { thresholdNw: 5.0, color: '#F59E0B', label: '5.0–15.0 nW (High Radiance)' },
    { thresholdNw: 15.0, color: '#FEF08A', label: '> 15.0 nW (Core Luminous Center)' },
  ],
} as const

/**
 * Single-Line Diagram (SLD) SVG palette aligned with design system tokens.
 */
export const SLD_PALETTE = {
  canvasBg: '#F8FAFC',
  cardFill: '#FFFFFF',
  headerBand: '#0B1426',
  inkPrimary: '#0F172A',
  inkSecondary: '#334155',
  inkMuted: '#64748B',
  ruleStroke: '#CBD5E1',
  ht11kvStroke: '#B91C1C',
  ltBackboneStroke: '#0284C7',
  ltCompliantStroke: '#009E73',
  ltNonCompliantStroke: '#D55E00',
  vdropViolationStroke: '#D55E00',
  dtStroke: '#D97706',
  dtCoreStroke: '#B45309',
  tieInBusFill: '#0F172A',
} as const

export type InfrastructureCategoryCode =
  | 'SUBSTATION_33_11KV'
  | 'LINE_33KV_EXISTING'
  | 'LINE_11KV_EXISTING'
  | 'DT_EXISTING'
  | 'TIE_IN_ASSUMED'
  | 'TOWER_33KV'
  | 'POLE_11KV'
  | 'LINE_11KV_PROPOSED'
  | 'LINE_415V_LT_PROPOSED'
  | 'DT_PROPOSED'
  | 'MINIGRID_PROPOSED'

export interface InfrastructureCategorySpec {
  code: InfrastructureCategoryCode
  label: string
  shortLabel: string
  voltageLabel: string
  color: string
  strokeColor?: string
  lineWidthPx?: number
  markerRadiusPx?: number
  strokeWidthPx?: number
  dashArray?: readonly [number, number]
  isProposed: boolean
  geometryKind: 'LINE' | 'POINT'
  osmTag: string
  description: string
}

export const INFRASTRUCTURE_CATEGORY_META: Record<
  InfrastructureCategoryCode,
  InfrastructureCategorySpec
> = {
  SUBSTATION_33_11KV: {
    code: 'SUBSTATION_33_11KV',
    label: '33/11 kV Primary Distribution Substation',
    shortLabel: '33/11 kV Substation',
    voltageLabel: '33/11 kV',
    color: '#4C1D95',
    strokeColor: '#FDE047',
    markerRadiusPx: 10.0,
    strokeWidthPx: 2.6,
    isProposed: false,
    geometryKind: 'POINT',
    osmTag: 'power=substation',
    description:
      'Primary distribution substation stepping down 33 kV sub-transmission power to 11 kV rural feeders.',
  },
  LINE_33KV_EXISTING: {
    code: 'LINE_33KV_EXISTING',
    label: '33 kV Sub-Transmission Feeder (Existing)',
    shortLabel: '33 kV Line (Existing)',
    voltageLabel: '33 kV',
    color: '#6D28D9',
    strokeColor: '#FFFFFF',
    lineWidthPx: 3.8,
    isProposed: false,
    geometryKind: 'LINE',
    osmTag: 'power=line',
    description:
      'Existing 33 kV sub-transmission line carrying bulk power between grid substations.',
  },
  LINE_11KV_EXISTING: {
    code: 'LINE_11KV_EXISTING',
    label: '11 kV Primary Distribution Feeder (Existing)',
    shortLabel: '11 kV Feeder (Existing)',
    voltageLabel: '11 kV',
    color: '#991B1B',
    strokeColor: '#FFFFFF',
    lineWidthPx: 2.8,
    isProposed: false,
    geometryKind: 'LINE',
    osmTag: 'power=minor_line',
    description:
      'Existing 11 kV primary distribution line supplying village distribution transformers.',
  },
  DT_EXISTING: {
    code: 'DT_EXISTING',
    label: 'Existing Distribution Transformer (11/0.433 kV DT)',
    shortLabel: 'Existing DT',
    voltageLabel: '11/0.433 kV',
    color: '#0F766E',
    strokeColor: '#FFFFFF',
    markerRadiusPx: 7.5,
    strokeWidthPx: 2.0,
    isProposed: false,
    geometryKind: 'POINT',
    osmTag: 'power=transformer',
    description:
      'Existing distribution transformer stepping down 11 kV medium voltage to 415 V 3-phase / 240 V 1-phase household supply.',
  },
  TIE_IN_ASSUMED: {
    code: 'TIE_IN_ASSUMED',
    label: 'User-Assumed 11 kV Tie-In Point',
    shortLabel: 'Assumed 11 kV Tie-In',
    voltageLabel: '11 kV (Assumed)',
    color: '#D97706',
    strokeColor: '#FEF08A',
    markerRadiusPx: 8.0,
    strokeWidthPx: 2.2,
    isProposed: false,
    geometryKind: 'POINT',
    osmTag: 'USER_ASSUMED',
    description:
      'Planner-designated 11 kV tapping point used for pre-feasibility routing when utility GIS records are incomplete; requires field confirmation.',
  },
  TOWER_33KV: {
    code: 'TOWER_33KV',
    label: '33 kV Lattice Steel Support Tower',
    shortLabel: '33 kV Lattice Tower',
    voltageLabel: '33 kV',
    color: '#334155',
    strokeColor: '#FFFFFF',
    markerRadiusPx: 5.8,
    strokeWidthPx: 1.6,
    isProposed: false,
    geometryKind: 'POINT',
    osmTag: 'power=tower',
    description:
      'Mapped 33 kV lattice steel support tower along sub-transmission corridor.',
  },
  POLE_11KV: {
    code: 'POLE_11KV',
    label: '11 kV / LT PSC Distribution Pole',
    shortLabel: '11 kV PSC Pole',
    voltageLabel: '11 kV / 415 V',
    color: '#64748B',
    strokeColor: '#FFFFFF',
    markerRadiusPx: 4.2,
    strokeWidthPx: 1.4,
    isProposed: false,
    geometryKind: 'POINT',
    osmTag: 'power=pole',
    description:
      'Mapped 8m/9m prestressed concrete (PSC) distribution pole; unmapped poles elsewhere never imply absence of ground lines.',
  },
  LINE_11KV_PROPOSED: {
    code: 'LINE_11KV_PROPOSED',
    label: 'Proposed 11 kV HT Spur (Preliminary Route)',
    shortLabel: 'Proposed 11 kV HT',
    voltageLabel: '11 kV (Proposed)',
    color: '#DC2626',
    lineWidthPx: 3.2,
    dashArray: [4, 2],
    isProposed: true,
    geometryKind: 'LINE',
    osmTag: 'PROPOSED_HT_11KV',
    description:
      'Computer-generated terrain-weighted 11 kV feeder extension route — NOT installed infrastructure.',
  },
  LINE_415V_LT_PROPOSED: {
    code: 'LINE_415V_LT_PROPOSED',
    label: 'Proposed 415 V LT AB-Cable (Preliminary Spine)',
    shortLabel: 'Proposed 415 V LT',
    voltageLabel: '415 V LT (Proposed)',
    color: '#0284C7',
    lineWidthPx: 2.6,
    dashArray: [2, 1.5],
    isProposed: true,
    geometryKind: 'LINE',
    osmTag: 'PROPOSED_LT_415V',
    description:
      'Preliminary 415 V minimum-spanning-tree (MST) low-tension aerial bunched cable layout — NOT installed infrastructure.',
  },
  DT_PROPOSED: {
    code: 'DT_PROPOSED',
    label: 'Proposed Distribution Transformer (Preliminary DT)',
    shortLabel: 'Proposed DT (25/63 kVA)',
    voltageLabel: '11/0.433 kV (Proposed)',
    color: '#DC2626',
    strokeColor: '#FEF08A',
    markerRadiusPx: 7.5,
    strokeWidthPx: 2.2,
    isProposed: true,
    geometryKind: 'POINT',
    osmTag: 'PROPOSED_DT',
    description:
      'Preliminary load-center distribution transformer placement — requires field plinth and flood-level survey.',
  },
  MINIGRID_PROPOSED: {
    code: 'MINIGRID_PROPOSED',
    label: 'Proposed Solar PV + LFP Battery Mini-Grid Hub',
    shortLabel: 'Proposed Solar Mini-Grid',
    voltageLabel: '415 V AC / Solar PV',
    color: '#0284C7',
    strokeColor: '#FEF08A',
    markerRadiusPx: 7.8,
    strokeWidthPx: 2.2,
    isProposed: true,
    geometryKind: 'POINT',
    osmTag: 'PROPOSED_MINIGRID',
    description:
      'Preliminary off-grid Solar PV + LFP Battery Mini-Grid generation hub candidate — NOT installed infrastructure.',
  },
}

/**
 * Resolves any asset_type, infra_category, or layer_type string into its authoritative
 * InfrastructureCategorySpec for consistent symbology across maps, legends, and tables.
 */
export function resolveInfraCategoryMeta(
  rawType?: string | null,
  provenance?: string | null,
  voltageKv?: number | null,
): InfrastructureCategorySpec {
  const upper = (rawType ?? '').toUpperCase()
  const prov = (provenance ?? '').toUpperCase()

  if (upper === 'HT_11KV_PROPOSED') return INFRASTRUCTURE_CATEGORY_META.LINE_11KV_PROPOSED
  if (upper === 'LT_415V_PROPOSED') return INFRASTRUCTURE_CATEGORY_META.LINE_415V_LT_PROPOSED
  if (upper === 'DT_PROPOSED') return INFRASTRUCTURE_CATEGORY_META.DT_PROPOSED
  if (upper === 'MINIGRID_PROPOSED') return INFRASTRUCTURE_CATEGORY_META.MINIGRID_PROPOSED

  if (upper === 'SUBSTATION' || upper === 'SUBSTATION_33_11KV') {
    return INFRASTRUCTURE_CATEGORY_META.SUBSTATION_33_11KV
  }
  if (upper === 'TRANSMISSION_LINE' || (upper.includes('LINE') && (voltageKv ?? 0) >= 33)) {
    return INFRASTRUCTURE_CATEGORY_META.LINE_33KV_EXISTING
  }
  if (upper === 'DISTRIBUTION_LINE_11KV' || upper === 'LINE') {
    return INFRASTRUCTURE_CATEGORY_META.LINE_11KV_EXISTING
  }
  if (upper === 'TIE_IN' || prov === 'USER_ASSUMED') {
    return INFRASTRUCTURE_CATEGORY_META.TIE_IN_ASSUMED
  }
  if (upper === 'TRANSFORMER' || upper === 'DT') {
    return INFRASTRUCTURE_CATEGORY_META.DT_EXISTING
  }
  if (upper === 'TOWER') {
    return INFRASTRUCTURE_CATEGORY_META.TOWER_33KV
  }
  if (upper === 'POLE') {
    return INFRASTRUCTURE_CATEGORY_META.POLE_11KV
  }
  return INFRASTRUCTURE_CATEGORY_META.DT_EXISTING
}

/**
 * Authoritative color-ramp and categorical legends for satellite & environmental raster overlays.
 * Matches backend `layer_processing.py` rendering palettes and `DESIGN_SYSTEM.md`.
 */
export interface RasterLegendStop {
  color: string
  label: string
  rangeText: string
  interpretation: string
}

export interface RasterOverlayLegendSpec {
  id: 'dem_slope' | 'landcover' | 'nightlights'
  title: string
  sensorAndVintage: string
  spatialResolution: string
  license: string
  unitLabel: string
  stops: RasterLegendStop[]
  epistemicNote: string
}

export const RASTER_LEGEND_SPECS: Record<
  'dem_slope' | 'landcover' | 'nightlights',
  RasterOverlayLegendSpec
> = {
  nightlights: {
    id: 'nightlights',
    title: 'Nighttime Illumination (VIIRS DNB Scale · Proxy)',
    sensorAndVintage:
      'NASA GIBS VIIRS_CityLights_2012 (2012 WMTS, z ≤ 8) · Local AOI Surface (Illustrative Reference)',
    spatialResolution:
      'GIBS 2012 (~500 m · z ≤ 8) · Local AOI Proxy Surface (Illustrative Reference)',
    license: 'Public Domain (NASA GIBS 2012) · Illustrative AOI Surface',
    unitLabel: 'nW/cm²/sr',
    stops: [
      {
        color: '#070913',
        rangeText: '< 0.2 nW',
        label: 'Background / Near Noise Floor',
        interpretation: 'No detectable outdoor street lighting; indoor meters or SHS may still exist.',
      },
      {
        color: '#1E1B4B',
        rangeText: '0.2 – 0.5 nW',
        label: 'Faint Rural Scatter',
        interpretation: 'Isolated outdoor security bulb or seasonal dispersion.',
      },
      {
        color: '#6D28D9',
        rangeText: '0.5 – 1.5 nW',
        label: 'Moderate Habitation Glow',
        interpretation: 'Partial street/community lighting or intermittent evening supply.',
      },
      {
        color: '#D97706',
        rangeText: '1.5 – 2.5 nW',
        label: 'Active Electrified Village Core',
        interpretation: 'Consistent evening outdoor illumination along primary habitation streets.',
      },
      {
        color: '#FDE047',
        rangeText: '> 2.5 nW',
        label: 'High-Luminance Substation / Market Node',
        interpretation: 'Substation yard lighting, commercial bazaar, or main highway junction.',
      },
    ],
    epistemicNote:
      'Satellites cannot see indoor household meters, low-wattage LED bulbs, or daytime solar kits. Low or zero nighttime radiance is NEVER definitive proof that electricity is unavailable. Note: Only NASA GIBS VIIRS_CityLights_2012 WMTS renders genuine orbital raster tiles; local AOI scenario PNGs use synthetic analytical scaling (1.00× / 1.08× / 0.88× / 0.72×).',
  },
  dem_slope: {
    id: 'dem_slope',
    title: 'Copernicus DEM GLO-30 Terrain Slope',
    sensorAndVintage: 'TanDEM-X / Copernicus DEM GLO-30 · 2021 Release',
    spatialResolution: '30 m (1 arc-sec) Digital Elevation Model',
    license: 'Copernicus Open Access License (Free & Open)',
    unitLabel: 'Degrees (°)',
    stops: [
      {
        color: '#F7F4E9',
        rangeText: '0° – 5°',
        label: 'Flat Valley / Plateau',
        interpretation: 'Standard 11 kV / LT span length (1.00× terrain routing weight).',
      },
      {
        color: '#C9A66B',
        rangeText: '5° – 15°',
        label: 'Moderate Hill Slope',
        interpretation: 'Reduced pole span & stay-wire reinforcement (1.35× routing penalty).',
      },
      {
        color: '#7F4F24',
        rangeText: '> 15°',
        label: 'Steep Eastern Ghats Escarpment',
        interpretation: 'High erection cost; favors off-grid Solar PV Mini-Grid if >2 km from 11 kV.',
      },
    ],
    epistemicNote:
      '30 m elevation cells smooth out narrow gullies and rock outcrops; final pole peg-marking requires field theodolite/total-station survey.',
  },
  landcover: {
    id: 'landcover',
    title: 'ESA WorldCover 10 m Land Classification',
    sensorAndVintage: 'Sentinel-1 & Sentinel-2 Optical/SAR · v200 (2021)',
    spatialResolution: '10 m Multi-Spectral Classification',
    license: 'CC BY 4.0 (ESA WorldCover Consortium)',
    unitLabel: 'Land Class Code',
    stops: [
      {
        color: '#006400',
        rangeText: 'Class 10',
        label: 'Tree Cover / Dense Forest',
        interpretation: 'Right-of-Way (RoW) tree-clearance / forest permit check required; ABC cable preferred.',
      },
      {
        color: '#FFBB22',
        rangeText: 'Class 20',
        label: 'Shrubland / Scrub',
        interpretation: 'Moderate vegetation clearance along 11 kV feeder corridor.',
      },
      {
        color: '#FFFF4C',
        rangeText: 'Class 30',
        label: 'Grassland / Open Grazing',
        interpretation: 'Unobstructed overhead line corridor.',
      },
      {
        color: '#F096FF',
        rangeText: 'Class 40',
        label: 'Cropland / Paddy Terrace',
        interpretation: 'Seasonal agricultural pump-set load potential; pole placement along bunds.',
      },
      {
        color: '#FA0000',
        rangeText: 'Class 50',
        label: 'Built-Up Habitation Surface',
        interpretation: 'Detected roofed settlement core for LT distribution drop-points.',
      },
      {
        color: '#0064C8',
        rangeText: 'Class 80',
        label: 'Permanent Water Bodies',
        interpretation: 'Long-span river crossing or route diversion required.',
      },
    ],
    epistemicNote:
      '10 m landcover classification assists in preliminary RoW cost weighting; statutory Reserve Forest boundaries must be verified with State Forest Department maps.',
  },
}

export interface SatelliteSourceAttributionItem {
  id: string
  name: string
  sensorOrProduct: string
  vintage: string
  resolution: string
  license: string
  roleInElectrimap: string
}

export const SATELLITE_SOURCES_ATTRIBUTION: SatelliteSourceAttributionItem[] = [
  {
    id: 'eox-s2-2020',
    name: 'EOX Sentinel-2 Cloudless Optical Basemap',
    sensorOrProduct: 'Copernicus Sentinel-2A/2B MSI True-Color Mosaic',
    vintage: '2020 Annual Cloudless Mosaic',
    resolution: '10 m optical (WMTS z ≤ 14)',
    license: 'CC BY-NC-SA 4.0 (EOX IT Services GmbH / Copernicus)',
    roleInElectrimap:
      'Visual verification of settlement roof clusters, forest canopy density, and access tracks.',
  },
  {
    id: 'nasa-viirs-dnb',
    name: 'NASA GIBS VIIRS Nighttime Lights',
    sensorOrProduct:
      'NASA GIBS VIIRS_CityLights_2012 WMTS + Local VIIRS VNP46A4 Composite',
    vintage:
      '2012 Global GIBS Basemap (WMTS) · Local GeoTIFF unavailable offline unless uploaded',
    resolution:
      '~500 m GIBS global tiles (z ≤ 8)',
    license: 'Public Domain (NASA Earthdata GIBS)',
    roleInElectrimap:
      'Indirect outdoor luminance cue (nW/cm²/sr) only; does not detect indoor meters or daytime solar.',
  },
  {
    id: 'copernicus-dem-30',
    name: 'Copernicus DEM GLO-30 Elevation & Slope',
    sensorOrProduct: 'TanDEM-X SAR Digital Surface Model',
    vintage: '2021 Release (Bundled 30 m GeoTIFF in sample archive; synthetic fallback outside)',
    resolution: '30 m (1 arc-sec)',
    license: 'Copernicus Open Access License',
    roleInElectrimap:
      'Computes terrain slope penalties (degrees) for 11 kV least-cost routing and pole span derating.',
  },
  {
    id: 'esa-worldcover-10m',
    name: 'ESA WorldCover 10 m Land Cover',
    sensorOrProduct: 'Sentinel-1 SAR + Sentinel-2 Optical Composite v200',
    vintage: '2021 Baseline (Bundled GeoTIFF in sample archive; synthetic fallback outside)',
    resolution: '10 m categorical raster',
    license: 'CC BY 4.0 (ESA WorldCover)',
    roleInElectrimap:
      'Identifies dense tree canopy (Class 10), cropland (Class 40), built-up areas (Class 50), and water crossings (Class 80).',
  },
  {
    id: 'nasa-power-ghi',
    name: 'NASA POWER Agroclimatology Solar Resource',
    sensorOrProduct: 'MERRA-2 / CERES Global Horizontal Irradiance (GHI)',
    vintage: 'Climatological Multi-Year Mean',
    resolution: '0.5° × 0.625° regional grid',
    license: 'Public Domain (NASA Langley Research Center)',
    roleInElectrimap:
      'Sizes Solar PV kWp and LFP battery kWh autonomy for off-grid Mini-Grid and SHS candidates.',
  },
]



