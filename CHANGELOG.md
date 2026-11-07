# CHANGELOG.md — Project Activity & Milestone History

All notable changes to the ElectriMap DPR project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] - 2026-11-07

### Added
- **Prompt 5 — Production Readiness Audit, Code Review & Hardening (`docs/PRODUCTION_READINESS_AUDIT.md`):**
  - Conducted 18-domain Code Review and Production Readiness Audit with release checklist, deployment runbook, and mandatory human/field/DISCOM validation disclosures (`docs/PRODUCTION_READINESS_AUDIT.md`).
  - Added `ensure_default_handlers_registered()` in `backend/app/worker.py` (`PR-01`) so standalone worker processes (`python -m app.worker`) automatically register `ACQUIRE_PROJECT_DATA` and `CLUSTER_SETTLEMENTS` handlers.
  - Added `@model_validator` in `backend/app/core/config.py` (`PR-02`) rejecting weak/placeholder `SESSION_SECRET` when `APP_ENV=production` and decoupling HTTP `demo` cookie security (`effective_cookie_secure`) from HTTPS `production` mode.
  - Synchronized `DATA_DIR` and `SESSION_SECRET` environment variables across `docker-compose.yml` (`PR-03`) and achieved 100% Apache 2.0 header coverage across all migrations and stylesheets (`PR-04`).
- **Milestone M8 — System Hardening, Performance Benchmarking, Accessibility, E2E & Security Fuzzing, Docker Stack & User Manual (`M8-1` to `M8-6`):**
  - Vector tile SHA-256 `ETag` (`304 Not Modified`), `Cache-Control`, and `X-Tile-Render-Ms` telemetry in `backend/app/api/v1/tiles.py`, plus live performance & readiness benchmark endpoint (`GET /api/v1/system/benchmark`) in `backend/app/api/v1/diagnostics.py`.
  - HTTP Security Headers middleware (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`) in `backend/app/main.py`.
  - WCAG 2.1 AA accessibility & keyboard navigation upgrades in `frontend/src/components/layout/AppShell.tsx` and `frontend/src/pages/WorkspacePage.tsx` (`Skip to main content`, `aria-current="page"`, keyboard-navigable 7-Step `Workflow Steps` rail with `aria-current="step"` and `aria-live="polite"` status announcer).
  - End-to-end user journey and security penetration/fuzzing integration test suite (`backend/tests/integration/test_m8_e2e_complete_journey_and_security.py`).
  - Multi-container production & offline evaluation Docker stack (`backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`, and full 4-service `docker-compose.yml` with `OFFLINE_MODE=true`).
  - Comprehensive Planner & Evaluator User Manual (`docs/USER_MANUAL.md`).
- **Milestone M7 — Complete 24-Section DPR, Excel BOQ & Cleaned GIS Exports (`M7-1` to `M7-6`):**
  - Pure domain pre-flight engineering & data integrity audit (`backend/app/domain/reporting/preflight.py`) with canonical 24-section catalog (`DPR_24_SECTIONS`), Hard Blocker vs. Soft Warning evaluation (`evaluate_dpr_preflight`), and deterministic SHA-256 snapshot and file hashing (`compute_snapshot_sha256`, `compute_file_sha256`).
  - Complete 24-section PDF DPR compilation engine (`backend/app/services/settlement_pdf_service.py`) rendering Sections 1–24 in sequential order, explicit `"No data available — reason: ..."` disclosures (`FR-10.4`), and dynamic `"PRELIMINARY ENGINEERING — NOT FIELD VERIFIED"` diagonal watermarks (`FR-10.3`).
  - Formula-driven 5-sheet Excel BOQ workbook generator (`backend/app/services/excel_export_service.py`) using `openpyxl` (`Summary`, `Settlements & Demand`, `Engineering & Sizing`, `BOQ & Rates`, `Scenario Comparison`) with live `=ROUND(D*F,2)` and `=ROUND(SUM(...),2)` formulas matching API and PDF BOQ totals (`AC-11.3`).
  - Cleaned GIS vector package exporter (`backend/app/services/gis_export_service.py`) producing a `.zip` bundle with `aoi_boundary.geojson`, `habitation_clusters.geojson`, `infrastructure_assets.geojson`, `preliminary_network_layout.geojson`, `settlement_and_engineering_schedule.csv`, and `provenance_manifest.json` (`AC-11.4`).
  - `ProjectExportRecord` ORM model (`backend/app/db/models/export_record.py`), Alembic migration `0008_m7_exports_and_preflight.py`, report orchestration service (`backend/app/services/report_service.py`), and REST endpoints (`backend/app/api/v1/reports.py`: `/report/preflight`, `/exports`, `/exports/dpr-pdf`, `/exports/boq-xlsx`, `/exports/gis-package`).
  - Frontend `DprExportCenterPanel.tsx` integrated into `WorkspacePage.tsx` with Pre-Flight Audit Checklist, 24-Section DPR Compilation Index, SHA-256 Export Audit Log, and one-click download triggers.
- **Milestone M6 — Traceable Cost Estimation, BOQ & Scenario Comparison (`M6-1` to `M6-5`):**
  - Schedule of Rates (SoR) domain (`backend/app/domain/costing/rates.py`) with 18 verified Odisha OPTCL/TPSODL/REC/MNRE unit rates (`STANDARD_SOR_ITEMS`), CSV import/export (`parse_and_validate_sor_csv`, `export_sor_to_csv`), row-level validation error reporting, and explicit `UNSET` rate support enforcing Core Principle #4.
  - Life-cycle financial and economic engine (`backend/app/domain/engineering/economics.py`) computing Capital Recovery Factor ($\text{CRF}$), Present Worth Factor ($\text{PWF}$), 10-year Net Present Cost ($\text{NPC}_{\text{INR}}$), Levelized Cost of Energy ($\text{LCOE}_{\text{INR/kWh}}$), Year-7 LiFePO4 battery replacement present value, wholesale grid energy cost (including technical losses), scheme capital grant share, and avoided $\text{CO}_2$ emissions.
  - Automated Bill of Quantities (BOQ) engine (`backend/app/domain/costing/boq.py`) with terrain difficulty multipliers ($1.00\times$ plain, $1.12\times$ rolling hilly, $1.25\times$ steep forest), GST (18%), contingency (3%), PMC overheads (5%), and `has_unset_rates` pre-flight blocking.
  - `ProjectRateItem` and `ScenarioBoqLine` models (`backend/app/db/models/costing.py`), Alembic migration `0007_m6_costing_boq_scenarios.py`, costing & scenario comparison service (`backend/app/services/costing_service.py`), REST router (`backend/app/api/v1/costing.py`), and DPR PDF Sections 15–17 (`backend/app/services/settlement_pdf_service.py`).
  - Frontend `CostAndScenarioComparisonPanel.tsx` integrated into `WorkspacePage.tsx` with 6-tile financial KPI strip, UNSET rate export-block banner, itemized BOQ spreadsheet, 4-scenario side-by-side comparison cards + per-habitation NPC/LCOE table, and interactive SoR editor + CSV importer.

### Fixed
- **Antigravity IDE Python Environments & PET Subsystem Resolution:**
  - Diagnosed persistent yellow "Select Python Interpreter" status bar warning as an extension locator failure in `ms-python.vscode-python-envs` caused by missing native `python-env-tools\bin\pet.exe` binary in universal extension packages.
  - Deployed native Windows x64 `pet.exe` (v0.1.0) into `ms-python.vscode-python-envs-1.20.1-universal` and `ms-python.python-2026.4.0-universal`, resolving `ENOENT` spawn errors.
  - Cleared stale workspace interpreter pointers to root `.venv` in `state.vscdb` and updated authoritative interpreter to `backend\.venv\Scripts\python.exe`.
- **IDE Language Server & Static Type Diagnostics (Resolved 23 Problems Panel Findings):**
  - Configured workspace settings (`.vscode/settings.json`, `.vscode/extensions.json`, `pyrightconfig.json`) resolving missing interpreter and `backend` module import resolution errors across spike scripts.
  - Resolved `BaseGeometry.geoms` attribute error in `backend/app/domain/gis/boundary.py` via safe collection attribute inspection (`getattr`).
  - Resolved `pyproj.exceptions.CRSError` import in `boundary.py` with explicit top-level exception import.
  - Fixed `shapely.transform` coordinate array shape mismatch in `boundary.py` using `np.column_stack`.
  - Fixed `Polygon(hull.convex_hull)` redundant constructor type errors in `backend/app/domain/gis/clustering.py` by preserving Shapely 2 polygon instances directly.
  - Resolved `BaseGeometry.x` and `BaseGeometry.y` access errors on projected UTM points in `backend/app/domain/gis/gap_analysis.py` and `backend/app/services/settlement_pdf_service.py` by accessing typed `.centroid.x` / `.centroid.y`.
  - Fixed `simplify` return type narrowing for `LineString` in `backend/app/domain/gis/routing.py`.
  - Fixed optional `None.isoformat()` type violation on `proj.deleted_at` in `backend/app/services/project_service.py`.
  - Resolved `rasterio.enums.Resampling` attribute access in `scripts/spikes/s1_data_access.py` via explicit submodule import.
  - Shortened docstring line length in `backend/migrations/versions/0002_m1_auth_projects_aoi.py` to satisfy `E501`.
- **Codebase Integrity & Test Stability:**
  - Resolved `mypy` module typing conflict in `backend/tests/conftest.py` by aliasing `import app.db.models as _models` and `from app.main import app as fastapi_app`, restoring type safety for `app.dependency_overrides`.
  - Added explicit `Path` typing for `tmp_path: Path` in `backend/tests/integration/test_m1_auth_projects_aoi.py`.
  - Isolated scenario state in `backend/tests/integration/test_m5_planning_scenarios.py` by explicitly ensuring `HYBRID_OPTIMAL` baseline initialization and restoring baseline during test teardown.
  - Resolved ambiguous multiple element match in frontend `src/tests/AppRoutes.test.tsx` using `getAllByText(/1420 m/i)`.
  - Resolved unused imports, format ordering, and blind exception warnings in utility scripts (`scripts/spikes/s1_data_access.py`, `scripts/spikes/s2_routing.py`, `scripts/spikes/s3_pdf_spike.py`).

### Added
- **GitHub Community Standards Compliance:**
  - Expanded root `README.md` into an authoritative engineering guide covering epistemic honesty principles, 4 electrification dimensions, architecture, completed milestones M0–M5, local setup (Docker PostGIS, Python venv, Vite dev), and quality commands.
  - Added `CONTRIBUTING.md` defining community values, core non-negotiable principles, domain purity rules, explicit physical units convention, and pre-commit verification gates.
  - Added `CODE_OF_CONDUCT.md` following Contributor Covenant v2.1 with reporting contact `swayamkr26@gmail.com`.
  - Added `SECURITY.md` detailing supported versions, responsible vulnerability disclosure process, and built-in security architecture (CSRF, path traversal protection, parameterized SQL, bcrypt).
  - Added GitHub issue forms and templates: `.github/ISSUE_TEMPLATE/bug_report.yml`, `.github/ISSUE_TEMPLATE/feature_request.yml`, `.github/ISSUE_TEMPLATE/config.yml`.
  - Added standard Pull Request template: `.github/pull_request_template.md` with engineering principles and quality gate checklist.
- **Apache License 2.0 Compliance:**
  - Created root `NOTICE` file specifying project copyright and comprehensive third-party open data attributions (Copernicus DEM GLO-30, Sentinel-2 Cloudless EOX, OpenStreetMap ODbL, Google/Microsoft Open Buildings via VIDA, NASA POWER climatology, and Census of India 2011).
  - Applied standard Apache 2.0 copyright and license boilerplate headers across 96 Python and 26 TypeScript/TSX source files via `scripts/apply_license_headers.py`.
- **GitHub Actions CI & Repository Configuration:**
  - Resolved `TS2307: Cannot find module '../lib/apiClient'` in CI builds by anchoring `.gitignore` Python build rules to `backend/build/` and `backend/lib/`, ensuring `frontend/src/lib/apiClient.ts` is committed and tracked.
  - Added explicit parameter type `(u: AdminUnitDto)` in `frontend/src/pages/NewProjectWizardPage.tsx` and included `geojson` in `frontend/tsconfig.json` compiler `types`.
  - Upgraded `maplibre-gl` from `4.7.1` to `6.16.0` to resolve critical CVSS 10.0 XSS vulnerability (`GHSA-jrc7-96c5-q579`), adapting map canvas imports to `import * as maplibregl`.
  - Modernized CI workflow in `.github/workflows/ci.yml` with Node.js 22 LTS and `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` to eliminate runner deprecation notices.

### Added
- **Milestone M5 — Network Layout Routing & Engineering Engine (`M5-1` to `M5-8`):**
  - Normative REC / IS / CEA / MNRE engineering constants (`backend/app/domain/engineering/constants.py`, `GET /api/v1/engineering-constants`) and IS 1180 Level-2 Distribution Transformer specifications (`16, 25, 63, 100, 200 kVA`).
  - Pure UTM (`EPSG:32644`) network sizing and routing domain (`backend/app/domain/engineering/network_sizing.py`) for DT placement & sub-zone splitting (`place_cluster_transformers`), 11 kV HT feeder `MCP_Geometric` least-cost path routing (`route_cluster_11kv_ht_feeder`), and 415 V LT radial Minimum Spanning Tree construction (`build_cluster_415v_lt_mst`).
  - Deterministic engineering calculations (`backend/app/domain/engineering/calculations.py`) for 11 kV HT / 415 V LT voltage drop ($\Delta V\%$), annual $I^2R$ and DT iron/copper technical losses ($\text{MWh/yr}$), NASA POWER worst-month monsoon GHI Solar PV + LiFePO4 BESS mini-grid sizing, and Standalone SHS kit sizing.
  - `PlanningScenario` and `ClusterEngineeringLayout` models (`backend/app/db/models/planning.py`), Alembic migration `0006_m5_planning_network_layout.py`, synchronous scenario planning service (`backend/app/services/planning_service.py`), REST router (`backend/app/api/v1/planning.py`), and DPR PDF Sections 10–14 + Single-Line Diagram schematic (`backend/app/services/settlement_pdf_service.py`).
  - Frontend `NetworkEngineeringPanel.tsx` integrated into `WorkspacePage.tsx` and `MapCanvas.tsx` (routed 11 kV HT, 415 V LT MST, and DT/Mini-Grid Hub layers, scenario switcher, per-cluster modality override with synchronous recalculation, inline SVG Single-Line Diagram, and REC/IS/CEA constants drawer).
- **Milestone M4 — Infrastructure Gap Analysis, Project Assumptions Register & 7-Category Demand Engine (`M4-1` to `M4-6`):**
  - Pure UTM (`EPSG:32644`) terrain-weighted distance and obstacle gap analysis domain (`backend/app/domain/gis/gap_analysis.py`) enforcing Core Principle #4 (zero fabricated infrastructure; `d_straight_m`/`d_terrain_m` remain `None`/`UNSET` until utility GIS or explicit `USER_ASSUMED` tie-in points are added).
  - Pure 14-parameter normative REC/CEA/ESMAP assumptions register and 7-category parametric electricity demand engine (`backend/app/domain/engineering/demand.py`) covering `DOMESTIC_BPL`, `DOMESTIC_APL`, `INSTITUTIONAL`, `STREET_LIGHTING`, `WATER_PUMPING`, `AGRICULTURAL_IRRIGATION`, and `MICRO_ENTERPRISE` with coincident peak ($\text{kW}$ / $\text{kVA}$) and compound horizon growth.
  - `InfrastructureAsset`, `ProjectSetting`, `ClusterGapAnalysis`, and `ProjectDemandEstimate` models (`backend/app/db/models/infrastructure.py`) and Alembic migration `0005_m4_infra_assumptions_demand.py`.
  - Infrastructure, Gap Analysis, Assumptions Register, and Demand orchestration service (`backend/app/services/infrastructure_service.py`) and REST endpoints (`backend/app/api/v1/infrastructure.py`, `backend/app/api/v1/settings.py`), plus Sections 6–9 in the Preliminary DPR PDF (`backend/app/services/settlement_pdf_service.py`).
  - Frontend `InfrastructureAndDemandPanel.tsx` integrated into `WorkspacePage.tsx` and `MapCanvas.tsx` (existing infrastructure and gap corridor layers, interactive map tie-in placement, assumptions register editor, and 7-category demand forecast tables).
- **Milestone M3 — Settlement Identification, Two-Axis Proxy Classification, Verification Ledger & Preliminary DPR PDF (`M3-1` to `M3-7`):**
  - Pure metric DBSCAN habitation clustering (`backend/app/domain/gis/clustering.py`) in UTM `EPSG:32644` with 35 m buffered convex hull polygons, isolated homestead grouping, and household estimation (`round(n_residential * household_alpha)`).
  - Pure 4-tier proxy classification and Census 2011 household reconciliation domain (`backend/app/domain/gis/classification.py`) enforcing epistemic honesty (`proxy_confidence` capped at `MEDIUM`/`LOW`, flagging $>30\%$ Census divergence).
  - `ClusterRun`, `SettlementCluster`, `VerificationRecord`, and `VerificationImport` models (`backend/app/db/models/settlement.py`) and Alembic migration `0004_m3_settlements_verification.py` with append-only immutability triggers (`before_update`/`before_delete` listeners + PostgreSQL trigger).
  - Settlement & Verification service (`backend/app/services/settlement_service.py`), Preliminary DPR PDF Skeleton generator (`backend/app/services/settlement_pdf_service.py` — Sections 1–5 + Page 2 UTM Cartographic Map Plate), and REST routers (`backend/app/api/v1/settlements.py`, `backend/app/api/v1/verification.py`, `clusters` layer in `backend/app/api/v1/tiles.py`).
  - Frontend `SettlementAssessmentPanel.tsx` integrated into `WorkspacePage.tsx` and `MapCanvas.tsx` (Okabe-Ito proxy palette, dashed vs. solid verification outlines, configurable DBSCAN controls, Census 2011 reconciliation banner, inline Axis-2 verification form, append-only audit ledger with reversal, CSV batch upload, and PDF download).
- **Milestone M2 — Geospatial Ingestion, Provenance Registry, Job Queue & Reference Pack (`M2-1` to `M2-7`):**
  - PostgreSQL-backed transactional job queue (`backend/app/services/job_service.py`, `backend/app/api/v1/jobs.py`, `backend/app/worker.py`) enforcing `max_jobs_per_user=2` (`429 CONCURRENT_JOB_LIMIT`), stage/progress updates, and cancellation (`POST /api/v1/jobs/{job_id}/cancel`).
  - Dataset provenance registry (`GET /api/v1/datasets`) and spatial models (`ProjectLayer`, `Building`, `OsmFeature`, `SolarResource`) with Alembic migration `0003_m2_layers_buildings_osm_solar.py`.
  - Pure GIS layer processing domain (`backend/app/domain/gis/layer_processing.py`) classifying building footprints by metric area (`NOISE` `<8 m²`, `OUTBUILDING` `8–15 m²`, `RESIDENTIAL` `15–250 m²`, `NON_RESIDENTIAL` `>250 m²`), computing UTM terrain/landcover/nightlight/OSM/NASA POWER GHI summaries, and rendering color-mapped RGBA PNG raster overlays (`dem_slope`, `landcover`, `nightlights`).
  - Offline Koraput Reference Pack pre-population and acquisition coordinator (`POST /api/v1/projects/{id}/data/acquire`), custom GeoJSON layer upload (`POST /api/v1/projects/{id}/layers/upload` tagged `USER_ENTERED`), vector GeoJSON & `ST_AsMVT` endpoints (`backend/app/api/v1/data.py`, `backend/app/api/v1/tiles.py`).
  - Frontend `ProvenanceChip.tsx`, `JobProgress.tsx`, and `DataManagementPanel.tsx` integrated into `WorkspacePage.tsx` and `MapCanvas.tsx` with vector layer toggles, raster overlay selector, and opacity slider.
- **Milestone M1 — Core Authentication, Project CRUD & AOI Module (`M1-1` to `M1-8`):**
  - Argon2id password hashing, SHA-256 session/CSRF token storage, sliding-window login rate limiter, and HttpOnly `em_session` cookie + `X-CSRF-Token` dependency (`backend/app/core/security.py`, `backend/app/services/auth_service.py`, `backend/app/api/v1/auth.py`, `backend/app/api/v1/deps.py`).
  - Project CRUD API (`GET/POST /api/v1/projects`, `GET/PATCH/DELETE /api/v1/projects/{id}`, `POST /api/v1/projects/{id}/duplicate`) with optimistic concurrency locking (`version`) and cross-user ownership isolation (`backend/app/services/project_service.py`, `backend/app/api/v1/projects.py`).
  - Administrative hierarchy (`AdminUnit`) and Census 2011 (`CensusVillage`) seeding for Odisha -> Koraput -> Nandapur / Pottangi -> Gram Panchayats -> Villages (`Bheja`, `Padwa`, `Maliaguda PVTG Forest Habitation`, `Pukali`), plus pre-seeded demo project (`backend/app/services/seed_service.py`, `backend/app/api/v1/admin_units.py`).
  - Pure GIS boundary validation & normalization domain (`backend/app/domain/gis/boundary.py`) supporting self-intersection auto-repair (`make_valid`), CRS reprojection to `EPSG:4326`, India bounds verification, UTM area caps (`0.01` to `500 km²`), and 1.5 km metric circular buffer fallback (`APPROXIMATE_BUFFER`).
  - Safe multipart boundary upload (`POST /api/v1/projects/{id}/aoi/upload`) supporting `.geojson`/`.json`, `.kml`, and `.zip` Shapefile archives with zip-bomb, path-traversal, and mandatory `.prj` checks (`backend/app/services/aoi_service.py`, `backend/app/api/v1/aoi.py`).
  - Frontend application shell (`AppShell.tsx`), session state store (`sessionStore.ts`), CSRF-aware API client (`apiClient.ts`), interactive `MapCanvas.tsx`, and routes (`/`, `/login`, `/projects`, `/projects/new`, `/projects/:id/workspace`).
- **Milestone M0 — Monorepo, Backend Foundation & Database Migrations (`M0-1`, `M0-2`, `M0-3`, `M0-5`):**
  - Monorepo layout (`backend/`, `frontend/`, `scripts/`, `data/`, `.github/workflows/ci.yml`), `.editorconfig`, and `docker-compose.yml` (`postgis/postgis:16-3.4`).
  - FastAPI application (`backend/app/main.py`) with structured JSON logging, typed `AppError` envelope, path-traversal-safe `LocalStorageService`, and `/api/v1/health` + `/api/v1/health/ready` + `/api/v1/spikes/*` endpoints.
  - Dual-mode spatial SQLAlchemy layer (`SpatialGeometry` in `backend/app/db/types.py`), foundation models (`Dataset`, `EngineeringConstant`, `Job`), and Alembic migration `0001_initial_foundation.py`.
- **Milestone M0 — Pure GIS Domain & Technical Risk Spikes (`S1`, `S2`, `S3`, `S4`):**
  - Pure GIS domain modules (`backend/app/domain/gis/crs.py`, `raster_ops.py`, `cost_surface.py`, `routing.py`) for dynamic UTM `EPSG:32644` reprojection, Horn slope/hillshade calculation, terrain cost surfaces, and `MCP_Geometric` least-cost 11 kV feeder routing.
  - Spike S1 (`scripts/spikes/s1_data_access.py`): Nandapur Block, Koraput District, Odisha reference geography (`data/reference/MANIFEST.json`, `docs/data-sources.md`).
  - Spike S2 (`scripts/spikes/s2_routing.py`): 11 kV feeder routing over 30 m DEM + WorldCover in 0.044 s (`data/reference/koraput_nandapur_sample_routes.geojson`).
  - Spike S3 (`scripts/spikes/s3_pdf_spike.py`): 2-page ReportLab Platypus + Matplotlib cartographic DPR map plate with metric scale bar, north arrow, graticule, and preliminary watermarks (`backend/tests/unit/test_pdf_spike.py`).
  - Spike S4 (`scripts/spikes/s4_generate_50k_buildings.py` & `frontend/src/components/map/MapSpikePreview.tsx`): 50,000 building footprints WebGL stress test in MapLibre GL JS.
- **Milestone M0 — Frontend Scaffolding & "Survey Sheet" Design System (`M0-4`):**
  - React 18 + TypeScript (`strict: true`) + Vite + Tailwind CSS + MapLibre GL JS SPA in `frontend/`.
  - Design system tokens (`frontend/src/styles/tokens.css`, `globals.css`) and core UI primitives (`TitleBlock`, `QualityTag`, `ClassificationBadge`, `StatTile`, `Callout`, `Button`, `MapSpikePreview`) with Vitest unit test coverage.
- **Prompt 3 — Repository & Documentation Setup:**
  - Comprehensive `.gitignore` protecting credentials, Python venvs, node_modules, GIS rasters, GeoParquet, and build artifacts.
  - Baseline `.env.example` documenting all configuration keys without exposing credentials.
  - Approved `docs/PROJECT_CONTEXT.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/DECISIONS.md`, `docs/KNOWN_ISSUES.md`, `AGENTS.md`, `CLAUDE.md`, `TASKS.md`, and `PROJECT_STATUS.md`.
