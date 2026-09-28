import type { PageResponse } from '../../lib/pagination';

export type InvoiceStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type LineItemType = 'CHARGE' | 'CREDIT';

export interface PaymentLineItem {
  id: string;
  description: string;
  type: LineItemType;
  amount: number;
}

export interface PaymentTransaction {
  id: string;
  amount: number;
  status: 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
  provider: string;
  reference: string;
  occurredAt: string;
}

export interface StudentInvoice {
  id: string;
  title: string;
  note: string | null;
  dueDate: string;
  currency: string;
  status: InvoiceStatus;
  charges: number;
  credits: number;
  payments: number;
  balance: number;
  lineItems: PaymentLineItem[];
  transactions: PaymentTransaction[];
  createdAt: string;
}

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
    overdueCount: number;
    openCount: number;
    currency: string;
  };
  page: PageResponse<AdminPaymentRow>;
}

export interface CreateInvoicePayload {
  studentIds: string[];
  title: string;
  note?: string;
  dueDate: string;
  lineItems: Array<{ description: string; type: LineItemType; amount: number }>;
}
