# Contributing to ElectriMap DPR

Thank you for your interest in contributing to **ElectriMap DPR**! We welcome contributions to our rural and tribal electrification planning workbench.

To maintain engineering rigor, epistemic honesty, and code reliability, please read and follow these guidelines.

---

## Code of Conduct

All contributors and participants are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please report unacceptable behavior to `swayamkr26@gmail.com`.

---

## Core Non-Negotiable Principles

Every contribution must respect the core principles of ElectriMap DPR:

1. **Epistemic Honesty**: Remote sensing and satellites cannot observe electricity meters. Proxy estimates (`LIKELY_ELECTRIFIED`, `POTENTIALLY_UNDERSERVED`, `POTENTIALLY_UNSERVED`, `UNKNOWN`) must never be presented as ground-truth verified without actual field survey evidence.
2. **Four Electrification Dimensions**: Maintain clear separation between:
   - Household connection coverage
   - Electricity supply availability (service hours / reliability)
   - Supply quality and voltage regulation
   - Distribution infrastructure adequacy
3. **No Fabricated Infrastructure or Unit Rates**: Existing 11 kV/LT lines and transformers come only from uploaded GIS files or explicit `USER_ASSUMED` tie-in placements. Missing unit costs are left `UNSET` and block export; they must never be fabricated.
4. **Domain Purity**: All files inside `backend/app/domain/` must remain pure functions and mathematical algorithms. Never import database models, file storage, or network HTTP clients inside `domain/`.
5. **Explicit Units in Identifiers**: Physical quantities must encode units in variable and parameter names (e.g., `length_m`, `peak_kva`, `drop_v`, `ghi_kwh_m2_day`, `cost_inr`).
6. **CRS Integrity**: Spatial geometries are stored in WGS 84 (`EPSG:4326`). All metric computations (area $\text{m}^2$, distance $\text{m}$, buffer distances) must be dynamically projected to the local UTM metric CRS via `domain/gis/crs.py`.

---

## Development Workflow

### 1. Setting Up Your Environment

1. Fork the repository and clone your fork locally:
   ```bash
   git clone https://github.com/swayamkr/electrimap.git
   cd electrimap
   ```
2. Start the PostGIS database:
   ```bash
   docker compose up -d
   ```
3. Set up the Python backend:
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\Activate.ps1
   pip install -e .
   alembic upgrade head
   python -m app.services.seed_service
   ```
4. Set up the frontend:
   ```bash
   cd ../frontend
   npm install
   ```

### 2. Branching Strategy

- Always create a descriptive branch from `main`:
  - `feat/feature-name` for new features
  - `fix/bug-description` for bug fixes
  - `docs/documentation-update` for documentation changes

### 3. Conventional Commits

We enforce Conventional Commits formatting:
- `feat: add 3-phase LT voltage drop evaluation`
- `fix: resolve optimistic concurrency conflict on AOI update`
- `docs: update DPR generation specifications`
- `test: add unit test for solar microgrid worst-month sizing`
- `chore: update dependency versions and ruff rules`

---

## Pre-Commit Verification Checklist

Before submitting a Pull Request, verify that all quality gates pass locally:

### Backend Checks
```bash
cd backend
ruff check app tests
mypy app tests
pytest -v
```

### Frontend Checks
```bash
cd frontend
npm run lint
npm run typecheck
npm run test
npm run build
```

---

## Submitting a Pull Request

1. Push your branch to your fork.
2. Open a Pull Request targeting `main`.
3. Complete the provided [Pull Request Template](.github/pull_request_template.md).
4. Verify that all automated GitHub Actions checks pass.
5. Address code review feedback promptly.

