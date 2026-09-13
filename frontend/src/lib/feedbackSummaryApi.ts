import { request } from './apiClient';
import type { FeedbackSummary, ReportInsight } from '../types';

export interface FeedbackSummaryDelivery {
  channel: 'EMAIL';
  status: 'SENT' | 'DEMO';
  message: string;
}

export async function listFeedbackSummaries(studentId?: string): Promise<FeedbackSummary[]> {
  const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : '';
  return request<FeedbackSummary[]>(`/api/feedback-summaries${query}`);
}

export async function listPublishedFeedbackSummaries(studentId: string): Promise<FeedbackSummary[]> {
  return request<FeedbackSummary[]>(`/api/students/${studentId}/feedback-summaries`);
}

export async function generateFeedbackSummary(payload: {
  studentId: string;
  courseOfferingId: string;
  dateFrom: string;
  dateTo: string;
}): Promise<FeedbackSummary> {
  return request<FeedbackSummary>('/api/feedback-summaries/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
}

export async function reviewFeedbackSummary(
  id: string,
  payload: Pick<FeedbackSummary, 'summary' | 'strengths' | 'nextSteps'>
): Promise<FeedbackSummary> {
  return request<FeedbackSummary>(`/api/feedback-summaries/${id}/review`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
}

export async function publishFeedbackSummary(id: string): Promise<FeedbackSummary> {
  return request<FeedbackSummary>(`/api/feedback-summaries/${id}/publish`, { method: 'POST' });
}

export async function emailFeedbackSummary(id: string): Promise<FeedbackSummaryDelivery> {
  return request<FeedbackSummaryDelivery>(`/api/feedback-summaries/${id}/email`, { method: 'POST' });
}

export async function generateReportInsight(payload: {
  scope: 'OVERALL' | 'CLASS';
  courseOfferingId?: string;
  dateFrom: string;
  dateTo: string;
}): Promise<ReportInsight> {
  return request<ReportInsight>('/api/feedback-summaries/insight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}
