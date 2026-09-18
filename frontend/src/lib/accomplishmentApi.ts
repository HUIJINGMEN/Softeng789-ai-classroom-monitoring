import { request } from './apiClient';
import type {
  Accomplishment,
  AccomplishmentCategory,
  AccomplishmentCorrectionStatus
} from '../types';

export interface AccomplishmentEntryInput {
  studentId: string;
  points: number | null;
  note: string;
}

export interface CreateAccomplishmentsInput {
  courseOfferingId: string;
  category: AccomplishmentCategory;
  title: string;
  description: string;
  achievementDate: string;
  includeInReport: boolean;
  confirm: boolean;
  entries: AccomplishmentEntryInput[];
}

export function createAccomplishments(payload: CreateAccomplishmentsInput): Promise<Accomplishment[]> {
  return request<Accomplishment[]>('/api/accomplishments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

/** Server-scoped list: admins receive every record; teachers receive only records for classes they teach. */
export function listAccomplishments(): Promise<Accomplishment[]> {
  return request<Accomplishment[]>('/api/accomplishments');
}

export function listAccomplishmentsForStudent(studentId: string): Promise<Accomplishment[]> {
  return request<Accomplishment[]>(
    `/api/accomplishments?studentId=${encodeURIComponent(studentId)}`
  );
}

export function listAccomplishmentsForClass(courseOfferingId: string): Promise<Accomplishment[]> {
  return request<Accomplishment[]>(
    `/api/accomplishments?courseOfferingId=${encodeURIComponent(courseOfferingId)}`
  );
}

export function listMyAccomplishments(studentId: string): Promise<Accomplishment[]> {
  return request<Accomplishment[]>(
    `/api/students/${encodeURIComponent(studentId)}/accomplishments`
  );
}

export function confirmAccomplishment(id: string): Promise<Accomplishment> {
  return request<Accomplishment>(`/api/accomplishments/${encodeURIComponent(id)}/confirm`, {
    method: 'POST'
  });
}

export function revokeAccomplishment(id: string): Promise<Accomplishment> {
  return request<Accomplishment>(`/api/accomplishments/${encodeURIComponent(id)}/revoke`, {
    method: 'POST'
  });
}

export function acknowledgeAccomplishment(
  studentId: string,
  accomplishmentId: string
): Promise<Accomplishment> {
  return request<Accomplishment>(
    `/api/students/${encodeURIComponent(studentId)}/accomplishments/${encodeURIComponent(accomplishmentId)}/acknowledge`,
    { method: 'POST' }
  );
}

export function requestAccomplishmentCorrection(
  studentId: string,
  accomplishmentId: string,
  message: string
): Promise<Accomplishment> {
  return request<Accomplishment>(
    `/api/students/${encodeURIComponent(studentId)}/accomplishments/${encodeURIComponent(accomplishmentId)}/correction-requests`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    }
  );
}

export interface ReviewAccomplishmentCorrectionInput {
  decision: Extract<AccomplishmentCorrectionStatus, 'ACCEPTED' | 'DECLINED'>;
  category: AccomplishmentCategory;
  title: string;
  description: string;
  studentNote: string;
  points: number | null;
  achievementDate: string;
  includeInReport: boolean;
  staffResponse: string;
}

export function reviewAccomplishmentCorrection(
  accomplishmentId: string,
  payload: ReviewAccomplishmentCorrectionInput
): Promise<Accomplishment> {
  return request<Accomplishment>(
    `/api/accomplishments/${encodeURIComponent(accomplishmentId)}/correction-request/review`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }
  );
}
