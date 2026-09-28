import type { PaymentStatusFilter } from '../hooks/useAdminPayments';
import type { AdminPaymentsResponse } from '../api';
import Pager from '../../../components/Pager';
import SearchField from '../../../components/SearchField';
import { IconWallet } from '../../../components/icons';
import MobilePaymentRequestList from './MobilePaymentRequestList';
import PaymentRequestTable from './PaymentRequestTable';
import { PAYMENT_STATUS_OPTIONS, paymentPageRangeLabel } from '../adminPaymentViewModel';

interface Props {
  readonly isMobile: boolean;
  readonly data: AdminPaymentsResponse | null;
  readonly query: string;
  readonly status: PaymentStatusFilter;
  readonly loading: boolean;
  readonly error: string;
  readonly onQueryChange: (value: string) => void;
  readonly onStatusChange: (value: PaymentStatusFilter) => void;
  readonly onPageChange: (page: number) => void;
  readonly onRetry: () => void;
}

function StatusFilter({
  mobile,
  value,
  onChange
}: {
  readonly mobile: boolean;
  readonly value: PaymentStatusFilter;
  readonly onChange: (next: PaymentStatusFilter) => void;
}) {
  if (mobile) {
    return (
      <div className="mobile-payment-status-filter" aria-label="Filter payment requests by status">
        {PAYMENT_STATUS_OPTIONS.map((option) => (
          <button
            type="button"
            className={value === option.value ? 'is-active' : ''}
            key={option.value || 'all'}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <label className="field">
      <span>Status</span>
      <select value={value} onChange={(event) => onChange(event.target.value as PaymentStatusFilter)}>
        {PAYMENT_STATUS_OPTIONS.map((option) => (
          <option value={option.value} key={option.value || 'all'}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

export default function AdminPaymentDirectory({
  isMobile,
  data,
  query,
  status,
  loading,
  error,
  onQueryChange,
  onStatusChange,
  onPageChange,
  onRetry
}: Props) {
  const resultPage = data?.page;
  const showing = paymentPageRangeLabel(resultPage, loading);

  return (
    <section className="card admin-payment-directory dashboard-enter stagger-2" aria-busy={loading}>
      <div className="card__head">
        <div>
          <div className="card__title">{isMobile ? 'Requests' : 'Payment requests'}</div>
          <div className="card__sub">
            {isMobile
              ? 'Track balances and follow up overdue accounts.'
              : 'Review every issued charge and its current payment status.'}
          </div>
        </div>
        <div className="admin-payment-directory__meta">
          {resultPage && <span>{resultPage.totalItems} request{resultPage.totalItems === 1 ? '' : 's'}</span>}
          {loading && data && <span className="payment-directory-state" role="status">Updating…</span>}
        </div>
      </div>
      <div className="list-toolbar admin-payment-toolbar">
        <SearchField
          value={query}
          onChange={onQueryChange}
          label="Search payments"
          placeholder="Student, number or request"
        />
        <StatusFilter mobile={isMobile} value={status} onChange={onStatusChange} />
      </div>
      {error && (
        <div className="notice notice--warn" role="alert">
          {error}<span className="spacer" />
          <button type="button" className="btn btn--sm" onClick={onRetry}>Retry</button>
        </div>
      )}
      {loading && !data && <div className="payment-page-state">Loading payment requests…</div>}
      {resultPage && resultPage.items.length > 0 && (
        isMobile
          ? <MobilePaymentRequestList rows={resultPage.items} />
          : <PaymentRequestTable rows={resultPage.items} />
      )}
      {!loading && resultPage?.items.length === 0 && (
        <div className="payment-empty">
          <IconWallet />
          <strong>No payment requests found</strong>
          <span>Adjust the filters or create a new request.</span>
        </div>
      )}
      {resultPage && (
        <Pager
          label={`Showing ${showing}`}
          page={resultPage.page}
          pageCount={resultPage.totalPages}
          canPrev={resultPage.hasPrevious}
          canNext={resultPage.hasNext}
          onPrev={() => onPageChange(Math.max(0, resultPage.page - 1))}
          onNext={() => onPageChange(resultPage.page + 1)}
          onGoToPage={onPageChange}
        />
      )}
    </section>
  );
}
