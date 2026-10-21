// Browser authentication is same-origin only. Vite proxies /api during development;
// the production reverse proxy owns the same route. No credential-bearing external API base.
export const API_BASE_URL = '';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let authenticated = false;
let expectedAccount: string | null = null;
let authRevision = 0;
let csrfRequest: Promise<{ headerName: string; token: string }> | null = null;

/** UI epoch/account only: credentials stay in HttpOnly cookies and are never passed to JavaScript. */
export function setSessionAuthenticated(value: boolean, account: string | null = null): void {
  authRevision++;
  authenticated = value;
  expectedAccount = value ? account : null;
  csrfRequest = null;
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

function rejectCurrentSession(response: Response, path: string, revision: number): void {
  // A request belongs to the session that sent it, not whichever account is signed in when it returns.
  if (response.status === 401 && revision === authRevision && authenticated
    && !path.startsWith('/api/auth/login') && !path.startsWith('/api/auth/register/')) onUnauthorized?.();
}

function validatePath(path: string): void {
  if (!/^\/api(?:\/|$)/.test(path) || /[\\\u0000-\u001f]/.test(path)) throw new Error('Invalid API path.');
}

function verifyResponseSession(response: Response, path: string, revision: number): void {
  if (path.startsWith('/api/auth/')) return;
  if (revision !== authRevision) throw new ApiError('Your login changed. Please try again.', 409);
  if (authenticated && expectedAccount && response.headers?.get('X-ClassLens-Account') !== expectedAccount) {
    onUnauthorized?.();
    throw new ApiError('Your account changed in another tab. Refresh the page to continue.', 409);
  }
}

async function csrfToken() {
  // Cookies can expire or change in another tab. Reacquire the proof for each operation;
  // only coalesce concurrent acquisitions, never cache a proof for the login lifetime.
  if (!csrfRequest) {
    const revision = authRevision;
    const pending = fetch('/api/auth/csrf', { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new ApiError(await responseMessage(response), response.status);
        const token = await response.json() as { headerName: string; token: string };
        if (token.headerName !== 'X-CSRF-TOKEN' || !token.token) throw new Error('Request protection is unavailable.');
        if (revision !== authRevision) throw new ApiError('Your login changed. Please try again.', 409);
        return token;
      }).finally(() => { if (csrfRequest === pending) csrfRequest = null; });
    csrfRequest = pending;
  }
  return csrfRequest;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // path is only ever meant to be a same-origin API route. Reject anything that could redirect
  // the request elsewhere — including a protocol-relative "//host/..." path, which still passes
  // a naive startsWith('/') check but resolves to a different origin in the browser.
  validatePath(path);
  const headers = new Headers(init?.headers);
  if (headers.has('Authorization')) throw new Error('Bearer authentication is no longer supported.');
  const revision = authRevision;
  if (!['GET', 'HEAD', 'OPTIONS'].includes((init?.method ?? 'GET').toUpperCase())) {
    const token = await csrfToken();
    if (revision !== authRevision) throw new ApiError('Your login changed. Please try again.', 409);
    headers.set(token.headerName, token.token);
  }
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: 'same-origin' });
  if (!response.ok) {
    // Only an already-authenticated request going stale should trigger a logout — a 401 from
    // /api/auth/login on a bad password happens before any token exists and must not count.
    rejectCurrentSession(response, path, revision);
    if (response.status === 403 && revision === authRevision) csrfRequest = null;
    throw new ApiError(await responseMessage(response), response.status);
  }
  // Some 2xx responses (e.g. a 201 Created with no representation to return) have an empty body —
  // response.json() throws on that, so check for actual content first rather than special-casing
  // 204 alone.
  const text = await response.text();
  verifyResponseSession(response, path, revision);
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function requestBlob(path: string, signal?: AbortSignal): Promise<Blob> {
  validatePath(path);
  const revision = authRevision;
  const response = await fetch(`${API_BASE_URL}${path}`, { signal, credentials: 'same-origin' });
  if (!response.ok) {
    rejectCurrentSession(response, path, revision);
    throw new ApiError(await responseMessage(response), response.status);
  }
  verifyResponseSession(response, path, revision);
  return response.blob();
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
