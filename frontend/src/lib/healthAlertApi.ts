import { request } from './apiClient';
import { buildQueryString } from './queryString';
import type { HealthAlert, HealthAlertStatus } from '../types';

interface HealthAlertApiResponse {
  id: string;
  studentId: string;
  studentName: string;
  sessionId: string;
  classLabel: string;
  room: string;
  detectedAt: string;
  eventType: string;
  confidence: number | null;
  source: string;
  status: 'AWAITING_REVIEW' | 'CONFIRMED' | 'DISMISSED';
  evidenceUrl: string | null;
  reviewedByTeacherId: string | null;
  reviewedByTeacherName: string | null;
  reviewedAt: string | null;
  teacherNotes: string | null;
  actionTaken: string | null;
  createdAt: string;
}

const STATUS_FROM_API: Record<HealthAlertApiResponse['status'], HealthAlertStatus> = {
  AWAITING_REVIEW: 'awaiting-review',
  CONFIRMED: 'confirmed',
  DISMISSED: 'dismissed'
};

function mapHealthAlertApiToUi(alert: HealthAlertApiResponse): HealthAlert {
  return {
    id: alert.id,
    studentId: alert.studentId,
    studentName: alert.studentName,
    sessionId: alert.sessionId,
    classLabel: alert.classLabel,
    room: alert.room,
    detectedAt: alert.detectedAt,
    eventType: alert.eventType,
    confidence: alert.confidence,
    source: alert.source,
    status: STATUS_FROM_API[alert.status],
    evidenceUrl: alert.evidenceUrl,
    reviewedByTeacherId: alert.reviewedByTeacherId,
    reviewedByTeacherName: alert.reviewedByTeacherName,
    reviewedAt: alert.reviewedAt,
    teacherNotes: alert.teacherNotes,
    actionTaken: alert.actionTaken,
    createdAt: alert.createdAt
  };
}

export interface HealthAlertFilters {
  courseOfferingId?: string;
  studentId?: string;
  status?: HealthAlertStatus;
  eventType?: string;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
}

const STATUS_TO_API: Record<HealthAlertStatus, HealthAlertApiResponse['status']> = {
  'awaiting-review': 'AWAITING_REVIEW',
  confirmed: 'CONFIRMED',
  dismissed: 'DISMISSED'
};

function toQueryString(filters?: HealthAlertFilters): string {
  if (!filters) return '';
  return buildQueryString({
    courseOfferingId: filters.courseOfferingId,
    studentId: filters.studentId,
    status: filters.status ? STATUS_TO_API[filters.status] : undefined,
    eventType: filters.eventType,
    source: filters.source,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo
  });
}

export async function listHealthAlerts(filters?: HealthAlertFilters): Promise<HealthAlert[]> {
  const alerts = await request<HealthAlertApiResponse[]>(`/api/health-alerts${toQueryString(filters)}`);
  return alerts.map(mapHealthAlertApiToUi);
}

export async function getHealthAlert(id: string): Promise<HealthAlert> {
  return mapHealthAlertApiToUi(await request<HealthAlertApiResponse>(`/api/health-alerts/${id}`));
}

export async function confirmHealthAlert(
  id: string,
  payload: { eventType?: string; teacherNotes?: string; actionTaken?: string }
): Promise<HealthAlert> {
  const alert = await request<HealthAlertApiResponse>(`/api/health-alerts/${id}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return mapHealthAlertApiToUi(alert);
}

export async function dismissHealthAlert(
  id: string,
  payload: { teacherNotes?: string }
): Promise<HealthAlert> {
  const alert = await request<HealthAlertApiResponse>(`/api/health-alerts/${id}/dismiss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return mapHealthAlertApiToUi(alert);
}
