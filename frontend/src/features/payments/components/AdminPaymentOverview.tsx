import { IconArrowRight } from '../../../components/icons';
import type { AdminPaymentSummaryView } from '../adminPaymentViewModel';

interface Props {
  readonly summary: AdminPaymentSummaryView;
  readonly onShowDrafts: () => void;
  readonly onShowOverdue: () => void;
}

export default function AdminPaymentOverview({ summary, onShowDrafts, onShowOverdue }: Props) {
  const openInvoiceLabel = `${summary.openCount} open invoice${summary.openCount === 1 ? '' : 's'}`;
  const draftLabel = summary.draftCount === 1 ? 'Draft to review' : 'Drafts to review';
  const overdueLabel = summary.overdueCount === 1 ? 'Overdue account' : 'Overdue accounts';
  const overdueSuffix = summary.overdueCount === 1 ? '' : 's';

  return (
    <section className="admin-receivables dashboard-enter stagger-1" aria-labelledby="receivables-title">
      <header className="admin-receivables__head">
        <div>
          <h2 id="receivables-title">Payment overview</h2>
          <p>See collection totals and the accounts that currently need attention.</p>
        </div>
      </header>

      <div className="admin-receivables__body">
        <section className="admin-receivables__balance" aria-labelledby="outstanding-balance-title">
          <div className="admin-receivables__balance-head">
            <h3 id="outstanding-balance-title">Outstanding balance</h3>
            <span>All issued invoices</span>
          </div>
          <div className="admin-receivables__amount">
            <strong>{summary.outstandingLabel}</strong>
            <span>{summary.currency}</span>
          </div>
          <p>{openInvoiceLabel} still waiting for payment.</p>
          <div className="admin-receivables__actions" aria-label="Payment actions">
            {summary.draftCount > 0 ? (
              <button type="button" className="admin-receivables__action is-review" onClick={onShowDrafts}>
                <span><b>{summary.draftCount}</b><small>{draftLabel}</small></span>
                <IconArrowRight />
              </button>
            ) : (
              <span className="admin-receivables__action is-clear"><span><b>0</b><small>No drafts waiting</small></span></span>
            )}
            {summary.overdueCount > 0 ? (
              <button type="button" className="admin-receivables__action is-overdue" onClick={onShowOverdue}>
                <span><b>{summary.overdueCount}</b><small>{overdueLabel}</small></span>
                <IconArrowRight />
              </button>
            ) : (
              <span className="admin-receivables__action is-clear"><span><b>0</b><small>Nothing overdue</small></span></span>
            )}
          </div>
        </section>

        <section className="admin-receivables__progress" aria-labelledby="collection-progress-title">
          <div className="admin-receivables__progress-head">
            <div>
              <h3 id="collection-progress-title">Collection progress</h3>
              <p>{summary.collectedLabel} received of {summary.issuedLabel} issued</p>
            </div>
            <strong>{summary.collectionRate}%</strong>
          </div>
          <progress value={summary.collectionRate} max={100} aria-label={`${summary.collectionRate}% of issued charges collected`} />
          <dl className="admin-receivables__progress-legend">
            <div><dt>Received</dt><dd>{summary.collectedLabel}</dd></div>
            <div><dt>Remaining</dt><dd>{summary.outstandingLabel}</dd></div>
          </dl>
          <p className="admin-receivables__progress-note">
            {summary.overdueCount > 0
              ? `${summary.overdueCount} overdue account${overdueSuffix} need follow-up.`
              : 'All open invoices are still within their due dates.'}
          </p>
        </section>
      </div>
    </section>
  );
}
