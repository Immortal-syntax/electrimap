// Copyright 2026 Swayam Kumar
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  Calculator,
  Compass,
  Database,
  FileCheck2,
  FolderKanban,
  GitBranch,
  Home,
  LayoutDashboard,
  Map,
  PlusCircle,
  UtilityPole,
  type LucideIcon,
} from 'lucide-react'

export const DEMO_PROJECT_ID = '00000000-0000-4000-8000-000000000001'

export type WorkspaceSectionKey =
  | 'overview'
  | 'map'
  | 'data'
  | 'settlements'
  | 'infrastructure'
  | 'network'
  | 'cost'
  | 'reports'

export interface WorkspaceSectionMeta {
  key: WorkspaceSectionKey
  stepNumber?: number
  shortLabel: string
  title: string
  subtitle: string
  nonGisHint: string
  targetDomId: string
  icon: LucideIcon
}

export const WORKSPACE_SECTIONS: WorkspaceSectionMeta[] = [
  {
    key: 'overview',
    shortLabel: 'Workbench Overview',
    title: 'Project Workbench & Spatial Overview',
    subtitle: 'Full 6-stage engineering sheet, study area summary, and interactive GIS map.',
    nonGisHint: 'Start here to inspect the village boundary, summary indicators, and complete planning workflow.',
    targetDomId: 'step-section-overview',
    icon: LayoutDashboard,
  },
  {
    key: 'map',
    shortLabel: 'Interactive GIS Map',
    title: 'Geospatial Infrastructure & Illumination Map',
    subtitle: 'Inspect power lines, transformers, nighttime light radiance, and habitation clusters.',
    nonGisHint: 'Pan, zoom, switch satellite/terrain basemaps, and click any village or power line for details.',
    targetDomId: 'step-section-map',
    icon: Map,
  },
  {
    key: 'data',
    stepNumber: 1,
    shortLabel: '1. Study Area & Data',
    title: 'Step 1 · Study Area Layers & Dataset Provenance',
    subtitle: 'Ingested satellite building footprints, terrain slope, solar resource, and licences.',
    nonGisHint: 'Verify which satellite and terrain datasets are loaded and toggle map overlays.',
    targetDomId: 'step-section-data',
    icon: Database,
  },
  {
    key: 'settlements',
    stepNumber: 2,
    shortLabel: '2. Villages & Habitations',
    title: 'Step 2 · Habitation Clustering & Field Verification',
    subtitle: 'Two-axis electrification proxy classification, Census 2011 reconciliation, and audit ledger.',
    nonGisHint: 'Review detected village clusters and record ground-truth Gram Sabha or utility verifications.',
    targetDomId: 'step-section-settlements',
    icon: Home,
  },
  {
    key: 'infrastructure',
    stepNumber: 3,
    shortLabel: '3. Grid & Demand',
    title: 'Step 3 · Existing Grid Infrastructure, Gaps & Demand Forecast',
    subtitle: 'Existing 11 kV/LT assets, terrain-penalized distance gaps, and 7-category load forecast.',
    nonGisHint: 'Register existing power lines or place an assumed 11 kV tie-in point and calculate kW demand.',
    targetDomId: 'step-section-infrastructure',
    icon: UtilityPole,
  },
  {
    key: 'network',
    stepNumber: 4,
    shortLabel: '4. Network & SLD',
    title: 'Step 4 · Network Routing, Voltage Drop & Off-Grid Sizing',
    subtitle: 'Least-cost 11 kV/LT routing, CEA voltage regulation checks, and Single-Line Diagram (SLD).',
    nonGisHint: 'Generate grid extension, solar mini-grid, or standalone SHS engineering layouts.',
    targetDomId: 'step-section-network',
    icon: GitBranch,
  },
  {
    key: 'cost',
    stepNumber: 5,
    shortLabel: '5. Cost, BOQ & Scenarios',
    title: 'Step 5 · Schedule of Rates, Itemized BOQ & Scenario Comparison',
    subtitle: 'Traceable unit rates, bill of quantities, 20-year Net Present Cost (NPC), and LCOE.',
    nonGisHint: 'Compare 4 electrification scenarios side by side and manage Schedule of Rates unit prices.',
    targetDomId: 'step-section-cost',
    icon: Calculator,
  },
  {
    key: 'reports',
    stepNumber: 6,
    shortLabel: '6. Pre-Flight & DPR',
    title: 'Step 6 · Pre-Flight Audit & 24-Section DPR Export Center',
    subtitle: 'Mandatory pre-flight integrity checks, 24-section PDF DPR, formula Excel BOQ, and GIS bundle.',
    nonGisHint: 'Run quality checks and download the complete Detailed Project Report (PDF, Excel, and GIS ZIP).',
    targetDomId: 'step-section-dpr',
    icon: FileCheck2,
  },
]

export const VALID_SECTION_KEYS = new Set<string>(
  WORKSPACE_SECTIONS.map((s) => s.key)
)

export function normalizeWorkspaceSection(
  rawSection: string | undefined | null
): WorkspaceSectionKey {
  if (!rawSection || rawSection === 'workspace') {
    return 'overview'
  }
  if (VALID_SECTION_KEYS.has(rawSection)) {
    return rawSection as WorkspaceSectionKey
  }
  return 'overview'
}

export interface BreadcrumbItem {
  label: string
  to?: string
}

export interface RouteContextInfo {
  breadcrumbs: BreadcrumbItem[]
  pageTitle: string
  contextHint: string
  activeProjectId: string | null
  activeSection: WorkspaceSectionKey | null
}

export function resolveRouteContext(
  pathname: string,
  projectName?: string | null
): RouteContextInfo {
  if (pathname === '/') {
    return {
      breadcrumbs: [
        { label: 'ElectriMap DPR' },
        { label: 'Reference Study & Demo Overview' },
      ],
      pageTitle: 'Reference Study & Interactive GIS Demo',
      contextHint:
        'Pre-feasibility rural & tribal electrification assessment — Koraput District, Odisha',
      activeProjectId: null,
      activeSection: null,
    }
  }

  if (pathname === '/login') {
    return {
      breadcrumbs: [{ label: 'ElectriMap DPR', to: '/' }, { label: 'Planner Sign In' }],
      pageTitle: 'Planner Authentication',
      contextHint: 'Session-authenticated access to the ElectriMap DPR engineering workbench',
      activeProjectId: null,
      activeSection: null,
    }
  }

  if (pathname === '/projects') {
    return {
      breadcrumbs: [
        { label: 'ElectriMap DPR', to: '/' },
        { label: 'Projects Portfolio' },
      ],
      pageTitle: 'Projects Portfolio Register',
      contextHint:
        'Manage rural & tribal electrification DPR studies, AOI boundaries, and revisions',
      activeProjectId: null,
      activeSection: null,
    }
  }

  if (pathname === '/projects/new') {
    return {
      breadcrumbs: [
        { label: 'ElectriMap DPR', to: '/' },
        { label: 'All Projects', to: '/projects' },
        { label: 'New Project & AOI Wizard' },
      ],
      pageTitle: 'New Project & Study Boundary Wizard',
      contextHint:
        'Define project metadata and establish a validated Area of Interest (LGD village, drawn polygon, or GIS upload)',
      activeProjectId: null,
      activeSection: null,
    }
  }

  const projectMatch = pathname.match(/^\/projects\/([^/]+)(?:\/([^/]+))?/)
  if (projectMatch) {
    const projectId = projectMatch[1]!
    const rawSection = projectMatch[2] ?? 'workspace'
    const sectionKey = normalizeWorkspaceSection(rawSection)
    const sectionMeta =
      WORKSPACE_SECTIONS.find((s) => s.key === sectionKey) ?? WORKSPACE_SECTIONS[0]!
    const displayProject =
      projectName ??
      (projectId === DEMO_PROJECT_ID
        ? 'Koraput — Bheja Reference Study'
        : `Project ${projectId.slice(0, 8)}`)

    return {
      breadcrumbs: [
        { label: 'All Projects', to: '/projects' },
        {
          label: displayProject,
          to:
            sectionKey === 'overview'
              ? undefined
              : `/projects/${projectId}/workspace`,
        },
        ...(sectionKey !== 'overview' ? [{ label: sectionMeta.shortLabel }] : []),
      ],
      pageTitle: sectionMeta.title,
      contextHint: sectionMeta.nonGisHint,
      activeProjectId: projectId,
      activeSection: sectionKey,
    }
  }

  return {
    breadcrumbs: [{ label: 'ElectriMap DPR', to: '/' }],
    pageTitle: 'ElectriMap DPR Workbench',
    contextHint: 'Geospatial Rural Electrification Planning Platform',
    activeProjectId: null,
    activeSection: null,
  }
}

export const SIDEBAR_PORTFOLIO_LINKS = [
  {
    to: '/',
    label: 'Reference Demo Study',
    description: 'Koraput GIS preview & methodology',
    icon: Compass,
  },
  {
    to: '/projects',
    label: 'Saved Projects Register',
    description: 'Browse & manage DPR studies',
    icon: FolderKanban,
  },
  {
    to: '/projects/new',
    label: 'Create Project Wizard',
    description: 'Define new village AOI boundary',
    icon: PlusCircle,
  },
] as const

