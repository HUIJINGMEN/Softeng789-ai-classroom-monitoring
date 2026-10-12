import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Modal from '../../../components/Modal';
import { IconArrowRight, IconBank } from '../../../components/icons';
import { apiMessage } from '../../../lib/apiClient';
import {
  downloadAdminPaymentReceipt,
  getPaymentBankAccount,
  listPendingManualPayments,
  reviewManualPayment,
  updatePaymentBankAccount
} from '../api';
import type { ManualPaymentSubmission, PaymentBankAccount } from '../types';
import { formatMoney, formatPaymentDate } from '../format';

interface Props {
  readonly refreshToken: number;
  readonly focusStudentId?: string;
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

function ReviewPaymentModal({ payment, onClose, onReviewed }: {
  readonly payment: ManualPaymentSubmission;
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
      await reviewManualPayment(payment.id, decision, note);
      onReviewed();
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setWorking(false);
    }
  };
  const openReceipt = async () => {
    try {
      const blob = await downloadAdminPaymentReceipt(payment.id);
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
      title={payment.method === 'CASH' ? 'Review cash payment' : 'Review bank transfer'}
      subtitle={payment.method === 'CASH' ? 'Approve only after matching the receipt to the institution cash record.' : 'Approve only after the transfer appears in the institution bank account.'}
      closeButton
      onClose={onClose}
      footer={<><button type="button" className="btn" disabled={working} onClick={() => void review('REJECTED')}>Reject receipt</button><button type="button" className="btn btn--primary" disabled={working} onClick={() => void review('APPROVED')}>{working ? 'Saving…' : 'Approve payment'}</button></>}
    >
      <div className="bank-transfer-review">
        <div className="bank-transfer-review__amount"><span>Submitted amount</span><strong>{formatMoney(payment.amount, payment.currency)}</strong></div>
        <dl>
          <div><dt>Student</dt><dd>{payment.studentName}<small>{payment.studentNumber}</small></dd></div>
          <div><dt>Method</dt><dd>{payment.method === 'CASH' ? 'Cash' : 'Bank transfer'}</dd></div>
          <div><dt>Submitted</dt><dd>{formatPaymentDate(payment.submittedAt.slice(0, 10))}</dd></div>
        </dl>
        {payment.studentNote && <p className="bank-transfer-review__note"><strong>Student note</strong>{payment.studentNote}</p>}
        <button type="button" className="bank-transfer-review__receipt" onClick={() => void openReceipt()}><span><strong>Open receipt</strong><small>{payment.receiptFileName}</small></span><IconArrowRight /></button>
        <label className="field"><span>Review note <small>Optional</small></span><textarea rows={3} value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} /></label>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

export default function ManualPaymentAdminPanel({ refreshToken, focusStudentId = '', onReviewed }: Props) {
  const [account, setAccount] = useState<PaymentBankAccount | null>(null);
  const [payments, setPayments] = useState<ManualPaymentSubmission[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingAccount, setEditingAccount] = useState(false);
  const [reviewing, setReviewing] = useState<ManualPaymentSubmission | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextAccount, queue] = await Promise.all([
        getPaymentBankAccount(),
        listPendingManualPayments(0, 100)
      ]);
      setAccount(nextAccount);
      setPayments([...queue.page.items].sort((left, right) => {
        if (!focusStudentId) return 0;
        return Number(right.studentId === focusStudentId) - Number(left.studentId === focusStudentId);
      }));
      setPendingCount(queue.pendingCount);
      setError('');
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [focusStudentId]);

  useEffect(() => { void load(); }, [load, refreshToken]);

  const reviewed = () => {
    setReviewing(null);
    void load();
    onReviewed();
  };

  return (
    <section className={`bank-transfer-admin${payments.length ? ' has-review-queue' : ''}`}>
      <header className="bank-transfer-admin__head">
        <div className="bank-transfer-admin__title">
          <span aria-hidden="true"><IconBank /></span>
          <div>
            <h2>Manual payment reviews</h2>
            <p>Verify cash and bank-transfer receipts before balances change.</p>
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
          {loading ? <output>Loading receipts…</output> : payments.length ? payments.map((payment) => (
            <button type="button" className={`bank-transfer-queue__row${payment.studentId === focusStudentId ? ' is-focused' : ''}`} key={payment.id} onClick={() => setReviewing(payment)}>
              <span><strong>{payment.studentName}</strong><small>{payment.method === 'CASH' ? 'Cash' : 'Bank transfer'} · {payment.invoiceTitle} · {formatPaymentDate(payment.submittedAt.slice(0, 10))}</small></span>
              <b>{formatMoney(payment.amount, payment.currency)}</b>
              <IconArrowRight />
            </button>
          )) : <div className="bank-transfer-queue__empty"><strong>No receipts waiting</strong><span>New submissions will appear here.</span></div>}
        </div>
      </div>
      {editingAccount && <BankAccountModal account={account} onClose={() => setEditingAccount(false)} onSaved={(saved) => { setAccount(saved); setEditingAccount(false); }} />}
      {reviewing && <ReviewPaymentModal payment={reviewing} onClose={() => setReviewing(null)} onReviewed={reviewed} />}
    </section>
  );
}
