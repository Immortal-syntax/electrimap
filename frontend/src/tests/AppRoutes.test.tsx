import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from '../pages/LoginPage';
import { ProvenanceChip } from '../components/ui/ProvenanceChip';
import { JobProgress } from '../components/ui/JobProgress';
import { DataManagementPanel } from '../components/workspace/DataManagementPanel';
import { SettlementAssessmentPanel } from '../components/workspace/SettlementAssessmentPanel';
import { InfrastructureAndDemandPanel } from '../components/workspace/InfrastructureAndDemandPanel';
import { NetworkEngineeringPanel } from '../components/workspace/NetworkEngineeringPanel';

describe('Milestone M1, M2, M3, M4 & M5 Frontend Components', () => {
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
});
