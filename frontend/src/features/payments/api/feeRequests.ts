import { request, requestBlob } from '../../../lib/apiClient';
import type { AdminFeeRequestsResponse, StudentFeeRequest } from '../types';

export function submitStudentFeeRequest(
  studentId: string,
  payload: { title: string; details: string; evidence?: File | null }
) {
  const body = new FormData();
  body.append('title', payload.title.trim());
  body.append('details', payload.details.trim());
  if (payload.evidence) body.append('evidence', payload.evidence);
  return request<StudentFeeRequest>(`/api/students/${studentId}/fee-requests`, {
    method: 'POST',
    body
  });
}

export function listStudentFeeRequests(studentId: string) {
  return request<StudentFeeRequest[]>(`/api/students/${studentId}/fee-requests`);
}

export function listAdminFeeRequests(page = 0, size = 10) {
  return request<AdminFeeRequestsResponse>(
    `/api/admin/payments/fee-requests?status=SUBMITTED&page=${page}&size=${size}`
  );
}

export function createInvoiceFromFeeRequest(
  requestId: string,
  payload: {
    invoiceTitle: string;
    note?: string;
    dueDate: string;
    lineItems: Array<{ description: string; type: 'CHARGE' | 'CREDIT'; amount: number }>;
  }
) {
  return request<StudentFeeRequest>(`/api/admin/payments/fee-requests/${requestId}/invoice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export function declineStudentFeeRequest(requestId: string, note: string) {
  return request<StudentFeeRequest>(`/api/admin/payments/fee-requests/${requestId}/decline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note })
  });
}

export function downloadAdminFeeRequestEvidence(requestId: string) {
  return requestBlob(`/api/admin/payments/fee-requests/${requestId}/evidence`);
}
