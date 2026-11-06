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

let csrfTokenMemory: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfTokenMemory = token;
  if (typeof window !== 'undefined') {
    if (token) {
      window.sessionStorage.setItem('em_csrf_token', token);
    } else {
      window.sessionStorage.removeItem('em_csrf_token');
    }
  }
}

export function getCsrfToken(): string | null {
  if (csrfTokenMemory) return csrfTokenMemory;
  if (typeof window !== 'undefined') {
    csrfTokenMemory = window.sessionStorage.getItem('em_csrf_token');
  }
  return csrfTokenMemory;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
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

  const response = await fetch(path, {
    ...options,
    method,
    headers,
    credentials: 'include',
  });

  if (response.status === 204) {
    return undefined as T;
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const errObj =
      body && typeof body === 'object' && 'error' in body
        ? (body as { error: ApiErrorDetail }).error
        : null;
    throw new ApiClientError(
      errObj?.code ?? `HTTP_${response.status}`,
      errObj?.message ?? `Request failed with status ${response.status}`,
      response.status,
      errObj?.details ?? {},
    );
  }

  return body as T;
}

