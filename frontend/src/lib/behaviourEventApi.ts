import { request } from './apiClient';
import type { CandidateEvent, EventStatus, EventType } from '../types';
import { pageQuery, type PageResponse } from './pagination';

interface BehaviourEventApiResponse {
  id: string;
  studentId: string | null;
  trackId: string;
  eventType: EventType;
  sessionId: string;
  timestamp: string;
  durationSeconds: number;
  confidence: number;
  reviewStatus: 'PENDING_REVIEW' | 'CONFIRMED' | 'REJECTED' | 'CORRECTED';
  correctedFrom: EventType | null;
}

const STATUS_FROM_API: Record<BehaviourEventApiResponse['reviewStatus'], EventStatus> = {
  PENDING_REVIEW: 'Pending Review',
  CONFIRMED: 'Confirmed',
  REJECTED: 'Rejected',
  CORRECTED: 'Corrected'
};

const STATUS_TO_API: Record<EventStatus, BehaviourEventApiResponse['reviewStatus']> = {
  'Pending Review': 'PENDING_REVIEW',
  Confirmed: 'CONFIRMED',
  Rejected: 'REJECTED',
  Corrected: 'CORRECTED'
};

export interface BehaviourEventPageFilters {
  reviewStatus?: EventStatus;
  course?: string;
  sessionId?: string;
  eventType?: EventType;
  dateFrom?: string;
  dateTo?: string;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function mapEvent(event: BehaviourEventApiResponse): CandidateEvent {
  const timestamp = new Date(event.timestamp);
  return {
    id: event.id,
    studentId: event.studentId,
    trackId: event.trackId,
    type: event.eventType,
    sessionId: event.sessionId,
    start: timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    duration: formatDuration(event.durationSeconds),
    confidence: event.confidence,
    status: STATUS_FROM_API[event.reviewStatus],
    correctedFrom: event.correctedFrom ?? undefined
  };
}

export async function listBehaviourEvents(): Promise<CandidateEvent[]> {
  return (await request<BehaviourEventApiResponse[]>('/api/behaviour-events')).map(mapEvent);
}

export async function listBehaviourEventsPage(
  page: number,
  size: number,
  filters: BehaviourEventPageFilters = {}
): Promise<PageResponse<CandidateEvent>> {
  const params = new URLSearchParams(pageQuery(page, size));
  if (filters.reviewStatus) params.set('reviewStatus', STATUS_TO_API[filters.reviewStatus]);
  if (filters.course) params.set('course', filters.course);
  if (filters.sessionId) params.set('sessionId', filters.sessionId);
  if (filters.eventType) params.set('eventType', filters.eventType);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  const response = await request<PageResponse<BehaviourEventApiResponse>>(
    `/api/behaviour-events/page?${params.toString()}`
  );
  return { ...response, items: response.items.map(mapEvent) };
}

export async function reviewBehaviourEvent(
  id: string,
  status: Exclude<EventStatus, 'Pending Review'>,
  eventType?: EventType
): Promise<CandidateEvent> {
  return mapEvent(await request<BehaviourEventApiResponse>(`/api/behaviour-events/${id}/review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: STATUS_TO_API[status], eventType })
  }));
}
