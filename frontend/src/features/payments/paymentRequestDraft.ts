import type {
  AbsenceBillingPolicy,
  ChargeSuggestionPreview,
  CourseChargeSuggestion,
  CoursePurchaseMode,
  CreateInvoicePayload,
  CreateStudentInvoiceBatchPayload,
  LineItemType
} from './types';

export interface DraftBillingPlan {
  sessionsPerPeriod: number | null;
  membershipInterval: string | null;
}

export interface DraftLine {
  id: string;
  description: string;
  type: LineItemType;
  amount: string;
}

export interface LearningEntitlementDraft {
  enabled: boolean;
  courseOfferingId: string;
  purchaseMode: CoursePurchaseMode;
  includedSessions: string;
  validFrom: string;
  validTo: string;
  absencePolicy: AbsenceBillingPolicy;
  classroomSessionId: string;
}

export interface CoursePurchaseDraft {
  id: string;
  description: string;
  amount: string;
  entitlement: LearningEntitlementDraft;
  billingPlan?: DraftBillingPlan;
  sessionLabel?: string;
}

export interface SuggestedCourseDraft extends CourseChargeSuggestion {
  included: boolean;
  amount: string;
  invoiceDescription: string;
}

export interface StudentInvoicePlan {
  studentId: string;
  studentName: string;
  studentNumber: string;
  includeInBatch: boolean;
  courses: SuggestedCourseDraft[];
  lines: DraftLine[];
}

export const EMPTY_LEARNING_ENTITLEMENT: LearningEntitlementDraft = {
  enabled: false,
  courseOfferingId: '',
  purchaseMode: 'COURSE_ENROLMENT',
  includedSessions: '',
  validFrom: '',
  validTo: '',
  absencePolicy: 'CONSUME_UNEXCUSED',
  classroomSessionId: ''
};

export interface PaymentRecipient {
  student: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export type SelectedStudents = Map<string, PaymentRecipient>;

export function selectedStudentLabel(item: PaymentRecipient) {
  return `${item.student.firstName} ${item.student.lastName}`.trim();
}

export function createDraftLine(type: LineItemType = 'CHARGE'): DraftLine {
  return { id: crypto.randomUUID(), description: '', type, amount: '' };
}

export function createCoursePurchaseDraft(
  entitlement: LearningEntitlementDraft = { ...EMPTY_LEARNING_ENTITLEMENT, enabled: true },
  description = '',
  amount = '',
  billingPlan?: DraftBillingPlan
): CoursePurchaseDraft {
  return { id: crypto.randomUUID(), description, amount, entitlement: { ...entitlement, enabled: true }, billingPlan };
}

export function calculateDraftTotal(lines: readonly DraftLine[]) {
  return lines.reduce((total, line) => {
    const amount = Number(line.amount) || 0;
    return total + (line.type === 'CREDIT' ? -amount : amount);
  }, 0);
}

export function calculateInvoiceDraftTotal(
  lines: readonly DraftLine[],
  purchases: readonly CoursePurchaseDraft[] = []
) {
  return calculateDraftTotal(lines) + purchases.reduce((total, purchase) => total + (Number(purchase.amount) || 0), 0);
}

export function studentPlansFromPreview(preview: ChargeSuggestionPreview): StudentInvoicePlan[] {
  return preview.students.map((student) => {
    const courses = student.courses.map((course) => ({
      ...course,
      included: course.selectedByDefault,
      amount: course.defaultPrice?.toString() ?? '',
      invoiceDescription: course.description
    }));
    return {
      studentId: student.studentId,
      studentName: student.studentName,
      studentNumber: student.studentNumber,
      includeInBatch: courses.some((course) => course.included),
      courses,
      lines: []
    };
  });
}

export function studentInvoicePlanTotal(plan: StudentInvoicePlan) {
  const courseTotal = plan.courses
    .filter((course) => course.included)
    .reduce((total, course) => total + (Number(course.amount) || 0), 0);
  return courseTotal + calculateDraftTotal(plan.lines);
}

export function isStudentInvoicePlanValid(plan: StudentInvoicePlan) {
  if (!plan.includeInBatch) return true;
  const includedCourses = plan.courses.filter((course) => course.included);
  return Boolean(
    includedCourses.length + plan.lines.length > 0
    && includedCourses.every((course) => (
      course.status !== 'ALREADY_BILLED'
      && course.status !== 'UNAVAILABLE'
      && course.invoiceDescription.trim()
      && Number(course.amount) > 0
      && (course.purchaseMode !== 'PAY_PER_LESSON' || course.classroomSessionId)
    ))
    && plan.lines.every((line) => line.description.trim() && Number(line.amount) > 0)
    && studentInvoicePlanTotal(plan) > 0
  );
}

export function isStudentInvoiceBatchValid(plans: readonly StudentInvoicePlan[]) {
  const included = plans.filter((plan) => plan.includeInBatch);
  return included.length > 0 && included.every(isStudentInvoicePlanValid);
}

export function toStudentInvoiceBatchPayload(
  plans: readonly StudentInvoicePlan[],
  title: string,
  dueDate: string,
  note: string
): CreateStudentInvoiceBatchPayload {
  return {
    invoices: plans.filter((plan) => plan.includeInBatch).map((plan) => ({
      studentId: plan.studentId,
      title: title.trim(),
      dueDate,
      ...(note.trim() ? { note: note.trim() } : {}),
      lineItems: plan.lines.map((line) => ({
        description: line.description.trim(),
        type: line.type,
        amount: Number(line.amount)
      })),
      coursePurchases: plan.courses.filter((course) => course.included).map((course) => ({
        description: course.invoiceDescription.trim(),
        amount: Number(course.amount),
        entitlement: {
          courseOfferingId: course.courseOfferingId,
          purchaseMode: course.purchaseMode,
          ...(course.validFrom ? { validFrom: course.validFrom } : {}),
          ...(course.validTo ? { validTo: course.validTo } : {}),
          ...(course.purchaseMode === 'LESSON_PACKAGE'
            ? {
                includedSessions: course.includedSessions ?? undefined,
                absencePolicy: course.absencePolicy ?? 'CONSUME_UNEXCUSED'
              }
            : {}),
          ...(course.classroomSessionId ? { classroomSessionId: course.classroomSessionId } : {})
        }
      }))
    }))
  };
}

export function isPaymentDraftValid(
  title: string,
  dueDate: string,
  lines: readonly DraftLine[],
  purchases: readonly CoursePurchaseDraft[] = []
) {
  return Boolean(
    title.trim()
    && dueDate
    && lines.length + purchases.length > 0
    && calculateInvoiceDraftTotal(lines, purchases) > 0
    && lines.every((line) => line.description.trim() && Number(line.amount) > 0)
    && purchases.every((purchase) => (
      purchase.description.trim()
      && Number(purchase.amount) > 0
      && isLearningEntitlementValid(purchase.entitlement)
    ))
  );
}

export function isLearningEntitlementValid(entitlement: LearningEntitlementDraft) {
  if (!entitlement.enabled) return true;
  if (!entitlement.courseOfferingId) return false;
  if (entitlement.purchaseMode === 'COURSE_ENROLMENT') return true;
  if (entitlement.purchaseMode === 'PAY_PER_LESSON') return Boolean(entitlement.classroomSessionId);
  if (!entitlement.validFrom || !entitlement.validTo || entitlement.validTo < entitlement.validFrom) return false;
  if (entitlement.purchaseMode === 'MEMBERSHIP') return true;
  const included = Number(entitlement.includedSessions);
  return Number.isInteger(included) && included > 0 && included <= 500;
}

export function toCreateInvoicePayload(
  selected: SelectedStudents,
  title: string,
  dueDate: string,
  note: string,
  lines: readonly DraftLine[],
  purchasesOrEntitlement: CoursePurchaseDraft[] | LearningEntitlementDraft = []
): CreateInvoicePayload {
  const payload: CreateInvoicePayload = {
    studentIds: [...selected.keys()],
    title: title.trim(),
    dueDate,
    note: note.trim() || undefined,
    lineItems: lines.map((line) => ({
      description: line.description.trim(),
      type: line.type,
      amount: Number(line.amount)
    }))
  };
  const entitlementPayload = (entitlement: LearningEntitlementDraft) => ({
    courseOfferingId: entitlement.courseOfferingId,
    purchaseMode: entitlement.purchaseMode,
    ...(entitlement.validFrom ? { validFrom: entitlement.validFrom } : {}),
    ...(entitlement.validTo ? { validTo: entitlement.validTo } : {}),
    ...(entitlement.purchaseMode === 'LESSON_PACKAGE'
      ? { includedSessions: Number(entitlement.includedSessions), absencePolicy: entitlement.absencePolicy }
      : {}),
    ...(entitlement.classroomSessionId ? { classroomSessionId: entitlement.classroomSessionId } : {})
  });
  if (Array.isArray(purchasesOrEntitlement)) {
    if (purchasesOrEntitlement.length > 0) {
      payload.coursePurchases = purchasesOrEntitlement.map((purchase) => ({
        description: purchase.description.trim(),
        amount: Number(purchase.amount),
        entitlement: entitlementPayload(purchase.entitlement)
      }));
    }
  } else if (purchasesOrEntitlement.enabled) {
    payload.entitlement = entitlementPayload(purchasesOrEntitlement);
  }
  return payload;
}

export function studentCountLabel(count: number) {
  return `${count} student${count === 1 ? '' : 's'}`;
}

export function recipientSummary(selected: SelectedStudents) {
  const names = [...selected.values()].map(selectedStudentLabel);
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
}
