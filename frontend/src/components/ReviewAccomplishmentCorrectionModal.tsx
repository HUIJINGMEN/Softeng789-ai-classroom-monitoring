import { type FormEvent, useState } from 'react';
import {
  ACCOMPLISHMENT_CATEGORIES,
  formatAccomplishmentPoints
} from '../lib/accomplishments';
import {
  reviewAccomplishmentCorrection,
  type ReviewAccomplishmentCorrectionInput
} from '../lib/accomplishmentApi';
import { apiMessage } from '../lib/apiClient';
import type { Accomplishment, AccomplishmentCategory } from '../types';
import Modal from './Modal';
import SelectMenu from './SelectMenu';

interface Props {
  readonly accomplishment: Accomplishment;
  readonly onClose: () => void;
  readonly onReviewed: (updated: Accomplishment) => void;
  readonly showToast: (message: string) => void;
}

export default function ReviewAccomplishmentCorrectionModal({
  accomplishment,
  onClose,
  onReviewed,
  showToast
}: Props) {
  const correction = accomplishment.latestCorrection;
  const [category, setCategory] = useState<AccomplishmentCategory>(accomplishment.category);
  const [title, setTitle] = useState(accomplishment.title);
  const [description, setDescription] = useState(accomplishment.description ?? '');
  const [studentNote, setStudentNote] = useState(accomplishment.studentNote ?? '');
  const [points, setPoints] = useState(accomplishment.points === null ? '' : String(accomplishment.points));
  const [achievementDate, setAchievementDate] = useState(accomplishment.achievementDate);
  const [includeInReport, setIncludeInReport] = useState(accomplishment.includeInReport);
  const [staffResponse, setStaffResponse] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!correction || correction.status !== 'PENDING') return null;

  const payload = (
    decision: ReviewAccomplishmentCorrectionInput['decision']
  ): ReviewAccomplishmentCorrectionInput => ({
    decision,
    category,
    title: title.trim(),
    description: description.trim(),
    studentNote: studentNote.trim(),
    points: points === '' ? null : Number(points),
    achievementDate,
    includeInReport,
    staffResponse: staffResponse.trim()
  });

  const submit = async (decision: ReviewAccomplishmentCorrectionInput['decision']) => {
    const numericPoints = points === '' ? null : Number(points);
    if (!title.trim() || !achievementDate) {
      setError('Add a title and achievement date before resolving this request.');
      return;
    }
    if (numericPoints !== null && (!Number.isFinite(numericPoints) || numericPoints < 0)) {
      setError('Points must be zero or a positive number.');
      return;
    }
    if (decision === 'DECLINED' && !staffResponse.trim()) {
      setError('Tell the student why the original record is being kept.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const updated = await reviewAccomplishmentCorrection(accomplishment.id, payload(decision));
      onReviewed(updated);
      showToast(decision === 'ACCEPTED' ? 'Record updated and correction resolved.' : 'Correction request declined.');
      onClose();
    } catch (caught) {
      setError(apiMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const accept = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit('ACCEPTED');
  };

  return (
    <Modal
      onClose={saving ? () => undefined : onClose}
      size="wide"
      className="accomplishment-review-modal"
      titleId="review-accomplishment-correction-title"
      title={(
        <span className="modal-task-title">
          <span>Review student request</span>
          <span className="badge badge--warn">Action required</span>
        </span>
      )}
      compactTitle
      subtitle={`${accomplishment.studentName} · ${accomplishment.classLabel}`}
      closeButton
      onSubmit={accept}
      footer={(
        <>
          <button type="button" className="btn" disabled={saving} onClick={() => void submit('DECLINED')}>
            {saving ? 'Saving…' : 'Decline request'}
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Apply corrected details'}
          </button>
        </>
      )}
    >
      <section className="accomplishment-review-modal__request" aria-label="Student request">
        <header>
          <span aria-hidden="true">{accomplishment.studentName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)}</span>
          <div>
            <strong>{accomplishment.studentName} requested a change</strong>
            <small>{accomplishment.title}</small>
          </div>
        </header>
        <blockquote>{correction.message}</blockquote>
      </section>

      <div className="accomplishment-review-modal__form">
        <div className="accomplishment-review-modal__section-head">
          <div>
            <strong>Resolve this request</strong>
            <span>Update the relevant detail and apply it, or leave the record unchanged and decline.</span>
          </div>
        </div>
        <div className="accomplishment-review-modal__core-fields">
          <label className="field field--wide">
            <span>Achievement</span>
            <input value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="field">
            <span>Date completed</span>
            <input type="date" value={achievementDate} onChange={(event) => setAchievementDate(event.target.value)} />
          </label>
          <label className="field">
            <span>Points <small>{formatAccomplishmentPoints(accomplishment.points) ?? 'Optional'}</small></span>
            <input type="number" min="0" step="0.5" value={points} placeholder="No points" onChange={(event) => setPoints(event.target.value)} />
          </label>
          <label className="field">
            <span>Type</span>
            <SelectMenu value={category} options={ACCOMPLISHMENT_CATEGORIES} onChange={setCategory} ariaLabel="Achievement type" />
          </label>
        </div>

        <details className="accomplishment-review-modal__more">
          <summary>More details and report settings</summary>
          <div>
            <label className="field">
              <span>Description <small>Optional</small></span>
              <textarea value={description} rows={2} maxLength={4000} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <label className="field">
              <span>Note to student <small>Optional</small></span>
              <textarea value={studentNote} rows={2} maxLength={2000} onChange={(event) => setStudentNote(event.target.value)} />
            </label>
            <label className="check-row accomplishment-modal__report-toggle">
              <input type="checkbox" checked={includeInReport} onChange={(event) => setIncludeInReport(event.target.checked)} />
              <span><strong>Include in reports</strong><small>Use the corrected record in matching reports.</small></span>
            </label>
          </div>
        </details>

        <label className="field accomplishment-review-modal__response">
          <span>Message to student <small>Required when declining</small></span>
          <textarea
            value={staffResponse}
            rows={3}
            maxLength={1200}
            placeholder="Explain the decision briefly. Optional when applying the correction."
            onChange={(event) => setStaffResponse(event.target.value)}
          />
          <small>{staffResponse.length}/1200</small>
        </label>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
    </Modal>
  );
}
