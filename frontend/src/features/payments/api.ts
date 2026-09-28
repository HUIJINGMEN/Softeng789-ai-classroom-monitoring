import { request } from '../../lib/apiClient';
import type {
  AdminPaymentsResponse,
  CreateInvoicePayload,
  InvoiceStatus,
  StudentInvoice,
  StudentPaymentStatement
} from './types';

export type {
  AdminPaymentRow,
  AdminPaymentsResponse,
  CreateInvoicePayload,
  InvoiceStatus,
  LineItemType,
  PaymentLineItem,
  PaymentTransaction,
  StudentInvoice,
  StudentPaymentStatement
} from './types';

export function getStudentPaymentStatement(studentId: string) {
  return request<StudentPaymentStatement>(`/api/students/${studentId}/payments`);
}

export function payStudentInvoice(studentId: string, invoiceId: string) {
  return request<{ invoice: StudentInvoice; message: string; demoMode: boolean }>(
    `/api/students/${studentId}/payments/${invoiceId}/checkout`,
    { method: 'POST' }
  );
}

export function listAdminPayments(
  page: number,
  size: number,
  filters: { query?: string; status?: InvoiceStatus | '' }
) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (filters.query?.trim()) params.set('query', filters.query.trim());
  if (filters.status) params.set('status', filters.status);
  return request<AdminPaymentsResponse>(`/api/admin/payments?${params.toString()}`);
}

export function createPaymentRequests(payload: CreateInvoicePayload) {
  return request<{ invoices: StudentInvoice[] }>('/api/admin/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}
