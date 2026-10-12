import { formatPaymentDate } from '../format';
import type { LearningEntitlement } from '../types';

const STATUS_LABELS: Record<LearningEntitlement['status'], string> = {
  PENDING_PAYMENT: 'Starts when paid',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled'
};

function titleFor(entitlement: LearningEntitlement) {
  if (entitlement.purchaseMode === 'MEMBERSHIP') return 'Membership access';
  if (entitlement.purchaseMode === 'PAY_PER_LESSON') return 'Single lesson';
  if (entitlement.purchaseMode === 'LESSON_PACKAGE') return 'Lesson package';
  return 'Full course enrolment';
}

function coverageFor(entitlement: LearningEntitlement) {
  if (entitlement.classroomSessionDate) return formatPaymentDate(entitlement.classroomSessionDate);
  if (entitlement.validFrom && entitlement.validTo) {
    if (entitlement.validFrom === entitlement.validTo) return formatPaymentDate(entitlement.validFrom);
    return `${formatPaymentDate(entitlement.validFrom)} – ${formatPaymentDate(entitlement.validTo)}`;
  }
  return 'Follows the class timetable';
}

export default function LearningEntitlementSummary({ entitlement, compact = false }: {
  readonly entitlement: LearningEntitlement;
  readonly compact?: boolean;
}) {
  return (
    <section className={`learning-entitlement-summary${compact ? ' is-compact' : ''}`} aria-label="Learning access">
      <div className="learning-entitlement-summary__head">
        <div>
          <span>{titleFor(entitlement)}</span>
          <strong>{entitlement.courseCode} · {entitlement.academicTerm}</strong>
        </div>
        <span className={`learning-entitlement-summary__status is-${entitlement.status.toLowerCase().replace('_', '-')}`}>
          {STATUS_LABELS[entitlement.status]}
        </span>
      </div>
      <dl>
        <div><dt>Coverage</dt><dd>{coverageFor(entitlement)}</dd></div>
        {entitlement.sessionAllowance != null && (
          <div><dt>Included</dt><dd>{entitlement.sessionAllowance} lesson{entitlement.sessionAllowance === 1 ? '' : 's'}</dd></div>
        )}
      </dl>
    </section>
  );
}
