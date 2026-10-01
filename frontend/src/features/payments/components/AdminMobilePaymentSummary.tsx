import { IconArrowRight, IconPlus } from '../../../components/icons';
import type { AdminPaymentSummaryView } from '../adminPaymentViewModel';

interface Props {
  readonly summary: AdminPaymentSummaryView;
  readonly loading: boolean;
  readonly onCreate: () => void;
  readonly onShowOverdue: () => void;
}

export default function AdminMobilePaymentSummary({
  summary,
  loading,
  onCreate,
  onShowOverdue
}: Props) {
  const summaryMessage = loading ? 'Loading account totals…' : 'Summary unavailable';
  const openRequestLabel = `${summary.openCount} open payment request${summary.openCount === 1 ? '' : 's'}`;
  let accountStatus = <span className="admin-mobile-payment-summary__pending" aria-hidden="true" />;
  if (summary.available && summary.overdueCount > 0) {
    accountStatus = (
      <button type="button" className="admin-mobile-payment-summary__overdue" onClick={onShowOverdue}>
        <span>{summary.overdueCount}</span>
        <span>Overdue</span>
        <IconArrowRight />
      </button>
    );
  } else if (summary.available) {
    accountStatus = <span className="admin-mobile-payment-summary__current">All within due date</span>;
  }

  return (
    <section className="admin-mobile-payment-summary" aria-labelledby="mobile-payment-summary-title" aria-busy={loading}>
      <div className="admin-mobile-payment-summary__lead">
        <div>
          <h2 id="mobile-payment-summary-title">Outstanding</h2>
          <div className="admin-mobile-payment-summary__amount">
            <strong>{summary.outstandingLabel}</strong>
            <span>{summary.currency}</span>
          </div>
          <p>{summary.available ? openRequestLabel : summaryMessage}</p>
        </div>
        {accountStatus}
      </div>

      <div className="admin-mobile-payment-summary__progress">
        <div className="admin-mobile-payment-summary__progress-head">
          <div>
            <strong>Collection progress</strong>
            <span>{summary.collectedLabel} received of {summary.issuedLabel}</span>
          </div>
          <strong>{summary.collectionRate}%</strong>
        </div>
        <progress
          value={summary.collectionRate}
          max={100}
          aria-label={`${summary.collectionRate}% of issued charges collected`}
        />
      </div>

      <button
        type="button"
        className="btn btn--primary btn--with-icon admin-mobile-payment-summary__create"
        onClick={onCreate}
      >
        <span className="admin-mobile-payment-summary__create-icon" aria-hidden="true">
          <IconPlus />
        </span>
        <span>New payment request</span>
      </button>
    </section>
  );
}
