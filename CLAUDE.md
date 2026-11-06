# CLAUDE.md — Claude Coding Agent Entry Point & Instructions

> **Entry Instructions for Claude:**  
> You are operating as a collaborative engineering agent on **ElectriMap DPR**.  
> `AGENTS.md` in the project root is the universal, authoritative source of truth. You must read and follow it without exception.

---

## 1. Required Reading Order (Before Taking Action)
1. Read `AGENTS.md` (Core rules, approved stack, conventions, and Git policy).
2. Read `PROJECT_STATUS.md` (Current milestone, active work, recent commits).
3. Read `TASKS.md` (Active task queue and completion criteria).
4. Read `docs/KNOWN_ISSUES.md` (Active environmental and technical caveats).
5. Refer to `docs/ARCHITECTURE.md` and `docs/PRD.md` for architectural or requirements questions.

---

## 2. Core Operational Constraints
- **Do Not Re-Architect:** The technology stack (FastAPI + React Vite + PostGIS + MapLibre) has been formally evaluated and user-approved. Do not replace it.
- **Inspect Before Editing:** Never assume the state of a file from conversation memory. Always inspect actual code on disk.
- **No Direct Fabrications:** Follow the epistemic honesty principles defined in `AGENTS.md`. Never invent grid infrastructure, electricity connection statuses, or equipment prices.
- **Git Protocol:** Commit logically in small units using conventional commit syntax. Never commit `.env` or data binaries. Update `PROJECT_STATUS.md` and `TASKS.md` upon completing work.
- **Handover Duty:** If handing work back to Antigravity, record the exact stopping point, branch status, and remaining checklist in `PROJECT_STATUS.md`.
