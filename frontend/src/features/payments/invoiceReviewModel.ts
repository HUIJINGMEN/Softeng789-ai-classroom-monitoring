import type { SessionPackageUsage, StudentInvoice } from './types';

export function invoiceSessionPackages(invoice: StudentInvoice | null): SessionPackageUsage[] {
  if (!invoice) return [];
  const packages = invoice.coursePurchases?.map((purchase) => purchase.sessionPackage)
    .filter((item): item is SessionPackageUsage => item != null) ?? [];
  if (packages.length > 0) return packages;
  return invoice.sessionPackage ? [invoice.sessionPackage] : [];
}

export interface InvoiceMessageState {
  readonly status: string;
  readonly messageReviewedAt: string | null;
  readonly lastEmailedAt: string | null;
  readonly messageDraftSavedAt?: string | null;
}

const MESSAGE_REVIEW_STATUSES = new Set(['DRAFT', 'PENDING', 'PARTIALLY_PAID', 'OVERDUE']);

/**
 * A creation-time note is source material, not proof that an administrator has
 * reviewed the student-facing message. Legacy invoices may already have been
 * emailed without the newer review timestamp, so the delivery timestamp is the
 * only safe fallback for treating their saved message as final.
 */
export function shouldPrepareAiMessage(invoice: InvoiceMessageState): boolean {
  return MESSAGE_REVIEW_STATUSES.has(invoice.status)
    && !invoice.messageReviewedAt
    && !invoice.messageDraftSavedAt
    && !invoice.lastEmailedAt;
}

export function draftPurchaseSummary(
  entitlement: {
    purchaseMode: 'COURSE_ENROLMENT' | 'LESSON_PACKAGE' | 'MEMBERSHIP' | 'PAY_PER_LESSON';
    includedSessions: string;
    validFrom: string;
    validTo: string;
  },
  billingPlan?: { sessionsPerPeriod: number | null },
  sessionLabel?: string
) {
  if (entitlement.purchaseMode === 'LESSON_PACKAGE') {
    return {
      label: 'Lesson package',
      value: `${entitlement.includedSessions} lessons`,
      detail: `${entitlement.validFrom} – ${entitlement.validTo}`
    };
  }
  if (entitlement.purchaseMode === 'MEMBERSHIP') {
    return {
      label: 'Membership access',
      value: billingPlan?.sessionsPerPeriod ? `${billingPlan.sessionsPerPeriod} lessons per period` : 'Unlimited access',
      detail: `${entitlement.validFrom} – ${entitlement.validTo}`
    };
  }
  if (entitlement.purchaseMode === 'PAY_PER_LESSON') {
    return {
      label: 'Single lesson charge',
      value: sessionLabel || 'Scheduled lesson selected',
      detail: 'No prepaid lesson balance'
    };
  }
  return {
    label: 'Full course enrolment',
    value: 'Complete scheduled course',
    detail: 'Coverage follows the class timetable'
  };
}
