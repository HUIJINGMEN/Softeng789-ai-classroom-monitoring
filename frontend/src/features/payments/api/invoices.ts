import { request, requestBlob } from '../../../lib/apiClient';
import type {
  AccountActivity,
  AccountAdjustmentType,
  AdminPaymentsResponse,
  CreateInvoicePayload,
  CreateStudentInvoiceBatchPayload,
  ChargeSuggestionPreview,
  InvoiceAccount,
  InvoiceDeliveryResult,
  InvoiceMessageDraft,
  InvoiceStatus,
  OperationsDashboard,
  PaymentBankAccount,
  SessionPackageAction,
  SessionPackageUsage,
  SavedInvoiceMessage,
  StudentInvoice,
  StudentPaymentDirectoryFilter,
  StudentPaymentDirectoryResponse,
  StudentPaymentStatement
} from '../types';

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

export function listStudentPaymentAccounts(
  page: number,
  size: number,
  filters: { query?: string; filter?: StudentPaymentDirectoryFilter | '' }
) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (filters.query?.trim()) params.set('query', filters.query.trim());
  if (filters.filter) params.set('filter', filters.filter);
  return request<StudentPaymentDirectoryResponse>(`/api/admin/payment-accounts?${params.toString()}`);
}

export function createPaymentRequests(payload: CreateInvoicePayload) {
  return request<{ invoices: StudentInvoice[] }>('/api/admin/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export function previewStudentCharges(payload: {
  studentIds: string[];
  preferredCourseOfferingId?: string;
  billingDate?: string;
}) {
  return request<ChargeSuggestionPreview>('/api/admin/payments/charge-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export function createStudentInvoiceBatch(payload: CreateStudentInvoiceBatchPayload) {
  return request<{ invoices: StudentInvoice[] }>('/api/admin/payments/student-batch', {
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
  return request<PaymentBankAccount>('/api/admin/payments/bank-account', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export function getPaymentBankAccount() {
  return request<PaymentBankAccount | null>('/api/admin/payments/bank-account');
}

export function getAdminInvoice(invoiceId: string) {
  return request<StudentInvoice>(`/api/admin/payments/${invoiceId}`);
}

export function getInvoiceAccount(invoiceId: string) {
  return request<InvoiceAccount>(`/api/admin/payments/${invoiceId}/account`);
}

export function adjustInvoiceAccount(
  invoiceId: string,
  payload: { type: AccountAdjustmentType; amount: number; reason: string; externalReference?: string }
) {
  return request<InvoiceAccount>(`/api/admin/payments/${invoiceId}/adjustments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export function manageSessionPackage(
  packageId: string,
  payload: {
    action: SessionPackageAction;
    reason: string;
    serviceTo?: string;
    targetCourseOfferingId?: string;
  }
) {
  return request<{ sessionPackage: SessionPackageUsage; activities: AccountActivity[] }>(
    `/api/admin/payments/session-packages/${packageId}/lifecycle`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }
  );
}

export function updateAttendanceBilling(
  packageId: string,
  attendanceRecordId: string,
  decision: 'CONSUME' | 'WAIVE',
  reason: string
) {
  return request<SessionPackageUsage>(
    `/api/admin/payments/session-packages/${packageId}/attendance/${attendanceRecordId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, reason })
    }
  );
}

export function getBillingOperations(filters: { from: string; to: string }) {
  const params = new URLSearchParams(filters);
  return request<OperationsDashboard>(`/api/admin/payments/operations?${params.toString()}`);
}

export function downloadAdminInvoice(invoiceId: string) {
  return requestBlob(`/api/admin/payments/${invoiceId}/invoice.pdf`);
}

export function downloadStudentInvoice(studentId: string, invoiceId: string) {
  return requestBlob(`/api/students/${studentId}/payments/${invoiceId}/invoice.pdf`);
}

export function generateInvoiceMessage(invoiceId: string) {
  return request<InvoiceMessageDraft>(`/api/admin/payments/${invoiceId}/message-draft`, {
    method: 'POST'
  });
}

export function saveInvoiceMessage(invoiceId: string, message: string, reviewed: boolean) {
  return request<SavedInvoiceMessage>(`/api/admin/payments/${invoiceId}/message-draft`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, reviewed })
  });
}

export function emailInvoice(invoiceId: string, message: string, deliveryKey?: string) {
  return request<InvoiceDeliveryResult>(`/api/admin/payments/${invoiceId}/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, deliveryKey })
  });
}
