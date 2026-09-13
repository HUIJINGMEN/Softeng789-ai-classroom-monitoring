import { useState } from 'react';
import Modal from './Modal';
import { apiMessage } from '../lib/apiClient';
import { emailFeedbackSummary, publishFeedbackSummary } from '../lib/feedbackSummaryApi';
import type { FeedbackSummary } from '../types';

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

  const run = async () => {
    if (!download && !email && !publish) return;
    setBusy(true); setError('');
    try {
      if (publish) await Promise.all(summaries.filter((item) => !item.publishedAt).map((item) => publishFeedbackSummary(item.id)));
      const deliveries = email ? await Promise.all(summaries.map((item) => emailFeedbackSummary(item.id))) : [];
      await onUpdated();
      onClose();
      if (deliveries.some((item) => item.status === 'DEMO')) showToast('Email delivery is in Demo mode; no external email was sent.');
      else if (email || publish) showToast('Selected sharing actions completed.');
      if (download) window.setTimeout(() => window.print(), 80);
    } catch (reason) {
      setError(apiMessage(reason));
    } finally { setBusy(false); }
  };

  return (
    <Modal
      size="confirm"
      onClose={busy ? () => undefined : onClose}
      closeButton
      titleId="export-share-title"
      title="Export & share"
      subtitle={hasReviewedSummary
        ? `${summaries.length} reviewed summar${summaries.length === 1 ? 'y' : 'ies'} selected. Choose how to deliver the report.`
        : 'No teacher feedback is available for this selection. The attendance and confirmed-event report can still be downloaded.'}
      footer={<><button type="button" className="btn" disabled={busy} onClick={onClose}>Cancel</button><button type="button" className="btn btn--primary" disabled={busy || (!download && !email && !publish)} onClick={() => void run()}>{busy ? 'Working…' : 'Continue'}</button></>}
    >
      <div className="modal__option-panel export-share-options">
        <label className="course-checklist__item"><input type="checkbox" checked={download} onChange={(e) => setDownload(e.target.checked)} /><span><strong>Download / print PDF</strong><small>Includes attendance, confirmed events and any reviewed AI summaries.</small></span></label>
        <label className={`course-checklist__item${hasReviewedSummary ? '' : ' is-disabled'}`}>
          <input type="checkbox" checked={email} disabled={!hasReviewedSummary} onChange={(e) => setEmail(e.target.checked)} />
          <span><strong>Email the student</strong><small>{hasReviewedSummary ? 'Uses the configured mail provider. Demo mode never sends externally.' : 'Requires at least one reviewed AI summary.'}</small></span>
        </label>
        <label className={`course-checklist__item${hasReviewedSummary ? '' : ' is-disabled'}`}>
          <input type="checkbox" checked={publish} disabled={!hasReviewedSummary} onChange={(e) => setPublish(e.target.checked)} />
          <span><strong>Publish to student portal</strong><small>{hasReviewedSummary ? 'Makes the reviewed summary visible in the student’s account.' : 'Requires at least one reviewed AI summary.'}</small></span>
        </label>
        {error && <div className="form-error" role="alert">{error}</div>}
      </div>
    </Modal>
  );
}
