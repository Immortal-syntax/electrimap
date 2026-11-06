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
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import { Button } from '../components/ui/Button';
import { Callout } from '../components/ui/Callout';

export const LoginPage: React.FC = () => {
  const { login, isLoading, error } = useSessionStore();
  const navigate = useNavigate();

  const [email, setEmail] = useState('planner@electrimap.in');
  const [password, setPassword] = useState('ElectriMap#2026');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/projects');
    } catch {
      // Error is stored in sessionStore.error
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 survey-grid-bg">
      <div className="w-full max-w-[400px] bg-sheet border border-rule-strong rounded-xs p-6 space-y-4">
        <div className="border-b border-rule pb-3">
          <div className="font-mono text-[11px] uppercase tracking-wider text-ink-2">
            SHEET AUTH-01 · PLANNER ACCESS
          </div>
          <h1 className="text-lg font-semibold text-ink mt-1">Sign in to ElectriMap DPR</h1>
          <p className="text-xs text-ink-2 mt-0.5">
            Session-authenticated GIS workbench for rural &amp; tribal electrification DPRs.
          </p>
        </div>

        {error && (
          <Callout tone="error" title="Authentication Failed">
            {error}
          </Callout>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-medium text-ink mb-1"
            >
              Official / Planner Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-8 px-2.5 text-xs font-mono bg-paper border border-rule-strong rounded-xs text-ink"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-medium text-ink mb-1"
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-8 px-2.5 text-xs font-mono bg-paper border border-rule-strong rounded-xs text-ink"
            />
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <Button type="submit" variant="primary" isLoading={isLoading} className="w-full">
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
              className="w-full"
            >
              Fill Default Demo Planner Credentials
            </Button>
          </div>
        </form>

        <div className="pt-2 border-t border-rule text-[11px] text-ink-3 font-mono">
          Security: Argon2id password verification · HttpOnly SameSite=Lax session cookie ·
          X-CSRF-Token mutation guard.
        </div>
      </div>
    </div>
  );
};

