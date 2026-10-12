import { formatMoney, formatPaymentDate } from '../format';
import { studentInvoicePlanTotal, type StudentInvoicePlan } from '../paymentRequestDraft';

export default function StudentInvoiceBatchReview({
  plans,
  title,
  dueDate,
  note
}: {
  readonly plans: readonly StudentInvoicePlan[];
  readonly title: string;
  readonly dueDate: string;
  readonly note: string;
}) {
  const included = plans.filter((plan) => plan.includeInBatch);
  const total = included.reduce((sum, plan) => sum + studentInvoicePlanTotal(plan), 0);
  return (
    <section className="student-invoice-batch-review">
      <div className="payment-create-step__intro">
        <div><h3>Review the invoice batch</h3><p>One private invoice draft will be created for each student below.</p></div>
        <span className="has-selection">{included.length} invoices</span>
      </div>
      <section className="student-invoice-batch-review__summary">
        <div><span>Batch total</span><strong>{formatMoney(total)}</strong></div>
        <div><span>Invoice title</span><strong>{title}</strong></div>
        <div><span>Due date</span><strong>{formatPaymentDate(dueDate)}</strong></div>
      </section>
      {note && <p className="student-invoice-batch-review__note"><strong>Shared note:</strong> {note}</p>}
      <div className="student-invoice-batch-review__students">
        {included.map((plan) => (
          <article key={plan.studentId}>
            <header>
              <div><strong>{plan.studentName}</strong><span>{plan.studentNumber}</span></div>
              <strong>{formatMoney(studentInvoicePlanTotal(plan))}</strong>
            </header>
            <div>
              {plan.courses.filter((course) => course.included).map((course) => (
                <p key={course.courseOfferingId}><span>{course.invoiceDescription}</span><strong>{formatMoney(Number(course.amount))}</strong></p>
              ))}
              {plan.lines.map((line) => (
                <p key={line.id}><span>{line.description}</span><strong>{line.type === 'CREDIT' ? '−' : ''}{formatMoney(Number(line.amount))}</strong></p>
              ))}
            </div>
          </article>
        ))}
      </div>
      <p className="student-invoice-batch-review__next">Next, you will review each generated invoice and its AI-written student message before anything is sent.</p>
    </section>
  );
}
