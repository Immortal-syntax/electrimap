# CHANGELOG.md — Project Activity & Milestone History

All notable changes to the ElectriMap DPR project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] - 2026-11-06

### Fixed
- **GitHub Actions CI & Repository Configuration:**
  - Resolved `TS2307: Cannot find module '../lib/apiClient'` in CI builds by anchoring `.gitignore` Python build rules to `backend/build/` and `backend/lib/`, ensuring `frontend/src/lib/apiClient.ts` is committed and tracked.
  - Added explicit parameter type `(u: AdminUnitDto)` in `frontend/src/pages/NewProjectWizardPage.tsx` and included `geojson` in `frontend/tsconfig.json` compiler `types`.
  - Upgraded `maplibre-gl` from `4.7.1` to `6.16.0` to resolve critical CVSS 10.0 XSS vulnerability (`GHSA-jrc7-96c5-q579`), adapting map canvas imports to `import * as maplibregl`.
  - Modernized CI workflow in `.github/workflows/ci.yml` with Node.js 22 LTS and `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` to eliminate runner deprecation notices.

### Added
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
