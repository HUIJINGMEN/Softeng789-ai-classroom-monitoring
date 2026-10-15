import { ReportFactCharts } from '../report-review/ReportFactCharts';
import type { ReportSnapshot } from './types';
import '../report-review/report-facts.css';

const rate = (value: number | null) =>
  value === null ? 'Not available' : `${value}%`;
const humanise = (value: string) => value.toLowerCase().replace(/_/g, ' ');

export function ReportStudentInfo({ snapshot }: { snapshot: ReportSnapshot }) {
  return (
    <dl className="report-document__scope report-facts__identity">
      <div>
        <dt>Student number</dt>
        <dd>{snapshot.student.studentNumber}</dd>
      </div>
      <div>
        <dt>Email</dt>
        <dd>{snapshot.student.email}</dd>
      </div>
      <div>
        <dt>Programme</dt>
        <dd>{snapshot.student.programme || 'Not recorded'}</dd>
      </div>
      <div>
        <dt>Level</dt>
        <dd>{humanise(snapshot.student.level)}</dd>
      </div>
    </dl>
  );
}

export function ReportFacts({ snapshot }: { snapshot: ReportSnapshot }) {
  const { attendance } = snapshot;
  return (
    <div className="report-facts">
      <section className="report-facts__section">
        <h2>Student course record</h2>
        <div className="report-facts__course-list">
          {snapshot.courses.map((course) => (
            <article className="report-facts__course" key={course.id}>
              <div>
                <h3>
                  {course.code}
                  {course.name && course.name.trim() !== course.code.trim()
                    ? ` · ${course.name}`
                    : ''}
                </h3>
              </div>
              <dl>
                <div>
                  <dt>Lessons attended</dt>
                  <dd>{course.attendance.present + course.attendance.late}</dd>
                </div>
                <div>
                  <dt>Absences</dt>
                  <dd>{course.attendance.absent}</dd>
                </div>
                <div>
                  <dt>Attendance rate</dt>
                  <dd>{rate(course.attendance.rate)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>
      <section className="report-facts__section">
        <h2>Student attendance</h2>
        <dl className="report-facts__totals">
          <div>
            <dt>Attendance rate</dt>
            <dd>{rate(attendance.rate)}</dd>
          </div>
          <div>
            <dt>Past scheduled lessons</dt>
            <dd>{attendance.completed}</dd>
          </div>
          <div>
            <dt>Lessons attended</dt>
            <dd>{attendance.present + attendance.late}</dd>
          </div>
          <div>
            <dt>Teacher feedback notes</dt>
            <dd>{snapshot.feedbackCount}</dd>
          </div>
        </dl>
        <p className="report-facts__note">
          Only this student's lessons within the report dates and enrolment
          period are counted. Attendance rate = (present + late) ÷ (present +
          late + absent). Unrecorded marks are not absences; future and cancelled
          lessons are excluded.
        </p>
        <ReportFactCharts snapshot={snapshot} />
      </section>
    </div>
  );
}

export function ReportPaymentFacts({
  payments
}: {
  payments: ReportSnapshot['payments'];
}) {
  const money = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-NZ', {
      style: 'currency',
      currency,
      currencyDisplay: 'code'
    }).format(amount);
  return (
    <div className="report-facts__payments">
      <p className="report-facts__note">
        Current balances at report preparation for invoices fully linked to the
        selected courses; not a whole-account statement.
        {payments.invoices.some((invoice) => invoice.awaitingVerification > 0) &&
          ' Pending verification is not money received.'}
      </p>
      {payments.invoices.length === 0 ? (
        <p className="report-facts__empty">
          No issued invoices linked entirely to these courses. This does not
          mean no fees are due.
        </p>
      ) : (
        <div className="report-facts__invoice-list">
          {payments.invoices.map((invoice) => (
            <article key={invoice.number} className="report-facts__invoice">
              <div>
                <h3>{invoice.number}</h3>
                <p>
                  Invoice status: {humanise(invoice.status)} · Due {invoice.due || 'not set'}
                </p>
              </div>
              <dl>
                <div>
                  <dt>Charges</dt>
                  <dd>{money(invoice.charges, invoice.currency)}</dd>
                </div>
                <div>
                  <dt>Credits</dt>
                  <dd>{money(invoice.credits, invoice.currency)}</dd>
                </div>
                <div>
                  <dt>Confirmed receipts</dt>
                  <dd>{money(invoice.received, invoice.currency)}</dd>
                </div>
                <div>
                  <dt>Balance</dt>
                  <dd>{money(invoice.balance, invoice.currency)}</dd>
                </div>
                {invoice.awaitingVerification > 0 && (
                  <div className="report-facts__pending">
                    <dt>Awaiting verification</dt>
                    <dd>
                      {money(invoice.awaitingVerification, invoice.currency)}
                    </dd>
                  </div>
                )}
              </dl>
            </article>
          ))}
        </div>
      )}
      {payments.excludedInvoices > 0 && (
        <p className="report-facts__note">
          {payments.excludedInvoices} other invoice(s) excluded because their
          course links are missing or extend beyond this selection.
        </p>
      )}
    </div>
  );
}
