import { request } from './apiClient';
import type { CandidateEvent, EventStatus, EventType } from '../types';

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

const STATUS_TO_API: Record<Exclude<EventStatus, 'Pending Review'>, BehaviourEventApiResponse['reviewStatus']> = {
  Confirmed: 'CONFIRMED',
  Rejected: 'REJECTED',
  Corrected: 'CORRECTED'
};

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
