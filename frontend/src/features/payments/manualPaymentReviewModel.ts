import type { ManualPaymentStatus, ManualPaymentSubmission } from './types';

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
