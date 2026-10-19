import type { ManualPaymentStatus, ManualPaymentSubmission } from './types';
import { formatIsoDateInAuckland } from '../../lib/sessionTime';

export function receiptDateToday() {
  return formatIsoDateInAuckland(new Date());
}

export function receiptDateError(value: string, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value))
    || new Date(value).toISOString().slice(0, 10) !== value || value > today)
    return 'Confirm the actual date funds were received, no later than today in Auckland.';
  return '';
}

export function hasPaymentReceipt(payment: ManualPaymentSubmission) {
  return Boolean(payment.receiptFileName?.trim()) && payment.receiptFileSize > 0;
}

export function manualPaymentReviewError(decision: ManualPaymentStatus, note: string) {
  if (decision === 'REJECTED' && !note.trim())
    return 'Enter a rejection reason so the student knows what to correct.';
  return '';
}

export function reviewMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency', currency, currencyDisplay: 'code'
  }).format(amount);
}

export function reviewSubmittedTime(value: string) {
  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'Pacific/Auckland', timeZoneName: 'short'
  }).format(new Date(value));
}
