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

import { create } from 'zustand';
import { apiRequest, setCsrfToken } from '../lib/apiClient';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
}

interface AuthSessionPayload {
  user: UserProfile;
  csrf_token: string | null;
}

interface SessionState {
  user: UserProfile | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  checkSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  isInitialized: false,
  isLoading: false,
  error: null,

  checkSession: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiRequest<AuthSessionPayload>('/api/v1/auth/me');
      if (data.csrf_token) {
        setCsrfToken(data.csrf_token);
      }
      set({ user: data.user, isInitialized: true, isLoading: false });
    } catch {
      set({ user: null, isInitialized: true, isLoading: false });
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiRequest<AuthSessionPayload>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (data.csrf_token) {
        setCsrfToken(data.csrf_token);
      }
      set({ user: data.user, isInitialized: true, isLoading: false, error: null });
      return data.user;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed.';
      set({ isLoading: false, error: msg });
      throw err;
    }
  },

  logout: async () => {
    try {
      await apiRequest('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      setCsrfToken(null);
      set({ user: null, error: null });
    }
  },
}));

