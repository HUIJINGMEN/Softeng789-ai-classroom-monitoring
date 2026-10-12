import { formatMoney, formatPaymentDate } from '../format';
import { formatIsoDateInAuckland } from '../../../lib/sessionTime';
import {
  isStudentInvoicePlanValid,
  studentInvoicePlanTotal,
  type StudentInvoicePlan,
  type SuggestedCourseDraft
} from '../paymentRequestDraft';
import type { ChargeSuggestionStatus, CoursePurchaseMode } from '../types';
import PaymentLineItemsEditor from './PaymentLineItemsEditor';

interface Props {
  readonly title: string;
  readonly dueDate: string;
  readonly note: string;
  readonly plans: StudentInvoicePlan[];
  readonly onTitle: (value: string) => void;
  readonly onDueDate: (value: string) => void;
  readonly onNote: (value: string) => void;
  readonly onPlans: (plans: StudentInvoicePlan[]) => void;
}

const STATUS_COPY: Record<ChargeSuggestionStatus, { label: string; tone: string }> = {
  READY: { label: 'Ready to invoice', tone: 'ready' },
  NEEDS_PRICE: { label: 'Price required', tone: 'attention' },
  OPTIONAL_RENEWAL: { label: 'Optional renewal', tone: 'optional' },
  ALREADY_BILLED: { label: 'Already invoiced', tone: 'muted' },
  UNAVAILABLE: { label: 'Not available', tone: 'muted' }
};

const MODE_COPY: Record<CoursePurchaseMode, string> = {
  COURSE_ENROLMENT: 'Full course',
  LESSON_PACKAGE: 'Lesson package',
  MEMBERSHIP: 'Membership',
  PAY_PER_LESSON: 'Per lesson'
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-NZ', {
    hour: 'numeric', minute: '2-digit', timeZone: 'Pacific/Auckland'
  }).format(new Date(value));
}

function sessionLabel(session: SuggestedCourseDraft['availableSessions'][number]) {
  return `${formatPaymentDate(session.date)} · ${formatTime(session.startTime)}–${formatTime(session.endTime)}`;
}

function coverage(course: SuggestedCourseDraft) {
  if (course.purchaseMode === 'PAY_PER_LESSON') {
    const selected = course.availableSessions.find((session) => session.id === course.classroomSessionId);
    return selected ? sessionLabel(selected) : 'Choose a scheduled lesson';
  }
  if (course.purchaseMode === 'LESSON_PACKAGE') {
    return `${course.includedSessions ?? '—'} lessons · ${course.validFrom && course.validTo
      ? `${formatPaymentDate(course.validFrom)}–${formatPaymentDate(course.validTo)}`
      : 'validity not configured'}`;
  }
  if (course.purchaseMode === 'MEMBERSHIP') {
    return course.validFrom && course.validTo
      ? `${formatPaymentDate(course.validFrom)}–${formatPaymentDate(course.validTo)}`
      : 'Membership period unavailable';
  }
  return 'Complete class timetable';
}

export default function StudentChargePlanStep({
  title,
  dueDate,
  note,
  plans,
  onTitle,
  onDueDate,
  onNote,
  onPlans
}: Props) {
  const includedPlans = plans.filter((plan) => plan.includeInBatch);
  const batchTotal = includedPlans.reduce((sum, plan) => sum + studentInvoicePlanTotal(plan), 0);
  const attentionCount = includedPlans.filter((plan) => !isStudentInvoicePlanValid(plan)).length;

  const updatePlan = (studentId: string, update: (plan: StudentInvoicePlan) => StudentInvoicePlan) => {
    onPlans(plans.map((plan) => (plan.studentId === studentId ? update(plan) : plan)));
  };
  const updateCourse = (studentId: string, courseOfferingId: string, patch: Partial<SuggestedCourseDraft>) => {
    updatePlan(studentId, (plan) => ({
      ...plan,
      courses: plan.courses.map((course) => (
        course.courseOfferingId === courseOfferingId ? { ...course, ...patch } : course
      ))
    }));
  };

  return (
    <section className="student-charge-planner">
      <div className="payment-create-step__intro">
        <div>
          <h3>Confirm what each student is buying</h3>
          <p>Every student receives one invoice. Courses remain separate line items with their own access and attendance rules.</p>
        </div>
        <span className={attentionCount > 0 ? 'has-attention' : 'has-selection'}>
          {attentionCount > 0 ? `${attentionCount} need attention` : formatMoney(batchTotal)}
        </span>
      </div>

      <section className="student-charge-planner__invoice-settings" aria-label="Shared invoice details">
        <label className="field">
          <span>Invoice title <small>Required</small></span>
          <input required maxLength={160} value={title} onChange={(event) => onTitle(event.target.value)} placeholder="e.g. 2026 course fees" />
        </label>
        <label className="field">
          <span>Due date <small>Required</small></span>
          <input required type="date" min={formatIsoDateInAuckland(new Date())} value={dueDate} onChange={(event) => onDueDate(event.target.value)} />
        </label>
        <label className="field student-charge-planner__note">
          <span>Shared note <small>Optional</small></span>
          <input maxLength={2000} value={note} onChange={(event) => onNote(event.target.value)} placeholder="Context that applies to every student" />
        </label>
      </section>

      <div className="student-charge-planner__summary" role="status">
        <span>{includedPlans.length} of {plans.length} students included</span>
        <strong>{formatMoney(batchTotal)} batch total</strong>
      </div>

      <div className="student-charge-planner__students">
        {plans.map((plan, index) => {
          const selectedCourses = plan.courses.filter((course) => course.included).length;
          const valid = isStudentInvoicePlanValid(plan);
          const selectableCourses = plan.courses.filter((course) => !['ALREADY_BILLED', 'UNAVAILABLE'].includes(course.status));
          const unbilledCourses = plan.courses.filter((course) => ['READY', 'NEEDS_PRICE'].includes(course.status));
          const selectedUnbilledCourses = unbilledCourses.filter((course) => course.included).length;
          return (
            <article className={`student-charge-card${plan.includeInBatch ? ' is-included' : ' is-excluded'}${!valid ? ' has-error' : ''}`} key={plan.studentId}>
              <header>
                <label className="student-charge-card__student">
                  <input
                    type="checkbox"
                    checked={plan.includeInBatch}
                    disabled={selectableCourses.length === 0 && plan.lines.length === 0}
                    onChange={(event) => updatePlan(plan.studentId, (current) => ({ ...current, includeInBatch: event.target.checked }))}
                  />
                  <span><strong>{plan.studentName}</strong><small>{plan.studentNumber}</small></span>
                </label>
                <div className="student-charge-card__total">
                  <strong>{formatMoney(studentInvoicePlanTotal(plan))}</strong>
                  <span>{plan.includeInBatch ? `${selectedCourses} course${selectedCourses === 1 ? '' : 's'} included` : 'Not in this batch'}</span>
                </div>
              </header>

              <details open={plans.length === 1 || !valid || index === 0}>
                <summary>
                  <span>Course charge details</span>
                  <span>{plan.courses.length} enrolled course{plan.courses.length === 1 ? '' : 's'}</span>
                </summary>
                {plan.courses.length === 0 ? (
                  <div className="student-charge-card__empty">No active course enrolments were found for this student.</div>
                ) : (
                  <div className="student-course-charges">
                    {unbilledCourses.length > selectedUnbilledCourses && (
                      <div className="student-course-charges__bulk">
                        <span>{unbilledCourses.length - selectedUnbilledCourses} other unpaid course{unbilledCourses.length - selectedUnbilledCourses === 1 ? '' : 's'} available</span>
                        <button
                          type="button"
                          className="btn btn--quiet btn--sm"
                          onClick={() => updatePlan(plan.studentId, (current) => ({
                            ...current,
                            includeInBatch: true,
                            courses: current.courses.map((course) => (
                              ['READY', 'NEEDS_PRICE'].includes(course.status)
                                ? { ...course, included: true } : course
                            ))
                          }))}
                        >
                          Include all unpaid courses
                        </button>
                      </div>
                    )}
                    {plan.courses.map((course) => {
                      const locked = course.status === 'ALREADY_BILLED' || course.status === 'UNAVAILABLE';
                      const status = STATUS_COPY[course.status];
                      return (
                        <section className={`student-course-charge is-${status.tone}${course.included ? ' is-selected' : ''}`} key={course.courseOfferingId}>
                          <div className="student-course-charge__main">
                            <label className="student-course-charge__select">
                              <input
                                type="checkbox"
                                checked={course.included}
                                disabled={locked || !plan.includeInBatch}
                                onChange={(event) => updateCourse(plan.studentId, course.courseOfferingId, { included: event.target.checked })}
                              />
                              <span>
                                <strong>{course.courseCode} · {course.academicTerm}</strong>
                                <small>{MODE_COPY[course.purchaseMode]} · {coverage(course)}</small>
                              </span>
                            </label>
                            <div className="student-course-charge__status">
                              {course.preferredCourse && <span className="is-current">Current course</span>}
                              <span className={`is-${status.tone}`}>{status.label}</span>
                            </div>
                          </div>
                          <p>{course.statusDetail}</p>
                          {course.included && !locked && (
                            <div className="student-course-charge__controls">
                              {course.purchaseMode === 'PAY_PER_LESSON' && (
                                <label className="field">
                                  <span>Scheduled lesson</span>
                                  <select
                                    value={course.classroomSessionId ?? ''}
                                    onChange={(event) => {
                                      const selected = course.availableSessions.find((session) => session.id === event.target.value);
                                      updateCourse(plan.studentId, course.courseOfferingId, {
                                        classroomSessionId: selected?.id ?? null,
                                        classroomSessionDate: selected?.date ?? null,
                                        classroomSessionStartTime: selected?.startTime ?? null,
                                        classroomSessionEndTime: selected?.endTime ?? null,
                                        validFrom: selected?.date ?? null,
                                        validTo: selected?.date ?? null
                                      });
                                    }}
                                  >
                                    <option value="">Choose a lesson</option>
                                    {course.availableSessions.map((session) => <option value={session.id} key={session.id}>{sessionLabel(session)}</option>)}
                                  </select>
                                </label>
                              )}
                              <label className="field student-course-charge__description">
                                <span>Invoice description</span>
                                <input maxLength={180} value={course.invoiceDescription} onChange={(event) => updateCourse(plan.studentId, course.courseOfferingId, { invoiceDescription: event.target.value })} />
                              </label>
                              <label className="field student-course-charge__price">
                                <span>Price (NZD)</span>
                                <input type="number" min="0.01" step="0.01" inputMode="decimal" value={course.amount} onChange={(event) => updateCourse(plan.studentId, course.courseOfferingId, { amount: event.target.value })} placeholder="0.00" />
                              </label>
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>
                )}
                <details className="student-charge-card__adjustments">
                  <summary>Fees, credits or scholarships</summary>
                  <PaymentLineItemsEditor
                    lines={plan.lines}
                    allowEmpty
                    invoiceTotal={studentInvoicePlanTotal(plan)}
                    onChange={(lines) => updatePlan(plan.studentId, (current) => ({ ...current, lines }))}
                  />
                </details>
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}
