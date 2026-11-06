# AGENTS.md — Permanent Shared AI Development Instructions

> **Universal Source of Truth:** This file governs all AI coding agents (Antigravity Agent, Claude, and secondary agents) working on **ElectriMap DPR**.
> All agents must read and adhere strictly to these rules before modifying files or executing commands.

---

## 1. Project Context & Non-Negotiable Core Principles
1. **Purpose:** ElectriMap DPR is a web-based pre-feasibility GIS workbench for assessing rural/tribal electrification in India and generating 24-section Detailed Project Reports (DPRs).
2. **Epistemic Honesty:** Satellites cannot see electricity meters. Proxy estimations (`LIKELY_ELECTRIFIED`, `POTENTIALLY_UNDERSERVED`, `POTENTIALLY_UNSERVED`, `UNKNOWN`) must **never** be labeled or presented as "verified" without actual ground evidence.
3. **Four Distinct Electrification Dimensions:** Maintain strict separation between (a) household connection coverage, (b) electricity supply availability, (c) supply quality/voltage regulation, and (d) distribution infrastructure adequacy.
4. **No Fabricated Infrastructure or Rates:** Existing 11 kV/LT lines and Distribution Transformers come only from uploaded GIS files or explicit `USER_ASSUMED` tie-in placements. Missing unit costs are left `UNSET` and block export; they are never invented.
5. **Preliminary Engineering Watermarks:** All layouts, circuits, and calculations are strictly preliminary and require field survey validation.
6. **Free-Only Resource Policy:** Zero paid APIs, commercial map keys, or paid imagery are allowed.

---

## 2. Approved Technology Stack (Strict)
- **Frontend:** React 18 + TypeScript (`strict: true`) + Vite + Tailwind CSS + MapLibre GL JS + Terra Draw + Radix UI + TanStack Query + Zustand.
- **Backend:** Python 3.12+ + FastAPI + Pydantic v2 + SQLAlchemy 2.0 + GeoAlchemy2 + Alembic.
- **Database:** PostgreSQL 16 + PostGIS 3.4.
- **Background Worker:** PostgreSQL-backed transactional job queue (`SELECT ... FOR UPDATE SKIP LOCKED`). No Redis.
- **Geospatial & Analytics:** GeoPandas, Shapely 2, PyProj, Rasterio, scikit-learn (DBSCAN), scikit-image (`MCP_Geometric`), SciPy.
- **Reporting & Exports:** ReportLab Platypus + Matplotlib (for 24-section PDF DPR), openpyxl (for formula-driven Excel BOQ).

---

## 3. Architecture & Code Quality Standards
- **Layering:** Keep a strict boundary: `api` (HTTP/routing) $\rightarrow$ `services` (orchestration, DB sessions) $\rightarrow$ `domain` (pure, side-effect-free algorithms and engineering math).
- **Domain Purity:** Files inside `backend/app/domain/` must **never** import database models, file storage, or network HTTP clients.
- **Explicit Units in Identifiers:** All variables handling physical quantities must encode units in their name (e.g., `length_m`, `peak_kva`, `drop_v`, `ghi_kwh_m2_day`, `cost_inr`).
- **CRS Integrity:** All spatial geometries are stored in WGS 84 (`EPSG:4326`). All metric computations (area $\text{m}^2$, distance $\text{m}$, clustering $\varepsilon$) must be dynamically projected to the local UTM metric CRS via `domain/gis/crs.py`.

---

## 4. Continuous Git & GitHub Workflow
- **Conventional Commits:** Use prefixes `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
- **Pre-Commit Hygiene:** Always check `git status` and `git diff` before staging. Stage only related files for the logical unit of work.
- **No Secrets:** Never commit `.env`, credentials, passwords, tokens, or large geospatial rasters (`*.tif`, `*.parquet`).
- **Verification Rule:** Never push unverified code. Run type checking, linting, and relevant tests before pushing. Verify push success explicitly.
- **Preserve History:** Never force-push or rewrite published Git history.

---

## 5. Multi-Agent Collaboration & Handover Rules
1. **Lock Discipline:** Only one AI agent may edit files at any given time.
2. **Handover Protocol:** Before transferring work:
   - Run tests and verify the working tree.
   - Stage and commit verified changes.
   - Update `PROJECT_STATUS.md` and `TASKS.md` with exact completed tasks, active files, and next actions.
3. **Incoming Agent Verification:** An incoming agent must read `PROJECT_STATUS.md`, `TASKS.md`, inspect `git status` and recent commits, and verify the codebase directly rather than relying on chat assumptions.
4. **Consistency:** Never silently modify or replace approved architecture, design system tokens, or domain formulas.

---

## 6. Permanent Documentation Locations
- Product Context & Problem: `docs/PROJECT_CONTEXT.md`
- Product Requirements & Scope: `docs/PRD.md`
- Architecture & Database Schema: `docs/ARCHITECTURE.md`
- UI/UX & Design Tokens: `docs/DESIGN_SYSTEM.md`
- Architecture Decisions Log: `docs/DECISIONS.md`
- Known Issues & Environment Caveats: `docs/KNOWN_ISSUES.md`
- Roadmaps & Tasks: `TASKS.md`
- Current Status & Agent Handover: `PROJECT_STATUS.md`

