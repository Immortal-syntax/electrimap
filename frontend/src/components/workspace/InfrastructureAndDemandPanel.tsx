import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/apiClient';
import { Button } from '../ui/Button';
import { Callout } from '../ui/Callout';
import { QualityTag, QualityTagKind } from '../ui/QualityTag';

export interface InfrastructureAssetDto {
  id: string;
  project_id: string;
  asset_type: string;
  name: string;
  voltage_kv: number | null;
  rating_kva: number | null;
  provenance: string;
  quality_tag: QualityTagKind;
  dataset_id: string | null;
  source_note: string;
  attributes: Record<string, unknown>;
  geojson_geometry: GeoJSON.Geometry;
  updated_at: string;
}

export interface InfrastructureListDto {
  project_id: string;
  has_existing_infra: boolean;
  items: InfrastructureAssetDto[];
  geojson: GeoJSON.FeatureCollection;
}

export interface ClusterGapAnalysisDto {
  cluster_id: string;
  cluster_label: string;
  cluster_name: string;
  est_households: number;
  effective_electrification_class: string;
  nearest_asset_id: string | null;
  nearest_asset_name: string | null;
  nearest_asset_type: string | null;
  nearest_asset_provenance: string | null;
  d_straight_m: number | null;
  d_terrain_m: number | null;
  terrain_penalty_factor: number;
  slope_mean_deg: number;
  canopy_share: number;
  water_crossings_count: number;
  road_distance_m: number | null;
  recommended_modality: string;
  rationale: string;
  corridor_geojson: GeoJSON.Geometry | null;
}

export interface ProjectGapAnalysisDto {
  project_id: string;
  has_existing_infra: boolean;
  infra_assets_count: number;
  assumed_assets_count: number;
  verified_assets_count: number;
  mean_d_straight_m: number | null;
  mean_d_terrain_m: number | null;
  max_d_terrain_m: number | null;
  grid_extension_candidates: number;
  minigrid_candidates: number;
  shs_candidates: number;
  augmentation_candidates: number;
  corridors_geojson: GeoJSON.FeatureCollection;
  clusters: ClusterGapAnalysisDto[];
}

export interface ProjectSettingDto {
  id: string;
  project_id: string;
  key: string;
  category: string;
  label: string;
  value: number;
  default_value: number;
  min_value: number;
  max_value: number;
  unit: string;
  quality_tag: QualityTagKind;
  citation: string;
  is_user_edited: boolean;
  override_note: string | null;
  updated_at: string;
}

export interface ProjectSettingsListDto {
  project_id: string;
  user_edited_count: number;
  items: ProjectSettingDto[];
}

export interface CategoryDemandRowDto {
  category: string;
  label: string;
  consumer_count: number;
  connected_kw: number;
  demand_factor: number;
  max_demand_kw: number;
  daily_hours: number;
  energy_kwh_day: number;
  annual_energy_mwh: number;
}

export interface ClusterDemandDto {
  cluster_id: string;
  cluster_label: string;
  cluster_name: string;
  est_households: number;
  categories: CategoryDemandRowDto[];
  total_connected_kw: number;
  non_coincident_peak_kw: number;
  coincidence_factor: number;
  power_factor_cos_phi: number;
  peak_kw_base: number;
  peak_kva_base: number;
  energy_kwh_day_base: number;
  annual_energy_mwh_base: number;
  horizon_years: number;
  annual_growth_rate: number;
  growth_multiplier: number;
  peak_kw_horizon: number;
  peak_kva_horizon: number;
  energy_kwh_day_horizon: number;
  annual_energy_mwh_horizon: number;
}

export interface ProjectDemandSummaryDto {
  project_id: string;
  total_households: number;
  total_connected_kw: number;
  peak_kw_base: number;
  peak_kva_base: number;
  energy_kwh_day_base: number;
  annual_energy_mwh_base: number;
  horizon_years: number;
  annual_growth_rate: number;
  peak_kw_horizon: number;
  peak_kva_horizon: number;
  energy_kwh_day_horizon: number;
  annual_energy_mwh_horizon: number;
  category_totals: CategoryDemandRowDto[];
  clusters: ClusterDemandDto[];
}

export interface InfrastructureAndDemandPanelProps {
  projectId: string;
  infrastructure: InfrastructureListDto | null;
  gapAnalysis: ProjectGapAnalysisDto | null;
  settings: ProjectSettingsListDto | null;
  demand: ProjectDemandSummaryDto | null;
  placeTieInModeActive: boolean;
  onTogglePlaceTieInMode: () => void;
  onInfrastructureAndDemandUpdated: () => Promise<void>;
}

export const InfrastructureAndDemandPanel: React.FC<
  InfrastructureAndDemandPanelProps
> = ({
  projectId,
  infrastructure,
  gapAnalysis,
  settings,
  demand,
  placeTieInModeActive,
  onTogglePlaceTieInMode,
  onInfrastructureAndDemandUpdated,
}) => {
  const [editedValues, setEditedValues] = useState<Record<string, number>>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [placingRefTieIn, setPlacingRefTieIn] = useState(false);
  const [uploadingGeoJson, setUploadingGeoJson] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    const initial: Record<string, number> = {};
    for (const item of settings.items) {
      initial[item.key] = item.value;
    }
    setEditedValues(initial);
  }, [settings]);

  const handlePlaceReferenceTieIn = async () => {
    setPlacingRefTieIn(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await apiRequest(`/api/v1/projects/${projectId}/infrastructure`, {
        method: 'POST',
        body: JSON.stringify({
          asset_type: 'TIE_IN',
          name: 'Nandapur 11 kV Feeder Tap Point (Assumed)',
          voltage_kv: 11.0,
          provenance: 'USER_ASSUMED',
          source_note:
            'Explicit planner-placed assumed 11 kV tie-in point on Nandapur-Padwa road.',
          lon: 82.7265,
          lat: 18.5645,
        }),
      });
      await onInfrastructureAndDemandUpdated();
      setStatusMessage(
        'Placed explicit USER_ASSUMED 11 kV tie-in point and recomputed UTM terrain gap matrix.',
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to place tie-in point.',
      );
    } finally {
      setPlacingRefTieIn(false);
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    setDeletingAssetId(assetId);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await apiRequest(`/api/v1/projects/${projectId}/infrastructure/${assetId}`, {
        method: 'DELETE',
      });
      await onInfrastructureAndDemandUpdated();
      setStatusMessage('Removed infrastructure asset and updated gap analysis.');
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to delete infrastructure asset.',
      );
    } finally {
      setDeletingAssetId(null);
    }
  };

  const handleUploadInfraGeoJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingGeoJson(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('provenance', 'UTILITY_RECORD');
      fd.append('source_note', `Uploaded utility GIS file: ${file.name}`);
      await apiRequest(`/api/v1/projects/${projectId}/infrastructure/upload`, {
        method: 'POST',
        body: fd,
      });
      await onInfrastructureAndDemandUpdated();
      setStatusMessage(`Uploaded utility GIS infrastructure file '${file.name}'.`);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Infrastructure GeoJSON upload failed.',
      );
    } finally {
      setUploadingGeoJson(false);
      e.target.value = '';
    }
  };

  const handleSaveAssumptions = async () => {
    if (!settings) return;
    setSavingSettings(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const updates = settings.items.map((item) => ({
        key: item.key,
        value: editedValues[item.key] ?? item.value,
      }));
      await apiRequest(`/api/v1/projects/${projectId}/settings`, {
        method: 'PATCH',
        body: JSON.stringify({ updates }),
      });
      await apiRequest(`/api/v1/projects/${projectId}/demand/calculate`, {
        method: 'POST',
      });
      await onInfrastructureAndDemandUpdated();
      setStatusMessage(
        'Saved assumption overrides (tagged USER_ENTERED) and recalculated 7-category demand.',
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to save project assumptions.',
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetAssumptions = async () => {
    setSavingSettings(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await apiRequest(`/api/v1/projects/${projectId}/settings/reset`, {
        method: 'POST',
      });
      await apiRequest(`/api/v1/projects/${projectId}/demand/calculate`, {
        method: 'POST',
      });
      await onInfrastructureAndDemandUpdated();
      setStatusMessage(
        'Reset all engineering assumptions to normative REC/CEA defaults and recalculated demand.',
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to reset project assumptions.',
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const hasInfra = infrastructure?.has_existing_infra ?? false;

  return (
    <section
      aria-label="Infrastructure Gap Analysis and Demand Engine"
      className="bg-sheet border border-rule-strong rounded-xs p-4 space-y-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3">
        <div>
          <div className="small-caps-heading">
            Milestone M4 · Existing Infrastructure, Terrain Gap Matrix, Assumptions Register &amp;
            7-Category Demand Engine
          </div>
          <p className="text-xs text-ink-2 mt-0.5">
            Enforces Core Principle #4 (no fabricated infrastructure), computes UTM (EPSG:32644)
            terrain-weighted feeder distances, and models 7-category rural demand over the planning
            horizon.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={placeTieInModeActive ? 'primary' : 'secondary'}
            onClick={onTogglePlaceTieInMode}
          >
            {placeTieInModeActive
              ? '✓ Click Map to Place Tie-In (Cancel)'
              : '+ Place Assumed 11 kV Tie-In on Map'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={placingRefTieIn}
            onClick={() => void handlePlaceReferenceTieIn()}
          >
            {placingRefTieIn
              ? 'Placing Tie-In…'
              : 'Place Reference Nandapur 11 kV Tap (USER_ASSUMED)'}
          </Button>
          <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-paper border border-rule-strong rounded-xs cursor-pointer hover:bg-sheet">
            <span>{uploadingGeoJson ? 'Uploading…' : 'Upload Utility GIS (.geojson)'}</span>
            <input
              type="file"
              accept=".geojson,.json"
              aria-label="Upload Utility GIS"
              disabled={uploadingGeoJson}
              onChange={(e) => void handleUploadInfraGeoJson(e)}
              className="sr-only"
            />
          </label>
        </div>
      </div>

      {errorMessage && (
        <Callout tone="error" title="Infrastructure / Demand Error">
          {errorMessage}
        </Callout>
      )}
      {statusMessage && (
        <Callout tone="info" title="Infrastructure & Demand Update">
          {statusMessage}
        </Callout>
      )}

      {/* Honest Warning when no infrastructure is present */}
      {!hasInfra && (
        <Callout
          tone="warn"
          title="Existing Electrical Infrastructure UNSET (Core Principle #4 — Zero Fabricated Lines)"
        >
          No utility 11 kV/LT lines, Distribution Transformers, or tie-in points have been uploaded
          or placed yet. Consistent with epistemic honesty rules, <code>d_straight_m</code> and{' '}
          <code>d_terrain_m</code> remain <strong>UNSET</strong> rather than invented. Click{' '}
          <strong>Place Reference Nandapur 11 kV Tap (USER_ASSUMED)</strong>, click on the map, or
          upload a utility GeoJSON file to compute grid extension distances.
        </Callout>
      )}

      {/* Existing Infrastructure Assets Table */}
      {hasInfra && infrastructure && (
        <div className="space-y-2">
          <div className="small-caps-heading">
            Registered Existing Infrastructure &amp; Tie-In Points ({infrastructure.items.length}{' '}
            Assets)
          </div>
          <div className="overflow-x-auto border border-rule rounded-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-paper border-b border-rule font-mono text-[11px] text-ink-2">
                  <th className="py-1.5 px-2.5">Asset Type</th>
                  <th className="py-1.5 px-2.5">Asset Name</th>
                  <th className="py-1.5 px-2.5">Voltage / Rating</th>
                  <th className="py-1.5 px-2.5">Provenance &amp; Quality</th>
                  <th className="py-1.5 px-2.5">Source Note</th>
                  <th className="py-1.5 px-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {infrastructure.items.map((asset) => (
                  <tr key={asset.id} className="hover:bg-paper/40">
                    <td className="py-1.5 px-2.5 font-mono font-semibold text-ink">
                      {asset.asset_type}
                    </td>
                    <td className="py-1.5 px-2.5 font-medium text-ink">{asset.name}</td>
                    <td className="py-1.5 px-2.5 font-mono text-[11px]">
                      {asset.voltage_kv ? `${asset.voltage_kv} kV` : '—'}
                      {asset.rating_kva ? ` · ${asset.rating_kva} kVA` : ''}
                    </td>
                    <td className="py-1.5 px-2.5">
                      <QualityTag
                        kind={asset.quality_tag}
                        label={`${asset.provenance}`}
                      />
                    </td>
                    <td className="py-1.5 px-2.5 text-[11px] text-ink-2">
                      {asset.source_note}
                    </td>
                    <td className="py-1.5 px-2.5 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={deletingAssetId === asset.id}
                        onClick={() => void handleDeleteAsset(asset.id)}
                      >
                        {deletingAssetId === asset.id ? 'Removing…' : 'Remove'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Terrain-Weighted Distance & Obstacle Gap Analysis Matrix */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="small-caps-heading">
            Terrain-Weighted Distance &amp; Obstacle Gap Analysis Matrix (UTM EPSG:32644)
          </div>
          {gapAnalysis && gapAnalysis.has_existing_infra && (
            <div className="font-mono text-[11px] text-ink-2">
              Mean Straight: <strong>{gapAnalysis.mean_d_straight_m} m</strong> · Mean Terrain:{' '}
              <strong>{gapAnalysis.mean_d_terrain_m} m</strong> · Grid Ext. Candidates:{' '}
              <strong>{gapAnalysis.grid_extension_candidates}</strong> · Mini-Grid:{' '}
              <strong>{gapAnalysis.minigrid_candidates}</strong> · SHS:{' '}
              <strong>{gapAnalysis.shs_candidates}</strong>
            </div>
          )}
        </div>

        <div className="overflow-x-auto border border-rule rounded-xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-paper border-b border-rule font-mono text-[11px] text-ink-2">
                <th className="py-2 px-2.5">Cluster</th>
                <th className="py-2 px-2.5">Nearest Tie-In / Asset</th>
                <th className="py-2 px-2.5">Straight (m)</th>
                <th className="py-2 px-2.5">Terrain Penalty</th>
                <th className="py-2 px-2.5">Terrain Dist (m)</th>
                <th className="py-2 px-2.5">Obstacles</th>
                <th className="py-2 px-2.5">Preliminary Modality Affinity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {(gapAnalysis?.clusters ?? []).map((g) => (
                <tr key={g.cluster_id} className="hover:bg-paper/40">
                  <td className="py-2 px-2.5 font-mono font-semibold text-ink">
                    {g.cluster_label} · {g.cluster_name} ({g.est_households} HH)
                  </td>
                  <td className="py-2 px-2.5 text-[11px]">
                    {g.nearest_asset_name ? (
                      <span>
                        {g.nearest_asset_name}{' '}
                        <span className="font-mono text-ink-2">
                          ({g.nearest_asset_provenance})
                        </span>
                      </span>
                    ) : (
                      <span className="font-mono text-warn font-semibold">UNSET</span>
                    )}
                  </td>
                  <td className="py-2 px-2.5 font-mono text-[11px]">
                    {g.d_straight_m !== null ? `${g.d_straight_m.toFixed(0)} m` : 'UNSET'}
                  </td>
                  <td className="py-2 px-2.5 font-mono text-[11px]">
                    {g.terrain_penalty_factor.toFixed(2)}×
                  </td>
                  <td className="py-2 px-2.5 font-mono text-[11px] font-semibold">
                    {g.d_terrain_m !== null ? `${g.d_terrain_m.toFixed(0)} m` : 'UNSET'}
                  </td>
                  <td className="py-2 px-2.5 font-mono text-[11px] text-ink-2">
                    {g.slope_mean_deg.toFixed(1)}° · {(g.canopy_share * 100).toFixed(0)}% canopy ·{' '}
                    {g.water_crossings_count} water x-ing
                  </td>
                  <td className="py-2 px-2.5">
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-xs border border-rule-strong bg-paper font-semibold text-ink">
                      {g.recommended_modality}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Split Grid: Project Assumptions Register + 7-Category Parametric Demand Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2 border-t border-rule">
        {/* Left 5 cols: Project Assumptions Register */}
        <div className="lg:col-span-5 bg-paper border border-rule rounded-xs p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule pb-2">
            <div>
              <span className="small-caps-heading block">
                Project Assumptions Register ({settings?.user_edited_count ?? 0} Overrides)
              </span>
              <span className="text-[11px] text-ink-2">
                Normative REC / CEA / ESMAP MTF parameters
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                disabled={savingSettings}
                onClick={() => void handleResetAssumptions()}
              >
                Reset Defaults
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={savingSettings}
                onClick={() => void handleSaveAssumptions()}
              >
                {savingSettings ? 'Saving…' : 'Save & Recalculate'}
              </Button>
            </div>
          </div>

          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {(settings?.items ?? []).map((item) => {
              const currentVal = editedValues[item.key] ?? item.value;
              return (
                <div
                  key={item.key}
                  className="p-2 bg-sheet border border-rule rounded-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor={`setting-${item.key}`}
                      className="text-xs font-medium text-ink"
                    >
                      {item.label}
                    </label>
                    <QualityTag
                      kind={item.is_user_edited ? 'USER_ENTERED' : 'ESTIMATED'}
                      label={
                        item.is_user_edited
                          ? 'USER_ENTERED'
                          : `DEFAULT: ${item.default_value}`
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-ink-2 truncate" title={item.citation}>
                      {item.citation}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        id={`setting-${item.key}`}
                        type="number"
                        step="any"
                        min={item.min_value}
                        max={item.max_value}
                        value={currentVal}
                        onChange={(e) =>
                          setEditedValues((prev) => ({
                            ...prev,
                            [item.key]: Number(e.target.value),
                          }))
                        }
                        className="w-24 px-1.5 py-0.5 text-xs font-mono bg-paper border border-rule-strong rounded-xs text-right"
                      />
                      <span className="font-mono text-[10px] text-ink-2 w-14">
                        {item.unit}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 7 cols: 7-Category Parametric Electricity Demand Forecast */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="small-caps-heading block">
                7-Category Parametric Electricity Demand &amp; {demand?.horizon_years ?? 10}-Year
                Horizon Forecast
              </span>
              <span className="text-[11px] text-ink-2">
                Coincident peak demand computed at cos φ = 0.85 lag and{' '}
                {((demand?.annual_growth_rate ?? 0.045) * 100).toFixed(1)}%/yr compound load growth
              </span>
            </div>
          </div>

          {demand && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
                <div className="p-2.5 bg-paper border border-rule rounded-xs">
                  <span className="text-[10px] text-ink-2 block">Total Connected Load</span>
                  <strong className="text-sm text-ink">
                    {demand.total_connected_kw.toFixed(2)} kW
                  </strong>
                  <span className="text-[10px] text-ink-2 block">
                    {demand.total_households} Total HH
                  </span>
                </div>
                <div className="p-2.5 bg-paper border border-rule rounded-xs">
                  <span className="text-[10px] text-ink-2 block">Base Coincident Peak</span>
                  <strong className="text-sm text-ink">
                    {demand.peak_kva_base.toFixed(2)} kVA
                  </strong>
                  <span className="text-[10px] text-ink-2 block">
                    ({demand.peak_kw_base.toFixed(2)} kW)
                  </span>
                </div>
                <div className="p-2.5 bg-accent-tint/40 border border-accent/40 rounded-xs">
                  <span className="text-[10px] text-accent block">
                    Horizon Peak (+{demand.horizon_years} Yrs)
                  </span>
                  <strong className="text-sm text-accent">
                    {demand.peak_kva_horizon.toFixed(2)} kVA
                  </strong>
                  <span className="text-[10px] text-ink-2 block">
                    ({demand.peak_kw_horizon.toFixed(2)} kW design)
                  </span>
                </div>
                <div className="p-2.5 bg-paper border border-rule rounded-xs">
                  <span className="text-[10px] text-ink-2 block">Annual Energy (Base → Hor.)</span>
                  <strong className="text-sm text-ink">
                    {demand.annual_energy_mwh_base.toFixed(1)} →{' '}
                    {demand.annual_energy_mwh_horizon.toFixed(1)}
                  </strong>
                  <span className="text-[10px] text-ink-2 block">MWh / year</span>
                </div>
              </div>

              <div className="overflow-x-auto border border-rule rounded-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-paper border-b border-rule font-mono text-[11px] text-ink-2">
                      <th className="py-1.5 px-2.5">Consumer Category</th>
                      <th className="py-1.5 px-2.5">Units</th>
                      <th className="py-1.5 px-2.5">Connected (kW)</th>
                      <th className="py-1.5 px-2.5">Max Demand (kW)</th>
                      <th className="py-1.5 px-2.5">Daily (kWh/d)</th>
                      <th className="py-1.5 px-2.5">Annual (MWh/yr)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {demand.category_totals.map((cat) => (
                      <tr key={cat.category} className="hover:bg-paper/40">
                        <td className="py-1.5 px-2.5 font-medium text-ink">{cat.label}</td>
                        <td className="py-1.5 px-2.5 font-mono text-[11px]">
                          {cat.consumer_count}
                        </td>
                        <td className="py-1.5 px-2.5 font-mono text-[11px]">
                          {cat.connected_kw.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-2.5 font-mono text-[11px]">
                          {cat.max_demand_kw.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-2.5 font-mono text-[11px]">
                          {cat.energy_kwh_day.toFixed(1)}
                        </td>
                        <td className="py-1.5 px-2.5 font-mono text-[11px] font-semibold">
                          {cat.annual_energy_mwh.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};
