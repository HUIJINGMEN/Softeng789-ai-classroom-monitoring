import type { AdminPaymentsResponse, InvoiceStatus } from './types';
import type { PageResponse } from '../../lib/pagination';
import { formatMoney } from './format';

export const PAYMENT_STATUS_OPTIONS: ReadonlyArray<{
  value: InvoiceStatus | '';
  label: string;
}> = [
  { value: '', label: 'All statuses' },
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
  overdueCount: number;
  collectionRate: number;
  outstandingRate: number;
}

export function toAdminPaymentSummaryView(
  summary: AdminPaymentsResponse['summary'] | undefined
): AdminPaymentSummaryView {
  const currency = summary?.currency ?? 'NZD';
  const collected = summary?.collected ?? 0;
  const outstanding = summary?.outstanding ?? 0;
  const issued = collected + outstanding;
  const collectionRate = issued > 0 ? Math.round((collected / issued) * 100) : 0;

  return {
    available: Boolean(summary),
    currency,
    outstanding,
    outstandingLabel: summary ? formatMoney(outstanding, currency) : '—',
    collected,
    collectedLabel: summary ? formatMoney(collected, currency) : '—',
    issuedLabel: summary ? formatMoney(issued, currency) : '—',
    openCount: summary?.openCount ?? 0,
    overdueCount: summary?.overdueCount ?? 0,
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
