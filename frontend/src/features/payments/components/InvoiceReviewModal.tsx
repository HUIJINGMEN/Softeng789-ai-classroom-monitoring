import Modal from '../../../components/Modal';
import { CLASSROOM_TIME_ZONE } from '../../../lib/sessionTime';
import { formatMoney, formatPaymentDate } from '../format';
import { ACCOUNT_ADJUSTMENT_COPY, adjustmentAmountError, adjustmentLimit, nextServiceDate } from '../invoiceReviewModel';
import { invoiceOverpayment } from '../studentPaymentModel';
import { useInvoiceReview, type InvoiceReviewOptions } from '../useInvoiceReview';
import type { AccountAdjustmentType, SessionPackageAction } from '../types';
import InvoiceCoursePurchasesSummary from './InvoiceCoursePurchasesSummary';
import InvoiceAmountInput from './InvoiceAmountInput';

function InvoiceAccountTools({ model }: { readonly model: ReturnType<typeof useInvoiceReview> }) {
  const {
    adjustmentType,
    setAdjustmentType,
    adjustmentAmount,
    setAdjustmentAmount,
    refundReference,
    setRefundReference,
    adjustmentReason,
    setAdjustmentReason,
    busy,
    submitAdjustment,
    sessionPackage,
    sessionPackages,
    setSelectedPackageId,
    setPackageReason,
    packageActions,
    packageAction,
    setPackageAction,
    serviceTo,
    setServiceTo,
    targetCourseOfferingId,
    setTargetCourseOfferingId,
    transferClasses,
    packageReason,
    submitPackageAction
  } = model;
  const adjustmentLabel = adjustmentType === 'REFUND' ? 'Record external refund' : 'Record adjustment';
  const amountError = model.invoice ? adjustmentAmountError(model.invoice, adjustmentType, adjustmentAmount) : 'Statement unavailable.';
  return (
    <section className="invoice-account-tools">
      <header><h3>Account tools</h3><p>Use these only when the balance or a lesson package needs correcting.</p></header>

      <details className="invoice-account-tool">
        <summary>
          <span><strong>Adjust the balance</strong><small>Add a credit, record a refund, or reverse an incorrect payment.</small></span>
          <span className="invoice-account-tool__closed">Open</span>
          <span className="invoice-account-tool__open">Close</span>
        </summary>
        <div className="invoice-account-action">
          <p className="invoice-account-action__intro">Every adjustment creates a permanent audit entry. Recording a refund does not move money.</p>
          <label className="field"><span>Adjustment type</span><select value={adjustmentType} onChange={(event) => setAdjustmentType(event.target.value as AccountAdjustmentType)}>{Object.entries(ACCOUNT_ADJUSTMENT_COPY).map(([value, copy]) => <option value={value} key={value}>{copy.label}</option>)}</select><small>{ACCOUNT_ADJUSTMENT_COPY[adjustmentType].help}</small></label>
          <label className="field"><span>Amount ({model.invoice?.currency ?? 'NZD'})</span><InvoiceAmountInput value={adjustmentAmount} onChange={setAdjustmentAmount} /><small>Maximum for this adjustment: {formatMoney(model.invoice ? adjustmentLimit(model.invoice, adjustmentType) : 0, model.invoice?.currency)}.</small></label>
          {adjustmentAmount.trim() && amountError && <p className="field-error" role="alert">{amountError}</p>}
          {adjustmentType === 'REFUND' && <label className="field"><span>Bank or provider reference <small>Required</small></span><input type="text" maxLength={100} value={refundReference} onChange={(event) => setRefundReference(event.target.value)} placeholder="e.g. Stripe refund ID or bank reference" /><small>ClassLens records this refund but does not move money.</small></label>}
          <label className="field"><span>Reason <small>Required</small></span><textarea rows={3} maxLength={500} value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} placeholder="Explain why this account is being adjusted." /></label>
          <button type="button" className="btn btn--primary" disabled={Boolean(busy) || !adjustmentReason.trim() || Boolean(amountError) || (adjustmentType === 'REFUND' && !refundReference.trim())} onClick={() => void submitAdjustment()}>{busy === 'adjust' ? 'Saving…' : adjustmentLabel}</button>
        </div>
      </details>

      {sessionPackage && (
        <details className="invoice-account-tool">
          <summary>
            <span><strong>Manage lesson package</strong><small>{sessionPackage.courseCode} · {sessionPackage.remainingSessions} lessons remain · {sessionPackage.status.toLowerCase().replace(/_/g, ' ')}</small></span>
            <span className="invoice-account-tool__closed">Open</span>
            <span className="invoice-account-tool__open">Close</span>
          </summary>
          <div className="invoice-account-action">
            {sessionPackages.length > 1 && <label className="field"><span>Course package</span><select value={sessionPackage.id} onChange={(event) => { setSelectedPackageId(event.target.value); setPackageReason(''); }}>{sessionPackages.map((item) => <option value={item.id} key={item.id}>{item.courseCode} · {item.academicTerm}</option>)}</select><small>Choose which course package this action applies to.</small></label>}
            {packageActions.length > 0 ? <>
              <label className="field"><span>Action</span><select value={packageAction} onChange={(event) => setPackageAction(event.target.value as SessionPackageAction)}>{packageActions.map((action) => <option value={action.value} key={action.value}>{action.label}</option>)}</select></label>
              {packageAction === 'EXTEND' && <label className="field"><span>New end date</span><input type="date" min={nextServiceDate(sessionPackage.serviceTo)} value={serviceTo} onChange={(event) => setServiceTo(event.target.value)} /></label>}
              {packageAction === 'TRANSFER' && <label className="field"><span>Target class</span><select value={targetCourseOfferingId} onChange={(event) => setTargetCourseOfferingId(event.target.value)} disabled={transferClasses.length === 0}><option value="">{transferClasses.length === 0 ? 'No eligible enrolled classes' : 'Choose an enrolled class'}</option>{transferClasses.map((item) => <option value={item.courseOfferingId} key={item.courseOfferingId}>{item.courseCode} · {item.academicTerm}</option>)}</select><small>{transferClasses.length === 0 ? 'Enroll the student in another active lesson-package class first.' : 'Only the student’s active lesson-package enrolments are shown. Open make-ups must be resolved first.'}</small></label>}
              <label className="field"><span>Reason <small>Required</small></span><textarea rows={3} maxLength={500} value={packageReason} onChange={(event) => setPackageReason(event.target.value)} placeholder="Explain this package change." /></label>
              {packageAction === 'CANCEL' && <p className="invoice-account-action__warning">Cancellation voids unused lessons. It does not refund money automatically.</p>}
              <button type="button" className={`btn ${packageAction === 'CANCEL' ? 'btn--danger' : ''}`} disabled={Boolean(busy) || !packageReason.trim() || (packageAction === 'TRANSFER' && !targetCourseOfferingId) || (packageAction === 'EXTEND' && !serviceTo)} onClick={() => void submitPackageAction()}>{busy === 'package' ? 'Saving…' : 'Apply package action'}</button>
            </> : <div className="invoice-account-action__empty"><strong>Package closed</strong><p>Cancelled packages remain visible in the account history.</p></div>}
          </div>
        </details>
      )}
    </section>
  );
}

export default function InvoiceReviewModal({ invoiceId, studentName, studentNumber, onClose, onUpdated }: InvoiceReviewOptions) {
  const model = useInvoiceReview({ invoiceId, studentName, studentNumber, onClose, onUpdated });
  const {
    view,
    studentLabel,
    busy,
    requestClose,
    invoice,
    download,
    message,
    messageDirty,
    saveMessage,
    deliver,
    setView,
    error,
    setLoadAttempt,
    notice,
    messageHeading,
    editMessage,
    draftError,
    generateDraft,
    messageHelp,
    account
  } = model;

  const sendLabel = invoice?.status === 'DRAFT' ? 'Approve & send invoice' : 'Send again';
  return (
    <Modal
      size="wide"
      className="invoice-review-modal"
      title={view === 'invoice' ? 'Invoice review' : 'Account activity'}
      subtitle={studentLabel}
      closeButton
      closeDisabled={busy === 'email' || busy === 'save'}
      onClose={requestClose}
      footer={(
        <>
          <button type="button" className="btn" disabled={busy === 'email' || busy === 'save'} onClick={requestClose}>Close</button>
          <span className="spacer" />
          {invoice && view === 'invoice' && <>
            {invoice?.status !== 'DRAFT' && <button type="button" className="btn" disabled={Boolean(busy)} onClick={download}>{busy === 'pdf' ? 'Preparing…' : 'Download PDF'}</button>}
            <button type="button" className="btn" disabled={Boolean(busy) || !message.trim() || !messageDirty} onClick={() => void saveMessage()}>{busy === 'save' ? 'Saving…' : 'Save message draft'}</button>
            <button type="button" className="btn btn--primary" disabled={Boolean(busy) || !message.trim()} onClick={deliver}>
              {busy === 'email' ? 'Sending…' : sendLabel}
            </button>
          </>}
        </>
      )}
    >
      {invoice && <nav className="invoice-review-tabs" aria-label="Invoice account sections">
        <button type="button" className={view === 'invoice' ? 'is-active' : ''} onClick={() => setView('invoice')}>Review &amp; send</button>
        <button type="button" className={view === 'account' ? 'is-active' : ''} onClick={() => setView('account')}>Activity &amp; adjustments</button>
      </nav>}
      {busy === 'load' && <output className="payment-page-state">Loading invoice account…</output>}
      {error && <div className="notice notice--warn invoice-review-notice" role="alert">{error}</div>}
      {!invoice && error && busy !== 'load' && <div className="invoice-review-retry"><button type="button" className="btn btn--primary" onClick={() => setLoadAttempt((value) => value + 1)}>Try loading again</button></div>}
      {notice && <output className="notice notice--success invoice-review-notice">{notice}</output>}
      {invoice && view === 'invoice' && (
        <div className="invoice-review-workspace">
          {invoice.status === 'DRAFT' && (
            <section className="invoice-draft-banner" aria-label="Invoice draft status">
              <div><span>Private draft</span><strong>Not visible to the student</strong></div>
              <p>Check the amount, access terms and AI-written message below. Sending publishes the invoice to the student portal.</p>
            </section>
          )}
          <section className="invoice-review-summary">
            <div><span>Invoice</span><strong>{invoice.invoiceNumber}</strong><small>Due {formatPaymentDate(invoice.dueDate)}</small></div>
            <div><span>Amount due</span><strong>{formatMoney(invoice.balance, invoice.currency)}</strong><small>{invoice.title}</small></div>
          </section>
          <InvoiceCoursePurchasesSummary
            purchases={invoice.coursePurchases}
            legacyEntitlement={invoice.entitlement}
            legacySessionPackage={invoice.sessionPackage}
          />
          <section className="invoice-message-editor">
            <div className="invoice-message-editor__head">
              <div>
                <span>Student message</span>
                <strong>{messageHeading}</strong>
              </div>
            </div>
            <textarea
              aria-label="Student message"
              value={message}
              maxLength={2000}
              rows={8}
              readOnly={busy === 'draft'}
              aria-busy={busy === 'draft'}
              onChange={(event) => editMessage(event.target.value)}
              placeholder={busy === 'draft' ? 'Preparing a message from this invoice and lesson record…' : 'Edit the AI draft or write your own message.'}
            />
            {draftError && (
              <div className="invoice-message-editor__error" role="alert">
                <span>{draftError}</span>
                <button type="button" className="btn btn--sm" disabled={Boolean(busy)} onClick={generateDraft}>Try AI again</button>
              </div>
            )}
            <div className="invoice-message-editor__meta">
              <span>{messageHelp}</span>
              <span>{message.length}/2000</span>
            </div>
          </section>
        </div>
      )}

      {invoice && view === 'account' && (
        <div className="invoice-account-workspace">
          <section className="invoice-account-balance">
            <div><span>Charged</span><strong>{formatMoney(invoice.charges - invoice.credits, invoice.currency)}</strong></div>
            <div><span>Paid (after refunds)</span><strong>{formatMoney(invoice.payments, invoice.currency)}</strong></div>
            <div className={invoice.balance > 0 ? 'has-balance' : ''}><span>Still owing</span><strong>{formatMoney(invoice.balance, invoice.currency)}</strong></div>
          </section>

          <section className="invoice-account-history">
            {invoiceOverpayment(invoice) > 0 && <p role="status">Overpayment: {formatMoney(invoiceOverpayment(invoice), invoice.currency)}. Review the account before making further adjustments; this amount has not been refunded or transferred automatically.</p>}
            <header><h3>Account history</h3><p>Charges, payments and account changes, newest first. Attendance remains in Lesson reconciliation.</p></header>
            {(account?.timeline ?? []).length === 0 ? <div className="invoice-account-history__empty">No account events have been recorded.</div> : (
              <ol>{(account?.timeline ?? []).map((event) => <li key={event.id}>
                <span aria-hidden="true" />
                <div><strong>{event.title}</strong><small>{new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium', timeStyle: 'short', timeZone: CLASSROOM_TIME_ZONE }).format(new Date(event.occurredAt))}{event.actorName ? ` · ${event.actorName}` : ''}</small>{event.detail && <p>{event.detail}</p>}{event.amount != null && <em>{formatMoney(event.amount, invoice.currency)}</em>}{event.reference && <em>Ref: {event.reference}</em>}</div>
              </li>)}</ol>
            )}
          </section>

          <InvoiceAccountTools model={model} />
        </div>
      )}
    </Modal>
  );
}
