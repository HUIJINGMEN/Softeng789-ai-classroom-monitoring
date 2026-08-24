export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8080').replace(
  /\/$/,
  ''
);

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let currentAuthToken: string | null = null;

/** Called by useAuth whenever the signed-in user changes, so every request below auto-attaches it. */
export function setAuthToken(token: string | null): void {
  currentAuthToken = token;
}

let onUnauthorized: (() => void) | null = null;

/**
 * Called by useAuth to react to a session going invalid mid-use (12-hour TTL expiry, or a logout
 * from another tab) — without this, a 401 on a background fetch would just fail silently instead
 * of returning the user to the sign-in screen.
 */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // path is only ever meant to be a same-origin API route. Reject anything that could redirect
  // the request elsewhere — including a protocol-relative "//host/..." path, which still passes
  // a naive startsWith('/') check but resolves to a different origin in the browser.
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error(`Invalid API path: "${path}"`);
  }
  const headers = new Headers(init?.headers);
  const authenticated = Boolean(currentAuthToken) || headers.has('Authorization');
  if (currentAuthToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${currentAuthToken}`);
  }
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    // Only an already-authenticated request going stale should trigger a logout — a 401 from
    // /api/auth/login on a bad password happens before any token exists and must not count.
    if (response.status === 401 && authenticated) {
      onUnauthorized?.();
    }
    throw new ApiError(await responseMessage(response), response.status);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export function apiMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export function absoluteApiUrl(path: string, version: string): string {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(version)}`;
}

async function responseMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body.message ?? body.detail ?? body.error ?? `${response.status} ${response.statusText}`;
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}
