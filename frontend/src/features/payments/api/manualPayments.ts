import { request, requestBlob } from '../../../lib/apiClient';
import type {
  AdminManualPaymentsResponse,
  ManualPaymentMethod,
  ManualPaymentSubmission
} from '../types';

export function submitManualPayment(
  studentId: string,
  invoiceId: string,
  method: ManualPaymentMethod,
  amount: number,
  note: string,
  receipt: File | null
) {
  const body = new FormData();
  body.append('method', method);
  body.append('amount', amount.toFixed(2));
  if (note.trim()) body.append('note', note.trim());
  if (receipt) body.append('receipt', receipt);
  return request<ManualPaymentSubmission>(
    `/api/students/${studentId}/payments/${invoiceId}/manual-payment`,
    { method: 'POST', body }
  );
}

export function listPendingManualPayments(page = 0, size = 10, studentId = '', signal?: AbortSignal) {
  const query = new URLSearchParams({ page: String(page), size: String(size) });
  if (studentId) query.set('studentId', studentId);
  return request<AdminManualPaymentsResponse>(
    `/api/admin/payments/manual-payments?${query}`, { signal }
  );
}

export function reviewManualPayment(id: string, decision: 'APPROVED' | 'REJECTED', note: string) {
  return request<ManualPaymentSubmission>(`/api/admin/payments/manual-payments/${id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, note: note.trim() || undefined })
  });
}

export function downloadAdminPaymentReceipt(id: string, signal?: AbortSignal) {
  return requestBlob(`/api/admin/payments/manual-payments/${id}/receipt`, signal);
}
