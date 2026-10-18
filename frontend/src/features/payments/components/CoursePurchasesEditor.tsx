import { IconPlus, IconX } from '../../../components/icons';
import type { ClassApiResponse, ClassBillingPlan } from '../../../lib/classAdminApi';
import { createCoursePurchaseDraft, type CoursePurchaseDraft } from '../paymentRequestDraft';
import CourseAccessEditor from './CourseAccessEditor';
import InvoiceAmountInput from './InvoiceAmountInput';

interface Props {
  readonly purchases: CoursePurchaseDraft[];
  readonly onChange: (purchases: CoursePurchaseDraft[]) => void;
  readonly fixedCourseOfferingId?: string;
  readonly fixedCourseLabel?: string;
  readonly fixedBillingPlan?: ClassBillingPlan;
  readonly sessionOptions: readonly { id: string; label: string; date: string }[];
}

function purchaseLabel(plan: ClassBillingPlan) {
  if (plan.purchaseMode === 'LESSON_PACKAGE') return 'lesson package';
  if (plan.purchaseMode === 'MEMBERSHIP') return 'membership';
  if (plan.purchaseMode === 'PAY_PER_LESSON') return 'lesson fee';
  return 'course enrolment';
}

export default function CoursePurchasesEditor({
  purchases,
  onChange,
  fixedCourseOfferingId,
  fixedCourseLabel,
  fixedBillingPlan,
  sessionOptions
}: Props) {
  const selectedIds = purchases.map((purchase) => purchase.entitlement.courseOfferingId).filter(Boolean);
  const update = (id: string, patch: Partial<CoursePurchaseDraft>) => {
    onChange(purchases.map((purchase) => (purchase.id === id ? { ...purchase, ...patch } : purchase)));
  };
  const applyClassDefaults = (
    purchase: CoursePurchaseDraft,
    klass: ClassApiResponse,
    entitlement: CoursePurchaseDraft['entitlement']
  ) => {
    const label = `${klass.courseCode} · ${klass.academicTerm} ${purchaseLabel(klass.billingPlan)}`;
    update(purchase.id, {
      entitlement,
      billingPlan: klass.billingPlan,
      sessionLabel: undefined,
      description: purchase.description.trim() ? purchase.description : label,
      amount: purchase.amount || klass.billingPlan.defaultPrice?.toString() || ''
    });
  };

  return (
    <section className="course-purchases-editor" aria-labelledby="course-purchases-title">
      <div className="course-purchases-editor__heading">
        <div>
          <strong id="course-purchases-title">Courses on this invoice</strong>
          <small>Each course keeps its own access, lesson balance and attendance record. Every recipient must be enrolled in every selected course.</small>
        </div>
        <span>{purchases.length} course{purchases.length === 1 ? '' : 's'}</span>
      </div>

      {purchases.length === 0 && (
        <div className="course-purchases-editor__empty">
          <strong>No course added yet</strong>
          <p>Add a course purchase, or use additional items below for a fee that does not grant course access.</p>
        </div>
      )}

      {purchases.map((purchase, index) => {
        const fixed = index === 0 && Boolean(fixedCourseOfferingId);
        return (
          <article className="course-purchase-card" key={purchase.id}>
            <header>
              <div><span>Course purchase {index + 1}</span><strong>{purchase.description || 'Untitled course charge'}</strong></div>
              {!fixed && (
                <button type="button" className="course-purchase-card__remove" onClick={() => onChange(purchases.filter((item) => item.id !== purchase.id))} aria-label={`Remove course purchase ${index + 1}`}>
                  <IconX />
                </button>
              )}
            </header>
            <div className="course-purchase-card__charge">
              <label className="field">
                <span>Invoice description <small>Required</small></span>
                <input value={purchase.description} maxLength={180} onChange={(event) => update(purchase.id, { description: event.target.value })} placeholder="e.g. Ballet full course" />
              </label>
              <label className="field">
                <span>Price (NZD) <small>Required</small></span>
                <InvoiceAmountInput value={purchase.amount} onChange={amount => update(purchase.id, {amount})} />
              </label>
            </div>
            <details className="course-purchase-card__access" open={!purchase.entitlement.courseOfferingId || purchase.entitlement.purchaseMode === 'PAY_PER_LESSON'}>
              <summary>
                <span><strong>Course access terms</strong><small>Purchase type, lesson coverage and validity</small></span>
                <span className="course-purchase-card__access-action">Review</span>
              </summary>
              <CourseAccessEditor
                value={purchase.entitlement}
                onChange={(entitlement) => update(purchase.id, { entitlement })}
                fixedCourseOfferingId={fixed ? fixedCourseOfferingId : undefined}
                fixedCourseLabel={fixed ? fixedCourseLabel : undefined}
                fixedBillingPlan={fixed ? fixedBillingPlan : purchase.billingPlan}
                sessionOptions={fixed ? sessionOptions : []}
                allowDisable={false}
                excludedCourseOfferingIds={selectedIds}
                onSessionLabelChange={(sessionLabel) => update(purchase.id, { sessionLabel })}
                onClassSelected={(klass, entitlement) => applyClassDefaults(purchase, klass, entitlement)}
              />
            </details>
          </article>
        );
      })}

      <button type="button" className="btn btn--with-icon btn--sm course-purchases-editor__add" disabled={purchases.length >= 20} onClick={() => onChange([...purchases, createCoursePurchaseDraft()])}>
        <IconPlus /> Add another course <span>(optional)</span>
      </button>
    </section>
  );
}
