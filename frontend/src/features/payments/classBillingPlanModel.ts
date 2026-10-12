import type {
  ClassAbsencePolicy,
  ClassBillingPlan,
  CoursePurchaseMode,
  MembershipInterval,
  PayPerLessonTrigger
} from '../../lib/classBillingPlan';
import type { Session } from '../../types';
import { formatPaymentDate } from './format';

export interface BillingModeOption {
  readonly mode: CoursePurchaseMode;
  readonly title: string;
  readonly description: string;
}

export interface ClassBillingDraft {
  readonly mode: CoursePurchaseMode;
  readonly price: string;
  readonly sessionCount: string;
  readonly validityDays: string;
  readonly absencePolicy: ClassAbsencePolicy;
  readonly membershipInterval: MembershipInterval;
  readonly sessionsPerPeriod: string;
  readonly payTrigger: PayPerLessonTrigger;
}

export interface BillingSummaryFact {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}

export const BILLING_MODES: readonly BillingModeOption[] = [
  {
    mode: 'COURSE_ENROLMENT',
    title: 'One price for the whole course',
    description: 'One payment covers the complete course timetable.'
  },
  {
    mode: 'LESSON_PACKAGE',
    title: 'Buy a number of lessons',
    description: 'Students buy a balance such as 5, 10 or 20 lessons.'
  },
  {
    mode: 'MEMBERSHIP',
    title: 'Pay for a time period',
    description: 'Students pay by week, month, term or year.'
  },
  {
    mode: 'PAY_PER_LESSON',
    title: 'Pay for each lesson',
    description: 'Charge for one specific scheduled lesson at a time.'
  }
];

export const MEMBERSHIP_LABELS: Readonly<Record<MembershipInterval, string>> = {
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  TERM: 'Per term',
  ANNUAL: 'Annual'
};

export const BILLING_SUMMARY_TITLES: Readonly<Record<CoursePurchaseMode, string>> = {
  COURSE_ENROLMENT: 'Whole-course fee',
  LESSON_PACKAGE: 'Lesson package',
  MEMBERSHIP: 'Period membership',
  PAY_PER_LESSON: 'Per-lesson fee'
};

export function createClassBillingDraft(plan: ClassBillingPlan): ClassBillingDraft {
  return {
    mode: plan.purchaseMode,
    price: plan.defaultPrice?.toString() ?? '',
    sessionCount: plan.defaultSessionCount?.toString() ?? '10',
    validityDays: plan.packageValidityDays?.toString() ?? '',
    absencePolicy: plan.absencePolicy ?? 'CONSUME_UNEXCUSED',
    membershipInterval: plan.membershipInterval ?? 'MONTHLY',
    sessionsPerPeriod: plan.sessionsPerPeriod?.toString() ?? '',
    payTrigger: plan.payPerLessonTrigger ?? 'ATTENDANCE'
  };
}

export function isClassBillingDraftValid(draft: ClassBillingDraft) {
  return optionalPositiveNumber(draft.price)
    && (draft.mode !== 'LESSON_PACKAGE' || (
      boundedInteger(draft.sessionCount, 1, 500)
      && optionalBoundedInteger(draft.validityDays, 1, 3650)
    ))
    && (draft.mode !== 'MEMBERSHIP' || optionalBoundedInteger(draft.sessionsPerPeriod, 1, 500));
}

export function toClassBillingPlanUpdate(draft: ClassBillingDraft): Omit<ClassBillingPlan, 'currency'> {
  return {
    purchaseMode: draft.mode,
    defaultPrice: draft.price ? Number(draft.price) : null,
    defaultSessionCount: draft.mode === 'LESSON_PACKAGE' ? Number(draft.sessionCount) : null,
    packageValidityDays: draft.mode === 'LESSON_PACKAGE' && draft.validityDays
      ? Number(draft.validityDays)
      : null,
    absencePolicy: draft.mode === 'LESSON_PACKAGE' ? draft.absencePolicy : null,
    membershipInterval: draft.mode === 'MEMBERSHIP' ? draft.membershipInterval : null,
    sessionsPerPeriod: draft.mode === 'MEMBERSHIP' && draft.sessionsPerPeriod
      ? Number(draft.sessionsPerPeriod)
      : null,
    payPerLessonTrigger: draft.mode === 'PAY_PER_LESSON' ? draft.payTrigger : null
  };
}

export function classScheduleSummary(sessions: readonly Session[]) {
  const available = sessions
    .filter((session) => session.status !== 'Cancelled')
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    count: available.length,
    from: available[0]?.date ?? '',
    to: available[available.length - 1]?.date ?? ''
  };
}

export function classBillingSummaryFacts(
  plan: ClassBillingPlan,
  schedule: ReturnType<typeof classScheduleSummary>
): readonly BillingSummaryFact[] {
  if (plan.purchaseMode === 'LESSON_PACKAGE') {
    return [
      {
        label: 'Package',
        value: plan.defaultSessionCount ? `${plan.defaultSessionCount} lessons` : 'Set per invoice',
        detail: plan.packageValidityDays
          ? `Valid for ${plan.packageValidityDays} days`
          : 'Uses the selected service dates.'
      },
      {
        label: 'Absence rule',
        value: plan.absencePolicy === 'ATTENDANCE_ONLY' ? 'Keep the lesson' : 'Deduct if unexcused',
        detail: plan.absencePolicy === 'ATTENDANCE_ONLY'
          ? 'Only attendance reduces the balance.'
          : 'Approved leave can be waived.'
      }
    ];
  }
  if (plan.purchaseMode === 'MEMBERSHIP') {
    return [
      {
        label: 'Billing period',
        value: MEMBERSHIP_LABELS[plan.membershipInterval ?? 'MONTHLY'],
        detail: 'Access is tied to the selected period.'
      },
      {
        label: 'Lesson allowance',
        value: plan.sessionsPerPeriod ? `${plan.sessionsPerPeriod} per period` : 'Unlimited',
        detail: 'Within the active membership period.'
      }
    ];
  }
  if (plan.purchaseMode === 'PAY_PER_LESSON') {
    return [
      {
        label: 'Purchase',
        value: 'One lesson',
        detail: 'The exact session is selected in the invoice draft.'
      },
      {
        label: 'Charging basis',
        value: plan.payPerLessonTrigger === 'BOOKING' ? 'Booking' : 'Attendance',
        detail: 'Used as the reference for the charge.'
      }
    ];
  }
  const schedulePeriod = schedule.from && schedule.to
    ? `${formatPaymentDate(schedule.from)} – ${formatPaymentDate(schedule.to)}`
    : 'Build the timetable to add course dates.';
  return [
    {
      label: 'Course timetable',
      value: schedule.count > 0
        ? `${schedule.count} scheduled lesson${schedule.count === 1 ? '' : 's'}`
        : 'No lessons scheduled',
      detail: schedulePeriod
    },
    {
      label: 'Student access',
      value: 'Complete course',
      detail: 'No lesson balance to manage.'
    }
  ];
}

function optionalPositiveNumber(value: string) {
  return !value || Number(value) > 0;
}

function boundedInteger(value: string, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum;
}

function optionalBoundedInteger(value: string, minimum: number, maximum: number) {
  return !value || boundedInteger(value, minimum, maximum);
}
