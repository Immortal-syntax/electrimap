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

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from '../pages/LoginPage';
import { NewProjectWizardPage } from '../pages/NewProjectWizardPage';
import { LandingPage } from '../pages/LandingPage';
import { useSessionStore } from '../stores/sessionStore';
import { AppShell } from '../components/layout/AppShell';
import { ProjectOverviewDashboard } from '../components/workspace/ProjectOverviewDashboard';
import {
  DEMO_PROJECT_ID,
  WORKSPACE_SECTIONS,
  normalizeWorkspaceSection,
  resolveRouteContext,
} from '../components/layout/navigationConfig';
import { ProvenanceChip } from '../components/ui/ProvenanceChip';
import { JobProgress } from '../components/ui/JobProgress';
import { DataManagementPanel } from '../components/workspace/DataManagementPanel';
import { SettlementAssessmentPanel } from '../components/workspace/SettlementAssessmentPanel';
import { InfrastructureAndDemandPanel } from '../components/workspace/InfrastructureAndDemandPanel';
import { NetworkEngineeringPanel } from '../components/workspace/NetworkEngineeringPanel';
import {
  INFRASTRUCTURE_CATEGORY_META,
  resolveInfraCategoryMeta,
} from '../components/map/symbology';
import { buildInspectedFeatureFromMapProperties } from '../components/map/GisFeatureInspectorDrawer';
import { CostAndScenarioComparisonPanel } from '../components/workspace/CostAndScenarioComparisonPanel';
import { DprExportCenterPanel } from '../components/workspace/DprExportCenterPanel';
import { MapCanvas } from '../components/map/MapCanvas';
import {
  MapSpikePreview,
  generateSyntheticPointsGeoJson,
} from '../components/map/MapSpikePreview';

interface MockMapInstance {
  options: Record<string, unknown>;
  addSource: ReturnType<typeof vi.fn>;
  addLayer: ReturnType<typeof vi.fn>;
  setPaintProperty: ReturnType<typeof vi.fn>;
  setLayoutProperty: ReturnType<typeof vi.fn>;
  setStyle: ReturnType<typeof vi.fn>;
  getSource: (
    id: string,
  ) => { setData: ReturnType<typeof vi.fn>; updateImage: ReturnType<typeof vi.fn> } | undefined;
  sourceData: Map<string, unknown>;
  emit: (event: string, payload?: unknown) => void;
}

const mockMapInstances: MockMapInstance[] = [];

vi.mock('maplibre-gl', () => {
  class MockMap {
    options: Record<string, unknown>;
    sourceData = new Map<string, unknown>();
    private sources = new Map<
      string,
      { setData: ReturnType<typeof vi.fn>; updateImage: ReturnType<typeof vi.fn> }
    >();
    private layers = new Set<string>();
    private listeners = new Map<string, Array<(payload?: unknown) => void>>();

    constructor(options: Record<string, unknown> = {}) {
      this.options = options;
      mockMapInstances.push(this as unknown as MockMapInstance);
    }
    emit = (event: string, payload?: unknown) => {
      const cbs = this.listeners.get(event) ?? [];
      for (const cb of cbs) {
        cb(payload);
      }
    };
    on = vi.fn((event: string, cb: (payload?: unknown) => void) => {
      const list = this.listeners.get(event) ?? [];
      list.push(cb);
      this.listeners.set(event, list);
      if (event === 'load' || event === 'style.load') {
        cb();
      }
    });
    once = vi.fn((event: string, cb: (payload?: unknown) => void) => {
      if (event === 'load' || event === 'style.load') {
        cb();
      } else {
        const list = this.listeners.get(event) ?? [];
        list.push(cb);
        this.listeners.set(event, list);
      }
    });
    off = vi.fn();
    addControl = vi.fn();
    resize = vi.fn();
    remove = vi.fn();
    getZoom = vi.fn(() => 13.4);
    getStyle = vi.fn(() => ({ version: 8, sources: {}, layers: [] }));
    isStyleLoaded = vi.fn(() => true);
    setStyle = vi.fn();
    fitBounds = vi.fn();
    flyTo = vi.fn();
    addSource = vi.fn((id: string, spec?: { data?: unknown }) => {
      if (spec && 'data' in spec) {
        this.sourceData.set(id, spec.data);
      } else {
        this.sourceData.set(id, spec);
      }
      const setDataMock = vi.fn((nextData: unknown) => {
        this.sourceData.set(id, nextData);
      });
      this.sources.set(id, { setData: setDataMock, updateImage: vi.fn() });
    });
    getSource = vi.fn((id: string) => this.sources.get(id));
    removeSource = vi.fn((id: string) => {
      this.sources.delete(id);
      this.sourceData.delete(id);
    });
    addLayer = vi.fn((spec: { id: string }) => {
      this.layers.add(spec.id);
    });
    getLayer = vi.fn((id: string) => (this.layers.has(id) ? { id } : undefined));
    removeLayer = vi.fn((id: string) => {
      this.layers.delete(id);
    });
    setPaintProperty = vi.fn();
    setLayoutProperty = vi.fn();
    triggerRepaint = vi.fn();
    queryRenderedFeatures = vi.fn(() => []);
  }

  return {
    Map: MockMap,
    NavigationControl: vi.fn(),
    ScaleControl: vi.fn(),
    AttributionControl: vi.fn(),
    setWorkerUrl: vi.fn(),
  };
});

describe('Milestone M1, M2, M3, M4, M5, M6 & M7 Frontend Components', () => {
  it('renders LoginPage with Survey Sheet header and default planner credentials button', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Sign in to ElectriMap DPR/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Official \/ Planner Email/i)).toHaveValue(
      'planner@electrimap.in',
    );
    expect(
      screen.getByRole('button', { name: /Sign In to Workbench/i }),
    ).toBeInTheDocument();
  });

  it('renders ProvenanceChip with licence, resolution, and expandable attribution', () => {
    render(
      <ProvenanceChip
        cacheKey="dem_ref_pack"
        dataset={{
          id: 'ds-1',
          key: 'copernicus_dem_glo30',
          name: 'Copernicus DEM GLO-30',
          provider: 'ESA / Copernicus',
          url: 'https://spacedata.copernicus.eu',
          licence: 'Copernicus Free & Open',
          licence_url: null,
          attribution_text: 'Contains Copernicus DEM data (2023)',
          spatial_resolution: '30 m',
          temporal_coverage: '2023 Release',
          version: '2023.1',
          is_non_commercial: false,
          notes: '30 m posting may smooth narrow micro-gullies.',
        }}
      />,
    );

    expect(screen.getByText(/ESA \/ Copernicus/i)).toBeInTheDocument();
    expect(screen.getByText(/30 m/i)).toBeInTheDocument();
    expect(screen.getByText('REFERENCE_PACK')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Attribution/i }));
    expect(screen.getByText(/Contains Copernicus DEM data/i)).toBeInTheDocument();
    expect(screen.getByText(/30 m posting may smooth narrow micro-gullies/i)).toBeInTheDocument();
  });

  it('renders JobProgress and invokes onCancel for active jobs', () => {
    const onCancel = vi.fn();
    render(
      <JobProgress
        onCancel={onCancel}
        job={{
          id: 'job-123',
          project_id: 'proj-1',
          job_type: 'ACQUIRE_PROJECT_DATA',
          status: 'RUNNING',
          progress: 60,
          stage: 'Computing DEM slope & hillshade in EPSG:32644...',
          params: {},
          result: null,
          error: null,
          attempts: 1,
          created_by: 'usr-1',
          created_at: '2026-11-06T00:00:00Z',
          updated_at: '2026-11-06T00:00:01Z',
          finished_at: null,
        }}
      />,
    );

    expect(screen.getByText('ACQUIRE_PROJECT_DATA')).toBeInTheDocument();
    expect(screen.getByText('RUNNING')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText(/Computing DEM slope/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cancel Job/i }));
    expect(onCancel).toHaveBeenCalledWith('job-123');
  });

  it('renders DataManagementPanel with layer cards and raster overlay controls', () => {
    const onToggleVector = vi.fn();
    const onChangeRaster = vi.fn();
    const onChangeOpacity = vi.fn();

    render(
      <DataManagementPanel
        projectId="00000000-0000-4000-8000-000000000001"
        layers={[
          {
            id: 'lyr-1',
            project_id: '00000000-0000-4000-8000-000000000001',
            layer_key: 'buildings',
            status: 'READY',
            retrieved_at: '2026-11-06T00:00:00Z',
            feature_count: 143,
            bbox: [82.71, 18.55, 82.75, 18.58],
            summary_metrics: {
              residential_count: 135,
              non_residential_count: 3,
              outbuilding_count: 5,
              noise_excluded_count: 2,
            },
            error_message: null,
            cache_key: 'bld_1234',
            dataset: {
              id: 'ds-bld',
              key: 'open_buildings_v3',
              name: 'Google-Microsoft-OSM Open Buildings',
              provider: 'VIDA / Google / Microsoft / OSM',
              url: 'https://beta.source.coop/vida/google-microsoft-open-buildings',
              licence: 'CC BY 4.0 / ODbL',
              licence_url: null,
              attribution_text: 'Contains Google & Microsoft Open Buildings.',
              spatial_resolution: '0.5 m',
              temporal_coverage: '2020–2023',
              version: 'v3',
              is_non_commercial: false,
              notes: null,
            },
          },
        ]}
        visibleVectorLayers={{ buildings: true }}
        onToggleVectorLayer={onToggleVector}
        activeRasterOverlay="none"
        onChangeRasterOverlay={onChangeRaster}
        rasterOpacity={0.65}
        onChangeRasterOpacity={onChangeOpacity}
        onLayersUpdated={async () => {}}
      />,
    );

    expect(
      screen.getByText(/Building Footprints \(Google-MS-OSM Open Buildings\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Residential: 135/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Copernicus DEM Slope/i }));
    expect(onChangeRaster).toHaveBeenCalledWith('dem_slope');
  });

  it('renders SettlementAssessmentPanel with Census 2011 reconciliation, two-axis badges, and verification ledger', () => {
    const onSelectCluster = vi.fn();

    render(
      <SettlementAssessmentPanel
        projectId="00000000-0000-4000-8000-000000000001"
        selectedClusterId="cl-1"
        onSelectCluster={onSelectCluster}
        onSettlementsUpdated={async () => {}}
        settlements={{
          project_id: '00000000-0000-4000-8000-000000000001',
          cluster_run_id: 'run-1',
          params: { eps_m: 150, min_samples: 5, household_alpha: 0.9 },
          verification_coverage_pct: 42.5,
          census_reconciliation: {
            census2011_code: '428914',
            village_name: 'Bheja',
            census_2011_households: 128,
            projected_base_year_households: 158,
            satellite_detected_buildings: 143,
            satellite_residential_buildings: 135,
            satellite_estimated_households: 122,
            delta_households: -36,
            delta_pct: -22.8,
            divergence_exceeds_30pct: false,
            reconciliation_note:
              'Satellite household estimate (122 HH) is within ±30% of projected Census baseline (158 HH).',
          },
          geojson: { type: 'FeatureCollection', features: [] },
          items: [
            {
              id: 'cl-1',
              cluster_run_id: 'run-1',
              project_id: '00000000-0000-4000-8000-000000000001',
              label: 'CL-01',
              name: 'Bheja Main Village Core',
              is_isolated_group: false,
              n_detected: 65,
              n_residential: 62,
              n_non_residential: 2,
              est_households: 56,
              census_hh_ref: 128,
              proxy_class: 'LIKELY_ELECTRIFIED',
              proxy_confidence: 'MEDIUM',
              verification_state: 'FIELD_VERIFIED',
              verified_class: 'LIKELY_ELECTRIFIED',
              d_infra_m: null,
              d_road_m: 85.0,
              slope_mean_deg: 6.4,
              canopy_share: 0.18,
              evidence: {
                nl_lightscore: 0.82,
                rationale: 'High nightlight radiance and road adjacency.',
              },
              centroid_lon: 82.732,
              centroid_lat: 18.567,
              geojson_geometry: { type: 'Polygon', coordinates: [] },
              updated_at: '2026-11-06T00:00:00Z',
            },
          ],
        }}
        ledger={{
          project_id: '00000000-0000-4000-8000-000000000001',
          total_clusters: 2,
          verified_clusters: 1,
          total_households: 122,
          verified_households: 56,
          verification_coverage_pct: 42.5,
          records: [
            {
              id: 'ver-101',
              project_id: '00000000-0000-4000-8000-000000000001',
              target_type: 'CLUSTER',
              target_id: 'cl-1',
              cluster_label: 'CL-01',
              attribute: 'cluster_verification',
              previous_value: { verification_state: 'UNVERIFIED' },
              new_value: {
                verification_state: 'FIELD_VERIFIED',
                verified_class: 'LIKELY_ELECTRIFIED',
              },
              evidence_type: 'GRAM_SABHA_RESOLUTION',
              verifier_name: 'Er. R. K. Mohanty (AE TPSODL)',
              observed_on: '2026-03-14',
              note: 'Verified 11kV transformer & LT service mains in core village.',
              import_batch_id: null,
              reverses_id: null,
              created_by: 'usr-1',
              created_at: '2026-11-06T00:00:00Z',
            },
          ],
          imports: [],
        }}
      />,
    );

    expect(
      screen.getByText(/Census 2011 Household Reconciliation/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/RECONCILED WITHIN ±30%/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/Bheja Main Village Core/i).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByText(/Verified 11kV transformer & LT service mains/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: /Download Preliminary DPR Skeleton/i,
      }),
    ).toHaveAttribute(
      'href',
      '/api/v1/projects/00000000-0000-4000-8000-000000000001/exports/preliminary-settlement-pdf',
    );
  });

  it('renders InfrastructureAndDemandPanel with UNSET warning, terrain gap matrix, assumptions register, and 7-category demand table', () => {
    const onToggleTieIn = vi.fn();

    render(
      <InfrastructureAndDemandPanel
        projectId="00000000-0000-4000-8000-000000000001"
        placeTieInModeActive={false}
        onTogglePlaceTieInMode={onToggleTieIn}
        onInfrastructureAndDemandUpdated={async () => {}}
        infrastructure={{
          project_id: '00000000-0000-4000-8000-000000000001',
          has_existing_infra: false,
          items: [],
          geojson: { type: 'FeatureCollection', features: [] },
        }}
        gapAnalysis={{
          project_id: '00000000-0000-4000-8000-000000000001',
          has_existing_infra: false,
          infra_assets_count: 0,
          assumed_assets_count: 0,
          verified_assets_count: 0,
          mean_d_straight_m: null,
          mean_d_terrain_m: null,
          max_d_terrain_m: null,
          grid_extension_candidates: 0,
          minigrid_candidates: 0,
          shs_candidates: 0,
          augmentation_candidates: 0,
          corridors_geojson: { type: 'FeatureCollection', features: [] },
          clusters: [
            {
              cluster_id: 'cl-1',
              cluster_label: 'CL-01',
              cluster_name: 'Bheja Main Village Core',
              est_households: 56,
              effective_electrification_class: 'POTENTIALLY_UNSERVED',
              nearest_asset_id: null,
              nearest_asset_name: null,
              nearest_asset_type: null,
              nearest_asset_provenance: null,
              d_straight_m: null,
              d_terrain_m: null,
              terrain_penalty_factor: 1.24,
              slope_mean_deg: 6.4,
              canopy_share: 0.18,
              water_crossings_count: 1,
              road_distance_m: 85.0,
              recommended_modality: 'UNSET_INFRA_REQUIRED',
              rationale: 'No existing electrical infrastructure uploaded or placed.',
              corridor_geojson: null,
            },
          ],
        }}
        settings={{
          project_id: '00000000-0000-4000-8000-000000000001',
          user_edited_count: 0,
          items: [
            {
              id: 'set-1',
              project_id: '00000000-0000-4000-8000-000000000001',
              key: 'bpl_connected_load_w',
              category: 'DOMESTIC',
              label: 'BPL Household Connected Load',
              value: 250,
              default_value: 250,
              min_value: 50,
              max_value: 2000,
              unit: 'W/HH',
              quality_tag: 'ESTIMATED',
              citation: 'REC DDUGJY / Saubhagya Normative BPL Load',
              is_user_edited: false,
              override_note: null,
              updated_at: '2026-11-06T00:00:00Z',
            },
          ],
        }}
        demand={{
          project_id: '00000000-0000-4000-8000-000000000001',
          total_households: 122,
          total_connected_kw: 84.5,
          peak_kw_base: 38.2,
          peak_kva_base: 44.94,
          energy_kwh_day_base: 295.4,
          annual_energy_mwh_base: 107.82,
          horizon_years: 10,
          annual_growth_rate: 0.045,
          peak_kw_horizon: 59.32,
          peak_kva_horizon: 69.79,
          energy_kwh_day_horizon: 458.7,
          annual_energy_mwh_horizon: 167.44,
          category_totals: [
            {
              category: 'DOMESTIC_BPL',
              label: 'Domestic BPL Households (Kutcha / Tribal)',
              consumer_count: 79,
              connected_kw: 19.75,
              demand_factor: 0.6,
              max_demand_kw: 11.85,
              daily_hours: 5.0,
              energy_kwh_day: 59.25,
              annual_energy_mwh: 21.63,
            },
          ],
          clusters: [],
        }}
      />,
    );

    expect(
      screen.getByText(/Existing Electrical Infrastructure UNSET/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/UNSET_INFRA_REQUIRED/i)).toBeInTheDocument();
    expect(screen.getByText(/BPL Household Connected Load/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Domestic BPL Households \(Kutcha \/ Tribal\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/69.79 kVA/i)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /\+ Place Assumed 11 kV Tie-In on Map/i }),
    );
    expect(onToggleTieIn).toHaveBeenCalledTimes(1);
  });

  it('renders NetworkEngineeringPanel with scenario KPIs, voltage drop compliance, SLD schematic, and REC/IS/CEA constants drawer', () => {
    const mockScenario = {
      id: 'scen-1',
      project_id: '00000000-0000-4000-8000-000000000001',
      scenario_key: 'HYBRID_OPTIMAL',
      name: 'Hybrid Least-Cost Optimal (Grid + Solar Mini-Grid + SHS)',
      is_active: true,
      requires_tie_in_warning: false,
      total_ht_length_m: 1420.0,
      total_lt_length_m: 685.0,
      total_dt_count: 1,
      total_dt_capacity_kva: 63.0,
      total_ht_poles: 23,
      total_lt_poles: 17,
      max_ht_vdrop_pct: 1.42,
      max_lt_vdrop_pct: 3.18,
      vdrop_compliance_ok: true,
      total_loss_mwh_yr: 2.145,
      total_solar_kwp: 45.0,
      total_bess_kwh: 150.0,
      total_shs_kits: 8,
      network_geojson: { type: 'FeatureCollection' as const, features: [] },
      updated_at: '2026-11-06T00:00:00Z',
      clusters: [
        {
          id: 'lay-1',
          scenario_id: 'scen-1',
          project_id: '00000000-0000-4000-8000-000000000001',
          cluster_id: 'cl-1',
          cluster_label: 'CL-01',
          cluster_name: 'Bheja Main Village Core',
          est_households: 56,
          modality: 'GRID_EXTENSION',
          is_manual_override: false,
          requires_tie_in: false,
          peak_kw_horizon: 32.3,
          peak_kva_horizon: 38.0,
          energy_kwh_day_horizon: 220.0,
          annual_energy_mwh_horizon: 80.3,
          dt_count: 1,
          total_dt_rating_kva: 63.0,
          max_dt_loading_pct: 60.3,
          placed_dts: [],
          ht_length_m: 1420.0,
          ht_poles_count: 23,
          lt_3ph_length_m: 410.0,
          lt_1ph_length_m: 275.0,
          lt_total_length_m: 685.0,
          max_lt_branch_m: 240.0,
          lt_poles_count: 17,
          ht_current_a: 1.99,
          ht_drop_v: 156.2,
          ht_drop_pct: 1.42,
          ht_vdrop_compliant: true,
          lt_current_a: 52.87,
          lt_drop_v: 13.2,
          lt_drop_pct: 3.18,
          lt_vdrop_compliant: true,
          overall_vdrop_compliant: true,
          load_factor: 0.284,
          load_loss_factor: 0.142,
          ht_line_loss_kwh_yr: 85.0,
          lt_line_loss_kwh_yr: 410.0,
          dt_no_load_loss_kwh_yr: 1401.6,
          dt_copper_loss_kwh_yr: 248.4,
          total_loss_mwh_yr: 2.145,
          technical_loss_pct: 2.6,
          solar_pv_kwp: 0.0,
          bess_capacity_kwh: 0.0,
          inverter_kva: 0.0,
          shs_kits_count: 0,
          engineering_notes: ['11 kV HT feeder routed via MCP_Geometric.'],
          updated_at: '2026-11-06T00:00:00Z',
        },
      ],
    };

    render(
      <NetworkEngineeringPanel
        projectId="00000000-0000-4000-8000-000000000001"
        onScenariosUpdated={async () => {}}
        scenariosState={{
          project_id: '00000000-0000-4000-8000-000000000001',
          active_scenario_key: 'HYBRID_OPTIMAL',
          active_scenario: mockScenario,
          scenarios: [mockScenario],
        }}
        constants={{
          count: 1,
          items: [
            {
              key: 'ht_11kv_r_ohm_per_km',
              value: 0.5426,
              unit: 'ohm/km',
              description: '11 kV 3-phase overhead ACSR Rabbit AC resistance at 20°C',
              citation: 'IS 398 (Part 2):1996 / REC F-1',
              status: 'SOURCE_VERIFIED',
            },
          ],
        }}
      />,
    );

    expect(screen.getAllByText(/1420 m/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/CEA Compliant/i)).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /Preliminary Single-Line Diagram/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /REC\/IS\/CEA Constants/i }));
    expect(screen.getByText('ht_11kv_r_ohm_per_km')).toBeInTheDocument();
  });

  it('renders CostAndScenarioComparisonPanel with BOQ table, 4-scenario comparison, and UNSET export-block alert', async () => {
    const onPinScenario = vi.fn(async () => {});

    render(
      <CostAndScenarioComparisonPanel
        projectId="00000000-0000-4000-8000-000000000001"
        onUpdateRateItem={async () => {}}
        onResetRates={async () => {}}
        onImportRatesCsv={async () => ({
          is_valid: true,
          imported_count: 1,
          unset_count: 0,
          unset_item_codes: [],
          errors: [],
          rates: null,
        })}
        onPinScenario={onPinScenario}
        rates={{
          project_id: '00000000-0000-4000-8000-000000000001',
          template_key: 'ODISHA_OPTCL_TPSODL_REC_2025',
          template_name: 'Odisha OPTCL / TPSODL & MNRE Reference Schedule of Rates (FY 2024-25)',
          total_items: 18,
          unset_count: 1,
          unset_item_codes: ['HT-COND-ACSR-50'],
          user_edited_count: 1,
          items: [
            {
              id: 'rate-1',
              project_id: '00000000-0000-4000-8000-000000000001',
              template_key: 'ODISHA_OPTCL_TPSODL_REC_2025',
              template_name: 'Odisha OPTCL / TPSODL & MNRE Reference Schedule of Rates (FY 2024-25)',
              item_code: 'HT-COND-ACSR-50',
              description: '11 kV 3-Phase Overhead Line with ACSR Rabbit Conductor',
              category: 'HT_11KV',
              unit: 'km',
              rate_inr: null,
              source_type: 'UNSET',
              citation: 'OPTCL / Odisha DISCOM Unified Schedule of Rates',
              source_year: 2025,
              is_user_edited: true,
              updated_at: '2026-11-07T00:00:00Z',
            },
          ],
        }}
        comparison={{
          project_id: '00000000-0000-4000-8000-000000000001',
          active_scenario_id: 'scen-hybrid',
          active_scenario_key: 'HYBRID_OPTIMAL',
          discount_rate: 0.08,
          horizon_years: 10,
          has_unset_rates: true,
          unset_item_codes: ['HT-COND-ACSR-50'],
          export_blocked_reason:
            'DPR export is blocked because 1 required Schedule of Rates item(s) are UNSET: HT-COND-ACSR-50.',
          scenarios: [
            {
              scenario_id: 'scen-hybrid',
              scenario_key: 'HYBRID_OPTIMAL',
              scenario_name: 'Hybrid Least-Cost Optimal (Grid + Solar Mini-Grid + SHS)',
              is_active_baseline: true,
              requires_tie_in_warning: false,
              vdrop_compliance_ok: true,
              total_households_served: 122,
              annual_delivered_energy_mwh: 167.44,
              modality_counts: { GRID_AUGMENTATION: 1, SOLAR_MINIGRID: 1 },
              base_equipment_inr: 3200000,
              terrain_premium_inr: 400000,
              gst_amount_inr: 648000,
              contingency_amount_inr: 108000,
              pmc_overhead_amount_inr: 180000,
              total_capex_inr: 4536000,
              total_capex_lakhs: 45.36,
              capital_subsidy_inr: 4082400,
              net_utility_capex_inr: 453600,
              annual_om_inr: 125000,
              annual_energy_purchase_inr: 210000,
              npc_inr: 6980000,
              npc_lakhs: 69.8,
              lcoe_inr_kwh: 6.21,
              cost_per_household_inr: 37180,
              npc_per_household_inr: 57213,
              avoided_co2_tonnes_yr: 42.5,
              has_unset_rates: true,
              unset_item_codes: ['HT-COND-ACSR-50'],
            },
            {
              scenario_id: 'scen-mg',
              scenario_key: 'MINIGRID_PRIORITY',
              scenario_name: 'Decentralized Solar PV + LiFePO4 Mini-Grid Priority',
              is_active_baseline: false,
              requires_tie_in_warning: false,
              vdrop_compliance_ok: true,
              total_households_served: 122,
              annual_delivered_energy_mwh: 167.44,
              modality_counts: { SOLAR_MINIGRID: 2 },
              base_equipment_inr: 4100000,
              terrain_premium_inr: 500000,
              gst_amount_inr: 828000,
              contingency_amount_inr: 138000,
              pmc_overhead_amount_inr: 230000,
              total_capex_inr: 5796000,
              total_capex_lakhs: 57.96,
              capital_subsidy_inr: 5216400,
              net_utility_capex_inr: 579600,
              annual_om_inr: 173880,
              annual_energy_purchase_inr: 0,
              npc_inr: 7650000,
              npc_lakhs: 76.5,
              lcoe_inr_kwh: 6.81,
              cost_per_household_inr: 47508,
              npc_per_household_inr: 62705,
              avoided_co2_tonnes_yr: 85.2,
              has_unset_rates: false,
              unset_item_codes: [],
            },
          ],
          habitation_comparisons: [
            {
              cluster_id: 'cl-1',
              cluster_label: 'C-001',
              cluster_name: 'Bheja Main Core',
              est_households: 60,
              annual_energy_mwh_horizon: 80.3,
              active_modality: 'SOLAR_MINIGRID',
              least_cost_npc_modality: 'SOLAR_MINIGRID',
              grid_capex_inr: 2900000,
              grid_npc_inr: 4100000,
              grid_lcoe_inr_kwh: 7.6,
              grid_requires_tie_in: false,
              minigrid_capex_inr: 2600000,
              minigrid_npc_inr: 3500000,
              minigrid_lcoe_inr_kwh: 6.49,
              shs_capex_inr: 2200000,
              shs_npc_inr: 3900000,
              shs_lcoe_inr_kwh: 7.23,
              rationale: 'Solar PV + LiFePO4 Mini-Grid avoids steep terrain 11 kV feeder costs.',
            },
          ],
          active_scenario_boq: {
            project_id: '00000000-0000-4000-8000-000000000001',
            scenario_id: 'scen-hybrid',
            scenario_key: 'HYBRID_OPTIMAL',
            scenario_name: 'Hybrid Least-Cost Optimal (Grid + Solar Mini-Grid + SHS)',
            is_active_baseline: true,
            discount_rate: 0.08,
            horizon_years: 10,
            gst_pct: 18.0,
            contingency_pct: 3.0,
            pmc_overhead_pct: 5.0,
            capital_subsidy_pct: 90.0,
            base_equipment_inr: 3200000,
            terrain_premium_inr: 400000,
            subtotal_supply_erection_inr: 3600000,
            gst_amount_inr: 648000,
            contingency_amount_inr: 108000,
            pmc_overhead_amount_inr: 180000,
            total_capex_inr: 4536000,
            total_capex_lakhs: 45.36,
            has_unset_rates: true,
            unset_item_codes: ['HT-COND-ACSR-50'],
            export_blocked_reason:
              'DPR export is blocked because 1 required Schedule of Rates item(s) are UNSET: HT-COND-ACSR-50.',
            economics: {
              modality: 'HYBRID_OPTIMAL',
              capex_inr: 4536000,
              capex_lakhs: 45.36,
              capital_subsidy_inr: 4082400,
              net_utility_capex_inr: 453600,
              annual_om_inr: 125000,
              annual_energy_purchase_inr: 210000,
              pv_om_inr: 838760,
              pv_energy_purchase_inr: 1409117,
              pv_battery_replacement_inr: 196123,
              npc_inr: 6980000,
              npc_lakhs: 69.8,
              annual_delivered_energy_kwh: 167440,
              pv_delivered_energy_kwh: 1123536,
              lcoe_inr_kwh: 6.21,
              annualized_cost_inr_yr: 1040222,
              cost_per_household_inr: 37180,
              npc_per_household_inr: 57213,
              avoided_co2_tonnes_yr: 42.5,
            },
            aggregated_lines: [
              {
                cluster_id: null,
                cluster_label: 'ALL',
                item_code: 'HT-COND-ACSR-50',
                description: '11 kV 3-Phase Overhead Line with ACSR Rabbit Conductor',
                category: 'HT_11KV',
                unit: 'km',
                quantity: 1.85,
                quantity_basis: 'Aggregated across C-001',
                rate_inr: null,
                rate_source_type: 'UNSET',
                citation: 'OPTCL / Odisha DISCOM Unified Schedule of Rates',
                is_unset: true,
                amount_inr: 0,
              },
            ],
            cluster_breakdowns: [],
          },
        }}
      />,
    );

    expect(
      screen.getByText(/DPR Export Blocked — UNSET Unit Rates Detected/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/HT-COND-ACSR-50/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/₹45.36 L/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /2\. Compare 4 Scenarios/i }));
    expect(screen.getByText(/MINIGRID_PRIORITY/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Pin as Baseline/i }));
    await waitFor(() => {
      expect(onPinScenario).toHaveBeenCalledWith('scen-mg');
    });
  });

  it('renders DprExportCenterPanel with pre-flight checklist, 24-section index, and SHA-256 export audit log', () => {
    render(
      <DprExportCenterPanel
        projectId="00000000-0000-4000-8000-000000000001"
        onRefreshAuditAndLogs={async () => {}}
        preflight={{
          project_id: '00000000-0000-4000-8000-000000000001',
          project_version: 3,
          active_scenario_key: 'HYBRID_OPTIMAL',
          can_export: true,
          hard_blockers_failed: 0,
          soft_warnings_count: 1,
          requires_not_field_verified_watermark: true,
          watermark_text: 'PRELIMINARY ENGINEERING — NOT FIELD VERIFIED',
          snapshot_hash: 'a1b2c3d4e5f60123456789abcdefa1b2c3d4e5f60123456789abcdef01234567',
          checks: [
            {
              check_code: 'NO_UNSET_BOQ_RATES',
              title: 'All Required BOQ Schedule of Rates Populated',
              category: 'HARD_BLOCKER',
              status: 'PASS',
              detail: 'All active BOQ line items have non-null unit rates.',
              remediation: 'None required.',
            },
            {
              check_code: 'AXIS_2_FIELD_VERIFICATION',
              title: 'Axis-2 Field / Utility Verification Coverage',
              category: 'SOFT_WARNING',
              status: 'WARN',
              detail: 'Verification coverage is 48.0% (< 100%).',
              remediation: 'Record Gram Sabha / DISCOM feeder ledger verifications.',
            },
          ],
          sections: Array.from({ length: 24 }, (_, idx) => ({
            section_number: idx + 1,
            section_key: `SEC_${String(idx + 1).padStart(2, '0')}`,
            title: `DPR Section ${idx + 1} Title`,
            group: 'Part I — Project Profile',
            is_populated: idx !== 4,
            data_status_note:
              idx === 4
                ? 'No data available — reason: Zero Axis-2 field verification records.'
                : 'Populated with traceable project & engineering records.',
          })),
        }}
        exportLog={{
          project_id: '00000000-0000-4000-8000-000000000001',
          total_exports: 1,
          items: [
            {
              id: 'exp-1',
              project_id: '00000000-0000-4000-8000-000000000001',
              scenario_id: 'scen-1',
              scenario_key: 'HYBRID_OPTIMAL',
              export_kind: 'PDF_DPR_24',
              filename: 'electrimap_dpr_24sec_00000000_hybrid_optimal.pdf',
              mime_type: 'application/pdf',
              file_size_bytes: 58420,
              file_sha256: '9f8e7d6c5b4a32109f8e7d6c5b4a32109f8e7d6c5b4a32109f8e7d6c5b4a3210',
              snapshot_hash: 'a1b2c3d4e5f60123456789abcdefa1b2c3d4e5f60123456789abcdef01234567',
              preflight_passed: true,
              preflight_warnings_count: 1,
              created_by: 'usr-1',
              notes: 'Complete 24-Section Preliminary DPR',
              created_at: '2026-11-07T12:00:00Z',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText(/READY TO EXPORT/i)).toBeInTheDocument();
    expect(screen.getByText(/24\/24/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Download 24-Section DPR \(\.pdf\)/i }),
    ).toHaveAttribute(
      'href',
      '/api/v1/projects/00000000-0000-4000-8000-000000000001/exports/dpr-pdf',
    );
    expect(
      screen.getByRole('link', { name: /Download Formula BOQ \(\.xlsx\)/i }),
    ).toHaveAttribute(
      'href',
      '/api/v1/projects/00000000-0000-4000-8000-000000000001/exports/boq-xlsx',
    );
    expect(
      screen.getByRole('link', { name: /Download Cleaned GIS Package \(\.zip\)/i }),
    ).toHaveAttribute(
      'href',
      '/api/v1/projects/00000000-0000-4000-8000-000000000001/exports/gis-package',
    );

    // Switch to 24-Section DPR Compilation Index tab
    fireEvent.click(screen.getByRole('button', { name: /2\. 24-Section DPR Compilation Index/i }));
    expect(
      screen.getByText(/No data available — reason: Zero Axis-2 field verification records/i),
    ).toBeInTheDocument();

    // Switch to SHA-256 Export Audit Log tab
    fireEvent.click(screen.getByRole('button', { name: /3\. Cryptographic SHA-256 Export Audit Log/i }));
    expect(
      screen.getByText(/electrimap_dpr_24sec_00000000_hybrid_optimal\.pdf/i),
    ).toBeInTheDocument();
  });

  it('renders AppShell with WCAG 2.1 AA skip-to-main-content link, aria-current page state, and main landmark', () => {
    render(
      <MemoryRouter initialEntries={['/projects']}>
        <AppShell>
          <div>Workbench Inner Content</div>
        </AppShell>
      </MemoryRouter>,
    );

    const skipLink = screen.getByRole('link', { name: /Skip to main content/i });
    expect(skipLink).toHaveAttribute('href', '#main-content');

    const portfolioLink = screen.getByRole('link', { name: /Projects Portfolio/i });
    expect(portfolioLink).toHaveAttribute('aria-current', 'page');

    const mainLandmark = screen.getByRole('main', { name: /Main engineering workbench/i });
    expect(mainLandmark).toHaveAttribute('id', 'main-content');
    expect(mainLandmark).toHaveAttribute('tabIndex', '-1');
  });

  it('supports Phase 2 sidebar navigation, breadcrumbs, desktop collapse toggle, and mobile navigation drawer across all destinations', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={[`/projects/${DEMO_PROJECT_ID}/settlements`]}>
        <AppShell>
          <div>Settlements Stage Content</div>
        </AppShell>
      </MemoryRouter>,
    );

    // Verify Breadcrumb navigation landmark and trail
    const breadcrumbNav = screen.getByRole('navigation', { name: /Breadcrumb/i });
    expect(breadcrumbNav).toBeInTheDocument();
    expect(screen.getByText(/Koraput — Bheja Reference Study/i)).toBeInTheDocument();

    // Verify active state on the current workflow stage in the sidebar
    const activeSettlementsLink = screen.getByRole('link', {
      name: /2\. Villages & Habitations/i,
    });
    expect(activeSettlementsLink).toHaveAttribute('aria-current', 'page');

    // Verify all 8 workflow destinations exist in the sidebar
    for (const sec of WORKSPACE_SECTIONS) {
      expect(
        screen.getByRole('link', { name: new RegExp(sec.shortLabel.replace('.', '\\.'), 'i') }),
      ).toBeInTheDocument();
    }

    // Verify desktop sidebar collapse and expand toggle
    const collapseBtn = screen.getByRole('button', {
      name: /Collapse sidebar navigation/i,
    });
    expect(collapseBtn).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(collapseBtn);

    const expandBtn = screen.getByRole('button', {
      name: /Expand sidebar navigation/i,
    });
    expect(expandBtn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(expandBtn);

    // Verify mobile navigation drawer open, dialog role, and Escape dismissal
    const mobileMenuBtn = screen.getByRole('button', {
      name: /Open navigation menu/i,
    });
    expect(mobileMenuBtn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(mobileMenuBtn);

    expect(
      screen.getByRole('dialog', { name: /Mobile navigation drawer/i }),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(
      screen.queryByRole('dialog', { name: /Mobile navigation drawer/i }),
    ).not.toBeInTheDocument();

    // Verify route context helper resolves all destinations accurately
    expect(normalizeWorkspaceSection('workspace')).toBe('overview');
    expect(normalizeWorkspaceSection('cost')).toBe('cost');
    expect(normalizeWorkspaceSection('unknown-route')).toBe('overview');

    const newProjCtx = resolveRouteContext('/projects/new');
    expect(newProjCtx.pageTitle).toContain('New Project');
    expect(newProjCtx.breadcrumbs).toHaveLength(3);

    unmount();
  });

  it('renders MapCanvas and MapSpikePreview with basemap switching, Fit AOI button, symbology legend, and 50k stress test', () => {
    const pts = generateSyntheticPointsGeoJson(100);
    expect(pts.features).toHaveLength(100);

    render(
      <div>
        <MapSpikePreview />
        <MapCanvas
          aoiGeometry={{
            type: 'Polygon',
            coordinates: [
              [
                [82.66, 18.55],
                [82.7, 18.55],
                [82.7, 18.59],
                [82.66, 18.59],
                [82.66, 18.55],
              ],
            ],
          }}
          boundarySource="HARMONISED"
          drawModeActive={true}
        />
      </div>,
    );

    expect(
      screen.getByLabelText('Koraput Electrification Assessment Map'),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('ElectriMap Interactive GIS Map Canvas'),
    ).toBeInTheDocument();

    // Verify map zoom-out constraints and India maxBounds (prevents globe navigation)
    expect(mockMapInstances.length).toBeGreaterThanOrEqual(2);
    const canvasMap = mockMapInstances[mockMapInstances.length - 1]!;
    const previewMap = mockMapInstances[mockMapInstances.length - 2]!;
    expect(canvasMap.options.minZoom).toBe(5.0);
    expect(canvasMap.options.maxZoom).toBe(20.0);
    expect(canvasMap.options.renderWorldCopies).toBe(false);
    expect(canvasMap.options.maxBounds).toEqual([[65.0, 5.0], [100.0, 38.5]]);
    expect(previewMap.options.minZoom).toBe(5.0);
    expect(previewMap.options.maxZoom).toBe(20.0);
    expect(previewMap.options.renderWorldCopies).toBe(false);
    expect(previewMap.options.maxBounds).toEqual([[65.0, 5.0], [100.0, 38.5]]);
    expect(screen.getByRole('button', { name: /Fit AOI/i })).toBeInTheDocument();
    expect(screen.getByText(/Likely Electrified \(Proxy\)/i)).toBeInTheDocument();

    // Verify all 4 free basemaps (including Terrain Topo and Sentinel-2 Satellite)
    const topoButtons = screen.getAllByRole('button', { name: /Terrain \(Topo\)/i });
    fireEvent.click(topoButtons[0]!);
    const satButtons = screen.getAllByRole('button', { name: /Sentinel-2 Satellite/i });
    fireEvent.click(satButtons[0]!);
    fireEvent.click(satButtons[1]!);

    // Verify Beginner Guide toggle
    const guideBtns = screen.getAllByRole('button', { name: /\? Beginner Guide/i });
    fireEvent.click(guideBtns[0]!);
    expect(
      screen.getByText(/Understanding the Specialised Electricity GIS Layers/i),
    ).toBeInTheDocument();

    // Verify Measure Tool toggle
    const measureBtn = screen.getByRole('button', { name: /Measure Span \/ Area/i });
    fireEvent.click(measureBtn);
    expect(screen.getByText(/Measurement Active:/i)).toBeInTheDocument();

    // Verify Village & Substation Search
    const searchInput = screen.getByLabelText(
      /Search villages, substations, or habitations/i,
    );
    fireEvent.change(searchInput, { target: { value: 'Nandapur' } });
    expect(
      screen.getByText(/33\/11 kV Nandapur Primary Distribution Substation/i),
    ).toBeInTheDocument();

    const stressBtn = screen.getByRole('button', {
      name: /Run 50k Footprint Stress Test/i,
    });
    fireEvent.click(stressBtn);
    expect(
      screen.getByRole('button', { name: /Clear 50k Points/i }),
    ).toBeInTheDocument();

    // Verify Hide All Overlays and Show All (A-F) checkbox synchronization
    const hideAllButtons = screen.getAllByRole('button', { name: /Hide All Overlays/i });
    fireEvent.click(hideAllButtons[0]!);
    fireEvent.click(hideAllButtons[1]!);

    const layerACheckboxes = screen.getAllByLabelText(
      /Layer A · Existing Electricity Infrastructure/i,
    );
    expect(layerACheckboxes[0]).not.toBeChecked();
    expect(layerACheckboxes[1]).not.toBeChecked();

    const showAllButtons = screen.getAllByRole('button', { name: /Show All \(A–F\)/i });
    fireEvent.click(showAllButtons[0]!);
    fireEvent.click(showAllButtons[1]!);

    expect(layerACheckboxes[0]).toBeChecked();
    expect(layerACheckboxes[1]).toBeChecked();

    const layerBCheckboxes = screen.getAllByLabelText(
      /Layer B · NASA VIIRS Nighttime Illumination/i,
    );
    expect(layerBCheckboxes[0]).toBeChecked();
    expect(layerBCheckboxes[1]).toBeChecked();
  });

  it('renders Phase 3 ProjectOverviewDashboard with real API data, 4 analytical charts, 4 electrification dimensions, provenance, and activity feed', () => {
    const onNavigateSection = vi.fn();

    render(
      <ProjectOverviewDashboard
        project={{
          id: DEMO_PROJECT_ID,
          owner_id: 'usr-1',
          name: 'Koraput — Bheja Reference Study',
          description: 'Tribal electrification study',
          scheme: 'DA-JGUA',
          target_state: 'Odisha',
          target_district: 'Koraput',
          target_block: 'Nandapur',
          village_names: 'Bheja',
          base_year: 2026,
          horizon_years: 10,
          discount_rate: 0.08,
          load_tier: 'TIER_2',
          metric_epsg: 32644,
          status: 'ACTIVE',
          version: 3,
          created_at: '2026-11-06T00:00:00Z',
          updated_at: '2026-11-07T00:00:00Z',
          aoi: {
            boundary_source: 'HARMONISED',
            area_km2: 14.82,
            lgd_code: '398712',
            census2011_code: '428914',
            upload_filename: null,
            original_crs: 'EPSG:4326',
            warnings: [],
            geojson_geometry: { type: 'Polygon', coordinates: [] },
          },
        }}
        layers={[
          {
            id: 'lyr-bld',
            project_id: DEMO_PROJECT_ID,
            layer_key: 'buildings',
            status: 'READY',
            retrieved_at: '2026-11-06T00:00:00Z',
            feature_count: 143,
            bbox: [82.71, 18.55, 82.75, 18.58],
            summary_metrics: { residential_count: 135 },
            error_message: null,
            cache_key: 'bld_ref_pack',
            dataset: {
              id: 'ds-1',
              key: 'open_buildings_v3',
              name: 'Google-Microsoft-OSM Open Buildings',
              provider: 'VIDA / Google / Microsoft / OSM',
              url: 'https://beta.source.coop',
              licence: 'CC BY 4.0 / ODbL',
              licence_url: null,
              attribution_text: 'Contains Open Buildings.',
              spatial_resolution: '0.5 m',
              temporal_coverage: '2020–2023',
              version: 'v3',
              is_non_commercial: false,
              notes: null,
            },
          },
          {
            id: 'lyr-sol',
            project_id: DEMO_PROJECT_ID,
            layer_key: 'solar_resource',
            status: 'READY',
            retrieved_at: '2026-11-06T00:00:00Z',
            feature_count: 1,
            bbox: [82.71, 18.55, 82.75, 18.58],
            summary_metrics: {
              worst_ghi_kwh_m2_day: 3.43,
              mean_ghi_kwh_m2_day: 4.9,
              optimal_tilt_deg: 19,
            },
            error_message: null,
            cache_key: 'sol_ref_pack',
            dataset: null,
          },
        ]}
        settlements={{
          project_id: DEMO_PROJECT_ID,
          cluster_run_id: 'run-1',
          params: { eps_m: 150, min_samples: 5, household_alpha: 0.9 },
          verification_coverage_pct: 45.9,
          census_reconciliation: {
            census2011_code: '428914',
            village_name: 'Bheja',
            census_2011_households: 128,
            projected_base_year_households: 158,
            satellite_detected_buildings: 143,
            satellite_residential_buildings: 135,
            satellite_estimated_households: 122,
            delta_households: -36,
            delta_pct: -22.8,
            divergence_exceeds_30pct: false,
            reconciliation_note: 'Reconciled within ±30% of projected baseline.',
          },
          geojson: { type: 'FeatureCollection', features: [] },
          items: [
            {
              id: 'cl-1',
              cluster_run_id: 'run-1',
              project_id: DEMO_PROJECT_ID,
              label: 'CL-01',
              name: 'Bheja Main Core',
              is_isolated_group: false,
              n_detected: 65,
              n_residential: 62,
              n_non_residential: 3,
              est_households: 56,
              census_hh_ref: 128,
              proxy_class: 'LIKELY_ELECTRIFIED',
              proxy_confidence: 'HIGH',
              verification_state: 'FIELD_VERIFIED',
              verified_class: 'LIKELY_ELECTRIFIED',
              d_infra_m: 120,
              d_road_m: 85,
              slope_mean_deg: 6.4,
              canopy_share: 0.18,
              evidence: {},
              centroid_lon: 82.73,
              centroid_lat: 18.56,
              geojson_geometry: { type: 'Polygon', coordinates: [] },
              updated_at: '2026-11-06T00:00:00Z',
            },
          ],
        }}
        verificationLedger={{
          project_id: DEMO_PROJECT_ID,
          total_clusters: 1,
          verified_clusters: 1,
          total_households: 56,
          verified_households: 56,
          verification_coverage_pct: 100.0,
          records: [
            {
              id: 'ver-1',
              project_id: DEMO_PROJECT_ID,
              target_type: 'CLUSTER',
              target_id: 'cl-1',
              cluster_label: 'CL-01',
              attribute: 'cluster_verification',
              previous_value: {},
              new_value: {},
              evidence_type: 'GRAM_SABHA_RESOLUTION',
              verifier_name: 'Er. R. K. Mohanty',
              observed_on: '2026-03-14',
              note: 'Confirmed 63 kVA DT in village center.',
              import_batch_id: null,
              reverses_id: null,
              created_by: 'usr-1',
              created_at: '2026-11-06T00:00:00Z',
            },
          ],
          imports: [],
        }}
        infrastructure={{
          project_id: DEMO_PROJECT_ID,
          has_existing_infra: true,
          items: [
            {
              id: 'inf-1',
              project_id: DEMO_PROJECT_ID,
              asset_type: 'TIE_IN',
              name: '11 kV Bheja Tapping Point',
              voltage_kv: 11.0,
              rating_kva: null,
              provenance: 'USER_ASSUMED',
              quality_tag: 'ASSUMED',
              dataset_id: null,
              source_note: 'Assumed tie-in',
              attributes: {},
              geojson_geometry: { type: 'Point', coordinates: [82.71, 18.55] },
              updated_at: '2026-11-06T00:00:00Z',
            },
          ],
          geojson: { type: 'FeatureCollection', features: [] },
        }}
        gapAnalysis={{
          project_id: DEMO_PROJECT_ID,
          has_existing_infra: true,
          infra_assets_count: 1,
          assumed_assets_count: 1,
          verified_assets_count: 0,
          mean_d_straight_m: 1450,
          mean_d_terrain_m: 1820,
          max_d_terrain_m: 3120,
          grid_extension_candidates: 2,
          minigrid_candidates: 1,
          shs_candidates: 1,
          augmentation_candidates: 1,
          corridors_geojson: { type: 'FeatureCollection', features: [] },
          clusters: [],
        }}
        demand={{
          project_id: DEMO_PROJECT_ID,
          total_households: 122,
          total_connected_kw: 84.5,
          peak_kw_base: 38.2,
          peak_kva_base: 44.94,
          energy_kwh_day_base: 295.4,
          annual_energy_mwh_base: 107.82,
          horizon_years: 10,
          annual_growth_rate: 0.045,
          peak_kw_horizon: 59.32,
          peak_kva_horizon: 69.79,
          energy_kwh_day_horizon: 458.7,
          annual_energy_mwh_horizon: 167.44,
          category_totals: [
            {
              category: 'DOMESTIC_BPL',
              label: 'Domestic BPL Households',
              consumer_count: 79,
              connected_kw: 19.75,
              demand_factor: 0.6,
              max_demand_kw: 11.85,
              daily_hours: 5.0,
              energy_kwh_day: 59.25,
              annual_energy_mwh: 21.63,
            },
          ],
          clusters: [],
        }}
        scenariosState={null}
        ratesState={{
          project_id: DEMO_PROJECT_ID,
          template_key: 'ODISHA_2025',
          template_name: 'Odisha SOR 2025',
          total_items: 18,
          unset_count: 0,
          unset_item_codes: [],
          user_edited_count: 0,
          items: [],
        }}
        comparisonState={{
          project_id: DEMO_PROJECT_ID,
          active_scenario_id: 'scen-1',
          active_scenario_key: 'HYBRID_OPTIMAL',
          discount_rate: 0.08,
          horizon_years: 10,
          has_unset_rates: false,
          unset_item_codes: [],
          export_blocked_reason: null,
          scenarios: [
            {
              scenario_id: 'scen-1',
              scenario_key: 'HYBRID_OPTIMAL',
              scenario_name: 'Hybrid Optimal',
              is_active_baseline: true,
              requires_tie_in_warning: false,
              vdrop_compliance_ok: true,
              total_households_served: 122,
              annual_delivered_energy_mwh: 167.44,
              modality_counts: { GRID_EXTENSION: 1, SOLAR_MINIGRID: 1 },
              base_equipment_inr: 3200000,
              terrain_premium_inr: 400000,
              gst_amount_inr: 648000,
              contingency_amount_inr: 108000,
              pmc_overhead_amount_inr: 180000,
              total_capex_inr: 4536000,
              total_capex_lakhs: 45.36,
              capital_subsidy_inr: 4082400,
              net_utility_capex_inr: 453600,
              annual_om_inr: 125000,
              annual_energy_purchase_inr: 210000,
              npc_inr: 6980000,
              npc_lakhs: 69.8,
              lcoe_inr_kwh: 6.21,
              cost_per_household_inr: 37180,
              npc_per_household_inr: 57213,
              avoided_co2_tonnes_yr: 42.5,
              has_unset_rates: false,
              unset_item_codes: [],
            },
          ],
          habitation_comparisons: [],
          active_scenario_boq: null as never,
        }}
        preflightState={null}
        exportLogState={null}
        onNavigateSection={onNavigateSection}
      />,
    );

    // Verify analytical charts and 4 dimensions render
    expect(
      screen.getByRole('img', {
        name: /Proportional bar chart of households by electrification classification/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: /Scenario CAPEX and Net Present Cost comparison bar chart/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: /Consumer category connected load breakdown chart/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Strict Epistemic Separation of Rural Electrification Dimensions/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Confirmed 63 kVA DT in village center/i)).toBeInTheDocument();

    // Verify workflow shortcut triggers navigation callback
    fireEvent.click(screen.getByRole('button', { name: /Inspect Clusters/i }));
    expect(onNavigateSection).toHaveBeenCalledWith('settlements');
  });

  it('never fabricates numbers in ProjectOverviewDashboard when project data is unavailable and shows EmptyState', () => {
    const onNavigateSection = vi.fn();

    render(
      <ProjectOverviewDashboard
        project={{
          id: 'proj-empty',
          owner_id: 'usr-1',
          name: 'Unconfigured Empty Study',
          description: null,
          scheme: 'RDSS',
          target_state: 'Odisha',
          target_district: 'Koraput',
          target_block: 'Nandapur',
          village_names: null,
          base_year: 2026,
          horizon_years: 10,
          discount_rate: 0.08,
          load_tier: 'TIER_1',
          metric_epsg: 32644,
          status: 'DRAFT',
          version: 1,
          created_at: '2026-11-06T00:00:00Z',
          updated_at: '2026-11-06T00:00:00Z',
          aoi: null,
        }}
        layers={[]}
        settlements={null}
        verificationLedger={null}
        infrastructure={null}
        gapAnalysis={null}
        demand={null}
        scenariosState={null}
        ratesState={null}
        comparisonState={null}
        preflightState={null}
        exportLogState={null}
        onNavigateSection={onNavigateSection}
      />,
    );

    // Must show "Not available" / EmptyState instead of invented zeroes
    expect(screen.getAllByText('Not available').length).toBeGreaterThanOrEqual(4);
    expect(
      screen.getByText(/Area of Interest \(AOI\) Not Configured/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No Habitation Clusters Generated Yet/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Scenario Cost Comparison Not Yet Computed/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Consumer Load Forecast Not Available/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No Geospatial Layers Acquired Yet/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No Verification or Export Activity Recorded Yet/i),
    ).toBeInTheDocument();
  });

  it('renders LandingPage with 12-month NASA POWER GHI chart, village Census 2011 comparison, workflow shortcuts, and REFERENCE_DEMO provenance', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('img', {
        name: /NASA POWER 12-month solar GHI bar chart for Koraput reference study/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('4.90').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/Nandapur Block Revenue Villages \(Census 2011 DCHB vs\. 2026 Footprints\)/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText('REF · DEMO').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('PROJECT DATA').length).toBeGreaterThanOrEqual(2);
  });

  it('supports Phase 4 GIS Workspace grouped layers, geographic filters, vector opacity, quick-select feature inspector drawer, and expandable symbology legend', () => {
    const onSelectCluster = vi.fn();

    render(
      <MapCanvas
        onSelectCluster={onSelectCluster}
        boundarySource="HARMONISED"
      />,
    );

    // 1. Verify grouped layer headers in the Layer Management Panel
    expect(
      screen.getByText(/Group 1 · Grid Infrastructure & Routing/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Group 2 · Satellite Nighttime Illumination/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Group 3 · Villages, Settlements & Gaps/i),
    ).toBeInTheDocument();

    // 2. Verify Vector Layer Opacity slider
    const opacitySlider = screen.getByLabelText(
      /Vector overlay layer transparency/i,
    );
    fireEvent.change(opacitySlider, { target: { value: '0.55' } });
    expect(screen.getByText(/Vector Layer Opacity: 55%/i)).toBeInTheDocument();

    // 3. Verify Settlement Electrification Status Filter
    const settlementFilter = screen.getByLabelText(
      /Filter settlements by electrification status/i,
    );
    fireEvent.change(settlementFilter, {
      target: { value: 'POTENTIALLY_UNSERVED' },
    });
    expect(
      (settlementFilter as HTMLSelectElement).value,
    ).toBe('POTENTIALLY_UNSERVED');

    // 4. Verify Reference Pack Provenance Toggle & Empty State notice when unchecked
    const refPackCheckbox = screen.getByLabelText(
      /Include Koraput Reference Pack/i,
    );
    expect(refPackCheckbox).toBeChecked();
    fireEvent.click(refPackCheckbox);
    expect(refPackCheckbox).not.toBeChecked();
    expect(
      screen.getByText(/No project infrastructure uploaded for this filter/i),
    ).toBeInTheDocument();
    fireEvent.click(refPackCheckbox);

    // 5. Verify Quick-Jump Geographic Selection & Feature Inspector Drawer
    const quickJumpToolbar = screen.getByRole('toolbar', {
      name: /Quick-jump geographic locations and features/i,
    });
    expect(quickJumpToolbar).toBeInTheDocument();

    const substationChip = screen.getByRole('button', {
      name: /Inspect: SS Nandapur 33\/11kV/i,
    });
    fireEvent.click(substationChip);

    const inspectorRegion = screen.getByRole('region', {
      name: /Selected GIS Feature Inspector/i,
    });
    expect(inspectorRegion).toBeInTheDocument();
    expect(
      screen.getByText(/3.15 MVA/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/MAPPED EXISTING INFRASTRUCTURE/i),
    ).toBeInTheDocument();

    // Select a gap cluster chip and verify onSelectCluster callback + ClassificationBadge
    const clusterChip = screen.getByRole('button', {
      name: /Inspect: CL-02 Podapadar Tola Eastern Ridge/i,
    });
    fireEvent.click(clusterChip);
    expect(onSelectCluster).toHaveBeenCalledWith('cl-02');
    expect(
      screen.getByText(/1640 m/i),
    ).toBeInTheDocument();

    // Close feature inspector
    const closeInspectorBtn = screen.getByRole('button', {
      name: /Close feature inspector/i,
    });
    fireEvent.click(closeInspectorBtn);
    expect(
      screen.queryByRole('region', { name: /Selected GIS Feature Inspector/i }),
    ).not.toBeInTheDocument();

    // 6. Verify Expandable GIS Symbology & Epistemic Provenance Legend
    const toggleLegendBtn = screen.getByRole('button', {
      name: /Symbology Legend/i,
    });
    fireEvent.click(toggleLegendBtn);
    expect(
      screen.getByRole('region', {
        name: /Expanded GIS Symbology and Epistemic Legend/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Cartographic Symbology & Epistemic Provenance Specification/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Satellites cannot see indoor household electricity meters/i,
      ),
    ).toBeInTheDocument();
  });

  it('verifies Phase 5 infrastructure symbology catalog and zero-fabrication GIS feature inspection', () => {
    // 1. Existing vs. Proposed symbology separation
    expect(INFRASTRUCTURE_CATEGORY_META.LINE_33KV_EXISTING.isProposed).toBe(false);
    expect(INFRASTRUCTURE_CATEGORY_META.LINE_33KV_EXISTING.dashArray).toBeUndefined();
    expect(INFRASTRUCTURE_CATEGORY_META.LINE_11KV_EXISTING.isProposed).toBe(false);
    expect(INFRASTRUCTURE_CATEGORY_META.LINE_11KV_PROPOSED.isProposed).toBe(true);
    expect(INFRASTRUCTURE_CATEGORY_META.LINE_11KV_PROPOSED.dashArray).toEqual([4, 2]);
    expect(INFRASTRUCTURE_CATEGORY_META.LINE_415V_LT_PROPOSED.isProposed).toBe(true);
    expect(INFRASTRUCTURE_CATEGORY_META.LINE_415V_LT_PROPOSED.dashArray).toEqual([2, 1.5]);

    // 2. Category resolution across backend asset_type and OSM infra_category
    expect(resolveInfraCategoryMeta('SUBSTATION').code).toBe('SUBSTATION_33_11KV');
    expect(resolveInfraCategoryMeta('TIE_IN', 'USER_ASSUMED').code).toBe('TIE_IN_ASSUMED');
    expect(resolveInfraCategoryMeta('LINE', 'UTILITY_RECORD', 33).code).toBe(
      'LINE_33KV_EXISTING',
    );
    expect(resolveInfraCategoryMeta('LINE', 'UTILITY_RECORD', 11).code).toBe(
      'LINE_11KV_EXISTING',
    );
    expect(resolveInfraCategoryMeta('TOWER').code).toBe('TOWER_33KV');
    expect(resolveInfraCategoryMeta('POLE').code).toBe('POLE_11KV');
    expect(resolveInfraCategoryMeta('MINIGRID_PROPOSED').code).toBe('MINIGRID_PROPOSED');

    // 3. Zero-fabrication feature inspection when properties are missing
    const sparseCluster = buildInspectedFeatureFromMapProperties(
      'clusters-centroid-circle',
      { id: 'c-sparse', cluster_code: 'CL-99', name: 'Sparse Hamlet' },
      [82.71, 18.55],
      true,
    );
    expect(sparseCluster.sourceClass).toBe('PROJECT');
    const rad2024Attr = sparseCluster.attributes.find(
      (a) => a.label === '2024 VIIRS Radiance',
    );
    const rad2020Attr = sparseCluster.attributes.find(
      (a) => a.label === '2020 Baseline Radiance',
    );
    expect(rad2024Attr?.value).toBe('Not recorded in source');
    expect(rad2020Attr?.value).toBe('Not recorded in source');

    const sparseInfra = buildInspectedFeatureFromMapProperties(
      'layer-a-11kv-lines',
      { name: 'Unattributed Line', infra_category: 'DISTRIBUTION_LINE_11KV' },
      [82.71, 18.55],
      false,
    );
    const condAttr = sparseInfra.attributes.find(
      (a) => a.label === 'Conductor / Structure Spec',
    );
    const opAttr = sparseInfra.attributes.find(
      (a) => a.label === 'Operator / Source Note',
    );
    expect(condAttr?.value).toBe('Not recorded in source');
    expect(opAttr?.value).toBe('Not recorded in source');
  });

  it('verifies Phase 5 InfrastructureAndDemandPanel symbology reference bar, asset category filter, and gap modality filter', () => {
    render(
      <InfrastructureAndDemandPanel
        projectId="00000000-0000-4000-8000-000000000001"
        placeTieInModeActive={false}
        onTogglePlaceTieInMode={() => {}}
        onInfrastructureAndDemandUpdated={async () => {}}
        infrastructure={{
          project_id: '00000000-0000-4000-8000-000000000001',
          has_existing_infra: true,
          items: [
            {
              id: 'asset-tie-1',
              project_id: '00000000-0000-4000-8000-000000000001',
              asset_type: 'TIE_IN',
              name: 'Nandapur 11 kV Feeder Tap Point (Assumed)',
              voltage_kv: 11,
              rating_kva: null,
              provenance: 'USER_ASSUMED',
              quality_tag: 'ASSUMED',
              dataset_id: null,
              source_note: 'Planner assumed tie-in point',
              attributes: {},
              geojson_geometry: { type: 'Point', coordinates: [82.7265, 18.5645] },
              updated_at: '2026-11-14T10:00:00Z',
            },
            {
              id: 'asset-sub-1',
              project_id: '00000000-0000-4000-8000-000000000001',
              asset_type: 'SUBSTATION',
              name: 'Nandapur 33/11 kV Primary Substation',
              voltage_kv: 33,
              rating_kva: 3150,
              provenance: 'UTILITY_RECORD',
              quality_tag: 'VERIFIED',
              dataset_id: null,
              source_note: 'TPSODL feeder diagram',
              attributes: {},
              geojson_geometry: { type: 'Point', coordinates: [82.692, 18.538] },
              updated_at: '2026-11-14T10:00:00Z',
            },
          ],
          geojson: { type: 'FeatureCollection', features: [] },
        }}
        gapAnalysis={{
          project_id: '00000000-0000-4000-8000-000000000001',
          has_existing_infra: true,
          infra_assets_count: 2,
          assumed_assets_count: 1,
          verified_assets_count: 1,
          grid_extension_candidates: 1,
          minigrid_candidates: 1,
          shs_candidates: 0,
          augmentation_candidates: 0,
          mean_d_straight_m: 2100,
          mean_d_terrain_m: 2550,
          max_d_terrain_m: 3890,
          corridors_geojson: { type: 'FeatureCollection', features: [] },
          clusters: [
            {
              cluster_id: 'cl-1',
              cluster_label: 'C-001',
              cluster_name: 'Podapadar Tola',
              est_households: 38,
              effective_electrification_class: 'POTENTIALLY_UNDERSERVED',
              nearest_asset_id: 'asset-tie-1',
              nearest_asset_name: 'Nandapur 11 kV Feeder Tap Point (Assumed)',
              nearest_asset_type: 'TIE_IN',
              nearest_asset_provenance: 'USER_ASSUMED',
              d_straight_m: 1640,
              d_terrain_m: 1858,
              terrain_penalty_factor: 1.13,
              slope_mean_deg: 4.2,
              canopy_share: 0.25,
              water_crossings_count: 1,
              road_distance_m: 120,
              recommended_modality: 'GRID_EXTENSION',
              rationale: 'Within 2 km of 11 kV tap',
              corridor_geojson: null,
            },
            {
              cluster_id: 'cl-2',
              cluster_label: 'C-002',
              cluster_name: 'Maliaguda PVTG',
              est_households: 26,
              effective_electrification_class: 'POTENTIALLY_UNSERVED',
              nearest_asset_id: 'asset-tie-1',
              nearest_asset_name: 'Nandapur 11 kV Feeder Tap Point (Assumed)',
              nearest_asset_type: 'TIE_IN',
              nearest_asset_provenance: 'USER_ASSUMED',
              d_straight_m: 3120,
              d_terrain_m: 3890,
              terrain_penalty_factor: 1.25,
              slope_mean_deg: 11.4,
              canopy_share: 0.62,
              water_crossings_count: 2,
              road_distance_m: 840,
              recommended_modality: 'SOLAR_MINIGRID',
              rationale: 'Steep terrain favors Solar PV Mini-Grid',
              corridor_geojson: null,
            },
          ],
        }}
        settings={null}
        demand={null}
      />,
    );

    // Symbology & Data Provenance Key is rendered
    expect(
      screen.getByText(/Electricity Infrastructure Symbology & Data Provenance Key/i),
    ).toBeInTheDocument();

    // Filter registered assets by SUBSTATION
    const assetFilter = screen.getByLabelText(
      /Filter registered infrastructure assets by category/i,
    );
    fireEvent.change(assetFilter, { target: { value: 'SUBSTATION' } });
    expect(
      screen.getByText(/Nandapur 33\/11 kV Primary Substation/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Planner assumed tie-in point'),
    ).not.toBeInTheDocument();

    // Filter gap analysis clusters by MINIGRID
    const modalityFilter = screen.getByLabelText(
      /Filter gap analysis matrix by recommended modality/i,
    );
    fireEvent.change(modalityFilter, { target: { value: 'MINIGRID' } });
    expect(screen.getByText(/C-002 · Maliaguda PVTG/i)).toBeInTheDocument();
    expect(screen.queryByText(/C-001 · Podapadar Tola/i)).not.toBeInTheDocument();
  });

  it('renders Phase 6 satellite imagery, NASA VIIRS nighttime illumination controls, MapLibre source/error handling, non-demo halo isolation, and raster legends in MapCanvas', () => {
    render(<MapCanvas />);
    const mapInst = mockMapInstances[mockMapInstances.length - 1]!;

    // Quick-switch to Sentinel-2 Satellite basemap inside Group 2
    const switchSatelliteBtn = screen.getByRole('button', {
      name: /Switch to Sentinel-2 Satellite Basemap/i,
    });
    fireEvent.click(switchSatelliteBtn);
    expect(
      screen.getByText(/Viewing 10 m Optical Satellite Imagery/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/SATELLITE: Sentinel-2 2020 \(10 m · CC BY-NC-SA 4\.0\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Loading Raster\.\.\./i)).toBeInTheDocument();

    // Real MapLibre idle event clears loading state
    act(() => {
      mapInst.emit('idle');
    });
    expect(screen.queryByText(/Loading Raster\.\.\./i)).not.toBeInTheDocument();

    // Enable Layer B (NASA VIIRS Nighttime Illumination)
    const layerBCheckbox = screen.getByRole('checkbox', {
      name: /Layer B · NASA VIIRS Nighttime Illumination/i,
    });
    fireEvent.click(layerBCheckbox);

    // Honest illustrative-scenario provenance card is displayed (no fake satellite dates)
    expect(
      screen.getByText(/Illustrative Pre-Feasibility Scenario \(1\.00× · SYNTHETIC_PLACEHOLDER\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/~500 m VIIRS DNB Scale · Local AOI Proxy PNG/i),
    ).toBeInTheDocument();

    expect(mapInst.addSource).toHaveBeenCalledWith(
      'project-raster',
      expect.objectContaining({
        type: 'image',
        url: '/api/v1/spikes/viirs-overlay?period=2024_ANNUAL',
      }),
    );

    // Switch observation composite scenario to 2023_POST_MONSOON (1.08× Scale)
    const periodSelect = screen.getByLabelText(/Observation Composite Date/i);
    fireEvent.change(periodSelect, { target: { value: '2023_POST_MONSOON' } });
    expect(
      screen.getByText(/Illustrative Pre-Feasibility Scenario \(1\.08× · SYNTHETIC_PLACEHOLDER\)/i),
    ).toBeInTheDocument();
    expect(mapInst.getSource('project-raster')?.updateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/v1/spikes/viirs-overlay?period=2023_POST_MONSOON',
      }),
    );

    // Test VIIRS opacity presets (25%, 50%, 75%, 100%) & MapLibre paint property sync
    const preset50Btn = screen.getByRole('button', { name: '50%' });
    fireEvent.click(preset50Btn);
    expect(screen.getByText(/Overlay Opacity: 50%/i)).toBeInTheDocument();
    expect(mapInst.setPaintProperty).toHaveBeenCalledWith(
      'project-raster-layer',
      'raster-opacity',
      0.5,
    );

    // Toggle Global NASA GIBS VIIRS_CityLights_2012 Tiles (2012 Mosaic · z <= 8)
    const gibsCheckbox = screen.getByRole('checkbox', {
      name: /Include Global NASA GIBS VIIRS_CityLights_2012 Tiles/i,
    });
    fireEvent.click(gibsCheckbox);
    expect(mapInst.addSource).toHaveBeenCalledWith(
      'nasa-gibs-viirs',
      expect.objectContaining({
        type: 'raster',
        maxzoom: 8,
        attribution: expect.stringMatching(/VIIRS_CityLights_2012/),
      }),
    );

    // MapLibre error triggers warning banner + Retry Overlay recovery
    act(() => {
      mapInst.emit('error', {
        sourceId: 'nasa-gibs-viirs',
        error: { status: 503, message: 'Service Unavailable' },
      });
    });
    expect(
      screen.getByText(/NASA GIBS VIIRS_CityLights_2012 tile server temporarily unreachable/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Retry Overlay/i }));
    expect(
      screen.queryByText(/NASA GIBS VIIRS_CityLights_2012 tile server temporarily unreachable/i),
    ).not.toBeInTheDocument();

    // Non-demo leakage check: disabling Koraput Reference Pack clears VIIRS glow source features
    const refPackCheckbox = screen.getByRole('checkbox', {
      name: /Include Koraput Reference Pack/i,
    });
    fireEvent.click(refPackCheckbox);
    const haloData = mapInst.sourceData.get('viirs-radiance-source') as {
      features: unknown[];
    };
    expect(haloData?.features).toHaveLength(0);

    // Inline VIIRS Brightness Scale is displayed with epistemic limitation warning
    expect(
      screen.getByText(/VIIRS Brightness Scale \(nW\/cm²\/sr\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Background \/ Near Noise Floor/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Dark pixels are NEVER proof of zero electricity/i),
    ).toBeInTheDocument();

    // Select Copernicus DEM Slope raster overlay directly inside MapCanvas Group 2
    const envRasterSelect = screen.getByLabelText(
      /Select environmental or satellite raster overlay/i,
    );
    fireEvent.change(envRasterSelect, { target: { value: 'dem_slope' } });
    expect(
      screen.getByText(/Copernicus DEM GLO-30 Terrain Slope/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Steep Eastern Ghats Escarpment/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Open a Project Workspace AOI to render clipped dem_slope PNG pixels/i),
    ).toBeInTheDocument();

    // Verify buildInspectedFeatureFromMapProperties for 'viirs-radiance-glow-outer' includes multi-year trend
    const inspectedViirs = buildInspectedFeatureFromMapProperties(
      'viirs-radiance-glow-outer',
      {
        id: 'cl-01',
        cluster_code: 'CL-01',
        name: 'Bheja Main Sahi',
        proxy_class: 'LIKELY_ELECTRIFIED',
        verification_state: 'UNVERIFIED',
        viirs_radiance_2020_nw: 1.55,
        viirs_radiance_2022_nw: 1.92,
        viirs_radiance_2023_nw: 2.24,
        viirs_radiance_2024_nw: 2.18,
      },
      [82.698, 18.54],
      false,
    );
    expect(inspectedViirs.layerGroupTitle).toMatch(
      /Layer B · NASA VIIRS Nighttime Illumination/i,
    );
    expect(
      inspectedViirs.attributes.find((a) => a.label === 'Multi-Year VIIRS Trend')
        ?.value,
    ).toBe('2020: 1.55 → 2022: 1.92 → 2023: 2.24 → 2024: 2.18 nW/cm²/sr');
  });

  it('renders MapSpikePreview with Phase 6 Sentinel-2 quick-switch, Layer B brightness legend, presets, and tile retry recovery', () => {
    render(<MapSpikePreview />);
    const previewMap = mockMapInstances[mockMapInstances.length - 1]!;

    fireEvent.click(
      screen.getByRole('button', { name: /Switch to Sentinel-2 Satellite Basemap/i }),
    );
    expect(
      screen.getByText(/SATELLITE: Sentinel-2 2020 \(10 m · CC BY-NC-SA 4\.0\)/i),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /Layer B · NASA VIIRS Nighttime Illumination/i,
      }),
    );
    expect(
      screen.getByText(/VIIRS Brightness Scale \(nW\/cm²\/sr\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Illustrative Pre-Feasibility Scenario \(1\.00× · SYNTHETIC_PLACEHOLDER\)/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '25%' }));
    expect(screen.getByText(/Overlay Opacity: 25%/i)).toBeInTheDocument();

    act(() => {
      previewMap.emit('error', {
        sourceId: 'eox-s2',
        error: { message: 'Failed to fetch tile' },
      });
    });
    expect(
      screen.getByText(/EOX Sentinel-2 2020 tile server temporarily unreachable/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Retry Overlay/i }));
    expect(
      screen.queryByText(/EOX Sentinel-2 2020 tile server temporarily unreachable/i),
    ).not.toBeInTheDocument();
  });

  it('renders DataManagementPanel satellite attribution, active raster color-ramp legend, empty state, and per-layer failure recovery', () => {
    const onChangeRasterOverlay = vi.fn();
    const onChangeRasterOpacity = vi.fn();

    // 1. Test EmptyState when layers is empty
    const { rerender } = render(
      <DataManagementPanel
        projectId="00000000-0000-4000-8000-000000000001"
        layers={[]}
        visibleVectorLayers={{}}
        onToggleVectorLayer={vi.fn()}
        activeRasterOverlay="none"
        onChangeRasterOverlay={onChangeRasterOverlay}
        rasterOpacity={0.65}
        onChangeRasterOpacity={onChangeRasterOpacity}
        onLayersUpdated={async () => {}}
      />,
    );

    expect(
      screen.getByText(/No Geospatial or Satellite Layers Ingested Yet/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/EOX Sentinel-2 Cloudless Optical Basemap/i),
    ).toBeInTheDocument();

    // 2. Test active raster legend ('landcover') and failed layer alert
    rerender(
      <DataManagementPanel
        projectId="00000000-0000-4000-8000-000000000001"
        layers={[
          {
            id: 'lyr-failed-1',
            project_id: '00000000-0000-4000-8000-000000000001',
            layer_key: 'nightlights',
            status: 'FAILED',
            retrieved_at: null,
            feature_count: 0,
            bbox: null,
            summary_metrics: {},
            error_message: 'Tile read timeout on AOI raster clip.',
            cache_key: null,
            dataset: null,
          },
        ]}
        visibleVectorLayers={{}}
        onToggleVectorLayer={vi.fn()}
        activeRasterOverlay="landcover"
        onChangeRasterOverlay={onChangeRasterOverlay}
        rasterOpacity={0.75}
        onChangeRasterOpacity={onChangeRasterOpacity}
        onLayersUpdated={async () => {}}
      />,
    );

    expect(
      screen.getByText(/ESA WorldCover 10 m Land Classification/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Class 10 · Tree Cover \/ Dense Forest/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Layer Ingestion Failed: Tile read timeout on AOI raster clip\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Retry Pipeline/i }),
    ).toBeInTheDocument();
  });
});

describe('Phase 7: Remaining Pages, Forms, Filters, Empty States & Confirmation Flows', () => {
  it('toggles password visibility on LoginPage without clearing input value', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    fireEvent.click(screen.getByRole('button', { name: /Show password/i }));
    expect(passwordInput.type).toBe('text');
    expect(screen.getByRole('button', { name: /Hide password/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Hide password/i }));
    expect(passwordInput.type).toBe('password');
  });

  it('supports segmented AOI tabs and LGD empty-search recovery on NewProjectWizardPage', async () => {
    useSessionStore.setState({
      user: {
        id: 'u-planner',
        email: 'planner@electrimap.in',
        display_name: 'Demo Planner',
        role: 'planner',
        is_active: true,
      },
      isInitialized: true,
      isLoading: false,
      error: null,
    });

    const mockVillages = [
      {
        lgd_code: '428914',
        level: 'VILLAGE',
        name: 'Bheja',
        parent_lgd_code: '030801',
        census2011_code: '428914',
        boundary_source: 'OFFICIAL_LGD',
        has_polygon_geometry: true,
        centroid_lon: 82.73,
        centroid_lat: 18.56,
        census_info: null,
      },
    ];

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
      if (url.includes('/api/v1/admin-units/search')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/boundary')) {
        return new Response(
          JSON.stringify({
            lgd_code: '428914',
            name: 'Bheja',
            level: 'VILLAGE',
            census2011_code: '428914',
            boundary_source: 'OFFICIAL_LGD',
            area_km2: 2.1,
            metric_epsg: 32644,
            warnings: [],
            geojson_geometry: {
              type: 'Polygon',
              coordinates: [[[82.71, 18.55], [82.74, 18.55], [82.74, 18.58], [82.71, 18.55]]],
            },
            census_info: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify(mockVillages), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    try {
      render(
        <MemoryRouter>
          <NewProjectWizardPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('option', { name: /Bheja/i })).toBeInTheDocument();
      });

      const drawTab = screen.getByRole('tab', { name: /Draw Polygon/i });
      fireEvent.click(drawTab);
      expect(drawTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText(/Interactive Map Polygon Drawing Active/i)).toBeInTheDocument();

      const adminTab = screen.getByRole('tab', { name: /Admin Unit \(LGD\)/i });
      fireEvent.click(adminTab);
      expect(adminTab).toHaveAttribute('aria-selected', 'true');

      const searchInput = screen.getByLabelText(/Search village by name or LGD code/i);
      fireEvent.change(searchInput, { target: { value: 'UnknownHamletXYZ' } });
      fireEvent.click(screen.getByRole('button', { name: /^Search$/i }));

      await waitFor(() => {
        expect(screen.getByText(/No Matching Reference Villages/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Show All Villages/i }));
      await waitFor(() => {
        expect(screen.getByRole('option', { name: /Bheja/i })).toBeInTheDocument();
      });
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('guards SettlementAssessmentPanel verification reversal with ConfirmDialog and filters clusters', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    try {
      const onSettlementsUpdated = vi.fn(async () => {});
      render(
        <SettlementAssessmentPanel
          projectId="00000000-0000-4000-8000-000000000001"
          selectedClusterId="cl-1"
          onSelectCluster={vi.fn()}
          onSettlementsUpdated={onSettlementsUpdated}
          settlements={{
            project_id: '00000000-0000-4000-8000-000000000001',
            cluster_run_id: 'run-1',
            params: { eps_m: 150, min_samples: 5, household_alpha: 0.9 },
            verification_coverage_pct: 50,
            census_reconciliation: {
              census2011_code: '428914',
              village_name: 'Bheja',
              census_2011_households: 100,
              projected_base_year_households: 110,
              satellite_detected_buildings: 100,
              satellite_residential_buildings: 95,
              satellite_estimated_households: 95,
              delta_households: -15,
              delta_pct: -13.6,
              divergence_exceeds_30pct: false,
              reconciliation_note: 'Consistent.',
            },
            geojson: { type: 'FeatureCollection', features: [] },
            items: [
              {
                id: 'cl-1',
                cluster_run_id: 'run-1',
                project_id: '00000000-0000-4000-8000-000000000001',
                label: 'H1',
                name: 'Bheja Main',
                is_isolated_group: false,
                n_detected: 50,
                n_residential: 45,
                n_non_residential: 5,
                est_households: 42,
                census_hh_ref: 42,
                proxy_class: 'POTENTIALLY_UNDERSERVED',
                proxy_confidence: 'MEDIUM',
                verification_state: 'FIELD_VERIFIED',
                verified_class: 'UNSERVED',
                d_infra_m: 600,
                d_road_m: 50,
                slope_mean_deg: 2.1,
                canopy_share: 0.1,
                evidence: {},
                centroid_lon: 82.73,
                centroid_lat: 18.56,
                geojson_geometry: { type: 'Point', coordinates: [82.73, 18.56] },
                updated_at: '2026-11-06T00:00:00Z',
              },
            ],
          }}
          ledger={{
            project_id: '00000000-0000-4000-8000-000000000001',
            total_clusters: 1,
            verified_clusters: 1,
            total_households: 42,
            verified_households: 42,
            verification_coverage_pct: 100,
            records: [
              {
                id: 'ver-1',
                project_id: '00000000-0000-4000-8000-000000000001',
                target_type: 'HABITATION_CLUSTER',
                target_id: 'cl-1',
                cluster_label: 'H1',
                attribute: 'verification_state',
                previous_value: { verification_state: 'UNVERIFIED' },
                new_value: { verification_state: 'FIELD_VERIFIED' },
                evidence_type: 'GRAM_SABHA_RECORD',
                verifier_name: 'JE S. Patra',
                observed_on: '2026-11-06',
                note: 'Zero LT poles verified.',
                import_batch_id: null,
                reverses_id: null,
                created_by: 'planner@electrimap.in',
                created_at: '2026-11-06T00:00:00Z',
              },
            ],
            imports: [],
          }}
        />,
      );

      // Cluster search empty state + reset
      const searchBox = screen.getByLabelText(/Filter habitation clusters by label or name/i);
      fireEvent.change(searchBox, { target: { value: 'NoSuchHamlet' } });
      expect(screen.getByText(/No Matching Habitation Clusters/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Reset Filters/i }));
      expect(screen.getAllByText(/Bheja Main/i).length).toBeGreaterThanOrEqual(1);

      // Reversal opens ConfirmDialog first without calling API
      fireEvent.click(screen.getByRole('button', { name: /Reverse Entry/i }));
      expect(
        screen.getByText(/Confirm Append-Only Verification Reversal/i),
      ).toBeInTheDocument();
      expect(fetchSpy).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: /Append Reversal Entry/i }));
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });
      expect(String(fetchSpy.mock.calls[0]?.[0])).toContain(
        '/api/v1/projects/00000000-0000-4000-8000-000000000001/verifications/ver-1/reverse',
      );
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('protects InfrastructureAndDemandPanel asset deletion and assumptions reset with ConfirmDialog', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    try {
      render(
        <InfrastructureAndDemandPanel
          projectId="00000000-0000-4000-8000-000000000001"
          placeTieInModeActive={false}
          onTogglePlaceTieInMode={vi.fn()}
          onInfrastructureAndDemandUpdated={vi.fn(async () => {})}
          infrastructure={{
            project_id: '00000000-0000-4000-8000-000000000001',
            has_existing_infra: true,
            geojson: { type: 'FeatureCollection', features: [] },
            items: [
              {
                id: 'ast-1',
                project_id: '00000000-0000-4000-8000-000000000001',
                asset_type: 'TIE_IN',
                name: '11 kV Tie-In (Nandapur Road)',
                voltage_kv: 11,
                rating_kva: null,
                provenance: 'USER_ASSUMED',
                quality_tag: 'ASSUMED',
                dataset_id: null,
                source_note: 'Assumed junction',
                attributes: {},
                geojson_geometry: { type: 'Point', coordinates: [82.73, 18.56] },
                updated_at: '2026-11-06T00:00:00Z',
              },
            ],
          }}
          gapAnalysis={null}
          settings={{
            project_id: '00000000-0000-4000-8000-000000000001',
            user_edited_count: 1,
            items: [
              {
                id: 'set-1',
                project_id: '00000000-0000-4000-8000-000000000001',
                key: 'coincidence_factor',
                category: 'DEMAND',
                label: 'Cluster Coincidence Factor',
                value: 0.6,
                default_value: 0.55,
                min_value: 0.3,
                max_value: 0.9,
                unit: 'factor',
                quality_tag: 'ASSUMED',
                citation: 'CEA Rural Load Forecasting Manual',
                is_user_edited: true,
                override_note: 'Field adjusted',
                updated_at: '2026-11-06T00:00:00Z',
              },
            ],
          }}
          demand={null}
        />,
      );

      // Missing demand renders structured EmptyState instead of returning null
      expect(screen.getByText(/Demand Forecast Not Computed Yet/i)).toBeInTheDocument();

      // Remove asset confirmation dialog
      fireEvent.click(screen.getByRole('button', { name: /^Remove$/i }));
      expect(screen.getByText(/Remove Registered Infrastructure Asset\?/i)).toBeInTheDocument();
      expect(fetchSpy).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: /^Remove Asset$/i }));
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });
      expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/infrastructure/ast-1');

      // Reset Defaults confirmation dialog
      fireEvent.click(screen.getByRole('button', { name: /Reset Defaults/i }));
      expect(
        screen.getByText(/Reset All Assumptions to Normative REC \/ CEA Defaults\?/i),
      ).toBeInTheDocument();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('renders NetworkEngineeringPanel empty state, modality filters, and manual-override ConfirmDialog', () => {
    const { rerender } = render(
      <NetworkEngineeringPanel
        projectId="00000000-0000-4000-8000-000000000001"
        scenariosState={null}
        constants={null}
        onScenariosUpdated={vi.fn(async () => {})}
      />,
    );

    expect(
      screen.getByText(/No Network Engineering Scenario Generated Yet/i),
    ).toBeInTheDocument();

    rerender(
      <NetworkEngineeringPanel
        projectId="00000000-0000-4000-8000-000000000001"
        constants={{ count: 0, items: [] }}
        onScenariosUpdated={vi.fn(async () => {})}
        scenariosState={{
          project_id: '00000000-0000-4000-8000-000000000001',
          active_scenario_key: 'HYBRID_OPTIMAL',
          scenarios: [],
          active_scenario: {
            id: 'sc-1',
            project_id: '00000000-0000-4000-8000-000000000001',
            scenario_key: 'HYBRID_OPTIMAL',
            name: 'Least-Cost Hybrid',
            is_active: true,
            requires_tie_in_warning: false,
            total_ht_length_m: 1200,
            total_lt_length_m: 850,
            total_dt_count: 1,
            total_dt_capacity_kva: 63,
            total_ht_poles: 20,
            total_lt_poles: 22,
            max_ht_vdrop_pct: 1.8,
            max_lt_vdrop_pct: 3.2,
            vdrop_compliance_ok: true,
            total_loss_mwh_yr: 12.4,
            total_solar_kwp: 0,
            total_bess_kwh: 0,
            total_shs_kits: 0,
            network_geojson: { type: 'FeatureCollection', features: [] },
            updated_at: '2026-11-06T00:00:00Z',
            clusters: [
              {
                id: 'cel-1',
                scenario_id: 'sc-1',
                project_id: '00000000-0000-4000-8000-000000000001',
                cluster_id: 'cl-1',
                cluster_label: 'H1',
                cluster_name: 'Bheja Main',
                est_households: 42,
                modality: 'GRID_NEW_DT_AND_EXTENSION',
                is_manual_override: true,
                requires_tie_in: false,
                peak_kw_horizon: 24,
                peak_kva_horizon: 26.7,
                energy_kwh_day_horizon: 110,
                annual_energy_mwh_horizon: 40.1,
                dt_count: 1,
                total_dt_rating_kva: 63,
                max_dt_loading_pct: 42.4,
                placed_dts: [],
                ht_length_m: 1200,
                ht_poles_count: 20,
                lt_3ph_length_m: 400,
                lt_1ph_length_m: 450,
                lt_total_length_m: 850,
                max_lt_branch_m: 290,
                lt_poles_count: 22,
                ht_current_a: 1.4,
                ht_drop_v: 198,
                ht_drop_pct: 1.8,
                ht_vdrop_compliant: true,
                lt_current_a: 35,
                lt_drop_v: 13.2,
                lt_drop_pct: 3.2,
                lt_vdrop_compliant: true,
                overall_vdrop_compliant: true,
                load_factor: 0.45,
                load_loss_factor: 0.25,
                ht_line_loss_kwh_yr: 1200,
                lt_line_loss_kwh_yr: 3200,
                dt_no_load_loss_kwh_yr: 1400,
                dt_copper_loss_kwh_yr: 6600,
                total_loss_mwh_yr: 12.4,
                technical_loss_pct: 5.1,
                solar_pv_kwp: 0,
                bess_capacity_kwh: 0,
                inverter_kva: 0,
                shs_kits_count: 0,
                engineering_notes: [],
                updated_at: '2026-11-06T00:00:00Z',
              },
            ],
          },
        }}
      />,
    );

    const clusterSearch = screen.getByLabelText(/^Filter scenario clusters$/i);
    fireEvent.change(clusterSearch, { target: { value: 'UnknownCluster' } });
    expect(screen.getByText(/No Clusters Match Engineering Filter/i)).toBeInTheDocument();

    fireEvent.change(clusterSearch, { target: { value: '' } });
    expect(screen.getAllByText(/Bheja Main/i).length).toBeGreaterThanOrEqual(1);

    // Switching scenarios over manual overrides prompts ConfirmDialog
    const scenarioSelect = screen.getByLabelText(/Select Planning Scenario/i);
    fireEvent.change(scenarioSelect, { target: { value: 'MINIGRID_PRIORITY' } });
    expect(screen.getByText(/Switch Scenario & Replace Manual Overrides\?/i)).toBeInTheDocument();
  });

  it('renders CostAndScenarioComparisonPanel empty state, UNSET filters, and confirmation dialogs', async () => {
    const onUpdateRateItem = vi.fn(async () => {});
    const onResetRates = vi.fn(async () => {});
    const { rerender } = render(
      <CostAndScenarioComparisonPanel
        projectId="00000000-0000-4000-8000-000000000001"
        rates={null}
        comparison={null}
        onUpdateRateItem={onUpdateRateItem}
        onResetRates={onResetRates}
        onImportRatesCsv={vi.fn(async () => ({
          is_valid: true,
          imported_count: 0,
          unset_count: 0,
          unset_item_codes: [],
          errors: [],
          rates: null,
        }))}
        onPinScenario={vi.fn(async () => {})}
      />,
    );

    expect(
      screen.getByText(/Cost Estimation & Schedule of Rates Not Available Yet/i),
    ).toBeInTheDocument();

    rerender(
      <CostAndScenarioComparisonPanel
        projectId="00000000-0000-4000-8000-000000000001"
        onUpdateRateItem={onUpdateRateItem}
        onResetRates={onResetRates}
        onImportRatesCsv={vi.fn(async () => ({
          is_valid: true,
          imported_count: 0,
          unset_count: 0,
          unset_item_codes: [],
          errors: [],
          rates: null,
        }))}
        onPinScenario={vi.fn(async () => {})}
        rates={{
          project_id: '00000000-0000-4000-8000-000000000001',
          template_key: 'ODISHA_2025',
          template_name: 'Odisha OPTCL / TPSODL & MNRE SoR (2025)',
          total_items: 1,
          unset_count: 0,
          unset_item_codes: [],
          user_edited_count: 0,
          items: [
            {
              id: 'rate-1',
              project_id: '00000000-0000-4000-8000-000000000001',
              template_key: 'ODISHA_2025',
              template_name: 'Odisha OPTCL / TPSODL & MNRE SoR (2025)',
              item_code: 'HT_ACSR_LINE_KM',
              description: '11 kV 3-phase ACSR Weasel HT Line',
              category: 'HT_LINE',
              unit: 'km',
              rate_inr: 650000,
              source_type: 'OPTCL_SOR',
              citation: 'TPSODL Cost Data Book FY 2025-26',
              source_year: 2025,
              is_user_edited: false,
              updated_at: '2026-11-06T00:00:00Z',
            },
          ],
        }}
        comparison={{
          project_id: '00000000-0000-4000-8000-000000000001',
          active_scenario_id: 'sc-1',
          active_scenario_key: 'HYBRID_OPTIMAL',
          discount_rate: 0.08,
          horizon_years: 10,
          has_unset_rates: false,
          unset_item_codes: [],
          export_blocked_reason: null,
          scenarios: [],
          habitation_comparisons: [],
          active_scenario_boq: {
            project_id: '00000000-0000-4000-8000-000000000001',
            scenario_id: 'sc-1',
            scenario_key: 'HYBRID_OPTIMAL',
            scenario_name: 'Least-Cost Hybrid',
            is_active_baseline: true,
            discount_rate: 0.08,
            horizon_years: 10,
            gst_pct: 18,
            contingency_pct: 5,
            pmc_overhead_pct: 8,
            capital_subsidy_pct: 60,
            base_equipment_inr: 780000,
            terrain_premium_inr: 39000,
            subtotal_supply_erection_inr: 819000,
            gst_amount_inr: 147420,
            contingency_amount_inr: 40950,
            pmc_overhead_amount_inr: 65520,
            total_capex_inr: 1072890,
            total_capex_lakhs: 10.73,
            has_unset_rates: false,
            unset_item_codes: [],
            export_blocked_reason: null,
            economics: {
              modality: 'HYBRID',
              capex_inr: 1072890,
              capex_lakhs: 10.73,
              capital_subsidy_inr: 643734,
              net_utility_capex_inr: 429156,
              annual_om_inr: 21458,
              annual_energy_purchase_inr: 90000,
              pv_om_inr: 143980,
              pv_energy_purchase_inr: 603900,
              pv_battery_replacement_inr: 0,
              npc_inr: 1820770,
              npc_lakhs: 18.21,
              annual_delivered_energy_kwh: 40100,
              pv_delivered_energy_kwh: 269071,
              lcoe_inr_kwh: 6.77,
              annualized_cost_inr_yr: 271349,
              cost_per_household_inr: 25545,
              npc_per_household_inr: 43352,
              avoided_co2_tonnes_yr: 18.2,
            },
            aggregated_lines: [
              {
                cluster_id: 'cl-1',
                cluster_label: 'H1',
                item_code: 'HT_ACSR_LINE_KM',
                description: '11 kV 3-phase ACSR Weasel HT Line',
                category: 'HT_LINE',
                unit: 'km',
                quantity: 1.2,
                quantity_basis: 'HT feeder route',
                rate_inr: 650000,
                rate_source_type: 'OPTCL_SOR',
                citation: 'TPSODL FY25',
                is_unset: false,
                amount_inr: 780000,
              },
            ],
            cluster_breakdowns: [],
          },
        }}
      />,
    );

    // Toggle UNSET Only on BOQ lines -> shows clean empty state
    fireEvent.click(screen.getByRole('button', { name: /^UNSET Only/i }));
    expect(screen.getByText(/No Matching BOQ Line Items/i)).toBeInTheDocument();

    // Switch to SoR Editor and test Reset + Mark UNSET ConfirmDialogs
    fireEvent.click(screen.getByRole('button', { name: /3\. Schedule of Rates & CSV/i }));
    fireEvent.click(screen.getByRole('button', { name: /Reset to Reference SoR/i }));
    const resetDialog = screen.getByRole('dialog');
    expect(
      within(resetDialog).getByText(/Reset All Rates to Reference Schedule of Rates\?/i),
    ).toBeInTheDocument();
    expect(onResetRates).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(
        within(resetDialog).getByRole('button', { name: /Reset to Reference SoR/i }),
      );
    });
    expect(onResetRates).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Mark UNSET/i }));
    expect(
      screen.getByText(/Mark Unit Rate UNSET & Block DPR Export\?/i),
    ).toBeInTheDocument();
    expect(onUpdateRateItem).not.toHaveBeenCalled();
  });

  it('renders DprExportCenterPanel empty state, blocked button, check status filter, and section search', async () => {
    const onRefresh = vi.fn(async () => {});
    const { rerender } = render(
      <DprExportCenterPanel
        projectId="00000000-0000-4000-8000-000000000001"
        preflight={null}
        exportLog={null}
        onRefreshAuditAndLogs={onRefresh}
      />,
    );

    expect(screen.getByText(/DPR Pre-Flight Audit Not Computed Yet/i)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Run Pre-Flight Audit/i }));
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender(
      <DprExportCenterPanel
        projectId="00000000-0000-4000-8000-000000000001"
        exportLog={{ project_id: '00000000-0000-4000-8000-000000000001', total_exports: 0, items: [] }}
        onRefreshAuditAndLogs={onRefresh}
        preflight={{
          project_id: '00000000-0000-4000-8000-000000000001',
          project_version: 2,
          active_scenario_key: 'HYBRID_OPTIMAL',
          can_export: false,
          hard_blockers_failed: 1,
          soft_warnings_count: 0,
          requires_not_field_verified_watermark: true,
          watermark_text: 'PRELIMINARY — NOT FIELD VERIFIED',
          snapshot_hash: 'abcdef1234567890',
          checks: [
            {
              check_code: 'SOR_COMPLETE',
              title: 'No UNSET SoR unit rates',
              category: 'HARD_BLOCKER',
              status: 'FAIL',
              detail: '1 unit rate is UNSET',
              remediation: 'Provide rate in Step 5',
            },
            {
              check_code: 'AOI_VALID',
              title: 'AOI CRS valid',
              category: 'HARD_BLOCKER',
              status: 'PASS',
              detail: 'EPSG:32644 active',
              remediation: 'None required',
            },
          ],
          sections: [
            {
              section_number: 1,
              section_key: 'exec_summary',
              title: 'Executive Summary',
              group: 'Part A',
              is_populated: true,
              data_status_note: 'Populated from scenario data.',
            },
            {
              section_number: 19,
              section_key: 'tariffs',
              title: 'Tariff Schedule & Cross-Subsidy',
              group: 'Part D',
              is_populated: false,
              data_status_note: 'No data available.',
            },
          ],
        }}
      />,
    );

    const blockedBtn = screen.getByRole('button', { name: /PDF & Excel Export Blocked/i });
    expect(blockedBtn).toBeDisabled();

    // Filter checks by FAIL
    fireEvent.click(screen.getByRole('button', { name: /^Fail \(1\)$/i }));
    expect(screen.getByText('SOR_COMPLETE')).toBeInTheDocument();
    expect(screen.queryByText('AOI_VALID')).not.toBeInTheDocument();

    // Switch to 24-section compilation index & search
    fireEvent.click(screen.getByRole('button', { name: /2\. 24-Section DPR Compilation Index/i }));
    const secSearch = screen.getByPlaceholderText(/Section #, part, title/i);
    fireEvent.change(secSearch, { target: { value: 'Tariff' } });
    expect(screen.getByText(/Tariff Schedule & Cross-Subsidy/i)).toBeInTheDocument();
    expect(screen.queryByText('Executive Summary')).not.toBeInTheDocument();
  });
});
