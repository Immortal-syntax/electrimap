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

import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  Compass,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldAlert,
  X,
  Zap,
} from 'lucide-react'
import { apiRequest } from '../../lib/apiClient'
import { useActiveProjectStore } from '../../stores/activeProjectStore'
import { useSessionStore } from '../../stores/sessionStore'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { QualityTag } from '../ui/QualityTag'
import { HelpTooltip } from '../ui/Tooltip'
import {
  DEMO_PROJECT_ID,
  SIDEBAR_PORTFOLIO_LINKS,
  WORKSPACE_SECTIONS,
  resolveRouteContext,
  type WorkspaceSectionKey,
} from './navigationConfig'

export interface AppShellProps {
  children: React.ReactNode
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { user, logout } = useSessionStore()
  const { projectsById, setProjectMeta } = useActiveProjectStore()
  const location = useLocation()
  const navigate = useNavigate()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const mobileNavTriggerRef = useRef<HTMLButtonElement>(null)
  const mobileDrawerRef = useRef<HTMLDivElement>(null)
  const mobileDrawerCloseRef = useRef<HTMLButtonElement>(null)
  const wasMobileNavOpenRef = useRef(false)

  // Close mobile navigation drawer automatically on route change
  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname, location.search])

  // Close mobile drawer on Escape key, trap Tab focus, and restore trigger focus
  useEffect(() => {
    if (!mobileNavOpen) {
      if (wasMobileNavOpenRef.current) {
        wasMobileNavOpenRef.current = false
        mobileNavTriggerRef.current?.focus()
      }
      return
    }
    wasMobileNavOpenRef.current = true
    const focusTimer = window.setTimeout(() => {
      mobileDrawerCloseRef.current?.focus()
    }, 0)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileNavOpen(false)
        return
      }
      if (e.key === 'Tab' && mobileDrawerRef.current) {
        const focusables = mobileDrawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (!first || !last) return
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileNavOpen])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const baseRouteContext = resolveRouteContext(location.pathname)
  const activeProjectId = baseRouteContext.activeProjectId
  const cachedProjectName = activeProjectId ? projectsById[activeProjectId]?.name : null
  const routeContext = resolveRouteContext(location.pathname, cachedProjectName)
  const isInsideProject = activeProjectId !== null
  const isLoginRoute = location.pathname === '/login'

  useEffect(() => {
    if (!activeProjectId || cachedProjectName || !user) return
    let active = true
    const timer = window.setTimeout(() => {
      if (!active || useActiveProjectStore.getState().projectsById[activeProjectId]?.name) {
        return
      }
      apiRequest<{ name: string; target_district?: string | null; target_state?: string | null }>(
        `/api/v1/projects/${activeProjectId}`,
      )
        .then((proj) => {
          if (active && proj?.name) {
            setProjectMeta(activeProjectId, {
              name: proj.name,
              district: proj.target_district,
              state: proj.target_state,
            })
          }
        })
        .catch(() => {
          // Fallback label handled smoothly by resolveRouteContext
        })
    }, 60)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [activeProjectId, cachedProjectName, user, setProjectMeta])

  const getSectionHref = (projectId: string, sectionKey: WorkspaceSectionKey) =>
    sectionKey === 'overview'
      ? `/projects/${projectId}/workspace`
      : `/projects/${projectId}/${sectionKey}`

  const renderSidebarContent = (isCompact: boolean) => (
    <div className="flex flex-col h-full justify-between select-none">
      <div className="p-3 space-y-5 overflow-y-auto">
        {/* Section 1: Main Navigation */}
        <div>
          {!isCompact && (
            <div className="px-2.5 pb-2 text-xs font-semibold text-ink-3">
              Navigation
            </div>
          )}
          <nav aria-label="Portfolio navigation" className="space-y-1">
            {SIDEBAR_PORTFOLIO_LINKS.map((item) => {
              const isActive = location.pathname === item.to
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  title={`${item.label} — ${item.description}`}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-xs text-body-sm transition-colors duration-100 border-l-2 ${
                    isActive
                      ? 'border-l-accent bg-accent-tint/70 text-accent font-semibold'
                      : 'border-l-transparent text-ink-2 hover:bg-surface-hover hover:text-ink font-medium'
                  } ${isCompact ? 'justify-center px-0' : ''}`.trim()}
                >
                  <Icon
                    icon={item.icon}
                    size="sm"
                    className={
                      isActive ? 'text-accent' : 'text-ink-3 group-hover:text-ink'
                    }
                  />
                  {!isCompact && (
                    <span className="truncate flex-1 leading-snug">{item.label}</span>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Section 2: 6-Stage Project Planning Workflow (Shown Only Inside Active Study) */}
        <div className="pt-3 border-t border-rule-subtle">
          {!isCompact && (
            <div className="px-2.5 pb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-ink-3">
                {isInsideProject ? '6-Step Plan' : 'Planning Steps (1–6)'}
              </span>
              {isInsideProject && (
                <span className="text-2xs font-medium text-accent">
                  {activeProjectId === DEMO_PROJECT_ID ? 'Sample' : 'Project'}
                </span>
              )}
            </div>
          )}

          {isInsideProject && activeProjectId ? (
            <nav aria-label="Project planning workflow" className="space-y-1">
              {WORKSPACE_SECTIONS.map((sec) => {
                const href = getSectionHref(activeProjectId, sec.key)
                const isSectionActive = routeContext.activeSection === sec.key

                return (
                  <Link
                    key={sec.key}
                    to={href}
                    title={isCompact ? `${sec.shortLabel} — ${sec.subtitle}` : sec.nonGisHint}
                    aria-current={isSectionActive ? 'page' : undefined}
                    className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-xs text-body-sm transition-colors duration-100 border-l-2 ${
                      isSectionActive
                        ? 'border-l-accent bg-accent-tint/70 text-accent font-semibold'
                        : 'border-l-transparent text-ink-2 hover:bg-surface-hover hover:text-ink'
                    } ${isCompact ? 'justify-center px-0 py-2' : ''}`.trim()}
                  >
                    <Icon
                      icon={sec.icon}
                      size="sm"
                      className={
                        isSectionActive
                          ? 'text-accent'
                          : 'text-ink-3 group-hover:text-ink'
                      }
                    />
                    {!isCompact && (
                      <span className="truncate flex-1 leading-snug">
                        {sec.shortLabel}
                      </span>
                    )}
                  </Link>
                )
              })}
            </nav>
          ) : (
            !isCompact && (
              <div className="mx-1.5 rounded-md border border-rule-subtle bg-subtle/60 p-3 space-y-2 text-xs text-ink-2">
                <p className="leading-relaxed">
                  Open a project in <strong className="text-ink">My Projects</strong> — or explore the pre-loaded sample — to use all 6 planning steps and interactive GIS tools.
                </p>
                <Link
                  to={`/projects/${DEMO_PROJECT_ID}/workspace`}
                  className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
                >
                  <Icon icon={Compass} size="xs" />
                  <span>Open Sample Study →</span>
                </Link>
              </div>
            )
          )}
        </div>
      </div>

      {/* Sidebar Plain-Language Accuracy Note */}
      {!isCompact && (
        <div className="p-3 border-t border-rule bg-subtle/40 text-xs text-ink-2 space-y-1">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-ink">
              <Icon icon={ShieldAlert} size="xs" className="text-warn" />
              <span>Satellite Check Note</span>
            </div>
            <HelpTooltip glossaryKey="proxyClassification" placement="right" />
          </div>
          <p className="leading-relaxed text-xs text-ink-2">
            Satellite tags are screening clues only — verify real connections on the ground.
          </p>
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      {/* WCAG 2.1 AA Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 bg-accent text-white px-3 py-1.5 rounded-xs text-xs font-semibold shadow-md"
      >
        Skip to main content
      </a>

      {/* Deep Navy Primary Command Header */}
      <header className="min-h-14 h-14 bg-navy-950 text-white border-b border-navy-800 px-3 sm:px-4 flex items-center justify-between gap-3 shrink-0 z-30">
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          {!isLoginRoute && (
            <>
              {/* Mobile Navigation Trigger */}
              <button
                ref={mobileNavTriggerRef}
                type="button"
                aria-label={
                  mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'
                }
                aria-expanded={mobileNavOpen}
                onClick={() => setMobileNavOpen((prev) => !prev)}
                className="lg:hidden inline-flex items-center justify-center h-8 w-8 rounded-xs text-slate-300 hover:text-white hover:bg-navy-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <Icon icon={mobileNavOpen ? X : Menu} size="md" />
              </button>

              {/* Desktop Sidebar Collapse/Expand Trigger */}
              <button
                type="button"
                aria-label={
                  sidebarCollapsed
                    ? 'Expand sidebar navigation'
                    : 'Collapse sidebar navigation'
                }
                aria-expanded={!sidebarCollapsed}
                onClick={() => setSidebarCollapsed((prev) => !prev)}
                className="hidden lg:inline-flex items-center justify-center h-7 w-7 rounded-xs text-slate-300 hover:text-white hover:bg-navy-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <Icon
                  icon={sidebarCollapsed ? PanelLeftOpen : PanelLeftClose}
                  size="sm"
                />
              </button>
            </>
          )}

          {/* Brand Mark */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-sans font-semibold text-sm tracking-tight text-white hover:text-sky-300 transition-colors shrink-0"
          >
            <span className="h-6 w-6 rounded-xs bg-accent flex items-center justify-center text-white shadow-xs">
              <Icon icon={Zap} size="xs" />
            </span>
            <span>ElectriMap DPR</span>
          </Link>

          <span className="hidden md:inline text-navy-700" aria-hidden="true">
            |
          </span>

          {/* Primary Top Navigation (Matches Sidebar Labels 1:1) */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-1.5 text-body-sm whitespace-nowrap"
          >
            <Link
              to="/"
              aria-current={location.pathname === '/' ? 'page' : undefined}
              className={`px-3 py-1.5 rounded-xs font-medium transition-colors ${
                location.pathname === '/'
                  ? 'bg-accent text-white font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-navy-800'
              }`}
            >
              Sample Study
            </Link>
            <Link
              to="/projects"
              aria-current={location.pathname === '/projects' ? 'page' : undefined}
              className={`px-3 py-1.5 rounded-xs font-medium transition-colors ${
                location.pathname === '/projects'
                  ? 'bg-accent text-white font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-navy-800'
              }`}
            >
              My Projects
            </Link>
            <Link
              to="/projects/new"
              aria-current={
                location.pathname === '/projects/new' ? 'page' : undefined
              }
              className={`px-3 py-1.5 rounded-xs font-medium transition-colors ${
                location.pathname === '/projects/new'
                  ? 'bg-accent text-white font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-navy-800'
              }`}
            >
              + New Project
            </Link>
          </nav>
        </div>

        {/* Right Controls: Preliminary Mode Tag & Session Auth */}
        <div className="flex items-center gap-2.5 text-xs shrink-0">
          <span className="hidden lg:inline-flex items-center gap-1.5">
            <QualityTag kind="ESTIMATED" label="Screening Tool" />
            <HelpTooltip
              glossaryKey="preliminaryDisclaimer"
              tone="inverted"
              placement="bottom"
            />
          </span>
          {user ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                data-testid="authenticated-user-name"
                className="text-slate-200 text-xs font-medium truncate max-w-[120px] sm:max-w-[200px]"
              >
                {user.display_name}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void handleLogout()}
              >
                Sign Out
              </Button>
            </div>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-xs font-medium bg-accent text-white hover:bg-accent-hover h-7 px-2.5 text-xs border border-accent transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Contextual Breadcrumb & Plain-English Guidance Bar */}
      {!isLoginRoute && (
        <div className="bg-sheet/95 backdrop-blur-sm border-b border-rule-subtle px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex items-center flex-wrap gap-1.5 text-xs">
              {routeContext.breadcrumbs.map((crumb, index) => {
                const isLast = index === routeContext.breadcrumbs.length - 1
                return (
                  <li key={index} className="inline-flex items-center gap-1.5">
                    {index > 0 && (
                      <Icon
                        icon={ChevronRight}
                        size="xs"
                        className="text-ink-3"
                      />
                    )}
                    {crumb.to && !isLast ? (
                      <Link
                        to={crumb.to}
                        className="text-ink-2 hover:text-accent hover:underline font-medium transition-colors"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span
                        aria-current={isLast ? 'page' : undefined}
                        className={
                          isLast
                            ? 'font-semibold text-ink text-xs sm:text-body-sm'
                            : 'text-ink-3'
                        }
                      >
                        {crumb.label}
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          </nav>

          <div className="flex flex-wrap items-center gap-3 text-xs text-ink-2">
            <span className="text-ink-2 leading-snug">{routeContext.contextHint}</span>
            {!isInsideProject && (
              <Link
                to={`/projects/${DEMO_PROJECT_ID}/workspace`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-tint/70 text-accent hover:bg-accent-tint font-semibold transition-colors shrink-0"
              >
                <Icon icon={Compass} size="xs" />
                <span>Explore Sample Study →</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Body Layout: Sidebar + Main Engineering Workbench */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Desktop Collapsible Left Sidebar */}
        {!isLoginRoute && (
          <aside
            aria-label="Application workflow navigation"
            className={`hidden lg:flex flex-col shrink-0 bg-sheet border-r border-rule-subtle transition-all duration-150 ${
              sidebarCollapsed ? 'w-14' : 'w-64'
            }`}
          >
            {renderSidebarContent(sidebarCollapsed)}
          </aside>
        )}

        {/* Mobile / Tablet Slide-Over Navigation Drawer */}
        {!isLoginRoute && mobileNavOpen && (
          <div
            className="fixed inset-0 z-40 lg:hidden flex"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation drawer"
          >
            <div
              className="fixed inset-0 bg-navy-950/55 backdrop-blur-sm"
              onClick={() => setMobileNavOpen(false)}
            />
            <div
              ref={mobileDrawerRef}
              className="relative z-50 w-72 max-w-[85vw] bg-sheet border-r border-rule h-full flex flex-col shadow-overlay rounded-r-md overflow-hidden"
            >
              <div className="p-3.5 bg-navy-900 text-white flex items-center justify-between border-b border-navy-800">
                <span className="text-sm font-semibold tracking-tight">
                  ElectriMap Navigation
                </span>
                <button
                  ref={mobileDrawerCloseRef}
                  type="button"
                  aria-label="Close mobile navigation"
                  onClick={() => setMobileNavOpen(false)}
                  className="p-1.5 rounded-sm text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Icon icon={X} size="sm" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {renderSidebarContent(false)}
              </div>
            </div>
          </div>
        )}

        {/* Main Content Landmark */}
        <main
          id="main-content"
          tabIndex={-1}
          aria-label="Main engineering workbench"
          className="flex-1 flex flex-col min-w-0 focus:outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  )
}
