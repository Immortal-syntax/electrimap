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

/**
 * Explicit client-side demonstration authentication for ElectriMap DPR.
 *
 * NOTE: This module provides browser-local demo sign-in using `localStorage`
 * so the demonstration app runs reliably without database or server auth
 * infrastructure. It is explicitly NOT real production identity verification.
 */

export interface DemoUserProfile {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
}

interface DemoAccountDefinition extends DemoUserProfile {
  demoPasscode: string;
}

const DEMO_ACCOUNTS: readonly DemoAccountDefinition[] = [
  {
    id: '00000000-0000-4000-8000-000000000010',
    email: 'swayamkr26@gmail.com',
    display_name: 'Swayam Kumar',
    role: 'DEMO_USER',
    is_active: true,
    demoPasscode: '1234',
  },
  {
    id: '00000000-0000-4000-8000-000000000012',
    email: 'sumitp@gmail.com',
    display_name: 'Sumit Kushwaha',
    role: 'DEMO_USER',
    is_active: true,
    demoPasscode: '1234',
  },
];

export const DEMO_SESSION_STORAGE_KEY = 'electrimap_demo_session_v1';

interface StoredDemoSession {
  id: string;
  email: string;
  display_name: string;
  signed_in_at: string;
}

function toPublicProfile(account: DemoAccountDefinition): DemoUserProfile {
  return {
    id: account.id,
    email: account.email,
    display_name: account.display_name,
    role: account.role,
    is_active: account.is_active,
  };
}

export function getStoredDemoUser(): DemoUserProfile | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(DEMO_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredDemoSession> | null;
    const emailNorm = (parsed?.email ?? '').trim().toLowerCase();
    const matched = DEMO_ACCOUNTS.find(
      (acct) => acct.email === emailNorm || acct.id === parsed?.id,
    );
    return matched ? toPublicProfile(matched) : null;
  } catch {
    return null;
  }
}

export function authenticateDemoUser(email: string, password: string): DemoUserProfile {
  const emailNorm = email.trim().toLowerCase();
  const matched = DEMO_ACCOUNTS.find((acct) => acct.email === emailNorm);
  if (!matched || matched.demoPasscode !== password) {
    throw new Error('Invalid email or password. Check your demo account email and password.');
  }

  const profile = toPublicProfile(matched);
  if (typeof window !== 'undefined') {
    const record: StoredDemoSession = {
      id: profile.id,
      email: profile.email,
      display_name: profile.display_name,
      signed_in_at: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(DEMO_SESSION_STORAGE_KEY, JSON.stringify(record));
    } catch {
      // Ignore storage quota exceptions
    }
  }
  return profile;
}

export function clearStoredDemoUser(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage exceptions
  }
}

