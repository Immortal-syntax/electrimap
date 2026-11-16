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

import React, { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { AppShell } from './components/layout/AppShell'
import { LoadingState } from './components/ui/Skeleton'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { NewProjectWizardPage } from './pages/NewProjectWizardPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { WorkspacePage } from './pages/WorkspacePage'
import { setCsrfToken } from './lib/apiClient'
import { useSessionStore } from './stores/sessionStore'

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, isInitialized } = useSessionStore()
  const location = useLocation()

  if (!isInitialized) {
    return (
      <div className="page-container">
        <LoadingState
          title="Verifying planner session…"
          description="Checking authenticated session credentials before loading workspace data."
        />
      </div>
    )
  }

  if (!user) {
    const nextPath = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Navigate to={`/login?next=${nextPath}`} replace />
  }

  return children
}

export const App: React.FC = () => {
  const { checkSession } = useSessionStore()

  useEffect(() => {
    void checkSession()
    const handleUnauthorized = () => {
      setCsrfToken(null)
      useSessionStore.setState({ user: null, isInitialized: true })
    }
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void checkSession()
      }
    }
    window.addEventListener('electrimap:unauthorized', handleUnauthorized)
    window.addEventListener('pageshow', handlePageShow)
    return () => {
      window.removeEventListener('electrimap:unauthorized', handleUnauthorized)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [checkSession])

  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/projects"
            element={
              <ProtectedRoute>
                <ProjectsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/new"
            element={
              <ProtectedRoute>
                <NewProjectWizardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:id/workspace"
            element={
              <ProtectedRoute>
                <WorkspacePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:id/:section"
            element={
              <ProtectedRoute>
                <WorkspacePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:id"
            element={<Navigate to="workspace" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
      <Analytics />
    </BrowserRouter>
  )
}

export default App
