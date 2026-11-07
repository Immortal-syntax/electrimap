# TASKS.md — Project Roadmap & Task Execution Tracker

> **Tracking Convention:** `[ ] TODO` · `[-] IN_PROGRESS` · `[x] DONE` · `[!] BLOCKED`  
> **Source of Truth:** Derived directly from approved `docs/ROADMAP.md`.

---

## Preparation & Planning (Prompts 0–3)
- [x] **PROMPT-0:** Comprehensive Project Definition, Research & Feasibility Evaluation *(Approved 2026-11-05)*
- [x] **PROMPT-1:** Product Discovery, Requirements Validation & PRD *(Approved 2026-11-05)*
- [x] **PROMPT-2:** Technical Architecture, UI/UX Design System & Roadmap *(Approved 2026-11-06)*
- [x] **PROMPT-3:** Environment Inspection, Git/GitHub Setup & Permanent Instructions *(Approved 2026-11-06)*
- [-] **PROMPT-4:** Milestone Implementation & Continuous Verification *(In Progress — Milestone M6 Completed)*
- [ ] **PROMPT-5:** Production Readiness, Debugging & Handover

---

## Milestone M0: Tooling, Database Setup & Spikes
- [x] **M0-1:** Establish Monorepo directory structure, editorconfig, and tooling configs
- [x] **M0-2:** Backend environment setup (Python 3.12/3.13, FastAPI base, linting, test runner)
- [x] **M0-3:** PostGIS database connectivity, SQLAlchemy models, and Alembic migrations
- [x] **M0-4:** Frontend scaffolding (Vite + React + TypeScript + Tailwind + MapLibre setup)
- [x] **M0-5:** GitHub Actions CI pipeline configuration
- [x] **S1 (Spike):** Koraput reference data acquisition & verification test
- [x] **S2 (Spike):** DEM slope cost-surface raster routing feasibility check
- [x] **S3 (Spike):** ReportLab PDF cartographic rendering test with north arrow & scale bar
- [x] **S4 (Spike):** MapLibre MVT performance test with 50k building footprints
- [x] **M0-6:** Milestone M0 Review & Checkpoint verification

---

## Milestone M1: Core Authentication, Project & AOI Module
- [x] **M1-1:** User auth, session store, CSRF, and security dependencies
- [x] **M1-2:** Project CRUD API with optimistic concurrency locking
- [x] **M1-3:** Administrative unit and Census database lookup seeding
- [x] **M1-4:** GIS CRS reprojection and boundary geometry validation service
- [x] **M1-5:** Boundary file upload handler (Shapefile zip, GeoJSON, KML)
- [x] **M1-6:** Frontend application shell, layout, and session state
- [x] **M1-7:** Interactive MapCanvas with MapLibre GL JS and basemap switching
- [x] **M1-8:** AOI selection wizard (administrative cascade, drawing, and upload)

---

## Milestone M2: Geospatial Ingestion, Provenance & Reference Pack
- [x] **M2-1:** Transactional background job queue and worker process
- [x] **M2-2:** Dataset provenance registry and metadata schema
- [x] **M2-3:** Spatial data ingestion pipelines (buildings, DEM, landcover, nightlights, OSM, solar)
- [x] **M2-4:** Background AOI data clipping and processing coordinator
- [x] **M2-5:** Koraput offline demonstration dataset packaging
- [x] **M2-6:** PostGIS vector tile (`ST_AsMVT`) and raster preview endpoints
- [x] **M2-7:** Workspace Data Management panel with provenance cards

---

## Milestone M3: Settlement Identification & Verification Ledger
- [x] **M3-1:** Building footprint filtering and DBSCAN habitation clustering
- [x] **M3-2:** Zonal statistics extraction and 4-tier proxy classification engine
- [x] **M3-3:** Cluster persistence API and Census household reconciliation
- [x] **M3-4:** Immutable verification audit ledger and CSV import processor
- [x] **M3-5:** Interactive Settlement Assessment UI with synchronized map inspector
- [x] **M3-6:** Verification Audit Log and field correction dashboard
- [x] **M3-7:** Preliminary DPR PDF skeleton generation with dynamic maps

---

## Milestone M4: Infrastructure Gap Analysis & Demand Engine
- [x] **M4-1:** Existing electrical infrastructure management and interactive tie-in placement
- [x] **M4-2:** Terrain-weighted distance and obstacle gap analysis matrix
- [x] **M4-3:** Project-level assumptions register with parameter edit tracking
- [x] **M4-4:** 7-category parametric electricity demand estimation engine
- [x] **M4-5:** Interactive Infrastructure and Demand Workspace panels
- [x] **M4-6:** DPR engineering demand and gap analysis section export

---

## Milestone M5: Network Layout Routing & Engineering Engine
- [x] **M5-1:** Engineering constants table verification against REC/IS standards
- [x] **M5-2:** Distribution transformer placement and radial distance constraints
- [x] **M5-3:** 11 kV HT feeder least-cost path routing algorithm
- [x] **M5-4:** 415V LT radial network Minimum Spanning Tree and pole allocation
- [x] **M5-5:** Deterministic engineering calculations (voltage drop, technical losses, solar/BESS sizing)
- [x] **M5-6:** Synchronous scenario planning and recalculation engine
- [x] **M5-7:** Planning and Network Layout interactive editing UI
- [x] **M5-8:** DPR engineering calculations and Single-Line Diagram export

---

## Repository Audit: Error Remediation, GitHub Community Standards & Apache 2.0 Compliance
- [x] **AUDIT-1:** Audit entire codebase and resolve test harness typing and scenario isolation issues
- [x] **AUDIT-2:** Implement full GitHub Community Standards (`README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, Issue & PR templates)
- [x] **AUDIT-3:** Verify Apache 2.0 compliance (unmodified `LICENSE`, `NOTICE` file with 6 dataset attributions, standard license headers on source files)
- [x] **AUDIT-4:** Verify all quality gates (`ruff`, `mypy`, `pytest`, `eslint`, `tsc`, `vitest`, `build`) and push to GitHub

---

## Milestone M6: Traceable Cost Estimation & Scenarios
- [x] **M6-1:** Schedule of Rates (SoR) management and custom CSV import
- [x] **M6-2:** Automated Bill of Quantities (BOQ) generator and financial metrics
- [x] **M6-3:** Scenario comparison engine (Grid vs. Mini-Grid vs. SHS vs. Hybrid)
- [x] **M6-4:** Interactive Cost BOQ spreadsheet and Scenario Comparison UI
- [x] **M6-5:** DPR financial statements and cost abstract export

---

## Milestone M7: Complete 24-Section DPR, Excel & GIS Exports
- [ ] **M7-1:** Comprehensive 24-section PDF DPR compilation engine
- [ ] **M7-2:** Pre-flight engineering and data integrity audit validation
- [ ] **M7-3:** Formula-driven multi-sheet Excel BOQ workbook generator
- [ ] **M7-4:** Cleaned GIS vector package export (GeoJSON/Shapefile/CSV)
- [ ] **M7-5:** Export job logging and cryptographic document hashing
- [ ] **M7-6:** DPR preview, map framing, and export download center

---

## Milestone M8: System Hardening, Benchmarking & Production Audit
- [ ] **M8-1:** Geospatial spatial query and map rendering performance optimization
- [ ] **M8-2:** Comprehensive accessibility audit and keyboard navigation review
- [ ] **M8-3:** End-to-end automated integration tests for complete user journeys
- [ ] **M8-4:** Security penetration review, input fuzzing, and dependency audit
- [ ] **M8-5:** Docker container configuration and offline evaluation readiness
- [ ] **M8-6:** Comprehensive technical documentation and user manual finalization

