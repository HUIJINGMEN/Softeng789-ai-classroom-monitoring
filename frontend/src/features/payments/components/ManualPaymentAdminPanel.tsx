import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Modal from '../../../components/Modal';
import Pager from '../../../components/Pager';
import { IconArrowRight, IconBank } from '../../../components/icons';
import { apiMessage } from '../../../lib/apiClient';
import {
  getPaymentBankAccount,
  updatePaymentBankAccount
} from '../api';
import type { ManualPaymentSubmission, PaymentBankAccount } from '../types';
import { formatMoney } from '../format';
import { reviewSubmittedTime } from '../manualPaymentReviewModel';
import { useManualPaymentQueue } from '../useManualPaymentQueue';
import ReviewPaymentModal from './ReviewPaymentModal';

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

export default function ManualPaymentAdminPanel({ refreshToken, focusStudentId = '', onReviewed }: Props) {
  const [account, setAccount] = useState<PaymentBankAccount | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountError, setAccountError] = useState('');
  const [accountAttempt, setAccountAttempt] = useState(0);
  const [editingAccount, setEditingAccount] = useState(false);
  const [reviewing, setReviewing] = useState<ManualPaymentSubmission | null>(null);
  const queue = useManualPaymentQueue(refreshToken, focusStudentId);
  const payments = queue.data?.page.items ?? [];
  const page = queue.data?.page;

  useEffect(() => {
    let active = true;
    setAccountLoading(true);
    setAccountError('');
    getPaymentBankAccount().then(value => { if (active) setAccount(value); })
      .catch(cause => { if (active) setAccountError(`Could not load bank details. ${apiMessage(cause)}`); })
      .finally(() => { if (active) setAccountLoading(false); });
    return () => { active = false; };
  }, [refreshToken, accountAttempt]);

  const reviewed = () => {
    setReviewing(null);
    queue.reload();
    onReviewed();
  };

  return (
    <section className={`bank-transfer-admin${payments.length ? ' has-review-queue' : ''}`}>
      <header className="bank-transfer-admin__head">
        <div className="bank-transfer-admin__title">
          <span aria-hidden="true"><IconBank /></span>
          <div>
            <h2>Manual payment reviews</h2>
            <p>Verify cash records and bank-transfer receipts before balances change.</p>
          </div>
        </div>
        <button type="button" className="btn bank-transfer-admin__manage" disabled={accountLoading || Boolean(accountError)} onClick={() => setEditingAccount(true)}>
          <span>{account ? 'Manage bank details' : 'Set up bank transfer'}</span>
          <IconArrowRight />
        </button>
      </header>
      {accountError && <div className="notice notice--warn" role="alert">{accountError}<button type="button" className="btn btn--sm" onClick={() => setAccountAttempt(value => value + 1)}>Retry bank details</button></div>}
      <div className="bank-transfer-admin__body">
        <div className="bank-transfer-account-summary">
          <span>Student transfer account</span>
          <BankAccountSummary account={account} loading={accountLoading} error={accountError} />
        </div>
        <div className="bank-transfer-queue">
          <div className="bank-transfer-queue__head"><div><strong>Payments to review</strong><span>Oldest submissions appear first · Auckland time</span></div><b>{queue.data?.pendingCount ?? '—'}</b></div>
          {queue.studentId && <div className="bank-transfer-queue__scope"><span>Filtered to the selected student{payments[0] ? `: ${payments[0].studentName}` : ''}.</span><button type="button" className="btn btn--sm" onClick={queue.showAll}>Show all students</button></div>}
          <PendingPayments queue={queue} focusStudentId={focusStudentId} onReview={setReviewing} />
          {page && <Pager label={page.totalItems ? `Showing ${page.page * page.size + 1}–${Math.min((page.page + 1) * page.size, page.totalItems)} of ${page.totalItems} pending payments` : '0 pending payments'}
            page={page.page} pageCount={page.totalPages} canPrev={page.hasPrevious} canNext={page.hasNext}
            onPrev={() => queue.setPage(page.page - 1)} onNext={() => queue.setPage(page.page + 1)} onGoToPage={queue.setPage} />}
        </div>
      </div>
      {editingAccount && <BankAccountModal account={account} onClose={() => setEditingAccount(false)} onSaved={(saved) => { setAccount(saved); setEditingAccount(false); }} />}
      {reviewing && <ReviewPaymentModal payment={reviewing} onClose={() => setReviewing(null)} onReviewed={reviewed} />}
    </section>
  );
}

function BankAccountSummary({ account, loading, error }: {
  readonly account: PaymentBankAccount | null;
  readonly loading: boolean;
  readonly error: string;
}) {
  if (loading) return <output>Loading bank details…</output>;
  if (error) return <strong>Bank details unavailable</strong>;
  if (!account) return <div className="bank-transfer-account-summary__identity"><strong>Not configured</strong><small>Students cannot submit bank receipts until details are added.</small></div>;
  return <><div className="bank-transfer-account-summary__identity"><strong>{account.accountName}</strong><small>{account.bankName}</small></div><b>{account.accountNumber}</b></>;
}

function PendingPayments({ queue, focusStudentId, onReview }: {
  readonly queue: ReturnType<typeof useManualPaymentQueue>;
  readonly focusStudentId: string;
  readonly onReview: (payment: ManualPaymentSubmission) => void;
}) {
  if (queue.loading) return <output>Loading pending payments…</output>;
  if (queue.error) return <div className="notice notice--warn" role="alert">{queue.error}<button type="button" className="btn btn--sm" onClick={queue.reload}>Retry</button></div>;
  const payments = queue.data?.page.items ?? [];
  if (!payments.length) return <div className="bank-transfer-queue__empty"><strong>{queue.studentId ? 'No pending payments for this student' : 'No payments waiting'}</strong><span>New submissions will appear here.</span></div>;
  return <>{payments.map(payment => (
    <button type="button" className={`bank-transfer-queue__row${payment.studentId === focusStudentId ? ' is-focused' : ''}`} key={payment.id} onClick={() => onReview(payment)}>
      <span><strong>{payment.studentName}</strong><small>{payment.method === 'CASH' ? 'Cash' : 'Bank transfer'} · {payment.invoiceTitle}</small><time dateTime={payment.submittedAt}>{reviewSubmittedTime(payment.submittedAt)}</time></span>
      <b>{formatMoney(payment.amount, payment.currency)}</b>
      <IconArrowRight />
    </button>
  ))}</>;
}
