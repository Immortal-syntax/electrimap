# ElectriMap DPR

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Python: 3.12+](https://img.shields.io/badge/Python-3.12%2B-blue.svg)](backend/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](backend/)
[![React: 18](https://img.shields.io/badge/Frontend-React%2018%20%2B%20TypeScript-61DAFB.svg)](frontend/)
[![PostGIS: 3.4](https://img.shields.io/badge/Database-PostgreSQL%2016%20%2B%20PostGIS-336791.svg)](docker-compose.yml)
[![MapLibre GL](https://img.shields.io/badge/GIS-MapLibre%20GL%20JS-3949ab.svg)](frontend/)

A web-based pre-feasibility GIS workbench for assessing rural and tribal electrification in India and generating 24-section Detailed Project Reports (DPRs) aligned with Rural Electrification Corporation (REC) and Revamped Distribution Sector Scheme (RDSS) standards.

---

## Core Engineering Principles

1. **Epistemic Honesty**: Remote sensing and satellites cannot observe electricity meters. Satellite-derived proxy indicators (`LIKELY_ELECTRIFIED`, `POTENTIALLY_UNDERSERVED`, `POTENTIALLY_UNSERVED`, `UNKNOWN`) are explicitly classified as preliminary proxies and never labeled as ground-truth verified without field-survey confirmation.
2. **Four Electrification Dimensions**: Strictly separates:
   - Household connection coverage (Census & building footprints)
   - Electricity supply availability (nighttime lights and service hours)
   - Supply quality and voltage regulation
   - Distribution infrastructure adequacy (11 kV lines and Distribution Transformers)
3. **No Fabricated Infrastructure or Unit Rates**: Existing 11 kV feeders, LT lines, and DTs originate exclusively from uploaded GIS datasets or explicit `USER_ASSUMED` tie-in placements. Missing unit costs are left `UNSET` and block DPR export rather than being hallucinated.
4. **Preliminary Engineering Watermarks**: All network layouts, minimum spanning tree (MST) LT circuits, and least-cost feeder paths carry clear preliminary watermarks requiring ground validation before tender issuance.
5. **Zero-Paid-API Architecture**: Operates exclusively with open datasets (Copernicus DEM, Sentinel-2, OpenStreetMap, Google/Microsoft Open Buildings, NASA POWER, and Census 2011) without paid commercial API dependencies.

---

## Architecture & Technology Stack

| Layer | Technologies | Purpose |
|---|---|---|
| **Frontend** | React 18, TypeScript (strict), Vite, Tailwind CSS, Radix UI, TanStack Query, Zustand | High-density GIS workbench UI, split-pane workspace, survey sheet styling |
| **Mapping & GIS** | MapLibre GL JS, Terra Draw, GeoJSON, Vector Tiles (MVT) | Multi-layer spatial visualization, AOI digitizing, and manual asset placement |
| **Backend API** | Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.0, GeoAlchemy2, Alembic | REST API, CRS reprojection, authentication, optimistic concurrency |
| **Pure Domain** | GeoPandas, Shapely 2, PyProj, Rasterio, scikit-learn (DBSCAN), SciPy | Pure mathematical algorithms: MST routing, voltage drop, 7-category demand forecasting |
| **Database** | PostgreSQL 16 + PostGIS 3.4 | Spatial persistence, transactional worker queue (`SKIP LOCKED`) |
| **Reporting** | ReportLab Platypus, Matplotlib, openpyxl | Multi-page 24-section PDF DPR generation, formula-driven Excel BOQ |

---

## Implemented Milestones

- **Milestone M0: Project Foundation & Architecture**
  - Database schema, PostGIS integration, Alembic migrations, test harness, reference data pipelines.
- **Milestone M1: Authentication, Project Management & AOI Definition**
  - Session auth, CSRF protection, optimistic concurrency, Census 2011 cascading admin hierarchy (State $\rightarrow$ District $\rightarrow$ Subdistrict $\rightarrow$ Village), and multi-format AOI ingestion (Admin boundary, user drawing, GeoJSON, KML, zipped Shapefile).
- **Milestone M2: Data Ingestion & Offline Provenance Pipeline**
  - Asynchronous transactional worker queue, dataset provenance hashing, raster tiling (Copernicus DEM slope/elevation, Sentinel-2 cloudless), and vector tiling (building footprints, OpenStreetMap roads/powerlines).
- **Milestone M3: Settlement Extraction & Verification Workbench**
  - Metric DBSCAN habitation clustering, 2-axis verification matrix (Proxy vs Ground Status), manual building placement, tamper-evident audit trail, and preliminary PDF DPR export.
- **Milestone M4: Infrastructure Gap Analysis & Multi-Sector Demand Engine**
  - Tie-in asset registration, honest gap analysis (nearest 11 kV grid line, terrain slope, water crossing penalties), 7-category demand engine (Domestic, Commercial, Agricultural, Institutional, etc.), and 10-year compound growth projections.
- **Milestone M5: Engineering Optimization & Network Layout**
  - REC-standard transformer sizing (16, 25, 63, 100 kVA), 11 kV HT feeder least-cost routing with terrain and water barriers, 3-phase LT distribution MST, IEEE voltage drop calculations, off-grid solar-plus-storage microgrid sizing, and scenario evaluation (`GRID_EXTENSION_ONLY`, `MINIGRID_SOLAR_STORAGE`, `HYBRID_OPTIMAL`).

---

## Directory Structure

```text
electrimap/
├── .github/                  # GitHub Actions CI workflows, issue & PR templates
├── backend/
│   ├── app/
│   │   ├── api/v1/           # FastAPI routers (auth, projects, aoi, jobs, planning, etc.)
│   │   ├── core/             # Configuration, logging, security, and CSRF protection
│   │   ├── db/               # SQLAlchemy models and database session management
│   │   ├── domain/           # Pure, side-effect-free GIS, demand, and engineering math
│   │   └── services/         # Orchestration services and database interaction
│   ├── migrations/           # Alembic database migrations
│   └── tests/                # Pytest unit and integration test suite
├── frontend/
│   ├── src/
│   │   ├── components/       # Radix UI and survey-sheet workspace components
│   │   ├── pages/            # Application views (Landing, Projects, Workspace, etc.)
│   │   ├── stores/           # Zustand state management
│   │   └── types/            # Strict TypeScript interfaces
├── docs/                     # PRD, Architecture, Design System, Decisions, and Context
├── data/reference/           # Calibrated reference datasets for Koraput, Odisha
└── scripts/                  # Data access spikes, routing spikes, and verification utilities
```

---

## Getting Started

### Prerequisites

- **Python**: 3.12 or 3.13
- **Node.js**: 20 LTS or later
- **Docker**: For running PostgreSQL 16 with PostGIS 3.4
- **GDAL / PROJ**: System libraries (included automatically in Docker or managed via conda/pip wheels)

### 1. Database Setup

Launch the PostGIS container:

```bash
docker compose up -d
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\Activate.ps1

# Install dependencies
pip install -e .

# Run database migrations
alembic upgrade head

# Seed initial admin units and demo project
python -m app.services.seed_service

# Start the FastAPI development server
uvicorn app.main:app --reload --port 8000
```

The API docs will be available at [http://localhost:8000/docs](http://localhost:8000/docs).

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

The application will be accessible at [http://localhost:5173](http://localhost:5173). Default planner credentials:
- **Email**: `planner@electrimap.gov.in`
- **Password**: `SurveySheet#2026`

---

## Quality Gates & Testing

Continuous quality enforcement is executed on every commit:

### Backend Quality Gates

```bash
cd backend

# Linting and import sorting
ruff check app tests

# Static type checking
mypy app tests

# Unit and integration test suite
pytest -v
```

### Frontend Quality Gates

```bash
cd frontend

# Linting
npm run lint

# TypeScript type verification
npm run typecheck

# Unit tests
npm run test

# Production build check
npm run build
```

---

## License & Attribution

ElectriMap DPR is licensed under the [Apache License, Version 2.0](LICENSE).

See the [NOTICE](NOTICE) file for required third-party data source attributions, including Copernicus DEM (ESA), Sentinel-2 Cloudless (EOX), OpenStreetMap, Google & Microsoft Open Buildings (VIDA), NASA POWER, and Census of India 2011.
