import type { AccountAdjustmentType, InvoiceDeliveryResult, SessionPackageUsage, StudentInvoice } from './types';
import { moneyMinorUnits, positiveMoney } from './money';

export function adjustmentLimit(invoice: StudentInvoice, type: AccountAdjustmentType): number {
  if (type === 'CREDIT') return invoice.balance;
  return invoice.payments;
}

/** Mirrors the server policy for feedback only; the locked server invoice remains authoritative. */
export function adjustmentAmountError(invoice: StudentInvoice, type: AccountAdjustmentType, value: string): string | null {
  if (!positiveMoney(value)) return 'Enter a positive amount with at most 2 decimal places.';
  if (invoice.status === 'CANCELLED') return 'A cancelled statement cannot be adjusted.';
  const cents = moneyMinorUnits(value)!;
  if (cents > Math.round(adjustmentLimit(invoice, type) * 100)) {
    return type === 'CREDIT'
      ? 'Credit cannot exceed the current amount due. For money already paid, record an external refund instead.'
      : 'Amount exceeds the payment or invoiced charges available for this adjustment.';
  }
  return null;
}

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

export function deliveryConfirmed(status: string): boolean {
  return status === 'SENT' || status === 'DEMO';
}

export function invoiceDeliveryOutcome(result: PromiseSettledResult<InvoiceDeliveryResult>) {
  if (result.status === 'rejected') return { status: 'FAILED' as const, warning: '' };
  return deliveryConfirmed(result.value.status)
    ? { status: result.value.status === 'DEMO' ? 'DEMO' as const : 'SENT' as const, warning: '' }
    : { status: 'UNKNOWN' as const, warning: result.value.message };
}

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

export const ACCOUNT_ADJUSTMENT_COPY: Record<AccountAdjustmentType, { label: string; help: string }> = {
  CREDIT: { label: 'Account credit', help: 'Reduces current unpaid fees only. For money already paid, record an external refund instead.' },
  REFUND: { label: 'Record external refund', help: 'Use only after returning the money through your bank or provider. Returns overpaid funds first; any remaining refund reduces fees.' },
  PAYMENT_REVERSAL: { label: 'Payment reversal', help: 'Corrects a payment entered in error and reopens the balance.' }
};

export function nextServiceDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
