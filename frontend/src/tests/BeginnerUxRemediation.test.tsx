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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BEGINNER_GLOSSARY,
  formatBoundarySourceLabel,
  formatModalityLabel,
  formatScenarioLabel,
  formatVerificationStateLabel,
} from '../lib/beginnerGlossary';
import { HelpTooltip } from '../components/ui/Tooltip';
import { DataManagementPanel } from '../components/workspace/DataManagementPanel';
import { computeMapDataReadiness } from '../lib/mapDataReadiness';
import { NewProjectWizardPage } from '../pages/NewProjectWizardPage';
import { SettlementAssessmentPanel } from '../components/workspace/SettlementAssessmentPanel';
import { InfrastructureAndDemandPanel } from '../components/workspace/InfrastructureAndDemandPanel';
import { NetworkEngineeringPanel } from '../components/workspace/NetworkEngineeringPanel';
import { CostAndScenarioComparisonPanel } from '../components/workspace/CostAndScenarioComparisonPanel';
import { DprExportCenterPanel } from '../components/workspace/DprExportCenterPanel';
import { useSessionStore } from '../stores/sessionStore';

vi.mock('maplibre-gl', () => {
  class MockMap {
    on = vi.fn((event: string, cb: () => void) => {
      if (event === 'load' || event === 'style.load') cb();
    });
    once = vi.fn((event: string, cb: () => void) => {
      if (event === 'load' || event === 'style.load') cb();
    });
    off = vi.fn();
    addControl = vi.fn();
    resize = vi.fn();
    remove = vi.fn();
    getZoom = vi.fn(() => 13);
    getStyle = vi.fn(() => ({ version: 8, sources: {}, layers: [] }));
    isStyleLoaded = vi.fn(() => true);
    setStyle = vi.fn();
    fitBounds = vi.fn();
    flyTo = vi.fn();
    addSource = vi.fn();
    getSource = vi.fn();
    removeSource = vi.fn();
    addLayer = vi.fn();
    getLayer = vi.fn();
    removeLayer = vi.fn();
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

afterEach(() => {
  vi.restoreAllMocks();
});

const EMPTY_PROJECT_ID = '00000000-0000-4000-8000-000000000099';

describe('Beginner UX Remediation Invariants (FTU-01 through FTU-28)', () => {
  it('opens HelpTooltip plain-language explanation on click and dismisses cleanly on Escape and outside click', () => {
    render(<HelpTooltip glossaryKey="viirsNighttimeLight" />);

    const trigger = screen.getByRole('button', {
      name: /Explain VIIRS Nighttime Radiance/i,
    });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByText(/Nighttime Brightness From Satellite/i),
    ).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByText(/Nighttime Brightness From Satellite/i),
    ).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.pointerDown(document.body);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('mounts NewProjectWizardPage with empty fields (no Koraput prefill) and loads sample values only on explicit click', async () => {
    useSessionStore.setState({
      user: {
        id: 'u-beginner',
        email: 'planner@electrimap.in',
        display_name: 'First Time Planner',
        role: 'planner',
        is_active: true,
      },
      isInitialized: true,
      isLoading: false,
      error: null,
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    render(
      <MemoryRouter>
        <NewProjectWizardPage />
      </MemoryRouter>,
    );

    const projectNameInput = screen.getByLabelText(/Project Name/i) as HTMLInputElement;
    await waitFor(() => {
      expect(projectNameInput.value).toBe('');
    });
    expect(screen.queryByDisplayValue(/Koraput/i)).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(/Bheja/i)).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(/Nandapur/i)).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(/Odisha/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Load Koraput Example/i }));

    expect(screen.getByText(/Loaded Koraput Example Values/i)).toBeInTheDocument();
    expect(projectNameInput.value).toBe('Koraput — Nandapur Tribal Habitation Study');
    expect(screen.getByDisplayValue('Koraput')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Nandapur')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bheja')).toBeInTheDocument();
  });

  it('honors power_factor_cos_phi setting key and keeps Advanced Electricity Load Assumptions collapsed by default (FTU-19)', () => {
    render(
      <InfrastructureAndDemandPanel
        projectId={EMPTY_PROJECT_ID}
        metricEpsg={32644}
        infrastructure={null}
        gapAnalysis={null}
        settings={{
          project_id: EMPTY_PROJECT_ID,
          user_edited_count: 1,
          items: [
            {
              id: 'set-pf',
              project_id: EMPTY_PROJECT_ID,
              key: 'power_factor_cos_phi',
              category: 'DEMAND',
              label: 'Power Factor (cos φ)',
              value: 0.92,
              default_value: 0.85,
              min_value: 0.7,
              max_value: 1.0,
              unit: 'ratio',
              quality_tag: 'USER_ENTERED',
              citation: 'Utility Field Calibration 2026',
              is_user_edited: true,
              override_note: 'Calibrated on rural feeder',
              updated_at: '2026-11-15T00:00:00Z',
            },
          ],
        }}
        demand={{
          project_id: EMPTY_PROJECT_ID,
          total_households: 35,
          total_connected_kw: 42.0,
          peak_kw_base: 18.4,
          peak_kva_base: 20.0,
          energy_kwh_day_base: 95.0,
          annual_energy_mwh_base: 34.7,
          horizon_years: 10,
          annual_growth_rate: 0.04,
          peak_kw_horizon: 27.2,
          peak_kva_horizon: 29.6,
          energy_kwh_day_horizon: 140.0,
          annual_energy_mwh_horizon: 51.1,
          category_totals: [],
          clusters: [],
        }}
        placeTieInModeActive={false}
        onTogglePlaceTieInMode={vi.fn()}
        onInfrastructureAndDemandUpdated={async () => {}}
      />,
    );

    expect(screen.getByText(/Peak demand uses power factor 0\.92/i)).toBeInTheDocument();

    const summaryEl = screen.getByText(/Advanced Electricity Load Assumptions/i);
    const detailsEl = summaryEl.closest('details');
    expect(detailsEl).not.toBeNull();
    expect(detailsEl).not.toHaveAttribute('open');
    expect(screen.getByText(/1 Customized · Standard Govt\. Defaults Pre-Loaded/i)).toBeInTheDocument();
  });

  it('previews scenario choice in NetworkEngineeringPanel and waits for explicit Apply Selected Plan before calling backend (FTU-21)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const onScenariosUpdated = vi.fn(async () => {});

    render(
      <NetworkEngineeringPanel
        projectId={EMPTY_PROJECT_ID}
        metricEpsg={32644}
        constants={null}
        onScenariosUpdated={onScenariosUpdated}
        scenariosState={{
          project_id: EMPTY_PROJECT_ID,
          active_scenario_key: 'HYBRID_OPTIMAL',
          scenarios: [],
          active_scenario: {
            id: 'scen-hybrid',
            project_id: EMPTY_PROJECT_ID,
            scenario_key: 'HYBRID_OPTIMAL',
            name: 'Recommended Mix',
            is_active: true,
            requires_tie_in_warning: false,
            total_ht_length_m: 1000,
            total_lt_length_m: 500,
            total_dt_count: 1,
            total_dt_capacity_kva: 25,
            total_ht_poles: 16,
            total_lt_poles: 12,
            max_ht_vdrop_pct: 1.5,
            max_lt_vdrop_pct: 3.1,
            vdrop_compliance_ok: true,
            total_loss_mwh_yr: 4.2,
            total_solar_kwp: 0,
            total_bess_kwh: 0,
            total_shs_kits: 0,
            network_geojson: { type: 'FeatureCollection', features: [] },
            clusters: [],
            updated_at: '2026-11-15T00:00:00Z',
          },
        }}
      />,
    );

    const scenarioSelect = screen.getByLabelText(/Choose Planning Option/i);
    fireEvent.change(scenarioSelect, { target: { value: 'GRID_EXTENSION_ONLY' } });

    expect(screen.getByText(/Plan Selection Ready to Apply/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Apply Selected Plan/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
    const [requestUrl, requestInit] = fetchSpy.mock.calls[0]!;
    expect(String(requestUrl)).toContain(`/api/v1/projects/${EMPTY_PROJECT_ID}/scenarios/generate`);
    expect(String(requestInit?.body)).toContain('GRID_EXTENSION_ONLY');
    expect(onScenariosUpdated).toHaveBeenCalledTimes(1);
  });

  it('shows honest empty statuses without fake pass/verified pills and supports CSV file upload + Fix in Step X navigation', async () => {
    render(
      <SettlementAssessmentPanel
        projectId={EMPTY_PROJECT_ID}
        metricEpsg={32644}
        settlements={{
          project_id: EMPTY_PROJECT_ID,
          cluster_run_id: null,
          params: { eps_m: 150, min_samples: 5 },
          items: [],
          geojson: { type: 'FeatureCollection', features: [] },
          verification_coverage_pct: 0,
          census_reconciliation: {
            census2011_code: null,
            village_name: null,
            census_2011_households: null,
            projected_base_year_households: null,
            satellite_detected_buildings: 0,
            satellite_residential_buildings: 0,
            satellite_estimated_households: 0,
            delta_households: null,
            delta_pct: null,
            divergence_exceeds_30pct: false,
            reconciliation_note: 'No official census baseline is attached yet.',
          },
        }}
        ledger={null}
        selectedClusterId={null}
        onSelectCluster={vi.fn()}
        onSettlementsUpdated={async () => {}}
      />,
    );

    expect(screen.getByText(/No Census Baseline Linked/i)).toBeInTheDocument();
    expect(screen.queryByText(/Matches Census Within/i)).not.toBeInTheDocument();

    render(
      <CostAndScenarioComparisonPanel
        projectId={EMPTY_PROJECT_ID}
        rates={{
          project_id: EMPTY_PROJECT_ID,
          template_key: 'ODISHA_2025',
          template_name: 'Default Utility Rate List',
          total_items: 1,
          unset_count: 0,
          unset_item_codes: [],
          user_edited_count: 0,
          items: [
            {
              id: 'r-1',
              project_id: EMPTY_PROJECT_ID,
              template_key: 'ODISHA_2025',
              template_name: 'Default Utility Rate List',
              item_code: 'HT-1',
              description: '11 kV Overhead Line',
              category: 'HT_11KV',
              unit: 'km',
              rate_inr: 180000,
              source_type: 'REFERENCE_PUBLIC_DOCUMENT',
              citation: 'Public SoR',
              source_year: 2025,
              is_user_edited: false,
              updated_at: '2026-11-15T00:00:00Z',
            },
          ],
        }}
        comparison={{
          project_id: EMPTY_PROJECT_ID,
          active_scenario_id: 'sc-empty',
          active_scenario_key: 'HYBRID_OPTIMAL',
          discount_rate: 0.08,
          horizon_years: 10,
          has_unset_rates: false,
          unset_item_codes: [],
          export_blocked_reason: null,
          scenarios: [],
          habitation_comparisons: [],
          active_scenario_boq: {
            project_id: EMPTY_PROJECT_ID,
            scenario_id: 'sc-empty',
            scenario_key: 'HYBRID_OPTIMAL',
            scenario_name: 'Hybrid Optimal',
            is_active_baseline: true,
            discount_rate: 0.08,
            horizon_years: 10,
            gst_pct: 18,
            contingency_pct: 5,
            pmc_overhead_pct: 8,
            capital_subsidy_pct: 60,
            base_equipment_inr: 0,
            terrain_premium_inr: 0,
            subtotal_supply_erection_inr: 0,
            gst_amount_inr: 0,
            contingency_amount_inr: 0,
            pmc_overhead_amount_inr: 0,
            total_capex_inr: 0,
            total_capex_lakhs: 0,
            has_unset_rates: false,
            unset_item_codes: [],
            export_blocked_reason: null,
            economics: {
              modality: 'HYBRID',
              capex_inr: 0,
              capex_lakhs: 0,
              capital_subsidy_inr: 0,
              net_utility_capex_inr: 0,
              annual_om_inr: 0,
              annual_energy_purchase_inr: 0,
              pv_om_inr: 0,
              pv_energy_purchase_inr: 0,
              pv_battery_replacement_inr: 0,
              npc_inr: 0,
              npc_lakhs: 0,
              annual_delivered_energy_kwh: 0,
              pv_delivered_energy_kwh: 0,
              lcoe_inr_kwh: 0,
              annualized_cost_inr_yr: 0,
              cost_per_household_inr: 0,
              npc_per_household_inr: 0,
              avoided_co2_tonnes_yr: 0,
            },
            aggregated_lines: [],
            cluster_breakdowns: [],
          },
        }}
        onUpdateRateItem={vi.fn(async () => {})}
        onResetRates={vi.fn(async () => {})}
        onImportRatesCsv={vi.fn(async () => ({
          is_valid: true,
          imported_count: 1,
          unset_count: 0,
          unset_item_codes: [],
          errors: [],
          rates: null,
        }))}
        onPinScenario={vi.fn(async () => {})}
      />,
    );

    expect(screen.getAllByText('Pending Step 4').length).toBeGreaterThanOrEqual(2);
  });

  it('populates Schedule of Rates CSV textarea on file upload and routes Step 6 Fix buttons to Step 5', async () => {
    render(
      <CostAndScenarioComparisonPanel
        projectId={EMPTY_PROJECT_ID}
        rates={{
          project_id: EMPTY_PROJECT_ID,
          template_key: 'ODISHA_2025',
          template_name: 'Default Utility Rate List',
          total_items: 1,
          unset_count: 0,
          unset_item_codes: [],
          user_edited_count: 0,
          items: [
            {
              id: 'r-1',
              project_id: EMPTY_PROJECT_ID,
              template_key: 'ODISHA_2025',
              template_name: 'Default Utility Rate List',
              item_code: 'HT-1',
              description: '11 kV Overhead Line',
              category: 'HT_11KV',
              unit: 'km',
              rate_inr: 180000,
              source_type: 'REFERENCE_PUBLIC_DOCUMENT',
              citation: 'Public SoR',
              source_year: 2025,
              is_user_edited: false,
              updated_at: '2026-11-15T00:00:00Z',
            },
          ],
        }}
        comparison={{
          project_id: EMPTY_PROJECT_ID,
          active_scenario_id: 'sc-empty',
          active_scenario_key: 'HYBRID_OPTIMAL',
          discount_rate: 0.08,
          horizon_years: 10,
          has_unset_rates: false,
          unset_item_codes: [],
          export_blocked_reason: null,
          scenarios: [],
          habitation_comparisons: [],
          active_scenario_boq: {
            project_id: EMPTY_PROJECT_ID,
            scenario_id: 'sc-empty',
            scenario_key: 'HYBRID_OPTIMAL',
            scenario_name: 'Hybrid Optimal',
            is_active_baseline: true,
            discount_rate: 0.08,
            horizon_years: 10,
            gst_pct: 18,
            contingency_pct: 5,
            pmc_overhead_pct: 8,
            capital_subsidy_pct: 60,
            base_equipment_inr: 0,
            terrain_premium_inr: 0,
            subtotal_supply_erection_inr: 0,
            gst_amount_inr: 0,
            contingency_amount_inr: 0,
            pmc_overhead_amount_inr: 0,
            total_capex_inr: 0,
            total_capex_lakhs: 0,
            has_unset_rates: false,
            unset_item_codes: [],
            export_blocked_reason: null,
            economics: {
              modality: 'HYBRID',
              capex_inr: 0,
              capex_lakhs: 0,
              capital_subsidy_inr: 0,
              net_utility_capex_inr: 0,
              annual_om_inr: 0,
              annual_energy_purchase_inr: 0,
              pv_om_inr: 0,
              pv_energy_purchase_inr: 0,
              pv_battery_replacement_inr: 0,
              npc_inr: 0,
              npc_lakhs: 0,
              annual_delivered_energy_kwh: 0,
              pv_delivered_energy_kwh: 0,
              lcoe_inr_kwh: 0,
              annualized_cost_inr_yr: 0,
              cost_per_household_inr: 0,
              npc_per_household_inr: 0,
              avoided_co2_tonnes_yr: 0,
            },
            aggregated_lines: [],
            cluster_breakdowns: [],
          },
        }}
        onUpdateRateItem={vi.fn(async () => {})}
        onResetRates={vi.fn(async () => {})}
        onImportRatesCsv={vi.fn(async () => ({
          is_valid: true,
          imported_count: 1,
          unset_count: 0,
          unset_item_codes: [],
          errors: [],
          rates: null,
        }))}
        onPinScenario={vi.fn(async () => {})}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /3\. Edit Unit Prices & CSV/i }));
    const csvPayload =
      'item_code,description,category,unit,rate_inr,source_type,citation,source_year\nHT-1,11kV Line,HT_11KV,km,195000,USER_TEMPLATE,Custom SoR,2026';
    const csvFile = new File([csvPayload], 'rates.csv', { type: 'text/csv' });
    if (typeof csvFile.text !== 'function') {
      Object.defineProperty(csvFile, 'text', { value: async () => csvPayload });
    }
    const csvInput = screen.getByLabelText(/Upload Schedule of Rates CSV file/i);
    fireEvent.change(csvInput, { target: { files: [csvFile] } });

    await waitFor(() => {
      expect(
        screen.getByLabelText(/Schedule of Rates CSV Content/i),
      ).toHaveValue(csvPayload);
    });
    expect(screen.getByRole('button', { name: /Validate & Import CSV/i })).toBeEnabled();

    const onNavigateSection = vi.fn();
    render(
      <DprExportCenterPanel
        projectId={EMPTY_PROJECT_ID}
        exportLog={null}
        onRefreshAuditAndLogs={async () => {}}
        onNavigateSection={onNavigateSection}
        preflight={{
          project_id: EMPTY_PROJECT_ID,
          project_version: 1,
          active_scenario_key: 'HYBRID_OPTIMAL',
          can_export: false,
          hard_blockers_failed: 1,
          soft_warnings_count: 0,
          requires_not_field_verified_watermark: true,
          watermark_text: 'PRELIMINARY — REQUIRES FIELD VALIDATION',
          snapshot_hash: '0'.repeat(64),
          checks: [
            {
              check_code: 'SOR_COMPLETE',
              title: 'Equipment prices filled',
              category: 'HARD_BLOCKER',
              status: 'FAIL',
              detail: '1 unit price is missing',
              remediation: 'Open Step 5 to fill unit prices.',
            },
          ],
          sections: [],
        }}
      />,
    );

    expect(
      screen.getByRole('button', { name: /PDF & Excel Locked \(1 Step Needed\)/i }),
    ).toBeDisabled();
    expect(screen.getByText(/0\/24 Populated/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Fix in Step 5/i }));
    expect(onNavigateSection).toHaveBeenCalledWith('cost');
  });

  it('syncs all backend enum labels, adds the 8 technical glossary keys, and uses NPC terminology', () => {
    expect(formatScenarioLabel('GRID_EXTENSION_ONLY')).toContain('Grid Extension');
    expect(formatScenarioLabel('MINIGRID_PRIORITY')).toContain('Solar Microgrid');
    expect(formatScenarioLabel('SHS_DISPERSED')).toContain('Standalone Home Solar');

    expect(formatModalityLabel('GRID_AUGMENTATION')).toContain('Grid Augmentation');
    expect(formatModalityLabel('SOLAR_MINIGRID')).toContain('Solar Microgrid');
    expect(formatModalityLabel('UNSET_INFRA_REQUIRED')).toContain('11 kV Tie-In');

    expect(formatBoundarySourceLabel('LGD_SEARCH')).toBe('Official Village Record');
    expect(formatBoundarySourceLabel('DRAWN_POLYGON')).toBe('Drawn on Map');
    expect(formatBoundarySourceLabel('UPLOADED_GEOJSON')).toBe('Uploaded Boundary File');

    expect(formatVerificationStateLabel('UTILITY_VERIFIED')).toBe(
      'Utility Verified (DISCOM)',
    );

    expect(BEGINNER_GLOSSARY.capexOpexNpvLcoe.term).toContain('NPC');
    expect(BEGINNER_GLOSSARY.demSlope.plainTitle).toBeTruthy();
    expect(BEGINNER_GLOSSARY.worldCover.plainTitle).toBeTruthy();
    expect(BEGINNER_GLOSSARY.dbscanClustering.whatItMeans).toContain('150 m, 5 buildings');
    expect(BEGINNER_GLOSSARY.householdMultiplier.plainTitle).toBeTruthy();
    expect(BEGINNER_GLOSSARY.axis1Axis2.plainTitle).toBeTruthy();
    expect(BEGINNER_GLOSSARY.settlementBuffer.plainTitle).toBeTruthy();
    expect(BEGINNER_GLOSSARY.sldDiagram.plainTitle).toBeTruthy();
    expect(BEGINNER_GLOSSARY.verificationCoverage.plainTitle).toBeTruthy();
  });

  it('renders task-focused Step 1 (Get your map ready) with honest Ready/Partially available/Action needed statuses and collapsed provenance', () => {
    const emptyReadiness = computeMapDataReadiness([]);
    expect(emptyReadiness.label).toBe('Action needed');

    const partialReadiness = computeMapDataReadiness([
      {
        id: 'l-1',
        project_id: EMPTY_PROJECT_ID,
        layer_key: 'buildings',
        status: 'READY',
        retrieved_at: '2026-11-16T00:00:00Z',
        feature_count: 42,
        bbox: null,
        summary_metrics: {
          data_source_mode: 'LOCAL_GEOJSON_EXTRACT',
          residential_count: 42,
        },
        error_message: null,
        cache_key: 'bld_1',
        dataset: null,
      },
      {
        id: 'l-2',
        project_id: EMPTY_PROJECT_ID,
        layer_key: 'nightlights',
        status: 'READY',
        retrieved_at: '2026-11-16T00:00:00Z',
        feature_count: 0,
        bbox: null,
        summary_metrics: {
          availability: 'NO_LOCAL_VIIRS_RASTER',
          is_unavailable: true,
        },
        error_message: null,
        cache_key: 'nl_unavail',
        dataset: null,
      },
    ]);
    expect(partialReadiness.label).toBe('Partially available');

    const onNext = vi.fn();
    render(
      <DataManagementPanel
        projectId={EMPTY_PROJECT_ID}
        metricEpsg={32644}
        layers={[
          {
            id: 'l-1',
            project_id: EMPTY_PROJECT_ID,
            layer_key: 'buildings',
            status: 'READY',
            retrieved_at: '2026-11-16T00:00:00Z',
            feature_count: 42,
            bbox: null,
            summary_metrics: {
              data_source_mode: 'LOCAL_GEOJSON_EXTRACT',
              residential_count: 42,
            },
            error_message: null,
            cache_key: 'bld_1',
            dataset: null,
          },
          {
            id: 'l-2',
            project_id: EMPTY_PROJECT_ID,
            layer_key: 'nightlights',
            status: 'READY',
            retrieved_at: '2026-11-16T00:00:00Z',
            feature_count: 0,
            bbox: null,
            summary_metrics: {
              availability: 'NO_LOCAL_VIIRS_RASTER',
              is_unavailable: true,
            },
            error_message: null,
            cache_key: 'nl_unavail',
            dataset: null,
          },
        ]}
        visibleVectorLayers={{ buildings: true }}
        onToggleVectorLayer={vi.fn()}
        activeRasterOverlay="none"
        onChangeRasterOverlay={vi.fn()}
        rasterOpacity={0.65}
        onChangeRasterOpacity={vi.fn()}
        onLayersUpdated={async () => {}}
        onContinueToNextStep={onNext}
      />,
    );

    expect(screen.getByText('Get your map ready')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fetch map data/i })).toBeInTheDocument();
    expect(screen.getAllByText('Partially available').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Nighttime Lights Unavailable Offline/i)).toBeInTheDocument();

    const summaryEl = screen.getByText(/Data sources & technical information/i);
    const detailsEl = summaryEl.closest('details');
    expect(detailsEl).not.toBeNull();
    expect(detailsEl).not.toHaveAttribute('open');

    fireEvent.click(screen.getByRole('button', { name: /Next: Villages & Habitations/i }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('foregrounds 3 cost headlines, hides technical details inside expandable sections, and allows inline BOQ rate edits', async () => {
    const onUpdateRateItem = vi.fn(async () => {});
    render(
      <CostAndScenarioComparisonPanel
        projectId={EMPTY_PROJECT_ID}
        onUpdateRateItem={onUpdateRateItem}
        onResetRates={vi.fn(async () => {})}
        onImportRatesCsv={vi.fn(async () => ({
          is_valid: true,
          imported_count: 1,
          unset_count: 0,
          unset_item_codes: [],
          errors: [],
          rates: null,
        }))}
        onPinScenario={vi.fn(async () => {})}
        rates={{
          project_id: EMPTY_PROJECT_ID,
          template_key: 'ODISHA_2025',
          template_name: 'Odisha Reference Schedule of Rates (FY 2024-25)',
          total_items: 2,
          unset_count: 0,
          unset_item_codes: [],
          user_edited_count: 0,
          items: [
            {
              id: 'r-1',
              project_id: EMPTY_PROJECT_ID,
              template_key: 'ODISHA_2025',
              template_name: 'Odisha Reference Schedule of Rates (FY 2024-25)',
              item_code: 'HT-COND-ACSR-50',
              description: '11 kV 3-Phase Overhead Line ACSR Rabbit',
              category: 'HT_11KV',
              unit: 'km',
              rate_inr: 185000,
              source_type: 'REFERENCE_PUBLIC_DOCUMENT',
              citation: 'OPTCL / Odisha DISCOM Unified Schedule of Rates',
              source_year: 2025,
              is_user_edited: false,
              updated_at: '2026-11-16T00:00:00Z',
            },
            {
              id: 'r-2',
              project_id: EMPTY_PROJECT_ID,
              template_key: 'ODISHA_2025',
              template_name: 'Odisha Reference Schedule of Rates (FY 2024-25)',
              item_code: 'DT-POLE-25KVA',
              description: '25 kVA 11/0.4 kV Pole-Mounted Distribution Transformer',
              category: 'DT_SUBSTATION',
              unit: 'No.',
              rate_inr: 142000,
              source_type: 'REFERENCE_PUBLIC_DOCUMENT',
              citation: 'OPTCL / Odisha DISCOM Unified Schedule of Rates',
              source_year: 2025,
              is_user_edited: false,
              updated_at: '2026-11-16T00:00:00Z',
            },
          ],
        }}
        comparison={{
          project_id: EMPTY_PROJECT_ID,
          active_scenario_id: 'sc-opt',
          active_scenario_key: 'HYBRID_OPTIMAL',
          discount_rate: 0.08,
          horizon_years: 20,
          has_unset_rates: false,
          unset_item_codes: [],
          export_blocked_reason: null,
          scenarios: [
            {
              scenario_id: 'sc-opt',
              scenario_key: 'HYBRID_OPTIMAL',
              scenario_name: 'Hybrid Optimal (Grid + Microgrid)',
              is_active_baseline: true,
              requires_tie_in_warning: false,
              vdrop_compliance_ok: true,
              total_households_served: 95,
              annual_delivered_energy_mwh: 120.5,
              modality_counts: { GRID_EXTENSION: 1 },
              base_equipment_inr: 2400000,
              terrain_premium_inr: 240000,
              gst_amount_inr: 475200,
              contingency_amount_inr: 79200,
              pmc_overhead_amount_inr: 132000,
              total_capex_inr: 3326400,
              total_capex_lakhs: 33.26,
              capital_subsidy_inr: 2993760,
              net_utility_capex_inr: 332640,
              annual_om_inr: 95000,
              annual_energy_purchase_inr: 180000,
              npc_inr: 6026400,
              npc_lakhs: 60.26,
              lcoe_inr_kwh: 6.45,
              cost_per_household_inr: 35015,
              npc_per_household_inr: 63436,
              avoided_co2_tonnes_yr: 38.2,
              has_unset_rates: false,
              unset_item_codes: [],
            },
          ],
          habitation_comparisons: [],
          active_scenario_boq: {
            project_id: EMPTY_PROJECT_ID,
            scenario_id: 'sc-opt',
            scenario_key: 'HYBRID_OPTIMAL',
            scenario_name: 'Hybrid Optimal (Grid + Microgrid)',
            is_active_baseline: true,
            discount_rate: 0.08,
            horizon_years: 20,
            gst_pct: 18,
            contingency_pct: 3,
            pmc_overhead_pct: 5,
            capital_subsidy_pct: 90,
            base_equipment_inr: 2400000,
            terrain_premium_inr: 240000,
            subtotal_supply_erection_inr: 2640000,
            gst_amount_inr: 475200,
            contingency_amount_inr: 79200,
            pmc_overhead_amount_inr: 132000,
            total_capex_inr: 3326400,
            total_capex_lakhs: 33.26,
            has_unset_rates: false,
            unset_item_codes: [],
            export_blocked_reason: null,
            economics: {
              modality: 'HYBRID_OPTIMAL',
              capex_inr: 3326400,
              capex_lakhs: 33.26,
              capital_subsidy_inr: 2993760,
              net_utility_capex_inr: 332640,
              annual_om_inr: 95000,
              annual_energy_purchase_inr: 180000,
              pv_om_inr: 932724,
              pv_energy_purchase_inr: 1767266,
              pv_battery_replacement_inr: 145000,
              npc_inr: 6026400,
              npc_lakhs: 60.26,
              annual_delivered_energy_kwh: 120500,
              pv_delivered_energy_kwh: 1182900,
              lcoe_inr_kwh: 6.45,
              annualized_cost_inr_yr: 613802,
              cost_per_household_inr: 35015,
              npc_per_household_inr: 63436,
              avoided_co2_tonnes_yr: 38.2,
            },
            aggregated_lines: [
              {
                cluster_id: null,
                cluster_label: 'ALL',
                item_code: 'HT-COND-ACSR-50',
                description: '11 kV 3-Phase Overhead Line ACSR Rabbit',
                category: 'HT_11KV',
                unit: 'km',
                quantity: 2.5,
                quantity_basis: '11 kV spur length * 1.15 terrain factor',
                rate_inr: 185000,
                rate_source_type: 'REFERENCE_PUBLIC_DOCUMENT',
                citation: 'OPTCL / Odisha DISCOM Unified Schedule of Rates',
                is_unset: false,
                amount_inr: 462500,
              },
            ],
            cluster_breakdowns: [
              {
                cluster_id: 'cl-1',
                cluster_label: 'CL-01',
                cluster_name: 'Bheja Main Core',
                modality: 'GRID_EXTENSION',
                est_households: 95,
                terrain_multiplier: 1.1,
                terrain_classification: 'Moderate Hill',
                base_equipment_inr: 2400000,
                terrain_premium_inr: 240000,
                subtotal_supply_erection_inr: 2640000,
                gst_amount_inr: 475200,
                contingency_amount_inr: 79200,
                pmc_overhead_amount_inr: 132000,
                total_capex_inr: 3326400,
                total_capex_lakhs: 33.26,
                has_unset_rates: false,
                unset_item_codes: [],
                economics: {
                  modality: 'GRID_EXTENSION',
                  capex_inr: 3326400,
                  capex_lakhs: 33.26,
                  capital_subsidy_inr: 2993760,
                  net_utility_capex_inr: 332640,
                  annual_om_inr: 95000,
                  annual_energy_purchase_inr: 180000,
                  pv_om_inr: 932724,
                  pv_energy_purchase_inr: 1767266,
                  pv_battery_replacement_inr: 0,
                  npc_inr: 6026400,
                  npc_lakhs: 60.26,
                  annual_delivered_energy_kwh: 120500,
                  pv_delivered_energy_kwh: 1182900,
                  lcoe_inr_kwh: 6.45,
                  annualized_cost_inr_yr: 613802,
                  cost_per_household_inr: 35015,
                  npc_per_household_inr: 63436,
                  avoided_co2_tonnes_yr: 38.2,
                },
                lines: [
                  {
                    cluster_id: 'cl-1',
                    cluster_label: 'CL-01',
                    item_code: 'HT-COND-ACSR-50',
                    description: '11 kV 3-Phase Overhead Line ACSR Rabbit',
                    category: 'HT_11KV',
                    unit: 'km',
                    quantity: 2.5,
                    quantity_basis: '11 kV spur length * 1.15 terrain factor',
                    rate_inr: 185000,
                    rate_source_type: 'REFERENCE_PUBLIC_DOCUMENT',
                    citation: 'OPTCL / Odisha DISCOM Unified Schedule of Rates',
                    is_unset: false,
                    amount_inr: 462500,
                  },
                ],
              },
            ],
          },
        }}
      />,
    );

    // 3 headline cards + honest preliminary notice
    expect(screen.getByText('Estimated project cost')).toBeInTheDocument();
    expect(screen.getByText('Upfront cost per household')).toBeInTheDocument();
    expect(screen.getByText('Recommended electrification plan')).toBeInTheDocument();
    expect(screen.queryByText(/Unit Prices Set/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+\/\d+\s+Priced/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^ESTIMATED$/)).not.toBeInTheDocument();
    expect(screen.getByText(/Field-verified \/ Approved:/i)).toBeInTheDocument();

    // Financial details & Rate sources collapsed by default
    const financialDetails = screen.getByText('Financial details').closest('details');
    expect(financialDetails).not.toBeNull();
    expect(financialDetails).not.toHaveAttribute('open');

    const rateSourcesDetails = screen.getByText('Rate sources & assumptions').closest('details');
    expect(rateSourcesDetails).not.toBeNull();
    expect(rateSourcesDetails).not.toHaveAttribute('open');

    // Simplified 4-column BOQ translates category code & keeps technical details collapsed per row
    expect(screen.getByText('11 kV High-Tension Line')).toBeInTheDocument();
    expect(screen.queryByText('HT-COND-ACSR-50')).not.toBeInTheDocument();
    expect(screen.queryByText('CL-01')).not.toBeInTheDocument();

    // Expanding row reveals technical code, methodology, settlement label, and inline price editor
    fireEvent.click(
      screen.getByRole('button', {
        name: /Show details for 11 kV 3-Phase Overhead Line ACSR Rabbit/i,
      }),
    );
    expect(screen.getByText('HT-COND-ACSR-50')).toBeInTheDocument();
    expect(screen.getByText(/11 kV spur length \* 1.15 terrain factor/i)).toBeInTheDocument();
    expect(screen.getByText('(CL-01)')).toBeInTheDocument();

    const rateInput = screen.getByLabelText('Inline unit price for HT-COND-ACSR-50');
    fireEvent.change(rateInput, { target: { value: '195000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Price' }));
    await waitFor(() => {
      expect(onUpdateRateItem).toHaveBeenCalledWith('HT-COND-ACSR-50', 195000);
    });
  });
});
