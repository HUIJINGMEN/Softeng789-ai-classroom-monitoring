import { request, requestBlob } from '../../lib/apiClient';
import type {
  AdminBankTransfersResponse,
  AdminPaymentsResponse,
  BankTransferSubmission,
  CreateInvoicePayload,
  InvoiceStatus,
  StudentInvoice,
  StudentPaymentStatement
} from './types';

export type {
  AdminBankTransfersResponse,
  AdminPaymentRow,
  AdminPaymentsResponse,
  BankTransferStatus,
  BankTransferSubmission,
  CreateInvoicePayload,
  InvoiceStatus,
  LineItemType,
  PaymentLineItem,
  PaymentBankAccount,
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

export function updatePaymentBankAccount(payload: {
  accountName: string;
  bankName: string;
  accountNumber: string;
  paymentReference?: string;
  instructions?: string;
}) {
  return request<import('./types').PaymentBankAccount>('/api/admin/payments/bank-account', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export function getPaymentBankAccount() {
  return request<import('./types').PaymentBankAccount | null>('/api/admin/payments/bank-account');
}

export function submitBankTransfer(
  studentId: string,
  invoiceId: string,
  amount: number,
  note: string,
  receipt: File
) {
  const body = new FormData();
  body.append('amount', amount.toFixed(2));
  if (note.trim()) body.append('note', note.trim());
  body.append('receipt', receipt);
  return request<BankTransferSubmission>(
    `/api/students/${studentId}/payments/${invoiceId}/bank-transfer`,
    { method: 'POST', body }
  );
}

export function listPendingBankTransfers(page = 0, size = 10) {
  return request<AdminBankTransfersResponse>(`/api/admin/payments/bank-transfers?page=${page}&size=${size}`);
}

export function reviewBankTransfer(id: string, decision: 'APPROVED' | 'REJECTED', note: string) {
  return request<BankTransferSubmission>(`/api/admin/payments/bank-transfers/${id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, note: note.trim() || undefined })
  });
}

export function downloadAdminBankTransferReceipt(id: string) {
  return requestBlob(`/api/admin/payments/bank-transfers/${id}/receipt`);
}
