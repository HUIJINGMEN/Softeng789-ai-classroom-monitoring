import { formatPaymentDate, PAYMENT_STATUS_LABELS, paymentStatusClass } from '../format';
import { lessonCreditLabel } from '../lessonReconciliationModel';
import type { StudentInvoice } from '../types';

interface Props {
  readonly invoices: readonly StudentInvoice[];
  readonly mobile?: boolean;
}

export default function StudentLessonCredits({ invoices, mobile = false }: Props) {
  const packages = invoices.flatMap((invoice) => {
    const current = invoice.coursePurchases?.map((purchase) => purchase.sessionPackage).filter(Boolean) ?? [];
    const unique = current.length > 0 ? current : invoice.sessionPackage ? [invoice.sessionPackage] : [];
    return unique.map((sessionPackage) => ({ invoice, sessionPackage: sessionPackage! }));
  }).sort((left, right) => right.sessionPackage.serviceFrom.localeCompare(left.sessionPackage.serviceFrom));

  if (!packages.length) return null;

  return (
    <section className={`student-lesson-credits${mobile ? ' is-mobile' : ''}`} aria-labelledby="student-lessons-title">
      <div className="payment-section-heading">
        <div>
          <h2 id="student-lessons-title">My lessons</h2>
          <p>See which paid lessons were used, missed or moved to a make-up date.</p>
        </div>
        <span>{packages.length} package{packages.length === 1 ? '' : 's'}</span>
      </div>

      <div className="student-lesson-credits__list">
        {packages.map(({ invoice, sessionPackage: item }) => {
          return (
            <article className="student-lesson-package-card" key={item.id}>
              <header>
                <div>
                  <strong>{item.courseCode} · {item.academicTerm}</strong>
                  <span>{formatPaymentDate(item.serviceFrom)} – {formatPaymentDate(item.serviceTo)}</span>
                </div>
                <span className={paymentStatusClass(invoice.status)}>{PAYMENT_STATUS_LABELS[invoice.status]}</span>
              </header>
              <dl>
                <div><dt>Purchased</dt><dd>{item.purchasedSessions}</dd></div>
                <div><dt>Used</dt><dd>{item.usedSessions}</dd></div>
                <div><dt>Make-up available</dt><dd>{item.waivedAbsences}</dd></div>
                <div><dt>Remaining</dt><dd>{item.remainingSessions}</dd></div>
              </dl>
              <div className="student-lesson-package-card__history" role="table" aria-label={`${item.courseCode} lesson history`}>
                {item.sessions.map((session, index) => {
                  const originalDate = session.originalSessionDate ?? session.sessionDate;
                  const attendance = session.attendanceStatus === 'UNKNOWN'
                    ? (session.creditStatus === 'BOOKED' ? 'Upcoming' : 'Not recorded')
                    : session.attendanceStatus.toLowerCase();
                  return (
                    <div role="row" key={session.lessonCreditId ?? `${session.sessionId}-${index}`}>
                      <span role="cell"><strong>{originalDate ? formatPaymentDate(originalDate) : `Lesson ${index + 1}`}</strong><small>{attendance}</small></span>
                      <span role="cell">
                        <strong>{lessonCreditLabel(session.creditStatus, session.makeupSessionDate)}</strong>
                        {session.makeupSessionDate && <small>Make-up for {originalDate ? formatPaymentDate(originalDate) : 'original lesson'}</small>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
