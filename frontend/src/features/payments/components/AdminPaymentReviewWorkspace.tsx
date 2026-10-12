import {
  PAYMENT_REVIEW_QUEUES,
  type PaymentReviewQueue
} from '../admin/adminPaymentWorkspace';
import type { AdminPaymentRow } from '../types';
import AdminFeeRequestsPanel from './AdminFeeRequestsPanel';
import AdminMakeupRequestsPanel from './AdminMakeupRequestsPanel';
import ManualPaymentAdminPanel from './ManualPaymentAdminPanel';

interface Props {
  readonly queue: PaymentReviewQueue;
  readonly focusStudentId: string;
  readonly manualPaymentsRefresh: number;
  readonly onQueueChange: (queue: PaymentReviewQueue) => void;
  readonly onNotice: (message: string) => void;
  readonly onInvoiceCreated: (
    invoice: Pick<AdminPaymentRow, 'invoiceId' | 'studentName' | 'studentNumber'>
  ) => void;
  readonly onManualPaymentReviewed: () => void;
}

export default function AdminPaymentReviewWorkspace({
  queue,
  focusStudentId,
  manualPaymentsRefresh,
  onQueueChange,
  onNotice,
  onInvoiceCreated,
  onManualPaymentReviewed
}: Props) {
  return (
    <section className="payment-review-workspace">
      <header>
        <div>
          <h2>Payment requests &amp; approvals</h2>
          <p>Review lesson credits, fee changes and submitted payment evidence.</p>
        </div>
      </header>
      <nav className="payment-review-queues" aria-label="Approval queues">
        {PAYMENT_REVIEW_QUEUES.map((reviewQueue) => (
          <button
            type="button"
            key={reviewQueue.value}
            className={queue === reviewQueue.value ? 'is-active' : ''}
            aria-pressed={queue === reviewQueue.value}
            onClick={() => onQueueChange(reviewQueue.value)}
          >
            {reviewQueue.label}
          </button>
        ))}
      </nav>

      {queue === 'makeups' && <AdminMakeupRequestsPanel onReviewed={onNotice} />}
      {queue === 'fees' && <AdminFeeRequestsPanel onInvoiceCreated={onInvoiceCreated} />}
      {queue === 'payments' && (
        <ManualPaymentAdminPanel
          refreshToken={manualPaymentsRefresh}
          focusStudentId={focusStudentId}
          onReviewed={onManualPaymentReviewed}
        />
      )}
    </section>
  );
}
