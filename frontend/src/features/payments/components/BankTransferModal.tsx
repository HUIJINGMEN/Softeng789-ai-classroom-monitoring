import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Modal from '../../../components/Modal';
import { IconBank, IconUpload } from '../../../components/icons';
import { apiMessage } from '../../../lib/apiClient';
import { formatMoney } from '../format';
import { submitBankTransfer } from '../api';
import type { PaymentBankAccount, StudentInvoice } from '../types';

interface Props {
  readonly studentId: string;
  readonly invoice: StudentInvoice;
  readonly account: PaymentBankAccount;
  readonly onClose: () => void;
  readonly onSubmitted: () => void;
}

function Detail({ label, value, copyable = false }: {
  readonly label: string;
  readonly value: string;
  readonly copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="bank-transfer-detail">
      <span>{label}</span>
      <strong>{value}</strong>
      {copyable && <button type="button" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy'}</button>}
    </div>
  );
}

export default function BankTransferModal({ studentId, invoice, account, onClose, onSubmitted }: Props) {
  const [amount, setAmount] = useState(String(invoice.balance.toFixed(2)));
  const [note, setNote] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const parsedAmount = Number(amount);
  const canSubmit = useMemo(
    () => receipt && parsedAmount > 0 && parsedAmount <= invoice.balance && !submitting,
    [invoice.balance, parsedAmount, receipt, submitting]
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!receipt || !canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await submitBankTransfer(studentId, invoice.id, parsedAmount, note, receipt);
      onSubmitted();
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      size="wide"
      className="bank-transfer-modal"
      title="Pay by bank transfer"
      subtitle="Transfer externally, then upload the receipt so an administrator can verify it."
      closeButton
      onClose={onClose}
      onSubmit={submit}
      footer={(
        <>
          <button type="button" className="btn" disabled={submitting} onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={!canSubmit} aria-busy={submitting}>
            {submitting ? 'Submitting…' : 'Submit receipt for review'}
          </button>
        </>
      )}
    >
      <div className="bank-transfer-modal__layout">
        <section className="bank-transfer-account" aria-labelledby="bank-transfer-account-title">
          <div className="bank-transfer-account__head">
            <span><IconBank /></span>
            <div><h3 id="bank-transfer-account-title">Bank details</h3><p>Use these details in your banking app.</p></div>
          </div>
          <Detail label="Account name" value={account.accountName} />
          <Detail label="Bank" value={account.bankName} />
          <Detail label="Account number" value={account.accountNumber} copyable />
          {account.paymentReference && <Detail label="Reference" value={account.paymentReference} copyable />}
          {account.instructions && <p className="bank-transfer-account__instructions">{account.instructions}</p>}
        </section>

        <section className="bank-transfer-proof" aria-labelledby="bank-transfer-proof-title">
          <div className="bank-transfer-proof__head">
            <h3 id="bank-transfer-proof-title">Upload payment proof</h3>
            <p>{invoice.title} · balance {formatMoney(invoice.balance, invoice.currency)}</p>
          </div>
          <label className="field">
            <span>Amount transferred ({invoice.currency})</span>
            <input type="number" min="0.01" max={invoice.balance} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          </label>
          <label className={`bank-transfer-upload${receipt ? ' has-file' : ''}`}>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(event) => setReceipt(event.target.files?.[0] ?? null)}
              required
            />
            <IconUpload />
            <span><strong>{receipt ? receipt.name : 'Choose receipt'}</strong><small>PDF, JPG, PNG or WebP · up to 8 MB</small></span>
          </label>
          <label className="field">
            <span>Note <small>Optional</small></span>
            <textarea rows={3} maxLength={1000} value={note} placeholder="Add a reference or anything the reviewer should know." onChange={(event) => setNote(event.target.value)} />
          </label>
          {error && <p className="field-error" role="alert">{error}</p>}
        </section>
      </div>
    </Modal>
  );
}
