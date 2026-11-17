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

/**
 * Client-side router mapping /api/v1/* operations directly to ElectriMap's
 * browser demo store, pure engineering calculations, and binary export generators.
 */

import { generateSorCsvContent, STANDARD_ENGINEERING_CONSTANTS } from './domainEngMath';
import {
  generateBoqXlsxBytes,
  generateDprPdfBytes,
  generateGisPackageZipBytes,
} from './demoExports';
import {
  acquireDataForProject,
  addInfrastructureAsset,
  addVerificationEntry,
  createNewDemoProject,
  deleteDemoProject,
  deleteInfrastructureAsset,
  duplicateDemoProject,
  generateProjectScenario,
  getDerivedProject,
  getProjectRates,
  importProjectRatesCsv,
  importVerificationsCsv,
  listProjectsForCurrentUser,
  overrideClusterModalityInScenario,
  patchDemoProject,
  patchProjectSettings,
  pinComparisonScenario,
  recordDemoExportArtifact,
  resetProjectRates,
  resetProjectSettings,
  reverseVerificationEntry,
  runProjectClustering,
  setProjectAoiJson,
  setProjectAoiUploadedFile,
  updateProjectRateItem,
  uploadCustomLayerForProject,
  uploadInfrastructureGeoJson,
} from './demoStore';
import {
  OPEN_DATASET_CATALOG,
  REFERENCE_ADMIN_UNITS,
  getDemoSpikeSummary,
  getKoraputReferenceBundle,
} from './referenceData/referenceCatalog';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(code: string, message: string, status: number): Response {
  return jsonResponse({ error: { code, message } }, status);
}

async function readFormFileText(file: File | null): Promise<{ name: string; text: string }> {
  if (!file) {
    throw new Error('No file was attached in the upload request.');
  }
  const text =
    typeof file.text === 'function' ? await file.text() : await new Response(file).text();
  return { name: file.name || 'upload.geojson', text };
}

function parseJsonBody(body: BodyInit | null | undefined): Record<string, unknown> {
  if (typeof body !== 'string' || !body.trim()) return {};
  return JSON.parse(body) as Record<string, unknown>;
}

export async function handleDemoApiRequest(
  rawPath: string,
  options: RequestInit = {},
): Promise<Response> {
  const method = (options.method ?? 'GET').toUpperCase();
  const url = new URL(rawPath, 'https://demo.electrimap.local');
  const pathname = url.pathname.replace(/\/+$/, '');

  try {
    // 1. Public sample study / spike reference endpoints
    if (pathname === '/api/v1/spikes/reference-geojson' && method === 'GET') {
      return jsonResponse(getKoraputReferenceBundle());
    }
    if (pathname === '/api/v1/spikes/summary' && method === 'GET') {
      return jsonResponse(getDemoSpikeSummary());
    }

    // 2. Global datasets & normative constants
    if (pathname === '/api/v1/datasets' && method === 'GET') {
      return jsonResponse(OPEN_DATASET_CATALOG);
    }
    if (pathname === '/api/v1/engineering-constants' && method === 'GET') {
      return jsonResponse({
        count: STANDARD_ENGINEERING_CONSTANTS.length,
        items: STANDARD_ENGINEERING_CONSTANTS,
      });
    }

    // 3. Administrative LGD Units & Census baselines
    if (pathname === '/api/v1/admin-units' && method === 'GET') {
      const level = url.searchParams.get('level')?.toUpperCase();
      const filtered = REFERENCE_ADMIN_UNITS.filter((u) => !level || u.level === level);
      return jsonResponse(
        filtered.map((u) => ({
          lgd_code: u.lgd_code,
          level: u.level,
          name: u.name,
          parent_lgd_code: u.parent_lgd_code,
          census2011_code: u.census2011_code,
          boundary_source: u.boundary_source,
          has_polygon_geometry: u.has_polygon_geometry,
          centroid_lon: u.centroid_lon,
          centroid_lat: u.centroid_lat,
          census_info: u.census_info,
        })),
      );
    }
    if (pathname === '/api/v1/admin-units/search' && method === 'GET') {
      const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
      const matched = REFERENCE_ADMIN_UNITS.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.lgd_code.toLowerCase().includes(q) ||
          (u.census2011_code ?? '').toLowerCase().includes(q),
      );
      return jsonResponse(
        matched.map((u) => ({
          lgd_code: u.lgd_code,
          level: u.level,
          name: u.name,
          parent_lgd_code: u.parent_lgd_code,
          census2011_code: u.census2011_code,
          boundary_source: u.boundary_source,
          has_polygon_geometry: u.has_polygon_geometry,
          centroid_lon: u.centroid_lon,
          centroid_lat: u.centroid_lat,
          census_info: u.census_info,
        })),
      );
    }
    const adminBoundaryMatch = /^\/api\/v1\/admin-units\/([^/]+)\/boundary$/.exec(pathname);
    if (adminBoundaryMatch && method === 'GET') {
      const lgd = decodeURIComponent(adminBoundaryMatch[1]!);
      const unit = REFERENCE_ADMIN_UNITS.find((u) => u.lgd_code === lgd);
      if (!unit) return errorResponse('NOT_FOUND', `Admin unit ${lgd} not found.`, 404);
      return jsonResponse({
        lgd_code: unit.lgd_code,
        name: unit.name,
        level: unit.level,
        census2011_code: unit.census2011_code,
        boundary_source: unit.boundary_source,
        area_km2: unit.area_km2,
        metric_epsg: unit.metric_epsg,
        warnings: unit.warnings,
        geojson_geometry: unit.geometry,
        census_info: unit.census_info,
      });
    }

    // 4. Jobs cancel
    const jobCancelMatch = /^\/api\/v1\/jobs\/([^/]+)\/cancel$/.exec(pathname);
    if (jobCancelMatch && method === 'POST') {
      const nowIso = new Date().toISOString();
      return jsonResponse({
        id: jobCancelMatch[1]!,
        project_id: null,
        job_type: 'DATA_ACQUISITION',
        status: 'CANCELLED',
        progress: 100,
        stage: 'Cancelled by user.',
        params: null,
        result: null,
        error: null,
        attempts: 1,
        created_by: null,
        created_at: nowIso,
        updated_at: nowIso,
        finished_at: nowIso,
      });
    }

    // 5. Projects collection
    if (pathname === '/api/v1/projects' && method === 'GET') {
      return jsonResponse(listProjectsForCurrentUser());
    }
    if (pathname === '/api/v1/projects' && method === 'POST') {
      return jsonResponse(createNewDemoProject(parseJsonBody(options.body)), 201);
    }

    // 6. Project sub-routes
    const projMatch = /^\/api\/v1\/projects\/([^/]+)(?:\/(.*))?$/.exec(pathname);
    if (!projMatch) {
      return errorResponse('NOT_FOUND', `Demo endpoint '${pathname}' is not registered.`, 404);
    }

    const projectId = decodeURIComponent(projMatch[1]!);
    const sub = projMatch[2] ?? '';

    if (sub === '' && method === 'GET') {
      return jsonResponse(getDerivedProject(projectId).project);
    }
    if (sub === '' && method === 'PATCH') {
      return jsonResponse(patchDemoProject(projectId, parseJsonBody(options.body)));
    }
    if (sub === '' && method === 'DELETE') {
      deleteDemoProject(projectId);
      return new Response(null, { status: 204 });
    }
    if (sub === 'duplicate' && method === 'POST') {
      return jsonResponse(duplicateDemoProject(projectId), 201);
    }

    // AOI
    if (sub === 'aoi' && (method === 'PUT' || method === 'POST')) {
      const body = parseJsonBody(options.body);
      return jsonResponse(
        setProjectAoiJson(projectId, {
          mode: String(body.mode ?? 'USER_DRAWN'),
          lgd_code: body.lgd_code ? String(body.lgd_code) : undefined,
          geojson_geometry: body.geojson_geometry as GeoJSON.Geometry | undefined,
        }),
      );
    }
    if (sub === 'aoi/upload' && method === 'POST') {
      const fd = options.body as FormData;
      const { name, text } = await readFormFileText(fd.get('file') as File | null);
      return jsonResponse(setProjectAoiUploadedFile(projectId, name, text));
    }

    // Layers & Acquisition
    if (sub === 'layers' && method === 'GET') {
      return jsonResponse(getDerivedProject(projectId).layers);
    }
    if (sub === 'layers/buildings/geojson' && method === 'GET') {
      return jsonResponse(getDerivedProject(projectId).buildingsFc);
    }
    if (sub === 'layers/osm_features/geojson' && method === 'GET') {
      return jsonResponse(getDerivedProject(projectId).osmFc);
    }
    if (sub === 'data/acquire' && method === 'POST') {
      return jsonResponse(acquireDataForProject(projectId), 201);
    }
    if (sub === 'layers/upload' && method === 'POST') {
      const fd = options.body as FormData;
      const layerKey = String(fd.get('layer_key') ?? 'buildings');
      const { name, text } = await readFormFileText(fd.get('file') as File | null);
      return jsonResponse(uploadCustomLayerForProject(projectId, layerKey, name, text), 201);
    }
    if (sub === 'jobs' && method === 'GET') {
      return jsonResponse(getDerivedProject(projectId).jobs);
    }

    // Settlements & Verifications
    if (sub === 'clusters' && method === 'GET') {
      return jsonResponse(getDerivedProject(projectId).settlements);
    }
    if (sub === 'clustering' && method === 'POST') {
      const body = parseJsonBody(options.body);
      return jsonResponse(runProjectClustering(projectId, body));
    }
    if (sub === 'verifications' && method === 'GET') {
      return jsonResponse(getDerivedProject(projectId).ledger);
    }
    if (sub === 'verifications' && method === 'POST') {
      return jsonResponse(addVerificationEntry(projectId, parseJsonBody(options.body)), 201);
    }
    const revMatch = /^verifications\/([^/]+)\/reverse$/.exec(sub);
    if (revMatch && method === 'POST') {
      return jsonResponse(
        reverseVerificationEntry(projectId, revMatch[1]!, parseJsonBody(options.body)),
        201,
      );
    }
    if (sub === 'verifications/import' && method === 'POST') {
      const fd = options.body as FormData;
      const { name, text } = await readFormFileText(fd.get('file') as File | null);
      return jsonResponse(importVerificationsCsv(projectId, name, text), 201);
    }

    // Infrastructure, Gap Analysis, Settings & Demand
    if (sub === 'infrastructure' && method === 'GET') {
      return jsonResponse(getDerivedProject(projectId).infrastructure);
    }
    if (sub === 'infrastructure' && method === 'POST') {
      return jsonResponse(addInfrastructureAsset(projectId, parseJsonBody(options.body)), 201);
    }
    const delAssetMatch = /^infrastructure\/([^/]+)$/.exec(sub);
    if (delAssetMatch && method === 'DELETE') {
      deleteInfrastructureAsset(projectId, delAssetMatch[1]!);
      return jsonResponse({ status: 'deleted' });
    }
    if (sub === 'infrastructure/upload' && method === 'POST') {
      const fd = options.body as FormData;
      const { name, text } = await readFormFileText(fd.get('file') as File | null);
      const prov = String(fd.get('provenance') ?? 'UTILITY_RECORD');
      const note = String(fd.get('source_note') ?? `Uploaded utility GIS file: ${name}`);
      return jsonResponse(uploadInfrastructureGeoJson(projectId, name, text, prov, note), 201);
    }
    if (sub === 'gap-analysis' && method === 'GET') {
      return jsonResponse(getDerivedProject(projectId).gapAnalysis);
    }
    if (sub === 'settings' && method === 'GET') {
      return jsonResponse(getDerivedProject(projectId).settingsList);
    }
    if (sub === 'settings' && method === 'PATCH') {
      const body = parseJsonBody(options.body);
      const updates = Array.isArray(body.updates)
        ? (body.updates as Array<{ key: string; value: number }>)
        : [];
      return jsonResponse(patchProjectSettings(projectId, updates));
    }
    if (sub === 'settings/reset' && method === 'POST') {
      return jsonResponse(resetProjectSettings(projectId));
    }
    if (sub === 'demand' && method === 'GET') {
      return jsonResponse(getDerivedProject(projectId).demand);
    }
    if (sub === 'demand/calculate' && method === 'POST') {
      return jsonResponse(getDerivedProject(projectId).demand);
    }

    // Network Engineering Scenarios
    if (sub === 'scenarios' && method === 'GET') {
      return jsonResponse(getDerivedProject(projectId).scenariosList);
    }
    if (sub === 'scenarios/generate' && method === 'POST') {
      const body = parseJsonBody(options.body);
      return jsonResponse(
        generateProjectScenario(
          projectId,
          String(body.scenario_key ?? 'HYBRID_OPTIMAL'),
          Boolean(body.preserve_manual_overrides),
        ),
      );
    }
    const overrideMatch = /^scenarios\/([^/]+)\/clusters\/([^/]+)$/.exec(sub);
    if (overrideMatch && method === 'PATCH') {
      const body = parseJsonBody(options.body);
      return jsonResponse(
        overrideClusterModalityInScenario(
          projectId,
          overrideMatch[1]!,
          overrideMatch[2]!,
          String(body.modality ?? 'SOLAR_MINIGRID'),
        ),
      );
    }
    const pinMatch = /^scenarios\/([^/]+)\/pin$/.exec(sub);
    if (pinMatch && method === 'POST') {
      return jsonResponse(pinComparisonScenario(projectId, pinMatch[1]!));
    }

    // Costing, SoR & Comparison
    if (sub === 'rates' && method === 'GET') {
      return jsonResponse(getProjectRates(projectId));
    }
    if (sub === 'rates/reset' && method === 'POST') {
      return jsonResponse(resetProjectRates(projectId));
    }
    if (sub === 'rates/import-csv' && method === 'POST') {
      const body = parseJsonBody(options.body);
      return jsonResponse(
        importProjectRatesCsv(
          projectId,
          String(body.csv_content ?? ''),
          String(body.template_name ?? 'Imported Schedule'),
        ),
      );
    }
    if (sub === 'rates/export-csv' && method === 'GET') {
      const csv = generateSorCsvContent(getProjectRates(projectId));
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="electrimap_sor_${projectId.slice(0, 8)}.csv"`,
        },
      });
    }
    const ratePatchMatch = /^rates\/([^/]+)$/.exec(sub);
    if (ratePatchMatch && method === 'PATCH') {
      const body = parseJsonBody(options.body);
      const rateVal = body.rate_inr === null || body.rate_inr === undefined ? null : Number(body.rate_inr);
      return jsonResponse(
        updateProjectRateItem(
          projectId,
          decodeURIComponent(ratePatchMatch[1]!),
          rateVal,
          body.citation ? String(body.citation) : undefined,
        ),
      );
    }
    if (sub === 'comparison' && method === 'GET') {
      return jsonResponse(getDerivedProject(projectId).comparison);
    }

    // Pre-Flight Audit & Real Client-Side Exports (.pdf, .xlsx, .zip)
    if (sub === 'report/preflight' && method === 'GET') {
      return jsonResponse(getDerivedProject(projectId).preflight);
    }
    if (sub === 'exports' && method === 'GET') {
      return jsonResponse(getDerivedProject(projectId).exportsList);
    }
    if (sub === 'exports/preliminary-settlement-pdf' && method === 'GET') {
      const derived = getDerivedProject(projectId);
      const { bytes } = generateDprPdfBytes(
        {
          project: derived.project,
          layers: derived.layers,
          settlements: derived.settlements,
          ledger: derived.ledger,
          infrastructure: derived.infrastructure,
          gapAnalysis: derived.gapAnalysis,
          settings: derived.settingsList,
          demand: derived.demand,
          scenarios: derived.scenariosList,
          comparison: derived.comparison,
          preflight: derived.preflight,
        },
        true,
      );
      const filename = `preliminary_settlement_skeleton_${projectId.slice(0, 8)}.pdf`;
      return new Response(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }
    if (sub === 'exports/dpr-pdf' && method === 'GET') {
      const derived = getDerivedProject(projectId);
      if (!derived.preflight.can_export) {
        return errorResponse(
          'PREFLIGHT_EXPORT_BLOCKED',
          derived.comparison.export_blocked_reason ??
            'Resolve required pre-flight steps before exporting 24-section PDF.',
          422,
        );
      }
      const { bytes, sha256 } = generateDprPdfBytes(
        {
          project: derived.project,
          layers: derived.layers,
          settlements: derived.settlements,
          ledger: derived.ledger,
          infrastructure: derived.infrastructure,
          gapAnalysis: derived.gapAnalysis,
          settings: derived.settingsList,
          demand: derived.demand,
          scenarios: derived.scenariosList,
          comparison: derived.comparison,
          preflight: derived.preflight,
        },
        false,
      );
      const filename = `electrimap_dpr_24sec_${projectId.slice(0, 8)}_${derived.scenariosList.active_scenario_key.toLowerCase()}.pdf`;
      recordDemoExportArtifact(projectId, {
        scenario_id: derived.scenariosList.active_scenario.id,
        scenario_key: derived.scenariosList.active_scenario_key,
        export_kind: 'PDF_DPR_24',
        filename,
        mime_type: 'application/pdf',
        file_size_bytes: bytes.byteLength,
        file_sha256: sha256,
        snapshot_hash: derived.preflight.snapshot_hash,
        preflight_passed: derived.preflight.can_export,
        preflight_warnings_count: derived.preflight.soft_warnings_count,
        notes: `24-Section Preliminary DPR (${derived.preflight.watermark_text})`,
      });
      return new Response(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }
    if (sub === 'exports/boq-xlsx' && method === 'GET') {
      const derived = getDerivedProject(projectId);
      if (!derived.preflight.can_export) {
        return errorResponse(
          'PREFLIGHT_EXPORT_BLOCKED',
          derived.comparison.export_blocked_reason ??
            'Resolve required pre-flight steps before exporting Excel BOQ.',
          422,
        );
      }
      const { bytes, sha256 } = await generateBoqXlsxBytes({
        project: derived.project,
        layers: derived.layers,
        settlements: derived.settlements,
        ledger: derived.ledger,
        infrastructure: derived.infrastructure,
        gapAnalysis: derived.gapAnalysis,
        settings: derived.settingsList,
        demand: derived.demand,
        scenarios: derived.scenariosList,
        comparison: derived.comparison,
        preflight: derived.preflight,
      });
      const filename = `electrimap_boq_${projectId.slice(0, 8)}_${derived.scenariosList.active_scenario_key.toLowerCase()}.xlsx`;
      recordDemoExportArtifact(projectId, {
        scenario_id: derived.scenariosList.active_scenario.id,
        scenario_key: derived.scenariosList.active_scenario_key,
        export_kind: 'XLSX_BOQ',
        filename,
        mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        file_size_bytes: bytes.byteLength,
        file_sha256: sha256,
        snapshot_hash: derived.preflight.snapshot_hash,
        preflight_passed: derived.preflight.can_export,
        preflight_warnings_count: derived.preflight.soft_warnings_count,
        notes: '5-Sheet Formula-Driven Excel BOQ Workbook',
      });
      return new Response(
        new Blob([new Uint8Array(bytes)], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
        },
      );
    }
    if (sub === 'exports/gis-package' && method === 'GET') {
      const derived = getDerivedProject(projectId);
      const { bytes, sha256 } = await generateGisPackageZipBytes({
        project: derived.project,
        layers: derived.layers,
        settlements: derived.settlements,
        ledger: derived.ledger,
        infrastructure: derived.infrastructure,
        gapAnalysis: derived.gapAnalysis,
        settings: derived.settingsList,
        demand: derived.demand,
        scenarios: derived.scenariosList,
        comparison: derived.comparison,
        preflight: derived.preflight,
      });
      const filename = `electrimap_gis_package_${projectId.slice(0, 8)}_${derived.scenariosList.active_scenario_key.toLowerCase()}.zip`;
      recordDemoExportArtifact(projectId, {
        scenario_id: derived.scenariosList.active_scenario.id,
        scenario_key: derived.scenariosList.active_scenario_key,
        export_kind: 'GIS_PACKAGE_ZIP',
        filename,
        mime_type: 'application/zip',
        file_size_bytes: bytes.byteLength,
        file_sha256: sha256,
        snapshot_hash: derived.preflight.snapshot_hash,
        preflight_passed: derived.preflight.can_export,
        preflight_warnings_count: derived.preflight.soft_warnings_count,
        notes: 'Cleaned GIS Vector Package (GeoJSON + Schedule CSV + Provenance Manifest)',
      });
      return new Response(new Blob([new Uint8Array(bytes)], { type: 'application/zip' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    return errorResponse('NOT_FOUND', `Unhandled demo project sub-route '${sub}'.`, 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Demo workspace operation failed.';
    return errorResponse('DEMO_ERROR', message, 400);
  }
}
