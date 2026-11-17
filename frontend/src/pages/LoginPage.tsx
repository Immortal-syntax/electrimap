/*
 * Copyright 2026 Swayam Kumar
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useSessionStore } from '../stores/sessionStore';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Callout } from '../components/ui/Callout';
import { Icon } from '../components/ui/Icon';
import { Input } from '../components/ui/Input';

export const LoginPage: React.FC = () => {
  const { user, isInitialized, login, clearError, isLoading, error, connectionWarning } =
    useSessionStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const nextUrl = searchParams.get('next');
  const safeTarget =
    nextUrl && nextUrl.startsWith('/') && !nextUrl.startsWith('//')
      ? nextUrl
      : '/projects';

  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    if (isInitialized && user) {
      navigate(safeTarget, { replace: true });
    }
  }, [isInitialized, user, navigate, safeTarget]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email.trim(), password);
      navigate(safeTarget);
    } catch {
      // Error is stored in sessionStore.error
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-8 survey-grid-bg">
      <div className="w-full max-w-[440px] bg-sheet border border-rule rounded-lg shadow-overlay overflow-hidden">
        <div className="bg-subtle/70 border-b border-rule-subtle px-7 py-5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
            >
              <Icon icon={ArrowLeft} size="xs" />
              <span>Back to Sample Study Overview</span>
            </Link>
            <Badge variant="primary" size="sm">
              Demo Sign-In
            </Badge>
          </div>
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2 pt-0.5">
            <Icon icon={ShieldCheck} size="xs" className="text-accent" />
            <span>ElectriMap DPR Sign-In</span>
          </div>
          <h1 className="heading-xl">Sign in to ElectriMap DPR</h1>
          <p className="text-xs text-ink-2 leading-relaxed">
            Sign in with your demo account email and password to access village studies, GIS layers, and project reports.
          </p>
        </div>

        <div className="p-7 space-y-4">
          {connectionWarning && !error && (
            <Callout tone="warn" title="Backend Connection Issue">
              {connectionWarning}
            </Callout>
          )}
          {error && (
            <Callout tone="error" title="Sign-In Failed">
              {error}
            </Callout>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <Input
              id="login-email"
              label="Email address"
              type="email"
              required
              autoComplete="email"
              leftIcon={Mail}
              value={email}
              onChange={(e) => {
                if (error) clearError();
                setEmail(e.target.value);
              }}
            />

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="field-label mb-0">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-ink-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-xs px-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon icon={showPassword ? EyeOff : Eye} size="xs" />
                  <span>{showPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                leftIcon={Lock}
                value={password}
                onChange={(e) => {
                  if (error) clearError();
                  setPassword(e.target.value);
                }}
              />
            </div>

            <div className="pt-1">
              <Button
                type="submit"
                variant="primary"
                isLoading={isLoading}
                fullWidth
              >
                Sign In
              </Button>
            </div>
          </form>

          <div className="pt-3 border-t border-rule-subtle text-xs text-ink-3 leading-relaxed">
            Explicit demonstration sign-in only (persisted in this browser&apos;s{' '}
            <code>localStorage</code> — not real identity verification). Protected demo workspaces
            require an active demo sign-in; sign out when finished on a shared device.
          </div>
        </div>
      </div>
    </div>
  );
};

