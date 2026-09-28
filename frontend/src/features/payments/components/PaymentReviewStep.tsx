import { formatMoney, formatPaymentDate } from '../format';
import {
  calculateDraftTotal,
  recipientSummary,
  studentCountLabel,
  type DraftLine,
  type SelectedStudents
} from '../paymentRequestDraft';

interface Props {
  readonly selected: SelectedStudents;
  readonly title: string;
  readonly dueDate: string;
  readonly note: string;
  readonly lines: readonly DraftLine[];
}

export default function PaymentReviewStep({ selected, title, dueDate, note, lines }: Props) {
  return (
    <section className="payment-create-step payment-create-review">
      <div className="payment-create-step__intro">
        <div>
          <h3>Review before issuing</h3>
          <p>Check the recipients, amount and due date before sending.</p>
        </div>
        <span>{studentCountLabel(selected.size)}</span>
      </div>
      <div className="payment-create-review__hero">
        <span>{studentCountLabel(selected.size)}</span>
        <strong>{formatMoney(calculateDraftTotal(lines))}</strong>
        <small>per student · due {formatPaymentDate(dueDate)}</small>
      </div>
      <dl>
        <div><dt>Title</dt><dd>{title}</dd></div>
        <div><dt>Recipients</dt><dd>{recipientSummary(selected)}</dd></div>
        {note && <div><dt>Note</dt><dd>{note}</dd></div>}
      </dl>
      <div className="payment-create-review__items">
        {lines.map((line) => (
          <div key={line.id}>
            <span>{line.description}</span>
            <strong>{line.type === 'CREDIT' ? '−' : ''}{formatMoney(Number(line.amount))}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
