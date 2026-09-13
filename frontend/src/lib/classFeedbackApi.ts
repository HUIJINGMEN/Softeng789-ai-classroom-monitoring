import { request } from './apiClient';
import type { ClassFeedback } from '../types';

export function listClassFeedback(courseOfferingId: string): Promise<ClassFeedback[]> {
  return request<ClassFeedback[]>(
    `/api/class-feedback?courseOfferingId=${encodeURIComponent(courseOfferingId)}`
  );
}

export function createClassFeedback(payload: {
  courseOfferingId: string;
  comment: string;
}): Promise<ClassFeedback> {
  return request<ClassFeedback>('/api/class-feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}
