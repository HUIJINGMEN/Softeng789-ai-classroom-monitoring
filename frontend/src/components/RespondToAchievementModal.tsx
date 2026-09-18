import { type FormEvent, useState } from 'react';
import { accomplishmentCategoryLabel, formatAccomplishmentPoints } from '../lib/accomplishments';
import type { Accomplishment } from '../types';
import Modal from './Modal';

interface Props {
  readonly accomplishment: Accomplishment;
  readonly saving: boolean;
  readonly error: string;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly onSubmit: (message: string) => void;
}

export default function RespondToAchievementModal({
  accomplishment,
  saving,
  error,
  onClose,
  onConfirm,
  onSubmit
}: Props) {
  const [mode, setMode] = useState<'choose' | 'correction'>('choose');
  const [message, setMessage] = useState('');
  const trimmedMessage = message.trim();
  const completedDate = new Date(`${accomplishment.achievementDate}T00:00:00`).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  let previousResponse = '';
  if (accomplishment.latestCorrection?.status !== 'PENDING' && accomplishment.latestCorrection) {
    previousResponse = accomplishment.latestCorrection.staffResponse || 'Your previous change request has been reviewed.';
  } else if (accomplishment.acknowledgedAt) {
    previousResponse = 'You confirmed that these details are correct.';
  }
  const finishLabel = accomplishment.acknowledgedAt ? 'Done' : 'Everything is correct';
  const finish = accomplishment.acknowledgedAt ? onClose : onConfirm;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === 'correction' && trimmedMessage) onSubmit(trimmedMessage);
  };

  return (
    <Modal
      onClose={saving ? () => undefined : onClose}
      size="narrow"
      className="accomplishment-feedback-modal"
      titleId="respond-to-achievement-title"
      title="Check achievement"
      compactTitle
      subtitle="Your teacher shared this achievement with you."
      closeButton
      onSubmit={submit}
      footer={mode === 'choose' ? (
        <>
          <button type="button" className="btn" disabled={saving} onClick={() => setMode('correction')}>Something needs changing</button>
          <button type="button" className="btn btn--primary" disabled={saving} onClick={finish}>
            {saving ? 'Saving…' : finishLabel}
          </button>
        </>
      ) : (
        <>
          <button type="button" className="btn" disabled={saving} onClick={() => setMode('choose')}>Back to details</button>
          <button type="submit" className="btn btn--primary" disabled={saving || !trimmedMessage}>
            {saving ? 'Sending…' : 'Send change request'}
          </button>
        </>
      )}
    >
      <div className="accomplishment-feedback-modal__decision">
        <strong>{mode === 'choose' ? 'Is this achievement correct?' : 'What should your teacher change?'}</strong>
        <span>{mode === 'choose'
          ? 'Review the information below, then choose one response.'
          : 'Describe the incorrect detail and what it should say instead.'}</span>
      </div>
      <section className="accomplishment-feedback-modal__record" aria-label="Achievement details">
        <div className="accomplishment-feedback-modal__record-head">
          <div>
            <span>{accomplishmentCategoryLabel(accomplishment.category)}</span>
            <strong>{accomplishment.title}</strong>
          </div>
          {accomplishment.points !== null && <b>{formatAccomplishmentPoints(accomplishment.points)}</b>}
        </div>
        <dl className="accomplishment-feedback-modal__facts">
          <div><dt>Class</dt><dd>{accomplishment.classLabel}</dd></div>
          <div><dt>Completed</dt><dd>{completedDate}</dd></div>
          <div><dt>Recognised by</dt><dd>{accomplishment.confirmedByTeacherName ?? accomplishment.createdByTeacherName}</dd></div>
        </dl>
        {(accomplishment.description || accomplishment.studentNote) && (
          <div className="accomplishment-feedback-modal__copy-grid">
            {accomplishment.description && (
              <div className="accomplishment-feedback-modal__copy">
                <span>What was completed</span>
                <p>{accomplishment.description}</p>
              </div>
            )}
            {accomplishment.studentNote && (
              <div className="accomplishment-feedback-modal__copy accomplishment-feedback-modal__copy--personal">
                <span>Note from your teacher</span>
                <p>{accomplishment.studentNote}</p>
              </div>
            )}
          </div>
        )}
      </section>
      {mode === 'choose' ? (
        previousResponse && <div className="accomplishment-feedback-modal__history"><strong>Previous response</strong><span>{previousResponse}</span></div>
      ) : (
        <label className="field accomplishment-feedback-modal__message">
          <span>Change request</span>
          <textarea
            value={message}
            rows={4}
            maxLength={1200}
            autoFocus
            placeholder="Explain which detail is incorrect and what it should say."
            onChange={(event) => setMessage(event.target.value)}
          />
          <small>{message.length}/1200</small>
        </label>
      )}
      {error && <div className="form-error" role="alert">{error}</div>}
    </Modal>
  );
}
