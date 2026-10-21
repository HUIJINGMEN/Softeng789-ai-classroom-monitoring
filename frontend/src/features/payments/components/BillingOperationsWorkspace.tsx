import { formatIsoDateInAuckland } from '../../../lib/sessionTime';
import { useBillingOperations } from '../useBillingOperations';
import { formatMoney, formatPaymentDate } from '../format';
import type { OperationsAlert } from '../types';
import { courseLessonUse } from '../adminPaymentViewModel';

interface Props {
  readonly refreshToken: number;
  readonly onOpenInvoice: (alert: OperationsAlert) => void;
}

const ALERT_LABELS: Record<OperationsAlert['type'], string> = {
  OVERDUE_PAYMENT: 'Payment',
  LOW_LESSONS: 'Renewal',
  PACKAGE_EXPIRING: 'Package',
  MAKEUP_EXPIRING: 'Make-up',
  MEMBERSHIP_EXPIRING: 'Membership'
};

export default function BillingOperationsWorkspace({ refreshToken, onOpenInvoice }: Props) {
  const { data, loading, error, draftRange, setDraftRange, setRange, load, alertGroups } = useBillingOperations(refreshToken);

  if (loading && !data) return <output className="payment-page-state">Loading billing operations…</output>;
  if (error && !data) {
    return (
      <section className="billing-operations-state" role="alert">
        <strong>Billing operations could not be loaded</strong>
        <p>{error}</p>
        <button type="button" className="btn" onClick={() => void load()}>Try again</button>
      </section>
    );
  }
  if (!data) return null;

  const { financial } = data;
  const unassignedReceived = financial.unassignedNetReceived ?? 0;
  const unassignedOutstanding = financial.unassignedOutstanding ?? 0;
  return (
    <section className="billing-operations" aria-labelledby="billing-operations-title">
      <header className="billing-operations__head">
        <div>
          <h2 id="billing-operations-title">Billing operations</h2>
          <p>Work through current exceptions, then compare class results for the selected period.</p>
        </div>
      </header>

      {error && <div className="notice notice--warn" role="alert">{error}</div>}

      <section className="billing-period" aria-labelledby="billing-period-title">
        <header>
          <div>
            <h3 id="billing-period-title">Period snapshot</h3>
            <p>{formatPaymentDate(data.from)}–{formatPaymentDate(data.to)}</p>
          </div>
          <div className="billing-operations__controls">
            <label><span>From</span><input type="date" value={draftRange.from} max={draftRange.to} onChange={(event) => setDraftRange((current) => ({ ...current, from: event.target.value }))} /></label>
            <label><span>To</span><input type="date" value={draftRange.to} min={draftRange.from} max={formatIsoDateInAuckland(new Date())} onChange={(event) => setDraftRange((current) => ({ ...current, to: event.target.value }))} /></label>
            <button type="button" className="btn btn--sm" disabled={loading || !draftRange.from || !draftRange.to || draftRange.from > draftRange.to} onClick={() => setRange(draftRange)}>
              {loading ? 'Loading…' : 'Apply'}
            </button>
          </div>
        </header>
        <dl className="billing-operations__financial">
          <div className="is-primary"><dt>Period net received</dt><dd>{formatMoney(financial.netReceived, financial.currency)}</dd><small>Transactions in the selected period, after refunds</small></div>
          <div><dt>Current outstanding</dt><dd>{formatMoney(financial.outstanding, financial.currency)}</dd><small>All open invoices, not a historical balance</small></div>
          <div className={financial.overdue > 0 ? 'has-alert' : ''}><dt>Current overdue</dt><dd>{formatMoney(financial.overdue, financial.currency)}</dd><small>Unpaid balances past their due date</small></div>
          <div><dt>Period refunded</dt><dd>{formatMoney(financial.refunded, financial.currency)}</dd><small>Refund transactions in the selected period</small></div>
        </dl>
      </section>

      <div className="billing-operations__body">
        <section className="billing-alerts" aria-labelledby="billing-alerts-title">
          <header>
            <div><h3 id="billing-alerts-title">Action queue</h3><p>Ordered by the date action is needed.</p></div>
            <b>{data.alerts.length}</b>
          </header>
          {data.alerts.length === 0 ? (
            <div className="billing-alerts__empty"><strong>Nothing needs attention</strong><p>There are no overdue accounts or expiring learning rights.</p></div>
          ) : (
            <div className="billing-alerts__list">
              {[...alertGroups.urgent, ...alertGroups.upcoming].map((alert, index) => (
                <button type="button" key={`${alert.type}-${alert.invoiceId}-${alert.sessionPackageId ?? index}`} onClick={() => onOpenInvoice(alert)}>
                  <span className={`billing-alerts__signal is-${alert.severity}`} aria-hidden="true" />
                  <span className="billing-alerts__person">
                    <strong>{alert.studentName}</strong>
                    <small>{alert.detail}</small>
                  </span>
                  <span className="billing-alerts__meta">
                    <em>{ALERT_LABELS[alert.type]}</em>
                    <small>{alert.actionDate ? formatPaymentDate(alert.actionDate) : 'Review now'}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="course-operations" aria-labelledby="course-operations-title">
          <header><div><h3 id="course-operations-title">Class attribution</h3><p>Period net receipts; current balances and lesson use. Payments and discounts are apportioned by charge amount; transferred remaining lessons count against the destination class.</p></div></header>
          {(unassignedReceived !== 0 || unassignedOutstanding !== 0) && <p className="course-operations__note">Not linked to a class: {formatMoney(unassignedReceived, financial.currency)} period net received · {formatMoney(unassignedOutstanding, financial.currency)} current outstanding. Included in the totals above, not in class rows.</p>}
          {data.courses.length === 0 ? (
            <div className="billing-alerts__empty"><strong>No billed classes yet</strong><p>Class results appear after reviewed invoices are sent.</p></div>
          ) : (
            <div className="course-operations__table-wrap">
              <table className="course-operations__table">
                <thead><tr><th>Class</th><th>Students</th><th>Period net received</th><th>Current outstanding</th><th>Current lesson use</th></tr></thead>
                <tbody>
                  {data.courses.map((course) => {
                    const lessonUse = courseLessonUse(course);
                    return (
                    <tr key={course.courseOfferingId}>
                      <td><strong>{course.courseCode}</strong><small>{course.academicTerm}</small></td>
                      <td>{course.students}</td>
                      <td>{formatMoney(course.netReceived, financial.currency)}</td>
                      <td className={course.outstanding > 0 ? 'has-balance' : ''}>{formatMoney(course.outstanding, financial.currency)}</td>
                      <td><strong>{lessonUse.label}</strong><small>{lessonUse.detail}</small></td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
