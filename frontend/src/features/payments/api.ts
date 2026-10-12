/**
 * Stable public API for the payments feature.
 *
 * Domain-specific request implementations live under ./api so consumers do not depend on one
 * monolithic transport module. Existing imports can continue using this barrel.
 */
export * from './api/feeRequests';
export * from './api/invoices';
export * from './api/lessonReconciliation';
export * from './api/makeupRequests';
export * from './api/manualPayments';

export type {
  AdminManualPaymentsResponse,
  AdminPaymentRow,
  AdminPaymentsResponse,
  ManualPaymentMethod,
  ManualPaymentStatus,
  ManualPaymentSubmission,
  AdminFeeRequestsResponse,
  CreateInvoicePayload,
  InvoiceStatus,
  LineItemType,
  PaymentLineItem,
  PaymentBankAccount,
  PaymentTransaction,
  StudentInvoice,
  StudentFeeRequest,
  StudentPaymentStatement
} from './types';
