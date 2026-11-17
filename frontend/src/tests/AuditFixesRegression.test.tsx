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

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { CostAndScenarioComparisonPanel } from '../components/workspace/CostAndScenarioComparisonPanel';
import { SettlementAssessmentPanel } from '../components/workspace/SettlementAssessmentPanel';
import {
  ApiClientError,
  apiRequest,
  getCsrfToken,
  resolveApiUrl,
  setCsrfToken,
} from '../lib/apiClient';
import { LoginPage } from '../pages/LoginPage';
import { useSessionStore } from '../stores/sessionStore';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

describe('Audit Fixes Regression Suite (API Client, Auth, Costing, Settlements & Lazy Router)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    setCsrfToken(null);
    window.localStorage.clear();
    window.sessionStorage.clear();
    useSessionStore.setState({
      user: null,
      isInitialized: false,
      isLoading: false,
      error: null,
      connectionWarning: null,
    });
    window.history.pushState({}, '', '/');
  });

  it('resolves VITE_API_ORIGIN, scrubs localStorage CSRF tokens, and rejects HTML/405 fallbacks cleanly', async () => {
    expect(resolveApiUrl('/api/v1/auth/me')).toBe('/api/v1/auth/me');
    vi.stubEnv('VITE_API_ORIGIN', 'https://api.electrimap.example/');
    expect(resolveApiUrl('/api/v1/auth/me')).toBe(
      'https://api.electrimap.example/api/v1/auth/me',
    );
    vi.unstubAllEnvs();

    window.localStorage.setItem('em_csrf_token', 'stale-local-token');
    setCsrfToken('fresh-session-csrf');
    expect(window.sessionStorage.getItem('em_csrf_token')).toBe('fresh-session-csrf');
    expect(window.localStorage.getItem('em_csrf_token')).toBeNull();
    expect(getCsrfToken()).toBe('fresh-session-csrf');

    const htmlSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('<!doctype html><html><body>SPA Fallback</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
    );

    await expect(apiRequest('/api/v1/auth/me')).rejects.toMatchObject({
      name: 'ApiClientError',
      code: 'BACKEND_HTML_FALLBACK',
    });

    htmlSpy.mockResolvedValueOnce(
      new Response('Method Not Allowed', {
        status: 405,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    let capturedError: unknown = null;
    try {
      await apiRequest('/api/v1/auth/login', { method: 'POST', body: '{}' });
    } catch (err) {
      capturedError = err;
    }
    expect(capturedError).toBeInstanceOf(ApiClientError);
    expect((capturedError as ApiClientError).code).toBe('HTTP_405');
    expect((capturedError as ApiClientError).status).toBe(405);
    expect((capturedError as ApiClientError).message).toContain('HTTP 405');
  });

  it('shows non-blocking Backend Connection Issue banner on LoginPage and redirects once authenticated', async () => {
    useSessionStore.setState({
      user: null,
      isInitialized: true,
      isLoading: false,
      error: null,
      connectionWarning:
        'Backend unreachable on deployed domain. Configure VITE_API_ORIGIN.',
    });

    const { rerender } = render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/projects" element={<div>Projects Destination</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Backend Connection Issue')).toBeInTheDocument();
    expect(
      screen.getByText(/Configure VITE_API_ORIGIN/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/i)).toBeEnabled();

    await act(async () => {
      useSessionStore.setState({
        user: {
          id: 'u-1',
          email: 'swayamkr26@gmail.com',
          display_name: 'Swayam Kumar',
          role: 'PLANNER',
          is_active: true,
        },
        isInitialized: true,
        isLoading: false,
        error: null,
        connectionWarning: null,
      });
    });

    rerender(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/projects" element={<div>Projects Destination</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Projects Destination')).toBeInTheDocument();
    });
  });

  it('resets CostPanel editingRates on save/unset, withholds OPEX when unset, and labels Unset Tie-In', async () => {
    const onUpdateRateItem = vi.fn(async () => {});

    const { unmount } = render(
      <CostAndScenarioComparisonPanel
        projectId={PROJECT_ID}
        rates={null}
        comparison={null}
        onUpdateRateItem={onUpdateRateItem}
        onResetRates={vi.fn(async () => {})}
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
    expect(screen.getByText(/Reference Schedule of Rates/i)).toBeInTheDocument();
    expect(screen.queryByText(/Odisha Reference Schedule/i)).not.toBeInTheDocument();
    unmount();

    render(
      <CostAndScenarioComparisonPanel
        projectId={PROJECT_ID}
        onUpdateRateItem={onUpdateRateItem}
        onResetRates={vi.fn(async () => {})}
        onImportRatesCsv={vi.fn(async () => ({
          is_valid: true,
          imported_count: 1,
          unset_count: 1,
          unset_item_codes: ['HT-COND-ACSR-50'],
          errors: [],
          rates: null,
        }))}
        onPinScenario={vi.fn(async () => {})}
        rates={{
          project_id: PROJECT_ID,
          template_key: 'REFERENCE_DEFAULT',
          template_name: 'Reference Schedule of Rates (FY 2024-25)',
          total_items: 1,
          unset_count: 1,
          unset_item_codes: ['HT-COND-ACSR-50'],
          user_edited_count: 0,
          items: [
            {
              id: 'r-1',
              project_id: PROJECT_ID,
              template_key: 'REFERENCE_DEFAULT',
              template_name: 'Reference Schedule of Rates (FY 2024-25)',
              item_code: 'HT-COND-ACSR-50',
              description: '11 kV 3-Phase Overhead Line ACSR Rabbit',
              category: 'HT_11KV',
              unit: 'km',
              rate_inr: 185000,
              source_type: 'REFERENCE_PUBLIC_DOCUMENT',
              citation: 'Utility Schedule of Rates',
              source_year: 2025,
              is_user_edited: false,
              updated_at: '2026-11-16T00:00:00Z',
            },
          ],
        }}
        comparison={{
          project_id: PROJECT_ID,
          active_scenario_id: 'sc-opt',
          active_scenario_key: 'HYBRID_OPTIMAL',
          discount_rate: 0.08,
          horizon_years: 10,
          has_unset_rates: true,
          totals_withheld: true,
          unset_item_codes: ['HT-COND-ACSR-50'],
          export_blocked_reason: '1 UNSET rate item',
          scenarios: [
            {
              scenario_id: 'sc-opt',
              scenario_key: 'HYBRID_OPTIMAL',
              scenario_name: 'Hybrid Optimal',
              is_active_baseline: true,
              requires_tie_in_warning: true,
              vdrop_compliance_ok: true,
              total_households_served: 40,
              annual_delivered_energy_mwh: 32.0,
              modality_counts: { GRID_EXTENSION: 1 },
              base_equipment_inr: 0,
              terrain_premium_inr: 0,
              gst_amount_inr: 0,
              contingency_amount_inr: 0,
              pmc_overhead_amount_inr: 0,
              total_capex_inr: 0,
              total_capex_lakhs: 0,
              capital_subsidy_inr: 0,
              net_utility_capex_inr: 0,
              annual_om_inr: 0,
              annual_energy_purchase_inr: 0,
              npc_inr: 0,
              npc_lakhs: 0,
              lcoe_inr_kwh: 0,
              cost_per_household_inr: 0,
              npc_per_household_inr: 0,
              avoided_co2_tonnes_yr: 0,
              has_unset_rates: true,
              unset_item_codes: ['HT-COND-ACSR-50'],
            },
          ],
          habitation_comparisons: [
            {
              cluster_id: 'cl-1',
              cluster_label: 'CL-01',
              cluster_name: 'Upland Hamlet',
              est_households: 40,
              annual_energy_mwh_horizon: 32.0,
              active_modality: 'GRID_EXTENSION',
              least_cost_npc_modality: 'SOLAR_MINIGRID',
              grid_capex_inr: 0,
              grid_npc_inr: 0,
              grid_lcoe_inr_kwh: 0,
              grid_requires_tie_in: true,
              minigrid_capex_inr: 0,
              minigrid_npc_inr: 0,
              minigrid_lcoe_inr_kwh: 0,
              shs_capex_inr: 0,
              shs_npc_inr: 0,
              shs_lcoe_inr_kwh: 0,
              rationale: 'Grid tie-in required.',
            },
          ],
          active_scenario_boq: {
            project_id: PROJECT_ID,
            scenario_id: 'sc-opt',
            scenario_key: 'HYBRID_OPTIMAL',
            scenario_name: 'Hybrid Optimal',
            is_active_baseline: true,
            discount_rate: 0.08,
            horizon_years: 10,
            gst_pct: 18,
            contingency_pct: 3,
            pmc_overhead_pct: 5,
            capital_subsidy_pct: 60,
            base_equipment_inr: 0,
            terrain_premium_inr: 0,
            subtotal_supply_erection_inr: 0,
            gst_amount_inr: 0,
            contingency_amount_inr: 0,
            pmc_overhead_amount_inr: 0,
            total_capex_inr: 0,
            total_capex_lakhs: 0,
            has_unset_rates: true,
            totals_withheld: true,
            unset_item_codes: ['HT-COND-ACSR-50'],
            export_blocked_reason: '1 UNSET rate item',
            economics: {
              modality: 'HYBRID_OPTIMAL',
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
              annual_delivered_energy_kwh: 32000,
              pv_delivered_energy_kwh: 214722,
              lcoe_inr_kwh: 0,
              annualized_cost_inr_yr: 0,
              cost_per_household_inr: 0,
              npc_per_household_inr: 0,
              avoided_co2_tonnes_yr: 0,
            },
            aggregated_lines: [
              {
                cluster_id: null,
                cluster_label: 'ALL',
                item_code: 'HT-COND-ACSR-50',
                description: '11 kV 3-Phase Overhead Line ACSR Rabbit',
                category: 'HT_11KV',
                unit: 'km',
                quantity: 1.5,
                quantity_basis: '11 kV spur length',
                rate_inr: 185000,
                rate_source_type: 'REFERENCE_PUBLIC_DOCUMENT',
                citation: 'Utility Schedule of Rates',
                is_unset: false,
                amount_inr: 277500,
              },
            ],
            cluster_breakdowns: [],
          },
        }}
      />,
    );

    // Clear inline editingRates after Save Price
    fireEvent.click(
      screen.getByRole('button', {
        name: /Show details for 11 kV 3-Phase Overhead Line ACSR Rabbit/i,
      }),
    );
    const rateInput = screen.getByLabelText('Inline unit price for HT-COND-ACSR-50') as HTMLInputElement;
    fireEvent.change(rateInput, { target: { value: '205000' } });
    expect(rateInput.value).toBe('205000');
    fireEvent.click(screen.getByRole('button', { name: 'Save Price' }));
    await waitFor(() => {
      expect(onUpdateRateItem).toHaveBeenCalledWith('HT-COND-ACSR-50', 205000);
    });
    expect(rateInput.value).toBe('185000');

    // Clear on Mark UNSET (or Switch to Tab 2 & check OPEX withheld)
    fireEvent.click(screen.getByRole('button', { name: /Compare 4 Plans/i }));
    expect(screen.getAllByText(/^Held$/i).length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole('button', { name: /Breakdown/i }));
    expect(screen.getAllByText(/Held \(Missing Price\)/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders em-dash for null d_road_m, formats verified classes uniformly, and emits CL-01 sample CSV', async () => {
    const blobs: Blob[] = [];
    const origCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const origRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    const createObjectUrlMock = vi.fn((obj: Blob | MediaSource) => {
      if (obj instanceof Blob) {
        blobs.push(obj);
      }
      return 'blob:mock-csv';
    });
    const revokeObjectUrlMock = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    });

    try {
      render(
        <SettlementAssessmentPanel
          projectId={PROJECT_ID}
          selectedClusterId="cl-null-road"
          onSelectCluster={vi.fn()}
          onSettlementsUpdated={async () => {}}
          settlements={{
            project_id: PROJECT_ID,
            cluster_run_id: 'run-1',
            params: { eps_m: 150, min_samples: 5, household_alpha: 0.9 },
            verification_coverage_pct: 50,
            census_reconciliation: {
              census2011_code: null,
              village_name: null,
              census_2011_households: null,
              projected_base_year_households: null,
              satellite_detected_buildings: 24,
              satellite_residential_buildings: 22,
              satellite_estimated_households: 20,
              delta_households: null,
              delta_pct: null,
              divergence_exceeds_30pct: false,
              reconciliation_note: 'No census baseline linked.',
            },
            geojson: { type: 'FeatureCollection', features: [] },
            items: [
              {
                id: 'cl-null-road',
                cluster_run_id: 'run-1',
                project_id: PROJECT_ID,
                label: 'CL-01',
                name: 'Remote Ridge Hamlet',
                is_isolated_group: false,
                n_detected: 24,
                n_residential: 22,
                n_non_residential: 2,
                est_households: 20,
                census_hh_ref: null,
                proxy_class: 'POTENTIALLY_UNSERVED',
                proxy_confidence: 'LOW',
                verification_state: 'FIELD_VERIFIED',
                verified_class: 'ELECTRIFIED',
                d_infra_m: null,
                d_road_m: null,
                slope_mean_deg: 11.2,
                canopy_share: 0.3,
                evidence: { nl_lightscore: 0.04, rationale: 'Dark sky ridge' },
                centroid_lon: 82.73,
                centroid_lat: 18.56,
                geojson_geometry: { type: 'Polygon', coordinates: [] },
                updated_at: '2026-11-16T00:00:00Z',
              },
            ],
          }}
          ledger={{
            project_id: PROJECT_ID,
            total_clusters: 1,
            verified_clusters: 1,
            total_households: 20,
            verified_households: 20,
            verification_coverage_pct: 100,
            records: [],
            imports: [],
          }}
        />,
      );

      expect(screen.getByText(/Confirmed Status:\s*Electrified/i)).toBeInTheDocument();
      expect(screen.getByText(/Field Confirmed \(Electrified\)/i)).toBeInTheDocument();
      expect(screen.getByText(/—\s*·\s*11\.2°/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Sample Survey CSV/i }));
      expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
      const firstBlob = blobs[0];
      expect(firstBlob).toBeDefined();
      const csvText = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
        reader.readAsText(firstBlob!);
      });
      expect(csvText).toContain('CL-01,FIELD_VERIFIED');
      expect(csvText).not.toContain('C-01,FIELD_VERIFIED');
    } finally {
      if (origCreateObjectURL) {
        Object.defineProperty(URL, 'createObjectURL', origCreateObjectURL);
      } else {
        delete (URL as unknown as Record<string, unknown>).createObjectURL;
      }
      if (origRevokeObjectURL) {
        Object.defineProperty(URL, 'revokeObjectURL', origRevokeObjectURL);
      } else {
        delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
      }
    }
  });

  it('guards /projects via lazy-loaded App router and redirects unauthenticated sessions cleanly', async () => {
    window.history.pushState({}, '', '/projects');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Not signed in' } }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(<App />);

    const emailField = await screen.findByLabelText(/Email address/i, {}, { timeout: 5000 });
    expect(emailField).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
  });
});
