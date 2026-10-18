import type {
  AdminPaymentsResponse,
  CourseOperations,
  InvoiceStatus,
  StudentPaymentAccountRow,
  StudentPaymentAccountState
} from './types';
import type { PageResponse } from '../../lib/pagination';
import { formatMoney } from './format';

/** No finite lesson denominator is not a real 0% utilization result. */
export function courseLessonUse(course: Pick<CourseOperations, 'purchasedLessons' | 'usedLessons' | 'utilizationPercent'>) {
  return course.purchasedLessons > 0
    ? {label: `${course.utilizationPercent}%`, detail: `${course.usedLessons}/${course.purchasedLessons} lessons`}
    : {label: '—', detail: 'No lesson credits'};
}

export const PAYMENT_STATUS_OPTIONS: ReadonlyArray<{
  value: InvoiceStatus | '';
  label: string;
}> = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Needs review' },
  { value: 'PENDING', label: 'Payment due' },
  { value: 'PARTIALLY_PAID', label: 'Part paid' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'PAID', label: 'Paid' },
  { value: 'CANCELLED', label: 'Cancelled' }
];

export interface AdminPaymentSummaryView {
  available: boolean;
  currency: string;
  outstanding: number;
  outstandingLabel: string;
  collected: number;
  collectedLabel: string;
  issuedLabel: string;
  openCount: number;
  draftCount: number;
  overdueInvoiceCount: number;
  collectionRate: number;
  outstandingRate: number;
}

export function toAdminPaymentSummaryView(
  summary: AdminPaymentsResponse['summary'] | undefined
): AdminPaymentSummaryView {
  const currency = summary?.currency ?? 'NZD';
  const collected = summary?.collected ?? 0;
  const outstanding = summary?.outstanding ?? 0;
  const issued = summary?.issued ?? 0;
  // The server owns decimal rounding and per-invoice settlement; do not recompute from cash receipts.
  const collectionRate = summary?.collectionRate ?? 0;

  return {
    available: Boolean(summary),
    currency,
    outstanding,
    outstandingLabel: summary ? formatMoney(outstanding, currency) : '—',
    collected,
    collectedLabel: summary ? formatMoney(collected, currency) : '—',
    issuedLabel: summary && Number.isFinite(summary.issued) ? formatMoney(issued, currency) : '—',
    openCount: summary?.openCount ?? 0,
    draftCount: summary?.draftCount ?? 0,
    overdueInvoiceCount: summary?.overdueCount ?? 0,
    collectionRate,
    outstandingRate: issued > 0 ? 100 - collectionRate : 0
  };
}

export function paymentPageRangeLabel<T>(page: PageResponse<T> | undefined, loading: boolean) {
  if (!page) return loading ? 'Loading…' : 'No results';
  if (page.items.length === 0) return `0 of ${page.totalItems}`;
  const first = page.page * page.size + 1;
  const last = Math.min((page.page + 1) * page.size, page.totalItems);
  return `${first}–${last} of ${page.totalItems}`;
}

export const STUDENT_ACCOUNT_STATE_LABELS: Record<StudentPaymentAccountState, string> = {
  PAYMENT_REVIEW: 'Payment reported',
  OVERDUE: 'Overdue',
  DRAFT: 'Draft to send',
  NEEDS_INVOICE: 'Needs invoice',
  PARTIALLY_PAID: 'Part paid',
  PAYMENT_DUE: 'Awaiting payment',
  PAID: 'Paid',
  NO_PAYMENT_DUE: 'No payment due'
};

export function studentAccountStateClass(state: StudentPaymentAccountState) {
  return `student-account-state student-account-state--${state.toLowerCase().replace(/_/g, '-')}`;
}

export function studentAccountAction(row: StudentPaymentAccountRow) {
  if (row.state === 'PAYMENT_REVIEW') return 'Review payment';
  if (row.state === 'NEEDS_INVOICE') return 'Prepare invoice';
  if (row.primaryInvoiceId) return row.state === 'DRAFT' ? 'Review draft' : 'Open account';
  return '';
}

export function studentAccountDetail(row: StudentPaymentAccountRow) {
  if (row.state === 'PAYMENT_REVIEW') {
    return `${formatMoney(row.paymentReported, row.currency)} reported · verify before the balance changes`;
  }
  if (row.state === 'OVERDUE') {
    const overdue = typeof row.overdueBalance === 'number' && Number.isFinite(row.overdueBalance)
      ? `${formatMoney(row.overdueBalance, row.currency)} overdue` : 'Overdue amount unavailable';
    return `${overdue} · ${formatMoney(row.balance, row.currency)} total outstanding`;
  }
  if (row.state === 'DRAFT') {
    return `${row.draftCount} private draft${row.draftCount === 1 ? '' : 's'} not yet visible to the student`;
  }
  if (row.state === 'NEEDS_INVOICE') {
    return `${row.unbilledCourseCount} chargeable course${row.unbilledCourseCount === 1 ? '' : 's'} not yet invoiced`;
  }
  if (row.state === 'PARTIALLY_PAID') {
    return `${formatMoney(row.received, row.currency)} received · ${formatMoney(row.balance, row.currency)} remaining`;
  }
  if (row.state === 'PAYMENT_DUE') {
    return `${formatMoney(row.balance, row.currency)} still to receive`;
  }
  if (row.state === 'PAID') {
    return `${formatMoney(row.received, row.currency)} received · issued balance cleared`;
  }
  return 'No issued balance or charge currently needs attention';
}
