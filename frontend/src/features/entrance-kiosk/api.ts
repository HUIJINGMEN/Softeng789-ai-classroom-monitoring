import { request } from '../../lib/apiClient';
import { pageQuery, type PageResponse } from '../../lib/pagination';
import type {
  CancelReason,
  CaptureResult,
  ConfirmResult,
  KioskAttemptLogRow,
  KioskDevice,
  KioskSessionSummary,
  LaunchedKiosk,
  LaunchOptions,
  LaunchRequest
} from './types';

const json = { 'Content-Type': 'application/json' };
const id = (value: string) => encodeURIComponent(value);

// Staff routes: a teacher only sees and launches their own classes; the server enforces it.
export function getLaunchOptions(date: string, campusId?: string) {
  const query = new URLSearchParams({ date });
  if (campusId) query.set('campusId', campusId);
  return request<LaunchOptions>(`/api/kiosk/launch-options?${query.toString()}`);
}

/** Converts this browser into the kiosk: the response replaces the staff session cookie. */
export function launchKiosk(body: LaunchRequest) {
  return request<LaunchedKiosk>('/api/kiosk/sessions', { method: 'POST', headers: json, body: JSON.stringify(body) });
}

export function listKiosks(sessionId: string) {
  return request<KioskSessionSummary[]>(`/api/kiosk/sessions?${new URLSearchParams({ sessionId }).toString()}`);
}

export function endKiosk(kioskSessionId: string) {
  return request<void>(`/api/kiosk/sessions/${id(kioskSessionId)}/end`, { method: 'POST' });
}

export function listAttempts(sessionId: string, page = 0, size = 50) {
  return request<PageResponse<KioskAttemptLogRow>>(
    `/api/kiosk/attempts?${new URLSearchParams({ sessionId }).toString()}&${pageQuery(page, size)}`
  );
}

// Kiosk device routes: only a KIOSK session cookie may call these.
export function getDevice() {
  return request<KioskDevice>('/api/kiosk/device');
}

/** Reuse the same key and image when retrying, so the server replays rather than re-recognizes. */
export function submitCapture(image: Blob, idempotencyKey: string) {
  const data = new FormData();
  data.append('image', image, 'kiosk.jpg');
  return request<CaptureResult>('/api/kiosk/device/captures', {
    method: 'POST',
    body: data,
    headers: { 'Idempotency-Key': idempotencyKey }
  });
}

/** The attempt is the idempotency unit: repeating the same candidate replays the stored outcome. */
export function confirmCandidate(attemptId: string, candidateId: string) {
  return request<ConfirmResult>(`/api/kiosk/device/attempts/${id(attemptId)}/confirm`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ candidateId })
  });
}

export function cancelAttempt(attemptId: string, reason: CancelReason) {
  return request<void>(`/api/kiosk/device/attempts/${id(attemptId)}/cancel`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ reason })
  });
}
