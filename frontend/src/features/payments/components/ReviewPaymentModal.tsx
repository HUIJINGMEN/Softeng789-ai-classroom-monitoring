import Modal from '../../../components/Modal';
import { reviewMoney, reviewSubmittedTime } from '../manualPaymentReviewModel';
import type { ManualPaymentSubmission } from '../types';
import PaymentReceiptPreview from './PaymentReceiptPreview';
import { useManualPaymentReview } from '../useManualPaymentReview';
import '../payment-receipt-preview.css';

interface Props {
  readonly payment: ManualPaymentSubmission;
  readonly onClose: () => void;
  readonly onReviewed: () => void;
}

export default function ReviewPaymentModal({ payment, onClose, onReviewed }: Props) {
  const {
    note,
    setNote,
    decision,
    error,
    noteError,
    setNoteError,
    noteInput,
    noteId,
    working,
    cashPayment,
    receipt,
    knownBalance,
    balanceAllowsApproval,
    canApprove,
    review,
  } = useManualPaymentReview(payment, onReviewed);
  return (
    <Modal size="wide" className="bank-transfer-review-modal" footCompact={false}
      title={payment.method === 'CASH' ? 'Review cash payment' : 'Review bank transfer'}
      subtitle={cashPayment ? 'Confirm the cash was received in the institution cash record. A receipt is optional.' : 'Match the transfer to the institution bank account before approval. A receipt alone does not confirm payment.'}
      closeButton closeDisabled={working} onClose={onClose}
      footer={<>
        <span className="bank-transfer-review__receipt-status" data-status="none" role="status">{cashPayment ? 'Approving confirms you verified the cash received.' : 'Approving confirms you verified the transfer in the bank account.'}</span>
        <button type="button" className="btn bank-transfer-review__reject" disabled={working} onClick={() => void review('REJECTED')}>{decision === 'REJECTED' ? 'Rejecting…' : cashPayment ? 'Reject payment' : 'Reject receipt'}</button>
        <button type="button" className="btn btn--primary" disabled={working || !canApprove} onClick={() => void review('APPROVED')}>{decision === 'APPROVED' ? 'Approving…' : 'Approve payment'}</button>
      </>}
    >
      <div className="bank-transfer-review-layout">
        <PaymentReceiptPreview fileName={payment.receiptFileName} receipt={receipt} cashPayment={cashPayment} />
        <div className="bank-transfer-review" aria-busy={working}>
        <div className="bank-transfer-review__student" aria-label="Student"><h3>{payment.studentName}</h3><span>{payment.studentNumber}</span></div>
        <div className="bank-transfer-review__amount"><span>Submitted amount</span><strong>{reviewMoney(payment.amount, payment.currency)}</strong></div>
        <dl className="bank-transfer-review__identity">
          <div><dt>Method</dt><dd>{payment.method === 'CASH' ? 'Cash' : 'Bank transfer'}</dd></div>
          <div><dt>Submitted</dt><dd>{reviewSubmittedTime(payment.submittedAt)}</dd></div>
        </dl>
        <section className="bank-transfer-review__invoice" aria-label="Invoice to credit">
          <div><h3>Invoice to credit</h3><strong>{payment.invoiceTitle}</strong><span>{payment.invoiceNumber || 'Invoice number unavailable'}</span></div>
          <div><span>Outstanding before this payment</span><strong>{knownBalance ? reviewMoney(payment.invoiceBalance, payment.currency) : 'Balance unavailable'}</strong><small>Balance is rechecked on approval.</small></div>
        </section>
        {!balanceAllowsApproval && <p className="field-error" role="alert">{knownBalance ? 'This amount exceeds the current invoice balance. Close this dialog and refresh the review queue before proceeding.' : 'Reload the review queue to check the invoice balance before approval.'}</p>}
        {payment.studentNote && <div className="bank-transfer-review__note"><strong>Student note</strong><p>{payment.studentNote}</p></div>}
        <label className="field bank-transfer-review__review-note" htmlFor={noteId}><span>Review note</span>
          <textarea id={noteId} ref={noteInput} rows={3} value={note} maxLength={1000} disabled={working}
            aria-invalid={Boolean(noteError)} aria-describedby={`${noteId}-hint${noteError ? ` ${noteId}-error` : ''}`}
            onChange={(event) => { setNote(event.target.value); if (event.target.value.trim()) setNoteError(''); }} />
          <small className="field__hint" id={`${noteId}-hint`}>Required to reject {cashPayment ? 'a payment' : 'a receipt'}; optional when approving. The student can see this note.</small>
        </label>
        {noteError && <p className="field-error" id={`${noteId}-error`} role="alert">{noteError}</p>}
        {error && <p className="field-error" role="alert">{error}</p>}
        </div>
      </div>
    </Modal>
  );
}
