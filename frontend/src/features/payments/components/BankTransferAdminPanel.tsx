import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Modal from '../../../components/Modal';
import { IconArrowRight, IconBank } from '../../../components/icons';
import { apiMessage } from '../../../lib/apiClient';
import {
  downloadAdminBankTransferReceipt,
  getPaymentBankAccount,
  listPendingBankTransfers,
  reviewBankTransfer,
  updatePaymentBankAccount
} from '../api';
import type { BankTransferSubmission, PaymentBankAccount } from '../types';
import { formatMoney, formatPaymentDate } from '../format';

interface Props {
  readonly refreshToken: number;
  readonly onReviewed: () => void;
}

function BankAccountModal({ account, onClose, onSaved }: {
  readonly account: PaymentBankAccount | null;
  readonly onClose: () => void;
  readonly onSaved: (account: PaymentBankAccount) => void;
}) {
  const [form, setForm] = useState({
    accountName: account?.accountName ?? '',
    bankName: account?.bankName ?? '',
    accountNumber: account?.accountNumber ?? '',
    paymentReference: account?.paymentReference ?? '',
    instructions: account?.instructions ?? ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      onSaved(await updatePaymentBankAccount(form));
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      size="narrow"
      className="bank-account-modal"
      title="Bank transfer details"
      subtitle="These details are shown to students who choose bank transfer."
      closeButton
      onClose={onClose}
      onSubmit={submit}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save bank details'}</button></>}
    >
      <div className="bank-account-form">
        <label className="field"><span>Account name</span><input value={form.accountName} maxLength={120} onChange={(event) => update('accountName', event.target.value)} required /></label>
        <div className="bank-account-form__row">
          <label className="field"><span>Bank</span><input value={form.bankName} maxLength={120} onChange={(event) => update('bankName', event.target.value)} required /></label>
          <label className="field"><span>Account number</span><input value={form.accountNumber} maxLength={80} onChange={(event) => update('accountNumber', event.target.value)} required /></label>
        </div>
        <div className="bank-account-form__guidance">
          <label className="field">
            <span>Reference students should use <small>Optional</small></span>
            <input
              value={form.paymentReference}
              maxLength={120}
              placeholder="e.g. Use your student number"
              onChange={(event) => update('paymentReference', event.target.value)}
            />
            <small className="field__hint">Shown beside the bank details so each transfer can be matched to the correct student.</small>
          </label>
          <label className="field">
            <span>Additional transfer instructions <small>Optional</small></span>
            <textarea
              rows={3}
              maxLength={2000}
              value={form.instructions}
              placeholder="e.g. Allow 1–2 business days for the payment to appear"
              onChange={(event) => update('instructions', event.target.value)}
            />
            <small className="field__hint">Only add information that applies to every student using bank transfer.</small>
          </label>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

function ReviewTransferModal({ transfer, onClose, onReviewed }: {
  readonly transfer: BankTransferSubmission;
  readonly onClose: () => void;
  readonly onReviewed: () => void;
}) {
  const [note, setNote] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const review = async (decision: 'APPROVED' | 'REJECTED') => {
    setWorking(true);
    setError('');
    try {
      await reviewBankTransfer(transfer.id, decision, note);
      onReviewed();
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setWorking(false);
    }
  };
  const openReceipt = async () => {
    try {
      const blob = await downloadAdminBankTransferReceipt(transfer.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (cause) {
      setError(apiMessage(cause));
    }
  };
  return (
    <Modal
      size="confirm"
      className="bank-transfer-review-modal"
      title="Review bank transfer"
      subtitle="Approve only after the transfer appears in the institution bank account."
      closeButton
      onClose={onClose}
      footer={<><button type="button" className="btn" disabled={working} onClick={() => void review('REJECTED')}>Reject receipt</button><button type="button" className="btn btn--primary" disabled={working} onClick={() => void review('APPROVED')}>{working ? 'Saving…' : 'Approve payment'}</button></>}
    >
      <div className="bank-transfer-review">
        <div className="bank-transfer-review__amount"><span>Submitted amount</span><strong>{formatMoney(transfer.amount, transfer.currency)}</strong></div>
        <dl>
          <div><dt>Student</dt><dd>{transfer.studentName}<small>{transfer.studentNumber}</small></dd></div>
          <div><dt>Statement</dt><dd>{transfer.invoiceTitle}</dd></div>
          <div><dt>Submitted</dt><dd>{formatPaymentDate(transfer.submittedAt.slice(0, 10))}</dd></div>
        </dl>
        {transfer.studentNote && <p className="bank-transfer-review__note"><strong>Student note</strong>{transfer.studentNote}</p>}
        <button type="button" className="bank-transfer-review__receipt" onClick={() => void openReceipt()}><span><strong>Open receipt</strong><small>{transfer.receiptFileName}</small></span><IconArrowRight /></button>
        <label className="field"><span>Review note <small>Optional</small></span><textarea rows={3} value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} /></label>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

export default function BankTransferAdminPanel({ refreshToken, onReviewed }: Props) {
  const [account, setAccount] = useState<PaymentBankAccount | null>(null);
  const [transfers, setTransfers] = useState<BankTransferSubmission[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingAccount, setEditingAccount] = useState(false);
  const [reviewing, setReviewing] = useState<BankTransferSubmission | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextAccount, queue] = await Promise.all([
        getPaymentBankAccount(),
        listPendingBankTransfers(0, 100)
      ]);
      setAccount(nextAccount);
      setTransfers(queue.page.items);
      setPendingCount(queue.pendingCount);
      setError('');
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load, refreshToken]);

  const reviewed = () => {
    setReviewing(null);
    void load();
    onReviewed();
  };

  return (
    <section className={`bank-transfer-admin${transfers.length ? ' has-review-queue' : ''}`}>
      <header className="bank-transfer-admin__head">
        <div className="bank-transfer-admin__title">
          <span aria-hidden="true"><IconBank /></span>
          <div>
            <h2>Bank transfers</h2>
            <p>Manage transfer details and review submitted receipts.</p>
          </div>
        </div>
        <button type="button" className="btn bank-transfer-admin__manage" onClick={() => setEditingAccount(true)}>
          <span>{account ? 'Manage bank details' : 'Set up bank transfer'}</span>
          <IconArrowRight />
        </button>
      </header>
      {error && <div className="notice notice--warn" role="alert">{error}<button type="button" className="btn btn--sm" onClick={() => void load()}>Retry</button></div>}
      <div className="bank-transfer-admin__body">
        <div className="bank-transfer-account-summary">
          <span>Student transfer account</span>
          {account
            ? <><div className="bank-transfer-account-summary__identity"><strong>{account.accountName}</strong><small>{account.bankName}</small></div><b>{account.accountNumber}</b></>
            : <div className="bank-transfer-account-summary__identity"><strong>Not configured</strong><small>Students cannot submit bank receipts until details are added.</small></div>}
        </div>
        <div className="bank-transfer-queue">
          <div className="bank-transfer-queue__head"><div><strong>Receipts to review</strong><span>Oldest submissions appear first.</span></div><b>{pendingCount}</b></div>
          {loading ? <output>Loading receipts…</output> : transfers.length ? transfers.map((transfer) => (
            <button type="button" className="bank-transfer-queue__row" key={transfer.id} onClick={() => setReviewing(transfer)}>
              <span><strong>{transfer.studentName}</strong><small>{transfer.invoiceTitle} · {formatPaymentDate(transfer.submittedAt.slice(0, 10))}</small></span>
              <b>{formatMoney(transfer.amount, transfer.currency)}</b>
              <IconArrowRight />
            </button>
          )) : <div className="bank-transfer-queue__empty"><strong>No receipts waiting</strong><span>New submissions will appear here.</span></div>}
        </div>
      </div>
      {editingAccount && <BankAccountModal account={account} onClose={() => setEditingAccount(false)} onSaved={(saved) => { setAccount(saved); setEditingAccount(false); }} />}
      {reviewing && <ReviewTransferModal transfer={reviewing} onClose={() => setReviewing(null)} onReviewed={reviewed} />}
    </section>
  );
}
