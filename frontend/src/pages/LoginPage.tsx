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

import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useSessionStore } from '../stores/sessionStore';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Callout } from '../components/ui/Callout';
import { Icon } from '../components/ui/Icon';
import { Input } from '../components/ui/Input';

export const LoginPage: React.FC = () => {
  const { login, isLoading, error } = useSessionStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('planner@electrimap.in');
  const [password, setPassword] = useState('ElectriMap#2026');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      const nextUrl = searchParams.get('next');
      navigate(nextUrl && nextUrl.startsWith('/') ? nextUrl : '/projects');
    } catch {
      // Error is stored in sessionStore.error
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 survey-grid-bg">
      <div className="w-full max-w-[420px] bg-sheet border border-rule-strong rounded-sm shadow-sm overflow-hidden">
        <div className="bg-subtle border-b border-rule px-6 py-4 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2">
              <Icon icon={ShieldCheck} size="xs" className="text-accent" />
              <span>Planner Access · ElectriMap DPR</span>
            </div>
            <Badge variant="primary" size="sm">
              CSRF Protected
            </Badge>
          </div>
          <h1 className="heading-xl">Sign in to ElectriMap DPR</h1>
          <p className="text-xs text-ink-2 leading-relaxed">
            Session-authenticated GIS workbench for rural &amp; tribal electrification DPRs.
          </p>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <Callout tone="error" title="Authentication Failed">
              {error}
            </Callout>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <Input
              id="login-email"
              label="Official / Planner Email"
              type="email"
              required
              autoComplete="email"
              leftIcon={Mail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="pt-1 flex flex-col gap-2">
              <Button
                type="submit"
                variant="primary"
                isLoading={isLoading}
                fullWidth
              >
                Sign In to Workbench
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEmail('planner@electrimap.in');
                  setPassword('ElectriMap#2026');
                }}
                fullWidth
              >
                Fill Default Demo Planner Credentials
              </Button>
            </div>
          </form>

          <div className="pt-3 border-t border-rule-subtle text-xs text-ink-3 leading-relaxed">
            Security: Argon2id password verification · HttpOnly SameSite=Lax session cookie ·
            X-CSRF-Token mutation guard.
          </div>
        </div>
      </div>
    </div>
  );
};

