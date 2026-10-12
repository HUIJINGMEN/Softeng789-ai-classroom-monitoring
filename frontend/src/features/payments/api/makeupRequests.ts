import { request } from '../../../lib/apiClient';
import type { AdminMakeupRequestsResponse, LessonMakeupRequest } from '../types';

export function listAdminMakeupRequests(page = 0, size = 10) {
  return request<AdminMakeupRequestsResponse>(
    `/api/admin/payments/makeup-requests?status=SUBMITTED&page=${page}&size=${size}`
  );
}

export function reviewLessonMakeupRequest(
  requestId: string,
  decision: 'APPROVE' | 'DECLINE',
  note: string
) {
  return request<LessonMakeupRequest>(`/api/admin/payments/makeup-requests/${requestId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, note: note.trim() || undefined })
  });
}
