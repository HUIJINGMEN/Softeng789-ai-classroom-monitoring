import { useId, useState } from 'react';
import Modal from './Modal';
import { apiMessage } from '../lib/apiClient';
import { emailFeedbackSummary, publishFeedbackSummary } from '../lib/feedbackSummaryApi';
import type { FeedbackSummary } from '../types';
import {
  reportEmailProblem,
  deliveryActionLabel,
  deliveryCompletionMessage
} from '../features/report-review';
import { countLabel } from '../lib/text';

interface Props {
  readonly summaries: readonly FeedbackSummary[];
  readonly onClose: () => void;
  readonly onUpdated: () => Promise<void> | void;
  readonly showToast: (message: string) => void;
}

export default function ExportShareModal({ summaries, onClose, onUpdated, showToast }: Props) {
  const hasReviewedSummary = summaries.length > 0;
  const [download, setDownload] = useState(true);
  const [email, setEmail] = useState(false);
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selectedActionCount = Number(download) + Number(email) + Number(publish);
  const actionLabel = deliveryActionLabel(download, email, publish);
  const reviewedLabel = countLabel(summaries.length, 'reviewed summary', 'reviewed summaries');

  const run = async () => {
    if (!download && !email && !publish) return;
    setBusy(true);
    setError('');
    try {
      if (publish)
        await Promise.all(
          summaries.filter((item) => !item.publishedAt).map((item) => publishFeedbackSummary(item.id))
        );
      const deliveries = email
        ? await Promise.all(summaries.map((item) => emailFeedbackSummary(item.id)))
        : [];
      await onUpdated();
      const deliveryProblem = reportEmailProblem(deliveries);
      if (deliveryProblem) {
        setError(deliveryProblem);
        return;
      }
      onClose();
      const message = deliveryCompletionMessage(deliveries, email || publish);
      if (message) showToast(message);
      if (download) window.setTimeout(() => window.print(), 80);
    } catch (reason) {
      setError(apiMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      size="confirm"
      className="modal--delivery"
      onClose={busy ? () => undefined : onClose}
      closeButton
      titleId="export-share-title"
      title="Deliver report"
      subtitle={
        hasReviewedSummary
          ? `${reviewedLabel} ready. Choose one or more delivery methods.`
          : 'No teacher feedback is available for this selection. The attendance and confirmed-event report can still be downloaded.'
      }
      footer={
        <>
          <button type="button" className="btn" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy || selectedActionCount === 0}
            onClick={() => void run()}
          >
            {busy ? 'Working…' : actionLabel}
          </button>
        </>
      }
    >
      <DeliveryOptions
        selectedActionCount={selectedActionCount}
        hasReviewedSummary={hasReviewedSummary}
        download={download}
        setDownload={setDownload}
        email={email}
        setEmail={setEmail}
        publish={publish}
        setPublish={setPublish}
        error={error}
      />
    </Modal>
  );
}

interface DeliveryOptionsProps {
  readonly selectedActionCount: number;
  readonly hasReviewedSummary: boolean;
  readonly download: boolean;
  readonly email: boolean;
  readonly publish: boolean;
  readonly error: string;
  readonly setDownload: (value: boolean) => void;
  readonly setEmail: (value: boolean) => void;
  readonly setPublish: (value: boolean) => void;
}

function DeliveryOptions({
  selectedActionCount,
  hasReviewedSummary,
  download,
  setDownload,
  email,
  setEmail,
  publish,
  setPublish,
  error
}: DeliveryOptionsProps) {
  const fieldIds = useId();
  return (
    <div className="modal__option-panel export-share-options">
      <div className="export-share-options__summary" aria-live="polite">
        <strong>{selectedActionCount} selected</strong>
        <span>
          {selectedActionCount === 0
            ? 'Choose at least one delivery method.'
            : 'You can combine download, email and portal publishing.'}
        </span>
      </div>
      <label
        aria-label="Download / print PDF"
        htmlFor={`${fieldIds}-field-0`}
        className="course-checklist__item"
      >
        <input
          id={`${fieldIds}-field-0`}
          type="checkbox"
          checked={download}
          onChange={(e) => setDownload(e.target.checked)}
        />
        <span>
          <strong>Download / print PDF</strong>
          <small>Includes attendance, confirmed events and any reviewed AI summaries.</small>
        </span>
      </label>
      <label
        aria-label="Email the student"
        htmlFor={`${fieldIds}-field-1`}
        className={`course-checklist__item${hasReviewedSummary ? '' : ' is-disabled'}`}
      >
        <input
          id={`${fieldIds}-field-1`}
          type="checkbox"
          checked={email}
          disabled={!hasReviewedSummary}
          onChange={(e) => setEmail(e.target.checked)}
        />
        <span>
          <strong>Email the student</strong>
          <small>
            {hasReviewedSummary
              ? 'Uses the configured mail provider. Demo mode never sends externally.'
              : 'Requires at least one reviewed AI summary.'}
          </small>
        </span>
      </label>
      <label
        aria-label="Publish to student portal"
        htmlFor={`${fieldIds}-field-2`}
        className={`course-checklist__item${hasReviewedSummary ? '' : ' is-disabled'}`}
      >
        <input
          id={`${fieldIds}-field-2`}
          type="checkbox"
          checked={publish}
          disabled={!hasReviewedSummary}
          onChange={(e) => setPublish(e.target.checked)}
        />
        <span>
          <strong>Publish to student portal</strong>
          <small>
            {hasReviewedSummary
              ? 'Makes the reviewed summary visible in the student’s account.'
              : 'Requires at least one reviewed AI summary.'}
          </small>
        </span>
      </label>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
