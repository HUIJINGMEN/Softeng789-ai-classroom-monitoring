import type { PageResponse } from '../../../lib/pagination';
import type {
  InvoiceStatus,
  ManualPaymentSubmission,
  PaymentBankAccount,
  StudentInvoice
} from './paymentCore';

export type StudentPaymentAccountState =
  | 'PAYMENT_REVIEW'
  | 'OVERDUE'
  | 'DRAFT'
  | 'NEEDS_INVOICE'
  | 'PARTIALLY_PAID'
  | 'PAYMENT_DUE'
  | 'PAID'
  | 'NO_PAYMENT_DUE';
export type StudentPaymentDirectoryFilter = 'NEEDS_ACTION' | 'AWAITING_PAYMENT' | 'PAID';

export interface StudentPaymentStatement {
  studentId: string;
  studentName: string;
  studentNumber: string;
  currency: string;
  totalCharges: number;
  totalCredits: number;
  totalPayments: number;
  amountDue: number;
  nextDueDate: string | null;
  demoMode: boolean;
  bankAccount: PaymentBankAccount | null;
  invoices: StudentInvoice[];
}

export interface AdminPaymentRow {
  invoiceId: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  title: string;
  dueDate: string;
  currency: string;
  total: number;
  paid: number;
  balance: number;
  status: InvoiceStatus;
}

export interface AdminPaymentsResponse {
  summary: {
    outstanding: number;
    collected: number;
    issued: number;
    /** Rounded percentage of issued charges settled, calculated from per-invoice debt on the server. */
    collectionRate: number;
    draftCount: number;
    overdueCount: number;
    openCount: number;
    currency: string;
  };
  page: PageResponse<AdminPaymentRow>;
}

export interface StudentPaymentAccountRow {
  studentId: string;
  studentName: string;
  studentNumber: string;
  courses: string[];
  issued: number;
  received: number;
  balance: number;
  /** Issued unpaid balances past their school-local due date; never inferred from account state. */
  overdueBalance: number | null;
  paymentReported: number;
  invoiceCount: number;
  draftCount: number;
  pendingEvidenceCount: number;
  unbilledCourseCount: number;
  unbilledCourses: string[];
  nextDueDate: string | null;
  primaryInvoiceId: string | null;
  primaryInvoiceTitle: string | null;
  state: StudentPaymentAccountState;
  currency: string;
}

export interface StudentPaymentDirectoryResponse {
  summary: {
    studentCount: number;
    needsActionCount: number;
    awaitingPaymentCount: number;
    paidCount: number;
    clearCount: number;
    outstanding: number;
    paymentReported: number;
    currency: string;
  };
  page: PageResponse<StudentPaymentAccountRow>;
}

export interface AdminManualPaymentsResponse {
  pendingCount: number;
  page: PageResponse<ManualPaymentSubmission>;
}
