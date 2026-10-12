import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import Modal from '../../../components/Modal';
import { IconArrowRight, IconBank, IconUpload, IconWallet } from '../../../components/icons';
import { apiMessage } from '../../../lib/apiClient';
import { submitManualPayment } from '../api';
import { formatMoney } from '../format';
import type { ManualPaymentMethod, PaymentBankAccount, StudentInvoice } from '../types';

interface Props {
  readonly studentId: string;
  readonly invoice: StudentInvoice;
  readonly account: PaymentBankAccount | null;
  readonly demoMode: boolean;
  readonly onClose: () => void;
  readonly onCardPayment: (invoice: StudentInvoice) => void;
  readonly onSubmitted: () => void;
}

type PaymentChoice = 'CARD' | ManualPaymentMethod;

const METHOD_COPY: Record<ManualPaymentMethod, { title: string; description: string; receipt: string }> = {
  BANK_TRANSFER: {
    title: 'Bank transfer',
    description: 'Transfer through your banking app, then upload the confirmation.',
    receipt: 'Bank transfer confirmation'
  },
  CASH: {
    title: 'Cash',
    description: 'Pay in person, keep the official receipt, then upload it for review.',
    receipt: 'Official cash receipt'
  }
};

function MethodOption({ title, description, disabled, icon, onClick }: {
  readonly title: string;
  readonly description: string;
  readonly disabled?: boolean;
  readonly icon: ReactNode;
  readonly onClick: () => void;
}) {
  return (
    <button type="button" className="payment-method-option" disabled={disabled} onClick={onClick}>
      <span className="payment-method-option__icon" aria-hidden="true">{icon}</span>
      <span><strong>{title}</strong><small>{description}</small></span>
      <IconArrowRight />
    </button>
  );
}

function usePaymentMethod({ studentId, invoice, account, demoMode, onClose, onCardPayment, onSubmitted }: Props) {
  const [method, setMethod] = useState<PaymentChoice | null>(null);
  const [amount, setAmount] = useState(invoice.balance.toFixed(2));
  const [note, setNote] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const choose = (choice: PaymentChoice) => {
    if (choice === 'CARD') {
      onClose();
      onCardPayment(invoice);
      return;
    }
    setMethod(choice);
    setReceipt(null);
    setError('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!method || method === 'CARD' || !receipt) return;
    setSaving(true);
    setError('');
    try {
      await submitManualPayment(studentId, invoice.id, method, Number(amount), note, receipt);
      onSubmitted();
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const copy = method && method !== 'CARD' ? METHOD_COPY[method] : null;

  return {
    copy,
    invoice,
    onClose,
    submit,
    saving,
    setMethod,
    receipt,
    demoMode,
    choose,
    account,
    method,
    amount,
    setAmount,
    setReceipt,
    note,
    setNote,
    error
  };
}

function ManualPaymentForm({ model }: { readonly model: ReturnType<typeof usePaymentMethod> }) {
  const { method, copy, account, invoice, amount, setAmount, receipt, setReceipt, note, setNote, error } =
    model;
  if (!copy) return null;
  return (
    <div className="manual-payment-form">
      <div className="manual-payment-guidance">
        <span className="manual-payment-guidance__icon" aria-hidden="true">{method === 'BANK_TRANSFER' ? <IconBank /> : <span className="payment-method-cash">$</span>}</span>
        <div>
          <strong>{method === 'BANK_TRANSFER' ? 'Transfer before submitting' : 'Pay in person before submitting'}</strong>
          <p>{copy.description}</p>
        </div>
      </div>

      {method === 'BANK_TRANSFER' && account && (
        <dl className="manual-payment-account">
          <div><dt>Account name</dt><dd>{account.accountName}</dd></div>
          <div><dt>Bank</dt><dd>{account.bankName}</dd></div>
          <div><dt>Account number</dt><dd>{account.accountNumber}</dd></div>
          {account.paymentReference && <div><dt>Reference</dt><dd>{account.paymentReference}</dd></div>}
        </dl>
      )}

      <label className="field"><span>Amount paid</span><div className="money-input"><span>$</span><input type="number" min="0.01" max={invoice.balance} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div></label>
      <label className={`manual-payment-upload${receipt ? ' has-file' : ''}`}>
        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setReceipt(event.target.files?.[0] ?? null)} required />
        <IconUpload />
        <span><strong>{receipt ? receipt.name : `Upload ${copy.receipt.toLowerCase()}`}</strong><small>JPG, PNG, WebP or PDF · max 8 MB</small></span>
      </label>
      <label className="field"><span>Note <small>Optional</small></span><textarea rows={3} maxLength={1000} value={note} placeholder={method === 'CASH' ? 'e.g. Paid at the reception desk' : 'Add a transfer detail if the reviewer may need it'} onChange={(event) => setNote(event.target.value)} /></label>
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

export default function PaymentMethodModal({ studentId, invoice, account, demoMode, onClose, onCardPayment, onSubmitted }: Props) {
  const model = usePaymentMethod({
    studentId,
    invoice,
    account,
    demoMode,
    onClose,
    onCardPayment,
    onSubmitted
  });
  const { copy, submit, saving, setMethod, receipt, choose } = model;

  return (
    <Modal
      size="narrow"
      className="payment-method-modal"
      title={copy ? copy.title : 'Choose how to pay'}
      subtitle={copy ? `Submit proof for ${invoice.title}.` : `${invoice.title} · ${formatMoney(invoice.balance, invoice.currency)} due`}
      closeButton
      onClose={onClose}
      onSubmit={copy ? submit : undefined}
      footer={copy ? <>
        <button type="button" className="btn" disabled={saving} onClick={() => setMethod(null)}>Back</button>
        <button type="submit" className="btn btn--primary" disabled={saving || !receipt}>{saving ? 'Submitting…' : 'Submit for review'}</button>
      </> : undefined}
    >
      {!copy ? (
        <div className="payment-method-list">
          <MethodOption title="Pay by card" description={demoMode ? 'Demo checkout — no real card is charged.' : 'Continue to secure card checkout.'} icon={<IconWallet />} onClick={() => choose('CARD')} />
          <MethodOption title="Bank transfer" description={account ? METHOD_COPY.BANK_TRANSFER.description : 'Bank details have not been published yet.'} disabled={!account} icon={<IconBank />} onClick={() => choose('BANK_TRANSFER')} />
          <MethodOption title="Cash" description={METHOD_COPY.CASH.description} icon={<span className="payment-method-cash">$</span>} onClick={() => choose('CASH')} />
        </div>
      ) : (
        <ManualPaymentForm model={model} />
      )}
    </Modal>
  );
}
