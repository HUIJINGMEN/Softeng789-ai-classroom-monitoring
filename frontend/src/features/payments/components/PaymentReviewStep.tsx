import { formatMoney, formatPaymentDate } from '../format';
import { draftPurchaseSummary } from '../invoiceReviewModel';
import {
  calculateInvoiceDraftTotal,
  recipientSummary,
  studentCountLabel,
  type DraftLine,
  type CoursePurchaseDraft,
  type SelectedStudents
} from '../paymentRequestDraft';

interface Props {
  readonly selected: SelectedStudents;
  readonly title: string;
  readonly dueDate: string;
  readonly note: string;
  readonly lines: readonly DraftLine[];
  readonly coursePurchases: readonly CoursePurchaseDraft[];
}

export default function PaymentReviewStep({ selected, title, dueDate, note, lines, coursePurchases }: Props) {
  const perStudent = calculateInvoiceDraftTotal(lines, coursePurchases);
  const batchTotal = perStudent * selected.size;
  return (
    <section className="payment-create-step payment-create-review">
      <div className="payment-create-step__intro">
        <div>
          <h3>Check the draft details</h3>
          <p>This creates private drafts. You will review each complete invoice and AI message before it is sent.</p>
        </div>
        <span>{studentCountLabel(selected.size)}</span>
      </div>
      <div className="payment-create-review__hero">
        <span>{studentCountLabel(selected.size)}</span>
        <strong>{formatMoney(batchTotal)}</strong>
        <small>{formatMoney(perStudent)} per student × {selected.size} · due {formatPaymentDate(dueDate)}</small>
      </div>
      <dl>
        <div><dt>Title</dt><dd>{title}</dd></div>
        <div><dt>Recipients</dt><dd>{recipientSummary(selected)}</dd></div>
        {note && <div><dt>Note</dt><dd>{note}</dd></div>}
      </dl>
      <div className="payment-create-review__items">
        {coursePurchases.map((purchase) => (
          <div key={purchase.id}>
            <span>{purchase.description}</span>
            <strong>{formatMoney(Number(purchase.amount))}</strong>
          </div>
        ))}
        {lines.map((line) => (
          <div key={line.id}>
            <span>{line.description}</span>
            <strong>{line.type === 'CREDIT' ? '−' : ''}{formatMoney(Number(line.amount))}</strong>
          </div>
        ))}
      </div>
      {coursePurchases.length > 0 && (
        <div className="payment-create-review__courses">
          {coursePurchases.map((course) => {
            const summary = draftPurchaseSummary(course.entitlement, course.billingPlan, course.sessionLabel);
            return (
              <div className="payment-create-review__package" key={course.id}>
                <span>{summary.label}</span>
                <strong>{course.description}</strong>
                <small>{summary.value} · {summary.detail}</small>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
