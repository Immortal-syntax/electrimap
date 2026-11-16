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
    shortLabel: 'Overview',
    title: 'Project Overview & Progress',
    subtitle: 'Summary of your study area, progress across all 6 steps, and interactive map.',
    nonGisHint: 'Start here to see village highlights, map layers, and what to do next.',
    targetDomId: 'step-section-overview',
    icon: LayoutDashboard,
  },
  {
    key: 'map',
    shortLabel: 'Interactive Map',
    title: 'Interactive Village & Power Line Map',
    subtitle: 'Explore nighttime light, trees, terrain slope, buildings, and power lines.',
    nonGisHint: 'Move around the map, switch satellite views, and click any house cluster or line.',
    targetDomId: 'step-section-map',
    icon: Map,
  },
  {
    key: 'data',
    stepNumber: 1,
    shortLabel: '1. Study Area & Data',
    title: 'Step 1 · Get Your Map Ready',
    subtitle: 'Prepare buildings, terrain, land cover, and solar data for your study boundary.',
    nonGisHint: 'Fetch map data for your study area or upload surveyed files, then move to Step 2.',
    targetDomId: 'step-section-data',
    icon: Database,
  },
  {
    key: 'settlements',
    stepNumber: 2,
    shortLabel: '2. Villages & Habitations',
    title: 'Step 2 · Village Hamlets & Ground Check',
    subtitle: 'Group houses into hamlets, check against Census counts, and log field visits.',
    nonGisHint: 'Review detected hamlets and record what ground surveys or records show.',
    targetDomId: 'step-section-settlements',
    icon: Home,
  },
  {
    key: 'infrastructure',
    stepNumber: 3,
    shortLabel: '3. Grid & Demand',
    title: 'Step 3 · Nearest Grid Connection & Electricity Demand',
    subtitle: 'Mark existing grid tie-in poles, measure distances, and estimate peak village demand.',
    nonGisHint: 'Record existing lines or click the map to mark where new power lines could connect.',
    targetDomId: 'step-section-infrastructure',
    icon: UtilityPole,
  },
  {
    key: 'network',
    stepNumber: 4,
    shortLabel: '4. Network Design',
    title: 'Step 4 · Power Line Routes & Off-Grid Solar',
    subtitle: 'Design 11 kV / street wire paths, transformer sizes, or off-grid solar systems.',
    nonGisHint: 'Generate line routes and solar options, then verify voltage stays within CEA limits.',
    targetDomId: 'step-section-network',
    icon: GitBranch,
  },
  {
    key: 'cost',
    stepNumber: 5,
    shortLabel: '5. Costs & Scenarios',
    title: 'Step 5 · Equipment Prices, Itemized Costs & Options',
    subtitle: 'Enter or review unit prices, inspect itemized quantities, and compare supply options.',
    nonGisHint: 'Confirm unit prices for poles, wire, and solar kits, then pick the best scenario.',
    targetDomId: 'step-section-cost',
    icon: Calculator,
  },
  {
    key: 'reports',
    stepNumber: 6,
    shortLabel: '6. Final Check & Report',
    title: 'Step 6 · Final Safety Check & Report Download',
    subtitle: 'Fix any missing items and export your 24-section PDF report, Excel BOQ, and GIS files.',
    nonGisHint: 'Review readiness checks and download your preliminary report and cost workbook.',
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
        { label: 'Sample Study Overview' },
      ],
      pageTitle: 'Sample Village Study & Map Preview',
      contextHint:
        'Explore how ElectriMap plans rural electrification using Koraput, Odisha as a pre-loaded example.',
      activeProjectId: null,
      activeSection: null,
    }
  }

  if (pathname === '/login') {
    return {
      breadcrumbs: [{ label: 'ElectriMap DPR', to: '/' }, { label: 'Sign In' }],
      pageTitle: 'Sign In to ElectriMap DPR',
      contextHint: 'Sign in to create your own village projects and save progress.',
      activeProjectId: null,
      activeSection: null,
    }
  }

  if (pathname === '/projects') {
    return {
      breadcrumbs: [
        { label: 'ElectriMap DPR', to: '/' },
        { label: 'My Projects' },
      ],
      pageTitle: 'My Electrification Projects',
      contextHint:
        'Open a saved village project, copy an existing study, or start a new boundary.',
      activeProjectId: null,
      activeSection: null,
    }
  }

  if (pathname === '/projects/new') {
    return {
      breadcrumbs: [
        { label: 'ElectriMap DPR', to: '/' },
        { label: 'My Projects', to: '/projects' },
        { label: 'New Project' },
      ],
      pageTitle: 'Start a New Village Electrification Study',
      contextHint:
        'Step 1: Name your study and choose a service level. Step 2: Pick a village, draw on map, or upload a boundary.',
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
        : 'Active Study')

    return {
      breadcrumbs: [
        { label: 'My Projects', to: '/projects' },
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
    contextHint: 'Rural & tribal village electrification planning workbench',
    activeProjectId: null,
    activeSection: null,
  }
}

export const SIDEBAR_PORTFOLIO_LINKS = [
  {
    to: '/',
    label: 'Sample Study',
    description: 'Explore pre-loaded Koraput example & guide',
    icon: Compass,
  },
  {
    to: '/projects',
    label: 'My Projects',
    description: 'Open, copy, or manage saved village studies',
    icon: FolderKanban,
  },
  {
    to: '/projects/new',
    label: 'New Project',
    description: 'Start a study for your own village boundary',
    icon: PlusCircle,
  },
] as const

