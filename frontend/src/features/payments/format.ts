import type { InvoiceStatus } from './types';
import { formatIsoDateInAuckland } from '../../lib/sessionTime';

export const PAYMENT_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Needs review',
  PENDING: 'Payment due',
  PARTIALLY_PAID: 'Part paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled'
};

export function formatMoney(value: number, currency = 'NZD') {
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency }).format(value);
}

export function formatPaymentDeduction(value: number, currency = 'NZD') {
  return value > 0 ? `−${formatMoney(value, currency)}` : '—';
}

export function formatPaymentDate(value: string | null) {
  if (!value) return 'No due date';
  return new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${value}T00:00:00`));
}

/** Payment instants use the school date; date-only due dates stay unchanged. */
export function formatPaymentRecordedDate(value: string) {
  const date = formatIsoDateInAuckland(new Date(value));
  return date ? formatPaymentDate(date) : 'Date unavailable';
}

export function paymentStatusClass(status: InvoiceStatus) {
  return `payment-status payment-status--${status.toLowerCase().replace(/_/g, '-')}`;
}

export function paymentSummaryCopy(amountDue: number, currency: string, unavailable: boolean) {
  if (unavailable) {
    return { title: 'Statement unavailable', action: 'Try loading your statement' };
  }
  if (amountDue > 0) {
    return { title: `${formatMoney(amountDue, currency)} due`, action: 'View statement and pay' };
  }
  return { title: 'No payment due', action: 'View payment history' };
}
