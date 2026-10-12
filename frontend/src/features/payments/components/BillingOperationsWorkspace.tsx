import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiMessage } from '../../../lib/apiClient';
import { getBillingOperations } from '../api';
import { formatMoney, formatPaymentDate } from '../format';
import type { OperationsAlert, OperationsDashboard } from '../types';

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

function localDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function currentYearRange() {
  const today = new Date();
  return { from: `${today.getFullYear()}-01-01`, to: localDate(today) };
}

export default function BillingOperationsWorkspace({ refreshToken, onOpenInvoice }: Props) {
  const [data, setData] = useState<OperationsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState(currentYearRange);
  const [draftRange, setDraftRange] = useState(currentYearRange);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getBillingOperations(range));
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { void load(); }, [load, refreshToken]);

  const alertGroups = useMemo(() => {
    if (!data) return { urgent: [] as OperationsAlert[], upcoming: [] as OperationsAlert[] };
    return {
      urgent: data.alerts.filter((alert) => alert.severity === 'high'),
      upcoming: data.alerts.filter((alert) => alert.severity !== 'high')
    };
  }, [data]);

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
            <label><span>To</span><input type="date" value={draftRange.to} min={draftRange.from} max={localDate(new Date())} onChange={(event) => setDraftRange((current) => ({ ...current, to: event.target.value }))} /></label>
            <button type="button" className="btn btn--sm" disabled={loading || !draftRange.from || !draftRange.to || draftRange.from > draftRange.to} onClick={() => setRange(draftRange)}>
              {loading ? 'Loading…' : 'Apply'}
            </button>
          </div>
        </header>
        <dl className="billing-operations__financial">
          <div className="is-primary"><dt>Net received</dt><dd>{formatMoney(financial.netReceived, financial.currency)}</dd><small>After refunds</small></div>
          <div><dt>Outstanding</dt><dd>{formatMoney(financial.outstanding, financial.currency)}</dd><small>Open invoices</small></div>
          <div className={financial.overdue > 0 ? 'has-alert' : ''}><dt>Overdue</dt><dd>{formatMoney(financial.overdue, financial.currency)}</dd><small>Needs follow-up</small></div>
          <div><dt>Refunded</dt><dd>{formatMoney(financial.refunded, financial.currency)}</dd><small>Recorded reversals</small></div>
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
          <header><div><h3 id="course-operations-title">Class performance</h3><p>Revenue stays with the class that sold the access; transferred remaining lessons count against the destination class.</p></div></header>
          {data.courses.length === 0 ? (
            <div className="billing-alerts__empty"><strong>No billed classes yet</strong><p>Class results appear after reviewed invoices are sent.</p></div>
          ) : (
            <div className="course-operations__table-wrap">
              <table className="course-operations__table">
                <thead><tr><th>Class</th><th>Students</th><th>Net received</th><th>Outstanding</th><th>Lesson use</th></tr></thead>
                <tbody>
                  {data.courses.map((course) => (
                    <tr key={course.courseOfferingId}>
                      <td><strong>{course.courseCode}</strong><small>{course.academicTerm}</small></td>
                      <td>{course.students}</td>
                      <td>{formatMoney(course.netReceived, financial.currency)}</td>
                      <td className={course.outstanding > 0 ? 'has-balance' : ''}>{formatMoney(course.outstanding, financial.currency)}</td>
                      <td><strong>{course.utilizationPercent}%</strong><small>{course.usedLessons}/{course.purchasedLessons} lessons</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
