import { useMemo, useState } from 'react';
import { apiMessage } from '../../../lib/apiClient';
import { createPaymentRequests } from '../api';
import Modal from '../../../components/Modal';
import PaymentDetailsStep from './PaymentDetailsStep';
import PaymentRecipientStep from './PaymentRecipientStep';
import PaymentReviewStep from './PaymentReviewStep';
import {
  calculateDraftTotal,
  createDraftLine,
  isPaymentDraftValid,
  studentCountLabel,
  toCreateInvoicePayload,
  type DraftLine,
  type SelectedStudents
} from '../paymentRequestDraft';

interface Props {
  readonly onClose: () => void;
  readonly onCreated: (count: number) => void;
}

function stepState(step: number, position: number) {
  if (step === position) return 'is-active';
  if (step > position) return 'is-complete';
  return '';
}

const STEPS = [
  { label: 'Students', detail: 'Choose recipients' },
  { label: 'Details', detail: 'Add charges' },
  { label: 'Review', detail: 'Check and issue' }
] as const;

export default function CreatePaymentRequestModal({ onClose, onCreated }: Props) {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<SelectedStudents>(new Map());
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([createDraftLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const total = useMemo(() => calculateDraftTotal(lines), [lines]);
  const validDetails = isPaymentDraftValid(title, dueDate, lines);
  const canContinue = step === 1 ? selected.size > 0 : validDetails;

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const result = await createPaymentRequests(
        toCreateInvoicePayload(selected, title, dueDate, note, lines)
      );
      onCreated(result.invoices.length);
    } catch (cause) {
      setError(apiMessage(cause));
      setSubmitting(false);
    }
  };

  let content = <PaymentRecipientStep selected={selected} onSelected={setSelected} />;
  if (step === 2) {
    content = (
      <PaymentDetailsStep
        title={title}
        dueDate={dueDate}
        note={note}
        lines={lines}
        onTitle={setTitle}
        onDueDate={setDueDate}
        onNote={setNote}
        onLines={setLines}
      />
    );
  } else if (step === 3) {
    content = (
      <PaymentReviewStep
        selected={selected}
        title={title}
        dueDate={dueDate}
        note={note}
        lines={lines}
      />
    );
  }

  const backAction = step === 1 ? onClose : () => setStep((current) => current - 1);
  const backLabel = step === 1 ? 'Cancel' : 'Back';
  const primaryAction = step === 3 ? (
    <button type="button" className="btn btn--primary" disabled={submitting} onClick={submit}>
      {submitting ? 'Issuing…' : `Issue to ${studentCountLabel(selected.size)}`}
    </button>
  ) : (
    <button
      type="button"
      className="btn btn--primary"
      disabled={!canContinue}
      onClick={() => setStep((current) => current + 1)}
    >
      Continue
    </button>
  );

  return (
    <Modal
      size="wide"
      className="payment-create-modal"
      title="Create payment request"
      subtitle="Prepare and issue a clear account statement."
      closeButton
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn" onClick={backAction}>{backLabel}</button>
          <span className="spacer" />
          {primaryAction}
        </>
      )}
    >
      <div className="payment-create-workspace">
        <div className="payment-stepper" aria-label={`Step ${step} of 3`}>
          {STEPS.map(({ label, detail }, index) => {
            const position = index + 1;
            return (
              <span key={label} className={stepState(step, position)} aria-current={step === position ? 'step' : undefined}>
                <i>{position}</i>
                <b>{label}</b>
                <small>{detail}</small>
              </span>
            );
          })}
        </div>
        <div className="payment-create-content">
          {error && <div className="notice notice--warn" role="alert">{error}</div>}
          {content}
        </div>
      </div>
    </Modal>
  );
}
