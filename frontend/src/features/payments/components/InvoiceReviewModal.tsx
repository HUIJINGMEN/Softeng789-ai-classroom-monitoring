import { useEffect, useMemo, useState } from 'react';
import Modal from '../../../components/Modal';
import { apiMessage } from '../../../lib/apiClient';
import {
  adjustInvoiceAccount,
  downloadAdminInvoice,
  emailInvoice,
  generateInvoiceMessage,
  getInvoiceAccount,
  manageSessionPackage,
  saveInvoiceMessage
} from '../api';
import { formatMoney, formatPaymentDate } from '../format';
import { shouldPrepareAiMessage } from '../invoiceReviewModel';
import type {
  AccountAdjustmentType,
  InvoiceAccount,
  InvoiceMessageDraft,
  SessionPackageUsage,
  SessionPackageAction,
  StudentInvoice
} from '../types';
import { saveDownload } from '../../../lib/saveDownload';
import InvoiceCoursePurchasesSummary from './InvoiceCoursePurchasesSummary';

interface Props {
  readonly invoiceId: string;
  readonly studentName: string;
  readonly studentNumber?: string;
  readonly onClose: () => void;
  readonly onUpdated: () => void;
}

const ADJUSTMENT_COPY: Record<AccountAdjustmentType, { label: string; help: string }> = {
  CREDIT: { label: 'Account credit', help: 'Reduces the amount owed without sending money back.' },
  REFUND: { label: 'Record external refund', help: 'Use this only after the money has been returned through your bank or payment provider.' },
  PAYMENT_REVERSAL: { label: 'Payment reversal', help: 'Corrects a payment entered in error and reopens the balance.' }
};

// Keep an unreviewed AI draft available while the administrator moves around the
// payments workspace, without exposing it to the student or persisting it as an
// approved invoice message.
const invoiceDraftCache = new Map<string, InvoiceMessageDraft>();

function nextDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export default function InvoiceReviewModal({ invoiceId, studentName, studentNumber, onClose, onUpdated }: Props) {
  const [account, setAccount] = useState<InvoiceAccount | null>(null);
  const [view, setView] = useState<'invoice' | 'account'>('invoice');
  const [message, setMessage] = useState('');
  const [provider, setProvider] = useState('');
  const [draftError, setDraftError] = useState('');
  const [busy, setBusy] = useState<'load' | 'draft' | 'save' | 'pdf' | 'email' | 'adjust' | 'package' | ''>('load');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [messageDirty, setMessageDirty] = useState(false);
  const [deliveryKey, setDeliveryKey] = useState(() => `single-${invoiceId}-${crypto.randomUUID()}`);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<AccountAdjustmentType>('CREDIT');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [refundReference, setRefundReference] = useState('');
  const [packageAction, setPackageAction] = useState<SessionPackageAction>('PAUSE');
  const [packageReason, setPackageReason] = useState('');
  const [serviceTo, setServiceTo] = useState('');
  const [targetCourseOfferingId, setTargetCourseOfferingId] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');

  const invoice = account?.invoice ?? null;
  const sessionPackages = useMemo(() => {
    if (!invoice) return [];
    const purchases = invoice.coursePurchases
      ?.map((purchase) => purchase.sessionPackage)
      .filter((item): item is SessionPackageUsage => item !== null) ?? [];
    return purchases.length > 0 ? purchases : invoice.sessionPackage ? [invoice.sessionPackage] : [];
  }, [invoice]);
  const sessionPackage = sessionPackages.find((item) => item.id === selectedPackageId) ?? sessionPackages[0] ?? null;

  const reload = async () => {
    const result = await getInvoiceAccount(invoiceId);
    setAccount(result);
    return result;
  };

  useEffect(() => {
    let active = true;
    const initialise = async () => {
      setBusy('load');
      setError('');
      setDraftError('');
      try {
        const result = await getInvoiceAccount(invoiceId);
        if (!active) return;
        setAccount(result);
        setMessageDirty(false);

        const reviewedMessage = result.invoice.note?.trim();
        if (reviewedMessage && !shouldPrepareAiMessage(result.invoice)) {
          setMessage(reviewedMessage);
          setProvider('');
          return;
        }

        const cachedDraft = invoiceDraftCache.get(invoiceId);
        if (cachedDraft) {
          setMessage(cachedDraft.message);
          setProvider(cachedDraft.provider);
          setMessageDirty(true);
          return;
        }

        // A note entered while creating the invoice is useful fallback text,
        // but is not an administrator-reviewed student message. Keep it visible
        // only while the automatic AI draft is being prepared.
        setMessage(reviewedMessage ?? '');
        setBusy('draft');
        try {
          const draft = await generateInvoiceMessage(invoiceId);
          if (!active) return;
          invoiceDraftCache.set(invoiceId, draft);
          setMessage(draft.message);
          setProvider(draft.provider);
          setMessageDirty(true);
        } catch (cause) {
          if (!active) return;
          setDraftError(`AI draft could not be prepared: ${apiMessage(cause)} You can write your own message or try again.`);
        }
      } catch (cause) {
        if (active) setError(apiMessage(cause));
      } finally {
        if (active) setBusy('');
      }
    };
    void initialise();
    return () => { active = false; };
  }, [invoiceId, loadAttempt]);

  useEffect(() => {
    if (!sessionPackage) return;
    setSelectedPackageId(sessionPackage.id);
    setServiceTo(nextDate(sessionPackage.serviceTo));
    setPackageAction(sessionPackage.status === 'PAUSED' ? 'RESUME' : 'PAUSE');
  }, [sessionPackage?.id, sessionPackage?.serviceTo, sessionPackage?.status]);

  const transferClasses = useMemo(() => account?.transferOptions ?? [], [account?.transferOptions]);

  const generateDraft = async () => {
    setBusy('draft'); setDraftError(''); setNotice('');
    try {
      const result = await generateInvoiceMessage(invoiceId);
      invoiceDraftCache.set(invoiceId, result);
      setMessage(result.message); setProvider(result.provider);
      setMessageDirty(true);
    } catch (cause) {
      setDraftError(`AI draft could not be prepared: ${apiMessage(cause)} You can keep editing the current message or try again.`);
    } finally { setBusy(''); }
  };

  const saveMessage = async () => {
    if (!message.trim()) return;
    setBusy('save'); setError(''); setNotice('');
    try {
      await saveInvoiceMessage(invoiceId, message.trim(), false);
      invoiceDraftCache.delete(invoiceId);
      setMessageDirty(false);
      setNotice('Message draft saved. The invoice is still private and has not been sent.');
    } catch (cause) { setError(apiMessage(cause)); }
    finally { setBusy(''); }
  };

  const download = async () => {
    setBusy('pdf'); setError('');
    try { saveDownload(await downloadAdminInvoice(invoiceId), `${invoice?.invoiceNumber ?? 'ClassLens-invoice'}.pdf`); }
    catch (cause) { setError(apiMessage(cause)); } finally { setBusy(''); }
  };

  const deliver = async () => {
    if (!message.trim()) return;
    setBusy('email'); setError(''); setNotice('');
    try {
      const result = await emailInvoice(invoiceId, message, deliveryKey);
      invoiceDraftCache.delete(invoiceId);
      await reload();
      setProvider('');
      setMessageDirty(false);
      setDeliveryKey(`single-${invoiceId}-${crypto.randomUUID()}`);
      setNotice(result.message);
      onUpdated();
    } catch (cause) { setError(apiMessage(cause)); } finally { setBusy(''); }
  };

  const submitAdjustment = async () => {
    const amount = Number(adjustmentAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !adjustmentReason.trim()) return;
    setBusy('adjust'); setError(''); setNotice('');
    try {
      const result = await adjustInvoiceAccount(invoiceId, {
        type: adjustmentType,
        amount,
        reason: adjustmentReason.trim(),
        ...(adjustmentType === 'REFUND' ? { externalReference: refundReference.trim() } : {})
      });
      setAccount(result);
      setAdjustmentAmount(''); setAdjustmentReason(''); setRefundReference('');
      setNotice(`${ADJUSTMENT_COPY[adjustmentType].label} recorded in the account history.`);
      onUpdated();
    } catch (cause) { setError(apiMessage(cause)); } finally { setBusy(''); }
  };

  const submitPackageAction = async () => {
    if (!sessionPackage || !packageReason.trim()) return;
    setBusy('package'); setError(''); setNotice('');
    try {
      await manageSessionPackage(sessionPackage.id, {
        action: packageAction,
        reason: packageReason.trim(),
        ...(packageAction === 'EXTEND' ? { serviceTo } : {}),
        ...(packageAction === 'TRANSFER' ? { targetCourseOfferingId } : {})
      });
      await reload();
      setPackageReason('');
      setNotice(`Package ${packageAction.toLowerCase()} action saved.`);
      onUpdated();
    } catch (cause) { setError(apiMessage(cause)); } finally { setBusy(''); }
  };

  const packageActions: Array<{ value: SessionPackageAction; label: string }> = sessionPackage?.status === 'CANCELLED'
    ? []
    : [
      ...(sessionPackage?.status === 'PAUSED'
        ? [{ value: 'RESUME' as const, label: 'Resume package' }]
        : [{ value: 'PAUSE' as const, label: 'Pause package' }]),
      { value: 'EXTEND', label: 'Extend end date' },
      { value: 'TRANSFER', label: 'Transfer remaining lessons' },
      { value: 'CANCEL', label: 'Cancel remaining lessons' }
    ];

  const requestClose = () => {
    if (messageDirty && !window.confirm('Close without saving your message changes?')) return;
    onClose();
  };

  return (
    <Modal
      size="wide"
      className="invoice-review-modal"
      title={view === 'invoice' ? 'Invoice review' : 'Account activity'}
      subtitle={`${studentName}${studentNumber ? ` · ${studentNumber}` : ''}`}
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
              {busy === 'email' ? 'Sending…' : invoice?.status === 'DRAFT' ? 'Approve & send invoice' : 'Send again'}
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
      {notice && <div className="notice notice--success invoice-review-notice" role="status">{notice}</div>}
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
                <strong>{busy === 'draft'
                  ? 'AI is preparing the first draft…'
                  : provider
                    ? 'AI draft ready to edit'
                    : invoice.lastEmailedAt
                      ? 'Review the saved message before sending again'
                      : draftError
                        ? 'Write your message or retry AI'
                        : 'Edit the message before sending'}</strong>
              </div>
            </div>
            <textarea
              value={message}
              maxLength={2000}
              rows={8}
              readOnly={busy === 'draft'}
              aria-busy={busy === 'draft'}
              onChange={(event) => {
                const nextMessage = event.target.value;
                setMessage(nextMessage);
                setMessageDirty(true);
                const cachedDraft = invoiceDraftCache.get(invoiceId);
                if (cachedDraft) invoiceDraftCache.set(invoiceId, { ...cachedDraft, message: nextMessage });
              }}
              placeholder={busy === 'draft' ? 'Preparing a message from this invoice and lesson record…' : 'Edit the AI draft or write your own message.'}
            />
            {draftError && (
              <div className="invoice-message-editor__error" role="alert">
                <span>{draftError}</span>
                <button type="button" className="btn btn--sm" disabled={Boolean(busy)} onClick={generateDraft}>Try AI again</button>
              </div>
            )}
            <div className="invoice-message-editor__meta">
              <span>{busy === 'draft'
                ? 'Using the invoice, course access and attendance record'
                : provider
                  ? `Generated by ${provider} · review before sending`
                  : draftError
                    ? 'AI did not replace your text; retry or edit it manually'
                    : 'This message appears in the PDF, email and student account after it is sent.'}</span>
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
            <header><h3>Account history</h3><p>Charges, payments and account changes, newest first. Attendance remains in Lesson reconciliation.</p></header>
            {(account?.timeline ?? []).length === 0 ? <div className="invoice-account-history__empty">No account events have been recorded.</div> : (
              <ol>{(account?.timeline ?? []).map((event) => <li key={event.id}>
                <span aria-hidden="true" />
                <div><strong>{event.title}</strong><small>{new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.occurredAt))}{event.actorName ? ` · ${event.actorName}` : ''}</small>{event.detail && <p>{event.detail}</p>}{event.amount != null && <em>{formatMoney(event.amount, invoice.currency)}</em>}{event.reference && <em>Ref: {event.reference}</em>}</div>
              </li>)}</ol>
            )}
          </section>

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
                <label className="field"><span>Adjustment type</span><select value={adjustmentType} onChange={(event) => setAdjustmentType(event.target.value as AccountAdjustmentType)}>{Object.entries(ADJUSTMENT_COPY).map(([value, copy]) => <option value={value} key={value}>{copy.label}</option>)}</select><small>{ADJUSTMENT_COPY[adjustmentType].help}</small></label>
                <label className="field"><span>Amount (NZD)</span><input type="number" min="0.01" step="0.01" inputMode="decimal" value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value)} placeholder="0.00" /></label>
                {adjustmentType === 'REFUND' && <label className="field"><span>Bank or provider reference <small>Required</small></span><input type="text" maxLength={100} value={refundReference} onChange={(event) => setRefundReference(event.target.value)} placeholder="e.g. Stripe refund ID or bank reference" /><small>ClassLens records this refund but does not move money.</small></label>}
                <label className="field"><span>Reason <small>Required</small></span><textarea rows={3} maxLength={500} value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} placeholder="Explain why this account is being adjusted." /></label>
                <button type="button" className="btn btn--primary" disabled={Boolean(busy) || !adjustmentReason.trim() || Number(adjustmentAmount) <= 0 || (adjustmentType === 'REFUND' && !refundReference.trim())} onClick={() => void submitAdjustment()}>{busy === 'adjust' ? 'Saving…' : adjustmentType === 'REFUND' ? 'Record external refund' : 'Record adjustment'}</button>
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
                    {packageAction === 'EXTEND' && <label className="field"><span>New end date</span><input type="date" min={nextDate(sessionPackage.serviceTo)} value={serviceTo} onChange={(event) => setServiceTo(event.target.value)} /></label>}
                    {packageAction === 'TRANSFER' && <label className="field"><span>Target class</span><select value={targetCourseOfferingId} onChange={(event) => setTargetCourseOfferingId(event.target.value)} disabled={transferClasses.length === 0}><option value="">{transferClasses.length === 0 ? 'No eligible enrolled classes' : 'Choose an enrolled class'}</option>{transferClasses.map((item) => <option value={item.courseOfferingId} key={item.courseOfferingId}>{item.courseCode} · {item.academicTerm}</option>)}</select><small>{transferClasses.length === 0 ? 'Enroll the student in another active lesson-package class first.' : 'Only the student’s active lesson-package enrolments are shown. Open make-ups must be resolved first.'}</small></label>}
                    <label className="field"><span>Reason <small>Required</small></span><textarea rows={3} maxLength={500} value={packageReason} onChange={(event) => setPackageReason(event.target.value)} placeholder="Explain this package change." /></label>
                    {packageAction === 'CANCEL' && <p className="invoice-account-action__warning">Cancellation voids unused lessons. It does not refund money automatically.</p>}
                    <button type="button" className={`btn ${packageAction === 'CANCEL' ? 'btn--danger' : ''}`} disabled={Boolean(busy) || !packageReason.trim() || (packageAction === 'TRANSFER' && !targetCourseOfferingId) || (packageAction === 'EXTEND' && !serviceTo)} onClick={() => void submitPackageAction()}>{busy === 'package' ? 'Saving…' : 'Apply package action'}</button>
                  </> : <div className="invoice-account-action__empty"><strong>Package closed</strong><p>Cancelled packages remain visible in the account history.</p></div>}
                </div>
              </details>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
