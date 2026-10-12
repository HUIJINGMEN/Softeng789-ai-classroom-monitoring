export type CoursePurchaseMode = 'COURSE_ENROLMENT' | 'LESSON_PACKAGE' | 'MEMBERSHIP' | 'PAY_PER_LESSON';
export type MembershipInterval = 'WEEKLY' | 'MONTHLY' | 'TERM' | 'ANNUAL';
export type PayPerLessonTrigger = 'BOOKING' | 'ATTENDANCE';
export type ClassAbsencePolicy = 'CONSUME_UNEXCUSED' | 'ATTENDANCE_ONLY';

/** Stable class-billing contract shared by API transport and framework-free view models. */
export interface ClassBillingPlan {
  purchaseMode: CoursePurchaseMode;
  defaultPrice: number | null;
  currency: string;
  defaultSessionCount: number | null;
  packageValidityDays: number | null;
  absencePolicy: ClassAbsencePolicy | null;
  membershipInterval: MembershipInterval | null;
  sessionsPerPeriod: number | null;
  payPerLessonTrigger: PayPerLessonTrigger | null;
}
