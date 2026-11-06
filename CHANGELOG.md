# CHANGELOG.md — Project Activity & Milestone History

All notable changes to the ElectriMap DPR project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] - 2026-11-06

### Added
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
- Approved `docs/PROJECT_CONTEXT.md` defining project identity, problem statement, and non-negotiable principles.
- Approved `docs/PRD.md` detailing functional requirements (FR-1 to FR-12), non-functional requirements, and acceptance criteria.
- Approved `docs/ARCHITECTURE.md` specifying system architecture, database schema, REST API, and data ingestion pipelines.
- Approved `docs/DESIGN_SYSTEM.md` specifying "Survey Sheet" aesthetic, color-blind safe palettes, and map workspace interactions.
- Approved `docs/DECISIONS.md` recording all ADRs (D-01 to D-04, C1 to C8, AD-01 to AD-09).
- `docs/KNOWN_ISSUES.md` tracking environment observations and methodological caveats.
- Permanent root instructions `AGENTS.md` and `CLAUDE.md` establishing universal multi-agent coding standards and Git policies.
- Milestone tracking file `TASKS.md` derived from the development roadmap.
- Live progress and handover document `PROJECT_STATUS.md`.

