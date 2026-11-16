# DECISIONS.md — Architecture & Project Decision Records

This document maintains an immutable, chronological Architecture Decision Record (ADR) log for ElectriMap DPR.

---

## Decision D-01: Adoption of Prompt 0 Foundation
- **Date:** 2026-11-05
- **Status:** Approved by User
- **Context:** Project scope definition and initial feasibility study.
- **Decision:** Adopt the comprehensive Prompt 0 specification (Deliverables A–J) as the foundational technical scope for the rural electrification DPR workbench.

---

## Decision D-02: Zero-Cost Resource Policy
- **Date:** 2026-11-05
- **Status:** Approved by User
- **Context:** Budget and external dependency management.
- **Decision:** Restrict all geospatial and computational workflows to 100% free, permissive open data and keyless APIs. No paid satellite imagery, commercial tile servers, geocoding credits, or subscription cloud platforms are permitted.

---

## Decision D-03: Reference Demonstration Geography
- **Date:** 2026-11-05
- **Status:** Approved by User
- **Context:** Need for a high-fidelity, offline-ready tribal district dataset for immediate demonstration and validation.
- **Decision:** Selected **Koraput district, Odisha** (Eastern Ghats tribal belt) as the primary pre-seeded demo area.

---

## Decision D-04: Scope Boundary for Phase 1 MVP
- **Date:** 2026-11-05
- **Status:** Approved by User
- **Context:** Delivery focus and technical risk mitigation.
- **Decision:** Exclude on-the-fly deep learning segmentation on raw satellite rasters and full non-linear AC load-flow simulation from the Phase 1 MVP. Use pre-computed Google/Microsoft Open Buildings with spatial DBSCAN clustering and deterministic CEA/REC/MNRE engineering rules.

---

## Decision Refinements C1–C8: Methodology and Data Models
- **Date:** 2026-11-05
- **Status:** Approved by User
- **C1 (Classification Disaggregation):** Split electrification classification into two independent dimensions: *Computed Proxy Class* (`LIKELY_ELECTRIFIED`, `POTENTIALLY_UNDERSERVED`, `POTENTIALLY_UNSERVED`, `UNKNOWN`) and *Evidence Verification State* (`UNVERIFIED`, `FIELD_VERIFIED`, `UTILITY_VERIFIED`). Never label a satellite proxy as "verified".
- **C2 (Nighttime Lights):** Confirmed HREA dataset includes India sub-divided by state (`IND-XX`). VIIRS annual composites serve as fallback.
- **C3 (Engineering Constants):** Electrical and transformer constants flagged as `PROVISIONAL` until primary document citations (REC/IS/CEA) are verified.
- **C4 (UI Consolidation):** Consolidate 15 separate administrative pages into an integrated 8-route SPA with a unified multi-tab GIS engineering workbench.
- **C5 (MCDA Phasing):** Prioritization MCDA workbench phased to P1; MVP retains transparent sorting by unserved households and cost per household.
- **C6 (DT Distance Metric):** Apply secondary transformer distance rules only when actual DT assets exist in the project layer.
- **C7 (Open Basemap Terms):** Standardize on OpenFreeMap (vector) and EOX Sentinel-2 cloudless (2016 CC BY 4.0 raster) for keyless, legal mapping.
- **C8 (Block Selection):** Target block in Koraput district to be finalized during initial data ingestion based on data completeness.

---

## Architectural Decisions AD-01 to AD-09
- **Date:** 2026-11-06
- **Status:** Approved by User
- **AD-01 (Frontend Stack):** Replace Next.js with **React 18 + TypeScript + Vite SPA**. Eliminates unnecessary Node SSR runtime complexity and WebGL canvas lifecycle issues.
- **AD-02 (Queue Architecture):** Use PostgreSQL-backed transactional job table with `SKIP LOCKED` worker process. Avoids external Redis/Celery dependency.
- **AD-03 (DPR Generation):** Server-side ReportLab Platypus + Matplotlib cartography for pixel-perfect, deterministic 24-section PDF DPR compilation.
- **AD-04 (Auth & Security):** Standardize on server-side httpOnly secure session cookies with Argon2id password hashing and CSRF tokens.
- **AD-05 (Storage Layer):** File system storage under local `DATA_DIR` abstracted via a pluggable `StorageService` interface.
- **AD-06 (Satellite Basemap):** EOX Sentinel-2 cloudless 2016 (CC BY 4.0) selected as default; post-2018 (CC BY-NC-SA) made available with explicit non-commercial notices.
- **AD-07 (Deployment Strategy):** Local development and Docker Compose demo deployment prioritized for Phase 1. Public cloud hosting deferred to P1.
- **AD-08 (Network Routing):** scikit-image `MCP_Geometric` raster cost-surface pathfinding for HT feeders; SciPy Minimum Spanning Tree for LT radial networks.
- **AD-09 (Documentation Structure):** Permanent root instruction files (`AGENTS.md`, `CLAUDE.md`, `PROJECT_STATUS.md`, `TASKS.md`, `CHANGELOG.md`) paired with a comprehensive `docs/` repository.
- **AD-10 (Reference Block & Village Finalization — C8 Resolution):** Selected **Nandapur Block, Koraput District, Odisha** (sample village **Bheja**, LGD `398712`, Census 2011 `428914`, bbox `[82.68, 18.52, 82.78, 18.61]`, metric CRS `EPSG:32644` UTM Zone 44N) as the canonical reference geography in Spike S1 (`data/reference/MANIFEST.json`).
- **AD-11 (Dual-Mode Spatial Database Adapter):** Implemented `SpatialGeometry` (`backend/app/db/types.py`) using `geoalchemy2.Geometry` on PostgreSQL/PostGIS and WKB-hex + Shapely 2.2 / PyProj 3.8 on local SQLite so full spatial CRUD, CRS reprojection, and Alembic migrations run identically on Windows workstations without Docker (`KI-01`) as well as in PostGIS CI containers.

