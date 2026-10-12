import { useEffect, useState } from 'react';
import { apiMessage } from '../../../lib/apiClient';
import { formatIsoDateInAuckland } from '../../../lib/sessionTime';
import Modal from '../../../components/Modal';
import { createStudentInvoiceBatch, previewStudentCharges } from '../api';
import {
  isStudentInvoiceBatchValid,
  studentPlansFromPreview,
  toStudentInvoiceBatchPayload,
  type SelectedStudents,
  type StudentInvoicePlan
} from '../paymentRequestDraft';
import type { StudentInvoice } from '../types';
import PaymentRecipientStep from './PaymentRecipientStep';
import StudentChargePlanStep from './StudentChargePlanStep';
import StudentInvoiceBatchReview from './StudentInvoiceBatchReview';

interface Props {
  readonly onClose: () => void;
  readonly onCreated: (invoices: StudentInvoice[]) => void;
  readonly initialCourseOfferingId?: string;
  readonly classLabel?: string;
  readonly initialStudents?: readonly { id: string; name: string }[];
}

function isoDateAfter(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatIsoDateInAuckland(date);
}

function stepState(step: number, position: number) {
  if (step === position) return 'is-active';
  if (step > position) return 'is-complete';
  return '';
}

const STEPS = [
  { label: 'Students', detail: 'Choose recipients' },
  { label: 'Charges', detail: 'Confirm each course' },
  { label: 'Review', detail: 'Check the batch' }
] as const;

function useInvoiceCreation({
  onClose,
  onCreated,
  initialCourseOfferingId,
  classLabel,
  initialStudents = []
}: Props) {
  const [step, setStep] = useState(initialStudents.length > 0 ? 2 : 1);
  const [selected, setSelected] = useState<SelectedStudents>(() => new Map(initialStudents.map((student) => [
    student.id,
    { student: { id: student.id, firstName: student.name, lastName: '' } }
  ])));
  const [plans, setPlans] = useState<StudentInvoicePlan[]>([]);
  const [title, setTitle] = useState(`${new Date().getFullYear()} course fees`);
  const [dueDate, setDueDate] = useState(() => isoDateAfter(14));
  const [note, setNote] = useState('');
  const [loadingSuggestions, setLoadingSuggestions] = useState(initialStudents.length > 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const prepareCharges = async (recipients: SelectedStudents) => {
    if (recipients.size === 0) return;
    setLoadingSuggestions(true);
    setError('');
    try {
      const preview = await previewStudentCharges({
        studentIds: [...recipients.keys()],
        ...(initialCourseOfferingId ? { preferredCourseOfferingId: initialCourseOfferingId } : {})
      });
      setPlans(studentPlansFromPreview(preview));
      setStep(2);
    } catch (cause) {
      setError(`Course charges could not be prepared: ${apiMessage(cause)}`);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    if (initialStudents.length > 0) void prepareCharges(selected);
    // Initial class-register recipients are loaded once. Returning to Students and continuing
    // deliberately refreshes the suggestions with the latest enrolments and invoice state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validCharges = Boolean(title.trim() && dueDate && isStudentInvoiceBatchValid(plans));
  const submit = async () => {
    if (!validCharges) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await createStudentInvoiceBatch(
        toStudentInvoiceBatchPayload(plans, title, dueDate, note)
      );
      onCreated(result.invoices);
    } catch (cause) {
      setError(apiMessage(cause));
      setSubmitting(false);
    }
  };

  return {
    step,
    selected,
    setSelected,
    initialCourseOfferingId,
    loadingSuggestions,
    plans,
    title,
    dueDate,
    note,
    setTitle,
    setDueDate,
    setNote,
    setPlans,
    submitting,
    onClose,
    setStep,
    validCharges,
    submit,
    prepareCharges,
    classLabel,
    error
  };
}

function InvoiceCreationStep({ model }: { readonly model: ReturnType<typeof useInvoiceCreation> }) {
  const {
    step,
    selected,
    setSelected,
    initialCourseOfferingId,
    loadingSuggestions,
    plans,
    title,
    dueDate,
    note,
    setTitle,
    setDueDate,
    setNote,
    setPlans
  } = model;
  let content;
  if (step === 1) {
    content = <PaymentRecipientStep selected={selected} onSelected={setSelected} courseOfferingId={initialCourseOfferingId} />;
  } else if (loadingSuggestions) {
    content = <output className="payment-page-state" aria-live="polite">Checking enrolments and existing invoices…</output>;
  } else if (step === 2) {
    content = plans.length > 0 ? (
      <StudentChargePlanStep
        title={title}
        dueDate={dueDate}
        note={note}
        plans={plans}
        onTitle={setTitle}
        onDueDate={setDueDate}
        onNote={setNote}
        onPlans={setPlans}
      />
    ) : (
      <div className="payment-page-state">
        <strong>No charge suggestions are available.</strong>
        <span>Return to the student step or retry after checking enrolments and class billing setup.</span>
      </div>
    );
  } else {
    content = <StudentInvoiceBatchReview plans={plans} title={title} dueDate={dueDate} note={note} />;
  }

  return content;
}

function InvoiceCreationAction({ model }: { readonly model: ReturnType<typeof useInvoiceCreation> }) {
  const {
    step,
    submitting,
    validCharges,
    submit,
    plans,
    loadingSuggestions,
    setStep,
    selected,
    prepareCharges
  } = model;
  if (step === 3) return (
    <button type="button" className="btn btn--primary" disabled={submitting || !validCharges} onClick={() => void submit()}>
      {submitting ? 'Creating…' : `Create ${plans.filter((plan) => plan.includeInBatch).length} invoice drafts`}
    </button>
  );
  if (step === 2) return (
    <button type="button" className="btn btn--primary" disabled={loadingSuggestions || !validCharges} onClick={() => setStep(3)}>
      Review invoice batch
    </button>
  );
  return (
    <button type="button" className="btn btn--primary" disabled={selected.size === 0 || loadingSuggestions} onClick={() => void prepareCharges(selected)}>
      {loadingSuggestions ? 'Preparing…' : `Continue with ${selected.size}`}
    </button>
  );

}

export default function CreatePaymentRequestModal({
  onClose,
  onCreated,
  initialCourseOfferingId,
  classLabel,
  initialStudents = []
}: Props) {
  const model = useInvoiceCreation({
    onClose,
    onCreated,
    initialCourseOfferingId,
    classLabel,
    initialStudents
  });
  const { step, loadingSuggestions, submitting, setStep, error, prepareCharges, selected } = model;

  const busy = loadingSuggestions || submitting;
  const backAction = step === 1 ? onClose : () => setStep((current) => current - 1);

  return (
    <Modal
      size="wide"
      className="payment-create-modal payment-create-modal--student-led"
      title="Create student invoices"
      subtitle={initialCourseOfferingId
        ? `${classLabel ?? 'Current class'} is highlighted and included when it is ready to charge. Review every other enrolled course before creating one combined invoice per student.`
        : 'ClassLens finds each student’s eligible course charges and combines them into one invoice.'}
      closeButton
      closeDisabled={busy}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn" disabled={busy} onClick={backAction}>{step === 1 ? 'Cancel' : 'Back'}</button>
          <span className="spacer" />
          <InvoiceCreationAction model={model} />
        </>
      )}
    >
      <div className="payment-create-workspace">
        <div className="payment-stepper" aria-label={`Step ${step} of 3`}>
          {STEPS.map(({ label, detail }, index) => {
            const position = index + 1;
            return (
              <button
                type="button"
                key={label}
                className={stepState(step, position)}
                aria-current={step === position ? 'step' : undefined}
                disabled={busy || position > step}
                onClick={() => position < step && setStep(position)}
              >
                <i>{position}</i><b>{label}</b><small>{detail}</small>
              </button>
            );
          })}
        </div>
        <div className="payment-create-content" aria-busy={busy}>
          {error && (
            <div className="notice notice--warn payment-create-error" role="alert">
              <span>{error}</span>
              {step === 2 && !loadingSuggestions && <button type="button" className="btn btn--sm" onClick={() => void prepareCharges(selected)}>Try again</button>}
            </div>
          )}
          <InvoiceCreationStep model={model} />
        </div>
      </div>
    </Modal>
  );
}
