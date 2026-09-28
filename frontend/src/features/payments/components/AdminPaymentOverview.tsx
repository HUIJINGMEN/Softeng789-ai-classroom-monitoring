import { IconArrowRight, IconPlus } from '../../../components/icons';
import type { AdminPaymentSummaryView } from '../adminPaymentViewModel';

interface Props {
  readonly summary: AdminPaymentSummaryView;
  readonly onCreate: () => void;
  readonly onShowOverdue: () => void;
}

export default function AdminPaymentOverview({ summary, onCreate, onShowOverdue }: Props) {
  return (
    <section className="admin-receivables dashboard-enter stagger-1" aria-labelledby="receivables-title">
      <header className="admin-receivables__head">
        <div className="admin-receivables__heading">
          <div>
            <h2 id="receivables-title">Payment overview</h2>
            <p>Track issued charges, collections and accounts requiring attention.</p>
          </div>
        </div>
        <button type="button" className="btn btn--primary btn--with-icon admin-receivables__create" onClick={onCreate}>
          <span className="admin-receivables__create-icon" aria-hidden="true"><IconPlus /></span>
          <span>Create payment request</span>
        </button>
      </header>
      <div className="admin-receivables__body">
        <div className="admin-receivables__balance">
          <div className="admin-receivables__balance-head">
            <span>Outstanding balance</span>
          </div>
          <div className="admin-receivables__amount">
            <strong>{summary.outstandingLabel}</strong>
            {summary.available && <span>{summary.currency}</span>}
          </div>
          <div className="admin-receivables__balance-meta">
            <span className="admin-receivables__open-requests">
              <b>{summary.openCount}</b>
              <span>
                <strong>Open request{summary.openCount === 1 ? '' : 's'}</strong>
                <small>Awaiting payment</small>
              </span>
            </span>
            {summary.overdueCount > 0 ? (
              <button type="button" className="admin-receivables__overdue-link" onClick={onShowOverdue}>
                <span className="admin-receivables__overdue-dot" aria-hidden="true" />
                <span>
                  <b>{summary.overdueCount}</b>
                  <small>Overdue</small>
                </span>
                <IconArrowRight />
              </button>
            ) : (
              <span className="admin-receivables__current">
                <span aria-hidden="true" />
                All within due date
              </span>
            )}
          </div>
        </div>
        <div className="admin-receivables__progress">
          <div className="admin-receivables__progress-head">
            <div><strong>Collection progress</strong><span>Share of issued charges received</span></div>
            <strong>{summary.collectionRate}%</strong>
          </div>
          <progress
            value={summary.collected}
            max={summary.collected + summary.outstanding || 1}
            aria-label={`${summary.collectionRate}% of tracked charges collected`}
          />
          <dl className="admin-receivables__progress-legend">
            <div>
              <dt>Collected</dt>
              <dd>{summary.collectedLabel} <small>{summary.collectionRate}%</small></dd>
            </div>
            <div>
              <dt>Outstanding</dt>
              <dd>{summary.outstandingLabel} <small>{summary.outstandingRate}%</small></dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
