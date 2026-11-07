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

export type BasemapMode = 'survey_paper' | 'streets' | 'terrain' | 'satellite';

export type ViirsObservationPeriod =
  | '2024_ANNUAL'
  | '2023_POST_MONSOON'
  | '2022_ANNUAL'
  | '2020_BASELINE';

export type VoltageFilterMode =
  | 'ALL'
  | '33KV_TRANSMISSION'
  | '11KV_DISTRIBUTION'
  | 'SUBSTATIONS_AND_DTS'
  | 'TOWERS_AND_POLES';

export interface SearchableLocationItem {
  id: string;
  label: string;
  category: 'VILLAGE' | 'SETTLEMENT' | 'SUBSTATION' | 'GAP_ZONE';
  lon: number;
  lat: number;
  zoom: number;
  summary: string;
}

export const KORAPUT_SEARCH_CATALOG: SearchableLocationItem[] = [
  {
    id: 'vil-bheja',
    label: 'Bheja Revenue Village (LGD 398712 · Census 428914)',
    category: 'VILLAGE',
    lon: 82.73,
    lat: 18.565,
    zoom: 13.0,
    summary: 'Nandapur Block · 562 Pop (79.7% ST) · 128 Census HH · 143 Detected Footprints',
  },
  {
    id: 'vil-padwa',
    label: 'Padwa Revenue Village (LGD 398715 · Census 428918)',
    category: 'VILLAGE',
    lon: 82.65,
    lat: 18.505,
    zoom: 13.0,
    summary: 'Nandapur Block · 912 Pop · Grid-Connected (8–9 hrs/day in Census 2011)',
  },
  {
    id: 'vil-maliaguda',
    label: 'Maliaguda PVTG Forest Habitation (LGD 398719 · Census 428922)',
    category: 'VILLAGE',
    lon: 82.748,
    lat: 18.579,
    zoom: 14.2,
    summary: 'Reported Unelectrified in Census 2011 (0 hrs/day) · VIIRS 0.05 nW/cm²/sr',
  },
  {
    id: 'sub-nandapur',
    label: '33/11 kV Nandapur Primary Distribution Substation (TPSODL)',
    category: 'SUBSTATION',
    lon: 82.692,
    lat: 18.538,
    zoom: 14.5,
    summary: '3.15 MVA 33/11 kV Grid Substation (OSM Mapped power=substation)',
  },
  {
    id: 'cl-01',
    label: 'CL-01 · Bheja Main Village Core (59 Est. HH)',
    category: 'SETTLEMENT',
    lon: 82.718,
    lat: 18.556,
    zoom: 14.6,
    summary: 'Likely Electrified Proxy · Served by Existing 63 kVA DT-01 (2.18 nW/cm²/sr)',
  },
  {
    id: 'cl-02',
    label: 'CL-02 · Podapadar Tola Eastern Ridge (38 Est. HH)',
    category: 'GAP_ZONE',
    lon: 82.738,
    lat: 18.564,
    zoom: 14.6,
    summary: 'Potentially Underserved Gap · 1.64 km from 11 kV Grid · Proposed 25 kVA DT',
  },
  {
    id: 'cl-03',
    label: 'CL-03 · Maliaguda PVTG Hamlet North-East Valley (26 Est. HH)',
    category: 'GAP_ZONE',
    lon: 82.748,
    lat: 18.579,
    zoom: 14.6,
    summary: 'High-Priority Electrification Gap · 3.12 km from 11 kV Grid · 0.05 nW/cm²/sr',
  },
  {
    id: 'cl-04',
    label: 'CL-04 · Dispersed Forest Homesteads (8 Est. HH)',
    category: 'GAP_ZONE',
    lon: 82.708,
    lat: 18.578,
    zoom: 14.6,
    summary: 'Off-Grid SHS Candidate · 2.48 km from 11 kV Grid · Low Density',
  },
];

export const VIIRS_PERIOD_OPTIONS: Array<{
  id: ViirsObservationPeriod;
  label: string;
  compositeNote: string;
}> = [
  {
    id: '2024_ANNUAL',
    label: '2024 Annual Composite (VNL v2.2)',
    compositeNote: 'Latest annual cloud-free VIIRS Day/Night Band radiance composite',
  },
  {
    id: '2023_POST_MONSOON',
    label: '2023 Post-Monsoon Clear-Sky (Nov 2023)',
    compositeNote: 'Post-monsoon low-humidity observation window over Eastern Ghats',
  },
  {
    id: '2022_ANNUAL',
    label: '2022 Annual Baseline (VNL v2.2)',
    compositeNote: 'Mid-RDSS baseline annual composite for multi-year trend comparison',
  },
  {
    id: '2020_BASELINE',
    label: '2020 Pre-RDSS Baseline',
    compositeNote: 'Historical baseline prior to recent feeder augmentation works',
  },
];

export const DEFAULT_EXISTING_POWER_INFRA_FC: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'osm-line-33kv-jeypore-nandapur',
        name: '33 kV Jeypore–Nandapur–Pottangi Sub-Transmission Feeder',
        infra_category: 'TRANSMISSION_LINE',
        osm_tag: 'power=line',
        voltage_kv: 33.0,
        conductor: 'ACSR Dog (100 sq.mm)',
        operator: 'TPSODL / OPTCL (OSM Mapped)',
        provenance: 'OSM_MAPPED',
        quality_tag: 'ESTIMATED',
        epistemic_note:
          'Mapped in OpenStreetMap (ODbL). Field survey required to confirm thermal loading and exact pole/tower coordinates.',
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [82.648, 18.512],
          [82.672, 18.526],
          [82.692, 18.538],
          [82.716, 18.544],
          [82.748, 18.549],
          [82.782, 18.556],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'osm-line-11kv-bheja-spur',
        name: '11 kV Nandapur–Bheja Rural Distribution Feeder',
        infra_category: 'DISTRIBUTION_LINE_11KV',
        osm_tag: 'power=minor_line',
        voltage_kv: 11.0,
        conductor: 'ACSR Weasel (30 sq.mm)',
        operator: 'TPSODL (Southern Odisha DISCOM)',
        provenance: 'OSM_MAPPED',
        quality_tag: 'ESTIMATED',
        epistemic_note:
          'Existing 11 kV primary distribution spur terminating at Bheja Main Village Core (CL-01). Outlying eastern and north-eastern hamlets lack 11 kV spurs.',
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [82.692, 18.538],
          [82.701, 18.545],
          [82.709833, 18.55195],
          [82.7145, 18.5542],
          [82.718, 18.556],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'osm-substation-nandapur-33-11',
        name: '33/11 kV Nandapur Primary Distribution Substation',
        infra_category: 'SUBSTATION',
        osm_tag: 'power=substation',
        voltage_kv: 33.0,
        rating_kva: 3150.0,
        operator: 'TPSODL',
        provenance: 'OSM_MAPPED',
        quality_tag: 'ESTIMATED',
        epistemic_note:
          'Primary 33/11 kV source substation serving Nandapur Block rural feeders.',
      },
      geometry: {
        type: 'Point',
        coordinates: [82.692, 18.538],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'osm-dt-bheja-core-63kva',
        name: 'Existing 63 kVA Distribution Transformer (Bheja Core DT-01)',
        infra_category: 'TRANSFORMER',
        osm_tag: 'power=transformer',
        voltage_kv: 11.0,
        rating_kva: 63.0,
        operator: 'TPSODL',
        provenance: 'OSM_MAPPED',
        quality_tag: 'ESTIMATED',
        epistemic_note:
          'Serves Bheja Main Village Core (CL-01). Located 1.64 km from Podapadar Tola (CL-02) and 3.12 km from Maliaguda PVTG Hamlet (CL-03).',
      },
      geometry: {
        type: 'Point',
        coordinates: [82.718, 18.556],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'osm-dt-padwa-junction-25kva',
        name: 'Existing 25 kVA Distribution Transformer (Bheja South Tie-In DT-02)',
        infra_category: 'TRANSFORMER',
        osm_tag: 'power=transformer',
        voltage_kv: 11.0,
        rating_kva: 25.0,
        operator: 'TPSODL',
        provenance: 'OSM_MAPPED',
        quality_tag: 'ESTIMATED',
        epistemic_note:
          'Candidate 11 kV tapping/tie-in point (82.7098°E, 18.5520°N) for proposed feeder extension.',
      },
      geometry: {
        type: 'Point',
        coordinates: [82.709833, 18.55195],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'osm-twr-33-01',
        name: 'TWR-33-01 (33 kV Lattice Steel Support Tower)',
        infra_category: 'TOWER',
        osm_tag: 'power=tower',
        voltage_kv: 33.0,
        provenance: 'OSM_MAPPED',
        quality_tag: 'ESTIMATED',
        epistemic_note: 'Mapped 33 kV lattice steel support structure.',
      },
      geometry: { type: 'Point', coordinates: [82.672, 18.526] },
    },
    {
      type: 'Feature',
      properties: {
        id: 'osm-twr-33-03',
        name: 'TWR-33-03 (33 kV Lattice Steel Support Tower)',
        infra_category: 'TOWER',
        osm_tag: 'power=tower',
        voltage_kv: 33.0,
        provenance: 'OSM_MAPPED',
        quality_tag: 'ESTIMATED',
        epistemic_note: 'Mapped 33 kV lattice steel support structure.',
      },
      geometry: { type: 'Point', coordinates: [82.716, 18.544] },
    },
    {
      type: 'Feature',
      properties: {
        id: 'osm-twr-33-04',
        name: 'TWR-33-04 (33 kV Lattice Steel Support Tower)',
        infra_category: 'TOWER',
        osm_tag: 'power=tower',
        voltage_kv: 33.0,
        provenance: 'OSM_MAPPED',
        quality_tag: 'ESTIMATED',
        epistemic_note: 'Mapped 33 kV lattice steel support structure.',
      },
      geometry: { type: 'Point', coordinates: [82.748, 18.549] },
    },
    {
      type: 'Feature',
      properties: {
        id: 'osm-pole-11-01',
        name: 'POLE-11-01 (11 kV 8m PSC Distribution Pole)',
        infra_category: 'POLE',
        osm_tag: 'power=pole',
        voltage_kv: 11.0,
        provenance: 'OSM_MAPPED',
        quality_tag: 'ESTIMATED',
        epistemic_note:
          'Mapped 11 kV pole along Nandapur–Bheja spur; unmapped poles elsewhere do not imply absence of LT network.',
      },
      geometry: { type: 'Point', coordinates: [82.701, 18.545] },
    },
    {
      type: 'Feature',
      properties: {
        id: 'osm-pole-11-03',
        name: 'POLE-11-03 (11 kV 8m PSC Distribution Pole)',
        infra_category: 'POLE',
        osm_tag: 'power=pole',
        voltage_kv: 11.0,
        provenance: 'OSM_MAPPED',
        quality_tag: 'ESTIMATED',
        epistemic_note: 'Mapped 11 kV pole approaching Bheja Core DT-01.',
      },
      geometry: { type: 'Point', coordinates: [82.7145, 18.5542] },
    },
  ],
};

export const DEFAULT_VILLAGE_ELECTRIFICATION_FC: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        lgd_code: '398712',
        census2011_code: '428914',
        village_name: 'Bheja',
        block_name: 'Nandapur',
        district_name: 'Koraput',
        state_name: 'Odisha',
        total_pop: 562,
        st_pop: 448,
        sc_pop: 42,
        households_2011: 128,
        detected_footprints_2026: 143,
        estimated_households_2026: 131,
        electrification_status: 'PARTIALLY_ELECTRIFIED_UNDERSERVED',
        status_label: 'Main Core Grid-Connected; Outlying Hamlets Unserved/Underserved',
        domestic_power_2011: true,
        agricultural_power_2011: false,
        summer_supply_hrs_2011: 4.0,
        winter_supply_hrs_2011: 5.0,
        reported_electrified_hh_proxy: 59,
        reported_underserved_or_unserved_hh_proxy: 72,
        data_source: 'Census of India 2011 DCHB + LGD + VIIRS/Footprint Proxy',
        verification_state: 'UNVERIFIED',
        missing_data_notice:
          'Current household meter count requires DISCOM (TPSODL) consumer billing ledger or Gram Sabha field survey verification.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [82.695, 18.535],
            [82.765, 18.535],
            [82.765, 18.595],
            [82.695, 18.595],
            [82.695, 18.535],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        lgd_code: '398715',
        census2011_code: '428918',
        village_name: 'Padwa',
        block_name: 'Nandapur',
        district_name: 'Koraput',
        state_name: 'Odisha',
        total_pop: 912,
        st_pop: 740,
        sc_pop: 68,
        households_2011: 210,
        detected_footprints_2026: 228,
        estimated_households_2026: 215,
        electrification_status: 'ELECTRIFIED_GRID_CONNECTED',
        status_label: 'Grid-Connected Revenue Village (8–9 hrs/day in Census 2011)',
        domestic_power_2011: true,
        agricultural_power_2011: true,
        summer_supply_hrs_2011: 8.0,
        winter_supply_hrs_2011: 9.0,
        reported_electrified_hh_proxy: 190,
        reported_underserved_or_unserved_hh_proxy: 25,
        data_source: 'Census of India 2011 DCHB + LGD',
        verification_state: 'UNVERIFIED',
        missing_data_notice:
          'Feeder-level outage frequency and tail-end voltage drop require DISCOM DT metering logs.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [82.62, 18.48],
            [82.68, 18.48],
            [82.68, 18.53],
            [82.62, 18.53],
            [82.62, 18.48],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        lgd_code: '398719',
        census2011_code: '428922',
        village_name: 'Maliaguda PVTG Forest Habitation',
        block_name: 'Nandapur',
        district_name: 'Koraput',
        state_name: 'Odisha',
        total_pop: 118,
        st_pop: 114,
        sc_pop: 0,
        households_2011: 26,
        detected_footprints_2026: 28,
        estimated_households_2026: 26,
        electrification_status: 'REPORTED_UNELECTRIFIED_HABITATION',
        status_label: 'Reported Unelectrified in Census 2011 (0 hrs/day) + Near-Zero VIIRS',
        domestic_power_2011: false,
        agricultural_power_2011: false,
        summer_supply_hrs_2011: 0.0,
        winter_supply_hrs_2011: 0.0,
        reported_electrified_hh_proxy: 0,
        reported_underserved_or_unserved_hh_proxy: 26,
        data_source: 'Census of India 2011 DCHB (0 hrs supply) + VIIRS DNB (0.05 nW/cm²/sr)',
        verification_state: 'UNVERIFIED',
        missing_data_notice:
          'Official boundary polygon unavailable; shown as approximate buffer. Requires Gram Sabha field verification to check if standalone solar home systems (SHS) were installed post-2018.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [82.742, 18.572],
            [82.768, 18.572],
            [82.768, 18.596],
            [82.742, 18.596],
            [82.742, 18.572],
          ],
        ],
      },
    },
  ],
};

export const DEFAULT_SETTLEMENTS_FC: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'cluster-cl-01',
        cluster_code: 'CL-01',
        name: 'Bheja Main Village Core',
        building_count: 65,
        estimated_households: 59,
        estimated_population: 260,
        st_share_pct: 79.7,
        viirs_radiance_2024_nw: 2.18,
        viirs_radiance_2023_nw: 2.24,
        viirs_radiance_2022_nw: 1.92,
        viirs_radiance_2020_nw: 1.55,
        proxy_class: 'LIKELY_ELECTRIFIED',
        verification_state: 'UNVERIFIED',
        distance_to_11kv_m: 120.0,
        terrain_effective_dist_m: 135.0,
        preliminary_mode: 'Existing LT Augmentation Check',
        evidence_summary:
          'Existing 63 kVA DT-01 mapped within 120 m; consistent nighttime radiance (2.18 nW/cm²/sr); Census 2011 reports domestic grid supply (4–5 hrs/day).',
      },
      geometry: { type: 'Point', coordinates: [82.718, 18.556] },
    },
    {
      type: 'Feature',
      properties: {
        id: 'cluster-cl-02',
        cluster_code: 'CL-02',
        name: 'Podapadar Tola (Eastern Ridge)',
        building_count: 42,
        estimated_households: 38,
        estimated_population: 168,
        st_share_pct: 84.0,
        viirs_radiance_2024_nw: 0.41,
        viirs_radiance_2023_nw: 0.44,
        viirs_radiance_2022_nw: 0.35,
        viirs_radiance_2020_nw: 0.28,
        proxy_class: 'POTENTIALLY_UNDERSERVED',
        verification_state: 'UNVERIFIED',
        distance_to_11kv_m: 1640.0,
        terrain_effective_dist_m: 1858.2,
        preliminary_mode: 'Grid Extension (1.86 km 11 kV + 25 kVA DT)',
        evidence_summary:
          'Model-Estimated Gap: 42 building footprints (~38 HH) located 1.64 km east of nearest 11 kV DT; weak nighttime radiance (0.41 nW/cm²/sr) suggests either long low-voltage tail drop or partial connection.',
      },
      geometry: { type: 'Point', coordinates: [82.738, 18.564] },
    },
    {
      type: 'Feature',
      properties: {
        id: 'cluster-cl-03',
        cluster_code: 'CL-03',
        name: 'Maliaguda PVTG Hamlet (North-East Valley)',
        building_count: 28,
        estimated_households: 26,
        estimated_population: 118,
        st_share_pct: 96.6,
        viirs_radiance_2024_nw: 0.05,
        viirs_radiance_2023_nw: 0.06,
        viirs_radiance_2022_nw: 0.04,
        viirs_radiance_2020_nw: 0.04,
        proxy_class: 'POTENTIALLY_UNSERVED',
        verification_state: 'UNVERIFIED',
        distance_to_11kv_m: 3120.0,
        terrain_effective_dist_m: 3890.5,
        preliminary_mode: 'Solar PV Mini-Grid (18.5 kWp) vs 11 kV Extension Compare',
        evidence_summary:
          'High-Priority Potential Electrification Gap: 28 footprints (~26 PVTG HH) 3.12 km from nearest 11 kV tie-in across forested ridge; Census 2011 reports 0 hrs/day power; VIIRS radiance near noise floor (0.05 nW/cm²/sr). Dark pixel alone does not rule out indoor SHS.',
      },
      geometry: { type: 'Point', coordinates: [82.748, 18.579] },
    },
    {
      type: 'Feature',
      properties: {
        id: 'cluster-cl-04',
        cluster_code: 'CL-04',
        name: 'Dispersed Forest Homesteads (North-West Ridge)',
        building_count: 8,
        estimated_households: 8,
        estimated_population: 34,
        st_share_pct: 92.0,
        viirs_radiance_2024_nw: 0.02,
        viirs_radiance_2023_nw: 0.02,
        viirs_radiance_2022_nw: 0.02,
        viirs_radiance_2020_nw: 0.02,
        proxy_class: 'UNKNOWN',
        verification_state: 'UNVERIFIED',
        distance_to_11kv_m: 2480.0,
        terrain_effective_dist_m: 3210.0,
        preliminary_mode: 'Standalone Solar Home Systems (SHS · 200 Wp/HH)',
        evidence_summary:
          'Low-density dispersed homesteads (8 structures) 2.48 km from grid; below VIIRS 450 m spatial detection threshold. Classified UNKNOWN until field survey.',
      },
      geometry: { type: 'Point', coordinates: [82.708, 18.578] },
    },
  ],
};

export const DEFAULT_ELECTRIFICATION_GAPS_FC: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'gap-zone-cl-02',
        gap_code: 'GAP-01 · Podapadar Tola Underserved Corridor',
        target_cluster: 'CL-02',
        gap_severity: 'MODERATE_UNDERSERVED_CANDIDATE',
        estimation_type: 'MODEL_ESTIMATED_GAP',
        affected_households_est: 38,
        straight_line_dist_m: 1640.0,
        terrain_weighted_dist_m: 1858.2,
        viirs_radiance_nw: 0.41,
        recommended_action:
          'Verify if LT tail-end voltage drop exceeds 6%; evaluate 1.86 km 11 kV spur + 25 kVA DT.',
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [82.718, 18.556],
          [82.738, 18.564],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'gap-zone-cl-03',
        gap_code: 'GAP-02 · Maliaguda PVTG Unserved Corridor',
        target_cluster: 'CL-03',
        gap_severity: 'HIGH_UNSERVED_CANDIDATE',
        estimation_type: 'MODEL_ESTIMATED_GAP',
        affected_households_est: 26,
        straight_line_dist_m: 3120.0,
        terrain_weighted_dist_m: 3890.5,
        viirs_radiance_nw: 0.05,
        recommended_action:
          'High-priority field survey under DA-JGUA / RDSS; compare 3.89 km 11 kV forest crossing vs 18.5 kWp Solar PV Mini-Grid.',
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [82.718, 18.556],
          [82.748, 18.579],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'gap-zone-cl-04',
        gap_code: 'GAP-03 · Dispersed Homesteads Off-Grid Corridor',
        target_cluster: 'CL-04',
        gap_severity: 'DISPERSED_OFFGRID_CANDIDATE',
        estimation_type: 'MODEL_ESTIMATED_GAP',
        affected_households_est: 8,
        straight_line_dist_m: 2480.0,
        terrain_weighted_dist_m: 3210.0,
        viirs_radiance_nw: 0.02,
        recommended_action:
          'Evaluate standalone Solar Home Systems (SHS) due to low load density (8 HH over 2.48 km).',
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [82.718, 18.556],
          [82.708, 18.578],
        ],
      },
    },
  ],
};

export const DEFAULT_PROPOSED_NETWORK_FC: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'prop-ht-cl02',
        name: 'Proposed 11 kV HT Spur: Bheja Tie-In → Podapadar DT-1',
        layer_type: 'HT_11KV_PROPOSED',
        status: 'PROPOSED_PRELIMINARY',
        voltage_kv: 11.0,
        length_m: 1858.2,
        length_km: 1.858,
        conductor: 'ACSR Weasel (30 sq.mm, 3-Phase 11 kV)',
        mean_slope_deg: 2.01,
        engineering_disclaimer:
          'PRELIMINARY PROPOSED ROUTE — NOT INSTALLED INFRASTRUCTURE. Requires field peg-marking and DISCOM load-flow check.',
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [82.709833, 18.55195],
          [82.7145, 18.5562],
          [82.7225, 18.5594],
          [82.731, 18.5618],
          [82.738, 18.564],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'prop-ht-cl03',
        name: 'Proposed 11 kV HT Feeder Candidate: Podapadar → Maliaguda PVTG',
        layer_type: 'HT_11KV_PROPOSED',
        status: 'PROPOSED_PRELIMINARY',
        voltage_kv: 11.0,
        length_m: 3890.5,
        length_km: 3.891,
        conductor: 'ACSR Weasel (30 sq.mm, 3-Phase 11 kV)',
        mean_slope_deg: 6.45,
        engineering_disclaimer:
          'PRELIMINARY PROPOSED ROUTE — Crosses steep terrain; compare against 18.5 kWp Solar PV Mini-Grid option.',
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [82.738, 18.564],
          [82.7415, 18.5685],
          [82.7448, 18.5735],
          [82.748, 18.579],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'prop-lt-cl02-mst',
        name: 'Proposed 415 V LT AB-Cable Distribution Spine (Podapadar CL-02)',
        layer_type: 'LT_415V_PROPOSED',
        status: 'PROPOSED_PRELIMINARY',
        voltage_kv: 0.415,
        length_m: 640.0,
        length_km: 0.64,
        conductor: '3x35 + 1x25 sq.mm XLPE Aerial Bunched (AB) Cable',
        estimated_voltage_drop_pct: 3.42,
        engineering_disclaimer:
          'PRELIMINARY 415 V LT MST LAYOUT — Requires pole-to-household service drop survey.',
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [82.734, 18.562],
          [82.738, 18.564],
          [82.741, 18.566],
          [82.739, 18.567],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'prop-dt-cl02-25kva',
        name: 'Proposed 25 kVA 11/0.433 kV Distribution Transformer (Podapadar DT)',
        layer_type: 'DT_PROPOSED',
        status: 'PROPOSED_PRELIMINARY',
        voltage_kv: 11.0,
        rating_kva: 25.0,
        target_cluster: 'CL-02',
        engineering_disclaimer:
          'PRELIMINARY DT PLACEMENT — Load center centroid; verify plinth flood level and road access during field survey.',
      },
      geometry: {
        type: 'Point',
        coordinates: [82.738, 18.564],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'prop-minigrid-cl03-18kwp',
        name: 'Proposed 18.5 kWp Solar PV Mini-Grid + 68 kWh LFP Battery Hub (Maliaguda CL-03)',
        layer_type: 'MINIGRID_PROPOSED',
        status: 'PROPOSED_PRELIMINARY',
        voltage_kv: 0.415,
        rating_kva: 20.0,
        target_cluster: 'CL-03',
        engineering_disclaimer:
          'PRELIMINARY OFF-GRID MINI-GRID CANDIDATE — Compare 10-year NPC against 3.89 km 11 kV grid extension.',
      },
      geometry: {
        type: 'Point',
        coordinates: [82.748, 18.579],
      },
    },
  ],
};

/** Compute Haversine geodesic distance in meters between two `[lon, lat]` points */
export function haversineDistanceMeters(
  p1: [number, number],
  p2: [number, number],
): number {
  const R = 6371008.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180.0;
  const dLat = toRad(p2[1] - p1[1]);
  const dLon = toRad(p2[0] - p1[0]);
  const lat1 = toRad(p1[1]);
  const lat2 = toRad(p2[1]);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Compute total polyline length in meters */
export function computePolylineLengthMeters(pts: Array<[number, number]>): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += haversineDistanceMeters(pts[i - 1]!, pts[i]!);
  }
  return total;
}

/** Compute approximate polygon area in square meters using local equirectangular projection */
export function computePolygonAreaM2(pts: Array<[number, number]>): number {
  if (pts.length < 3) return 0;
  const R = 6371008.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180.0;
  const meanLatRad =
    toRad(pts.reduce((acc, p) => acc + p[1], 0) / pts.length);
  const proj = pts.map(([lon, lat]) => [
    R * toRad(lon) * Math.cos(meanLatRad),
    R * toRad(lat),
  ]);
  let area2 = 0;
  for (let i = 0; i < proj.length; i++) {
    const j = (i + 1) % proj.length;
    area2 += proj[i]![0]! * proj[j]![1]! - proj[j]![0]! * proj[i]![1]!;
  }
  return Math.abs(area2) / 2.0;
}

