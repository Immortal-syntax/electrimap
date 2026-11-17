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
 * Typed HTTP client for ElectriMap DPR REST API (/api/v1) with automatic CSRF header injection.
 */

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details: Record<string, unknown>;

  constructor(code: string, message: string, status: number, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function normalizeOrigin(raw: string): string {
  return raw.replace(/\/+$/, '');
}

export function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const rawApiOrigin = (
    import.meta.env.VITE_API_ORIGIN ??
    import.meta.env.VITE_API_BASE_ORIGIN ??
    ''
  ).trim();
  const apiOrigin = normalizeOrigin(rawApiOrigin);
  if (apiOrigin) {
    return `${apiOrigin}${normalizedPath}`;
  }
  const viteApiBase = (import.meta.env.VITE_API_BASE ?? '').trim();
  if (/^https?:\/\//i.test(viteApiBase) && normalizedPath.startsWith('/api/v1')) {
    const cleanBase = normalizeOrigin(viteApiBase).replace(/\/api\/v1$/i, '');
    return `${cleanBase}${normalizedPath}`;
  }
  return normalizedPath;
}

let csrfTokenMemory: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfTokenMemory = token;
  if (typeof window !== 'undefined') {
    try {
      if (token) {
        window.sessionStorage.setItem('em_csrf_token', token);
      } else {
        window.sessionStorage.removeItem('em_csrf_token');
      }
      // Always scrub any legacy localStorage CSRF tokens (AUD-42)
      window.localStorage.removeItem('em_csrf_token');
    } catch {
      // Ignore storage quota or privacy-mode exceptions
    }
  }
}

export function getCsrfToken(): string | null {
  if (csrfTokenMemory) return csrfTokenMemory;
  if (typeof window !== 'undefined') {
    try {
      csrfTokenMemory = window.sessionStorage.getItem('em_csrf_token');
      window.localStorage.removeItem('em_csrf_token');
    } catch {
      csrfTokenMemory = null;
    }
  }
  return csrfTokenMemory;
}

function buildBackendUnavailableMessage(status: number): string {
  if (status === 405) {
    return 'API endpoint returned HTTP 405 (static SPA fallback intercepted /api request). Configure VITE_API_ORIGIN or connect the ElectriMap backend server.';
  }
  return 'The ElectriMap backend API is unreachable or returned HTML instead of JSON. Configure VITE_API_ORIGIN or start the FastAPI server.';
}

async function parseErrorResponse(response: Response): Promise<ApiClientError> {
  const contentType = response.headers.get('content-type') ?? '';
  let body: unknown = null;
  let textSnippet = '';
  if (contentType.includes('application/json')) {
    try {
      body = await response.json();
    } catch {
      body = null;
    }
  } else {
    try {
      textSnippet = (await response.text()).slice(0, 300);
    } catch {
      textSnippet = '';
    }
  }

  const looksHtml =
    contentType.includes('text/html') || /^\s*<!doctype|^\s*<html/i.test(textSnippet);

  const errObj =
    body && typeof body === 'object' && 'error' in body
      ? (body as { error: ApiErrorDetail }).error
      : null;

  let detailMessage: string | null = null;
  if (!errObj && body && typeof body === 'object' && 'detail' in body) {
    const rawDetail = (body as { detail: unknown }).detail;
    if (typeof rawDetail === 'string') {
      detailMessage = rawDetail;
    } else if (Array.isArray(rawDetail)) {
      detailMessage = rawDetail
        .map((item) => {
          if (item && typeof item === 'object') {
            const obj = item as { loc?: unknown[]; msg?: unknown };
            const loc = Array.isArray(obj.loc)
              ? obj.loc.filter((part) => part !== 'body').join('.')
              : '';
            const msg = typeof obj.msg === 'string' ? obj.msg : JSON.stringify(item);
            return loc ? `${loc}: ${msg}` : msg;
          }
          return String(item);
        })
        .join('; ');
    }
  }

  if (looksHtml || response.status === 405) {
    return new ApiClientError(
      looksHtml ? 'BACKEND_HTML_FALLBACK' : 'HTTP_405',
      buildBackendUnavailableMessage(response.status),
      response.status,
    );
  }

  return new ApiClientError(
    errObj?.code ?? `HTTP_${response.status}`,
    errObj?.message ?? detailMessage ?? `Request failed with status ${response.status}`,
    response.status,
    errObj?.details ?? {},
  );
}

function buildRequestInit(method: string, options: RequestInit): { method: string; headers: Headers } {
  const headers = new Headers(options.headers);

  if (!(options.body instanceof FormData) && !headers.has('Content-Type') && method !== 'GET') {
    headers.set('Content-Type', 'application/json');
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf) {
      headers.set('X-CSRF-Token', csrf);
    }
  }
  return { method, headers };
}

export async function apiFetchResponse(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const method = (options.method ?? 'GET').toUpperCase();
  const { headers } = buildRequestInit(method, options);
  const url = resolveApiUrl(path);

  const response = await fetch(url, {
    ...options,
    method,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/api/v1/auth/')) {
      setCsrfToken(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('electrimap:unauthorized'));
      }
    }
    throw await parseErrorResponse(response);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('text/html') && path.includes('/api/')) {
    throw new ApiClientError(
      'BACKEND_HTML_FALLBACK',
      buildBackendUnavailableMessage(response.status),
      502,
    );
  }

  return response;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await apiFetchResponse(path, options);

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType && !contentType.includes('application/json')) {
    const snippet = await response.text().catch(() => '');
    if (/^\s*<!doctype|^\s*<html/i.test(snippet)) {
      throw new ApiClientError(
        'BACKEND_HTML_FALLBACK',
        buildBackendUnavailableMessage(response.status),
        502,
      );
    }
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    throw new ApiClientError(
      'INVALID_JSON_RESPONSE',
      'Unexpected non-JSON response received from API server.',
      response.status || 502,
    );
  }

  if (body === null || body === undefined) {
    throw new ApiClientError(
      'EMPTY_JSON_RESPONSE',
      'Received an empty JSON payload from API server.',
      response.status || 502,
    );
  }

  return body as T;
}

