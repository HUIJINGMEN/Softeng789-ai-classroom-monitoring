import type { CoursePurchase, LearningEntitlement, SessionPackageUsage } from '../types';
import LearningEntitlementSummary from './LearningEntitlementSummary';

interface Props {
  readonly purchases?: readonly CoursePurchase[];
  readonly legacyEntitlement?: LearningEntitlement | null;
  readonly legacySessionPackage?: SessionPackageUsage | null;
  readonly compact?: boolean;
}

function PackageSummary({ item, compact }: { readonly item: SessionPackageUsage; readonly compact: boolean }) {
  return (
    <section className={`invoice-course-package${compact ? ' is-compact' : ''}`} aria-label={`${item.courseCode} lesson package`}>
      <div className="invoice-course-package__head">
        <div><span>Lesson package</span><strong>{item.courseCode} · {item.academicTerm}</strong></div>
        <span>{item.status === 'PAUSED' ? 'Paused' : `${item.remainingSessions} remaining`}</span>
      </div>
      <dl>
        <div><dt>Purchased</dt><dd>{item.purchasedSessions}</dd></div>
        <div><dt>Attended</dt><dd>{item.attendedSessions}</dd></div>
        {!compact && <div><dt>Counted absent</dt><dd>{item.chargeableAbsences}</dd></div>}
        <div className="is-primary"><dt>Remaining</dt><dd>{item.remainingSessions}</dd></div>
      </dl>
      {!compact && item.unrecordedSessions > 0 && <p>{item.unrecordedSessions} lesson{item.unrecordedSessions === 1 ? '' : 's'} still awaiting attendance.</p>}
    </section>
  );
}

export default function InvoiceCoursePurchasesSummary({
  purchases = [],
  legacyEntitlement,
  legacySessionPackage,
  compact = false
}: Props) {
  if (purchases.length === 0) {
    if (legacySessionPackage) return <PackageSummary item={legacySessionPackage} compact={compact} />;
    if (legacyEntitlement) return <LearningEntitlementSummary entitlement={legacyEntitlement} compact={compact} />;
    return null;
  }

  return (
    <div className={`invoice-course-purchases${compact ? ' is-compact' : ''}`}>
      {purchases.map((purchase) => purchase.sessionPackage
        ? <PackageSummary key={purchase.entitlement.id} item={purchase.sessionPackage} compact={compact} />
        : <LearningEntitlementSummary key={purchase.entitlement.id} entitlement={purchase.entitlement} compact={compact} />)}
    </div>
  );
}
