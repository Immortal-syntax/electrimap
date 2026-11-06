import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from '../pages/LoginPage';
import { ProvenanceChip } from '../components/ui/ProvenanceChip';
import { JobProgress } from '../components/ui/JobProgress';
import { DataManagementPanel } from '../components/workspace/DataManagementPanel';

describe('Milestone M1 & M2 Frontend Components', () => {
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
});
