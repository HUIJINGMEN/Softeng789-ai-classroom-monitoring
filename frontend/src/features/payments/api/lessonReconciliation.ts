import { request, requestBlob } from '../../../lib/apiClient';
import type {
  AbsenceReason,
  LessonCreditDetail,
  LessonReconciliationResponse,
  MakeupOption
} from '../types';

export interface LessonReconciliationFilters {
  courseOfferingId: string;
  weekStart: string;
  view?: 'WEEK' | 'COURSE';
  query?: string;
  exceptionsOnly?: boolean;
  page?: number;
  size?: number;
}

export function getLessonReconciliation(filters: LessonReconciliationFilters) {
  const params = reconciliationParams(filters);
  params.set('page', String(filters.page ?? 0));
  params.set('size', String(filters.size ?? 25));
  return request<LessonReconciliationResponse>(`/api/admin/lesson-reconciliation?${params.toString()}`);
}

export function getLessonCreditDetail(creditId: string) {
  return request<LessonCreditDetail>(`/api/admin/lesson-reconciliation/credits/${creditId}`);
}

export function decideLessonCredit(
  creditId: string,
  payload: { decision: 'COUNT_AS_USED' | 'GRANT_MAKEUP'; reason: AbsenceReason; note: string }
) {
  return request<LessonCreditDetail>(`/api/admin/lesson-reconciliation/credits/${creditId}/decision`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export function updateReconciliationAttendance(
  sessionId: string,
  studentId: string,
  payload: {
    status: 'PRESENT' | 'LATE' | 'ABSENT' | 'UNKNOWN';
    absenceReason?: AbsenceReason;
    absenceNote?: string;
  }
) {
  return request<{
    id: string | null;
    status: 'PRESENT' | 'LATE' | 'ABSENT' | 'UNKNOWN';
    absenceReason: AbsenceReason | null;
    absenceNote: string | null;
  }>(`/api/sessions/${sessionId}/attendance/${studentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export function listMakeupOptions(creditId: string) {
  return request<MakeupOption[]>(`/api/admin/lesson-reconciliation/credits/${creditId}/makeup-options`);
}

export function scheduleLessonMakeup(creditId: string, targetSessionId: string) {
  return request<LessonCreditDetail>(`/api/admin/lesson-reconciliation/credits/${creditId}/makeup`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetSessionId })
  });
}

export function cancelLessonMakeup(creditId: string) {
  return request<LessonCreditDetail>(`/api/admin/lesson-reconciliation/credits/${creditId}/makeup`, {
    method: 'DELETE'
  });
}

export function downloadLessonReconciliation(
  format: 'xlsx' | 'pdf',
  filters: Omit<LessonReconciliationFilters, 'page' | 'size'>
) {
  return requestBlob(
    `/api/admin/lesson-reconciliation/export.${format}?${reconciliationParams(filters).toString()}`
  );
}

function reconciliationParams(filters: Omit<LessonReconciliationFilters, 'page' | 'size'>) {
  return new URLSearchParams({
    courseOfferingId: filters.courseOfferingId,
    weekStart: filters.weekStart,
    view: filters.view ?? 'WEEK',
    query: filters.query?.trim() ?? '',
    exceptionsOnly: String(Boolean(filters.exceptionsOnly))
  });
}
