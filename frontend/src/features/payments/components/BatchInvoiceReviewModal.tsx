import { useEffect, useMemo, useState } from 'react';
import Modal from '../../../components/Modal';
import { apiMessage } from '../../../lib/apiClient';
import { emailInvoice, generateInvoiceMessage, saveInvoiceMessage } from '../api';
import { formatMoney, formatPaymentDate } from '../format';
import type { StudentInvoice } from '../types';
import { sumMoneyValues } from '../money';
import { invoiceDeliveryOutcome } from '../invoiceReviewModel';
import BatchInvoiceFacts from './BatchInvoiceFacts';

interface Props {
  readonly invoices: StudentInvoice[];
  readonly onClose: () => void;
  readonly onSent: () => void;
}

type DraftStatus = 'PREPARING' | 'NEEDS_REVIEW' | 'REVIEWED' | 'SENDING' | 'SENT' | 'DEMO' | 'FAILED' | 'UNKNOWN';

interface DraftState {
  message: string;
  provider: string;
  warning: string;
  status: DraftStatus;
  dirty: boolean;
  deliveryKey: string;
}

const STATUS_COPY: Record<DraftStatus, string> = {
  PREPARING: 'Preparing',
  NEEDS_REVIEW: 'Needs review',
  REVIEWED: 'Reviewed',
  SENDING: 'Sending',
  SENT: 'Sent',
  DEMO: 'Published · no email',
  FAILED: 'Failed',
  UNKNOWN: 'Check delivery'
};

function fallbackMessage(invoice: StudentInvoice) {
  const firstName = invoice.studentName.trim().split(/\s+/)[0] || 'there';
  return `Hi ${firstName},\n\nYour invoice for ${invoice.title} is ready. The balance is ${formatMoney(invoice.balance, invoice.currency)}, due ${formatPaymentDate(invoice.dueDate)}. Please review the attached invoice and contact us if you have any questions.\n\nThank you.`;
}

function initialState(invoice: StudentInvoice): DraftState {
  const savedMessage = invoice.messageDraftSavedAt ? invoice.note?.trim() : '';
  let status: DraftState['status'] = 'PREPARING';
  if (savedMessage) status = invoice.messageReviewedAt ? 'REVIEWED' : 'NEEDS_REVIEW';
  return {
    message: savedMessage || '',
    provider: savedMessage ? 'Saved message' : '',
    warning: '',
    status,
    dirty: false,
    deliveryKey: `batch-${invoice.id}-${crypto.randomUUID()}`
  };
}

function reviewLabel(status: DraftState['status']) {
  return status === 'REVIEWED' ? 'Save as reviewed' : 'Mark reviewed';
}

export default function BatchInvoiceReviewModal({ invoices, onClose, onSent }: Props) {
  const [drafts, setDrafts] = useState<Record<string, DraftState>>(() => Object.fromEntries(invoices.map((invoice) => [invoice.id, initialState(invoice)])));
  const [activeId, setActiveId] = useState(invoices[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [exceptionsOnly, setExceptionsOnly] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const prepare = async () => {
      const pending = invoices.filter((invoice) => !invoice.messageDraftSavedAt || !invoice.note?.trim());
      for (let offset = 0; offset < pending.length; offset += 3) {
        const group = pending.slice(offset, offset + 3);
        const results = await Promise.all(group.map(async (invoice) => {
          try {
            const draft = await generateInvoiceMessage(invoice.id);
            return [invoice.id, { message: draft.message, provider: draft.provider, warning: '' }] as const;
          } catch (cause) {
            return [invoice.id, {
              message: fallbackMessage(invoice),
              provider: 'Standard fallback',
              warning: `AI draft unavailable: ${apiMessage(cause)} A standard fallback has been inserted.`
            }] as const;
          }
        }));
        if (!active) return;
        setDrafts((current) => {
          const next = { ...current };
          results.forEach(([id, result]) => {
            const existing = next[id];
            if (existing?.status !== 'PREPARING') return;
            next[id] = { ...existing, ...result, status: 'NEEDS_REVIEW', dirty: true };
          });
          return next;
        });
      }
    };
    void prepare();
    return () => { active = false; };
  }, [invoices]);

  const activeInvoice = invoices.find((invoice) => invoice.id === activeId) ?? invoices[0];
  const activeDraft = activeInvoice ? drafts[activeInvoice.id] : undefined;
  const total = useMemo(() => sumMoneyValues(invoices.map(invoice => invoice.balance)), [invoices]);
  const sentCount = invoices.filter((invoice) => drafts[invoice.id]?.status === 'SENT').length;
  const demoCount = invoices.filter((invoice) => drafts[invoice.id]?.status === 'DEMO').length;
  const reviewedCount = invoices.filter((invoice) => ['REVIEWED', 'SENDING', 'SENT', 'DEMO', 'UNKNOWN'].includes(drafts[invoice.id]?.status)).length;
  const unknownCount = invoices.filter((invoice) => drafts[invoice.id]?.status === 'UNKNOWN').length;
  const failedCount = invoices.filter((invoice) => drafts[invoice.id]?.status === 'FAILED').length;
  const preparing = invoices.some((invoice) => drafts[invoice.id]?.status === 'PREPARING');
  const sending = invoices.some((invoice) => drafts[invoice.id]?.status === 'SENDING');
  const dirty = invoices.some((invoice) => drafts[invoice.id]?.dirty);
  const unsent = invoices.filter((invoice) => !['SENT', 'DEMO', 'UNKNOWN'].includes(drafts[invoice.id]?.status));
  const canSend = unsent.length > 0 && unsent.every((invoice) => ['REVIEWED', 'FAILED'].includes(drafts[invoice.id]?.status) && drafts[invoice.id]?.message.trim());
  let sendLabel = `Send ${unsent.length} invoices`;
  if (sending) sendLabel = 'Sending…';
  else if (failedCount > 0) sendLabel = `Retry ${failedCount} failed`;
  const visibleInvoices = exceptionsOnly
    ? invoices.filter((invoice) => drafts[invoice.id]?.warning || ['NEEDS_REVIEW', 'FAILED'].includes(drafts[invoice.id]?.status))
    : invoices;

  useEffect(() => {
    if (visibleInvoices.length > 0 && !visibleInvoices.some((invoice) => invoice.id === activeId)) {
      setActiveId(visibleInvoices[0].id);
    }
  }, [activeId, visibleInvoices]);

  const updateMessage = (message: string) => {
    if (!activeInvoice || !activeDraft || ['SENDING', 'SENT', 'DEMO', 'UNKNOWN'].includes(activeDraft.status)) return;
    setDrafts((current) => ({
      ...current,
      [activeInvoice.id]: { ...current[activeInvoice.id], message, status: 'NEEDS_REVIEW', dirty: true }
    }));
  };

  const reviewActive = async () => {
    if (!activeInvoice || !activeDraft?.message.trim() || ['SENDING', 'SENT', 'DEMO', 'UNKNOWN'].includes(activeDraft.status)) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await saveInvoiceMessage(activeInvoice.id, activeDraft.message.trim(), true);
      setDrafts((current) => ({ ...current, [activeInvoice.id]: { ...current[activeInvoice.id], status: 'REVIEWED', dirty: false } }));
      setNotice(`${activeInvoice.studentName}'s invoice is reviewed and ready to send.`);
      const next = invoices.find((invoice) => invoice.id !== activeInvoice.id && drafts[invoice.id]?.status === 'NEEDS_REVIEW');
      if (next) setActiveId(next.id);
    } catch (cause) { setError(apiMessage(cause)); }
    finally { setSaving(false); }
  };

  const saveAndClose = async () => {
    setSaving(true); setError('');
    try {
      await Promise.all(invoices
        .filter((invoice) => drafts[invoice.id]?.dirty && drafts[invoice.id]?.message.trim())
        .map((invoice) => saveInvoiceMessage(
          invoice.id,
          drafts[invoice.id].message.trim(),
          drafts[invoice.id].status === 'REVIEWED'
        )));
      onClose();
    } catch (cause) { setError(`Drafts could not be saved: ${apiMessage(cause)}`); }
    finally { setSaving(false); }
  };

  const requestClose = () => {
    if (dirty && !window.confirm('Close without saving the message changes in this batch?')) return;
    onClose();
  };

  const sendReady = async () => {
    const targets = unsent.filter((invoice) => ['REVIEWED', 'FAILED'].includes(drafts[invoice.id]?.status));
    if (targets.length === 0 || !canSend) return;
    setError(''); setNotice('');
    setDrafts((current) => {
      const next = { ...current };
      targets.forEach((invoice) => { next[invoice.id] = { ...next[invoice.id], status: 'SENDING' }; });
      return next;
    });
    const results = await Promise.allSettled(targets.map((invoice) => (
      emailInvoice(invoice.id, drafts[invoice.id].message.trim(), drafts[invoice.id].deliveryKey)
    )));
    const outcomes = results.map(invoiceDeliveryOutcome);
    const failedNames = targets.filter((_, index) => outcomes[index].status === 'FAILED').map(invoice => invoice.studentName);
    const unknownNames = targets.filter((_, index) => outcomes[index].status === 'UNKNOWN').map(invoice => invoice.studentName);
    setDrafts((current) => {
      const next = { ...current };
      outcomes.forEach((outcome, index) => {
        const invoice = targets[index];
        next[invoice.id] = { ...next[invoice.id], ...outcome, dirty: false };
      });
      return next;
    });
    if (failedNames.length > 0 || unknownNames.length > 0) {
      setError(`${outcomes.filter(item => item.status === 'SENT').length} emailed; ${outcomes.filter(item => item.status === 'DEMO').length} demo-only; ${failedNames.length} failed; ${unknownNames.length} need delivery checks. `
        + (failedNames.length ? `Retry only: ${failedNames.join(', ')}. ` : '')
        + (unknownNames.length ? `Do not resend until checked: ${unknownNames.join(', ')}.` : ''));
      return;
    }
    const remaining = unsent.length - targets.length;
    if (remaining === 0 && unknownCount === 0) {
      const completedDemo = demoCount + outcomes.filter(item => item.status === 'DEMO').length;
      setNotice(`${sentCount + outcomes.filter(item => item.status === 'SENT').length} invoices emailed; ${completedDemo} published in demo mode without email.`);
      onSent();
    }
  };

  if (invoices.length === 0) return null;

  return (
    <Modal
      size="wide"
      className="batch-invoice-review-modal"
      title="Review and send invoices"
      subtitle="Confirm each amount, course access and student message. Only reviewed invoices can be sent."
      closeButton
      closeDisabled={saving || sending}
      onClose={requestClose}
      footer={(
        <>
          <button type="button" className="btn" disabled={saving || sending} onClick={() => void saveAndClose()}>{saving ? 'Saving…' : 'Save drafts & close'}</button>
          <span className="spacer" />
          <button type="button" className="btn btn--primary" disabled={preparing || saving || sending || !canSend} onClick={() => void sendReady()}>
            {sendLabel}
          </button>
        </>
      )}
    >
      <div className="batch-review" aria-busy={preparing || saving || sending}>
        <div className="batch-review__summary">
          <div><span>Batch total</span><strong>{formatMoney(total, invoices[0].currency)}</strong><small>{invoices.length} invoices · individual amounts shown below</small></div>
          <div><span>Reviewed</span><strong>{reviewedCount}/{invoices.length}</strong><small>{invoices.length - reviewedCount} still need confirmation</small></div>
          <div><span>Emailed</span><strong>{sentCount}/{invoices.length}</strong><small>{demoCount} demo-only · {failedCount} failed · {unknownCount} to check</small></div>
        </div>
        <div className="batch-review__toolbar">
          <span>Review every student before sending.</span>
          <label><input type="checkbox" checked={exceptionsOnly} onChange={(event) => setExceptionsOnly(event.target.checked)} /> Show items needing attention</label>
        </div>
        {error && <div className="notice notice--warn" role="alert">{error}</div>}
        {notice && <output className="notice notice--success" aria-live="polite">{notice}</output>}
        <div className="batch-review__body">
          <div className="batch-review__list" aria-label="Invoice batch">
            {visibleInvoices.map((invoice) => {
              const draft = drafts[invoice.id];
              return (
                <button
                  type="button"
                  className={activeInvoice?.id === invoice.id ? 'is-active' : ''}
                  key={invoice.id}
                  aria-current={activeInvoice?.id === invoice.id ? 'true' : undefined}
                  onClick={() => setActiveId(invoice.id)}
                >
                  <span><strong>{invoice.studentName}</strong><small>{invoice.studentNumber}</small></span>
                  <span><strong>{formatMoney(invoice.balance, invoice.currency)}</strong><small className={`is-${draft?.status.toLowerCase().replace('_', '-')}`}>{draft ? STATUS_COPY[draft.status] : 'Preparing'}</small></span>
                </button>
              );
            })}
            {visibleInvoices.length === 0 && <p className="batch-review__empty">No invoices currently need attention.</p>}
          </div>
          <section className="batch-review__message">
            {activeInvoice && activeDraft && (
              <>
                <header>
                  <div><span>Reviewing invoice</span><strong>{activeInvoice.studentName}</strong></div>
                  <span className={`batch-review__status is-${activeDraft.status.toLowerCase().replace('_', '-')}`}>{STATUS_COPY[activeDraft.status]}</span>
                </header>
                <BatchInvoiceFacts invoice={activeInvoice} />
                {activeDraft.warning && <p className="batch-review__fallback" role="alert">{activeDraft.warning}</p>}
                <label className="batch-review__editor">
                  <span>Student message</span>
                  <textarea
                    value={activeDraft.message}
                    maxLength={2000}
                    disabled={['PREPARING', 'SENDING', 'SENT', 'DEMO', 'UNKNOWN'].includes(activeDraft.status) || saving}
                    onChange={(event) => updateMessage(event.target.value)}
                    aria-label={`Message for ${activeInvoice.studentName}`}
                  />
                  <small><span>{activeDraft.provider || 'Preparing AI draft…'} · edit before sending</span><span>{activeDraft.message.length}/2000</span></small>
                </label>
                {!['SENT', 'DEMO'].includes(activeDraft.status) && (
                  <div className="batch-review__review-action">
                    <span>{activeDraft.status === 'REVIEWED' ? 'Any edit will require review again.' : 'Confirm the invoice facts and message above.'}</span>
                    <button type="button" className="btn btn--primary btn--sm" disabled={saving || sending || !activeDraft.message.trim() || ['PREPARING', 'UNKNOWN'].includes(activeDraft.status)} onClick={() => void reviewActive()}>
                      {saving ? 'Saving…' : reviewLabel(activeDraft.status)}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </Modal>
  );
}
