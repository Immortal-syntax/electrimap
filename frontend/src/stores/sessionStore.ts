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
import {
  authenticateDemoUser,
  clearStoredDemoUser,
  getStoredDemoUser,
  type DemoUserProfile,
} from '../demo/demoAuth';
import { setCsrfToken } from '../lib/apiClient';
import { useActiveProjectStore } from './activeProjectStore';

export type UserProfile = DemoUserProfile;

interface SessionState {
  user: UserProfile | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  connectionWarning: string | null;
  checkSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  isInitialized: false,
  isLoading: false,
  error: null,
  connectionWarning: null,

  checkSession: async () => {
    const storedUser = getStoredDemoUser();
    set({
      user: storedUser,
      isInitialized: true,
      isLoading: false,
      connectionWarning: null,
    });
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const profile = authenticateDemoUser(email, password);
      useActiveProjectStore.getState().resetUserProjects();
      set({
        user: profile,
        isInitialized: true,
        isLoading: false,
        error: null,
        connectionWarning: null,
      });
      return profile;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Demo authentication failed.';
      set({ isLoading: false, error: msg });
      throw err;
    }
  },

  logout: async () => {
    clearStoredDemoUser();
    setCsrfToken(null);
    useActiveProjectStore.getState().resetUserProjects();
    set({ user: null, isInitialized: true, error: null, connectionWarning: null });
  },

  clearError: () => set({ error: null }),
}));
