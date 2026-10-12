import type { AdminPaymentRow } from '../types';

export type AdminPaymentWorkspace = 'students' | 'invoices' | 'reviews' | 'overview';
export type PaymentReviewQueue = 'makeups' | 'fees' | 'payments';
export type InvoiceReviewTarget = Pick<
  AdminPaymentRow,
  'invoiceId' | 'studentName' | 'studentNumber'
>;

export const ADMIN_PAYMENT_WORKSPACES: ReadonlyArray<{
  value: AdminPaymentWorkspace;
  label: string;
  description: string;
}> = [
  { value: 'students', label: 'Payment accounts', description: 'Manage by student' },
  { value: 'invoices', label: 'Invoice records', description: 'Review documents' },
  { value: 'reviews', label: 'Approvals', description: 'Resolve requests' },
  { value: 'overview', label: 'Overview', description: 'Totals and alerts' }
];

export const PAYMENT_REVIEW_QUEUES: ReadonlyArray<{
  value: PaymentReviewQueue;
  label: string;
}> = [
  { value: 'makeups', label: 'Make-up requests' },
  { value: 'fees', label: 'Fee requests' },
  { value: 'payments', label: 'Payment evidence' }
];
