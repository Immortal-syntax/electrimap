import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSessionStore } from '../../stores/sessionStore';
import { Button } from '../ui/Button';
import { QualityTag } from '../ui/QualityTag';

export interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { user, logout } = useSessionStore();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 bg-accent text-white px-3 py-1.5 rounded-xs text-xs font-medium"
      >
        Skip to main content
      </a>

      <header className="h-12 bg-sheet border-b border-rule-strong px-4 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="font-mono font-semibold text-sm tracking-tight text-accent hover:underline"
          >
            ELECTRIMAP DPR
          </Link>
          <span className="text-rule-strong">|</span>
          <nav aria-label="Primary navigation" className="flex items-center gap-3 text-xs">
            <Link
              to="/"
              className={`px-2 py-1 rounded-xs font-medium ${
                location.pathname === '/'
                  ? 'bg-accent-tint text-accent'
                  : 'text-ink-2 hover:text-ink'
              }`}
            >
              Overview &amp; Demo
            </Link>
            <Link
              to="/projects"
              className={`px-2 py-1 rounded-xs font-medium ${
                location.pathname === '/projects'
                  ? 'bg-accent-tint text-accent'
                  : 'text-ink-2 hover:text-ink'
              }`}
            >
              Projects Portfolio
            </Link>
            <Link
              to="/projects/new"
              className={`px-2 py-1 rounded-xs font-medium ${
                location.pathname === '/projects/new'
                  ? 'bg-accent-tint text-accent'
                  : 'text-ink-2 hover:text-ink'
              }`}
            >
              + New Project &amp; AOI
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2.5 text-xs">
          <QualityTag kind="ESTIMATED" label="PRE-FEASIBILITY WORKBENCH" />
          {user ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-ink-2">
                {user.display_name} ({user.role})
              </span>
              <Button size="sm" variant="secondary" onClick={() => void handleLogout()}>
                Sign Out
              </Button>
            </div>
          ) : (
            <Link to="/login">
              <Button size="sm" variant="primary">
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </header>

      <main id="main-content" className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
};

