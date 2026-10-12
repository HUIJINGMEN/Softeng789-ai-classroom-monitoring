import type { ClassBillingPlan } from '../../../lib/classAdminApi';
import { formatIsoDateInAuckland } from '../../../lib/sessionTime';
import { formatMoney } from '../format';
import {
  calculateInvoiceDraftTotal,
  isLearningEntitlementValid,
  type CoursePurchaseDraft,
  type DraftLine,
} from '../paymentRequestDraft';
import CoursePurchasesEditor from './CoursePurchasesEditor';
import PaymentLineItemsEditor from './PaymentLineItemsEditor';

interface Props {
  readonly title: string;
  readonly dueDate: string;
  readonly note: string;
  readonly lines: DraftLine[];
  readonly coursePurchases: CoursePurchaseDraft[];
  readonly onTitle: (value: string) => void;
  readonly onDueDate: (value: string) => void;
  readonly onNote: (value: string) => void;
  readonly onLines: (value: DraftLine[]) => void;
  readonly onCoursePurchases: (value: CoursePurchaseDraft[]) => void;
  readonly fixedCourseOfferingId?: string;
  readonly fixedCourseLabel?: string;
  readonly fixedBillingPlan?: ClassBillingPlan;
  readonly sessionOptions: readonly { id: string; label: string; date: string }[];
}

export default function PaymentDetailsStep({
  title,
  dueDate,
  note,
  lines,
  coursePurchases,
  onTitle,
  onDueDate,
  onNote,
  onLines,
  onCoursePurchases,
  fixedCourseOfferingId,
  fixedCourseLabel,
  fixedBillingPlan,
  sessionOptions
}: Props) {
  const total = calculateInvoiceDraftTotal(lines, coursePurchases);
  const missing = missingRequirements(title, dueDate, lines, coursePurchases);

  return (
    <section className="payment-create-step">
      <div className="payment-create-step__intro">
        <div>
          <h3>Build the invoice draft</h3>
          <p>Add a clear title, due date and the items that make up this payment.</p>
        </div>
        <span className={total > 0 ? 'has-selection' : ''}>{formatMoney(total)}</span>
      </div>
      <div className="payment-create-fields">
        <label className="field">
          <span>Invoice title <small>Required</small></span>
          <input
            required
            value={title}
            maxLength={160}
            onChange={(event) => onTitle(event.target.value)}
            placeholder="e.g. 2026 Semester Two fees"
          />
        </label>
        <label className="field">
          <span>Due date <small>Required</small></span>
          <input
            required
            type="date"
            value={dueDate}
            min={formatIsoDateInAuckland(new Date())}
            onChange={(event) => onDueDate(event.target.value)}
          />
        </label>
      </div>
      <CoursePurchasesEditor
        purchases={coursePurchases}
        onChange={onCoursePurchases}
        fixedCourseOfferingId={fixedCourseOfferingId}
        fixedCourseLabel={fixedCourseLabel}
        fixedBillingPlan={fixedBillingPlan}
        sessionOptions={sessionOptions}
      />
      <PaymentLineItemsEditor lines={lines} onChange={onLines} allowEmpty invoiceTotal={total} />
      <label className="field">
        <span>Note <small>Optional</small></span>
        <textarea
          value={note}
          maxLength={2000}
          onChange={(event) => onNote(event.target.value)}
          placeholder="Add context students may need."
          rows={3}
        />
      </label>
      {missing.length > 0 && (
        <p className="payment-details-requirements" role="status">
          <strong>Before you continue:</strong> Add {missing.join(', ')}.
        </p>
      )}
    </section>
  );
}

function missingRequirements(
  title: string,
  dueDate: string,
  lines: readonly DraftLine[],
  coursePurchases: readonly CoursePurchaseDraft[]
) {
  const missing: string[] = [];
  const total = calculateInvoiceDraftTotal(lines, coursePurchases);
  if (!title.trim()) missing.push('invoice title');
  if (!dueDate) missing.push('due date');
  if (lines.length + coursePurchases.length === 0) missing.push('a course or additional item');
  if (lines.some((line) => !line.description.trim())) missing.push('item description');
  if (lines.some((line) => !Number.isFinite(Number(line.amount)) || Number(line.amount) <= 0)) {
    missing.push('item amount');
  }
  if (total <= 0 && lines.every((line) => Number(line.amount) > 0)) {
    missing.push('a positive statement total');
  }
  coursePurchases.forEach((purchase, index) => {
    const label = coursePurchases.length > 1 ? `course ${index + 1}` : 'course';
    if (!purchase.description.trim()) missing.push(`${label} description`);
    if (!Number.isFinite(Number(purchase.amount)) || Number(purchase.amount) <= 0) missing.push(`${label} price`);
    if (!purchase.entitlement.courseOfferingId) missing.push(`${label} class`);
    else if (!isLearningEntitlementValid(purchase.entitlement)) missing.push(`${label} access terms`);
  });
  return missing;
}
