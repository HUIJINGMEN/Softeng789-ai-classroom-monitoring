import { useCallback, useEffect, useState } from 'react';
import Modal from '../../../components/Modal';
import { IconChevronRight } from '../../../components/icons';
import { apiMessage } from '../../../lib/apiClient';
import { formatSessionDateLabel, formatSessionTimeRange } from '../../../lib/sessionTime';
import { listAdminMakeupRequests, reviewLessonMakeupRequest } from '../api';
import type { LessonMakeupRequest } from '../types';

function ReviewMakeupModal({ request, onClose, onResolved }: {
  readonly request: LessonMakeupRequest;
  readonly onClose: () => void;
  readonly onResolved: (decision: 'APPROVE' | 'DECLINE') => void;
}) {
  const [declineMode, setDeclineMode] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const review = async (decision: 'APPROVE' | 'DECLINE') => {
    if (decision === 'DECLINE' && !note.trim()) return;
    setBusy(true);
    setError('');
    try {
      await reviewLessonMakeupRequest(request.id, decision, note);
      onResolved(decision);
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      size="wide"
      className="makeup-review-modal"
      title="Review make-up request"
      subtitle={`${request.studentName} · ${request.studentNumber}`}
      closeButton
      onClose={onClose}
      footer={<>
        <button type="button" className="btn" disabled={busy} onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn--danger" disabled={busy} onClick={() => setDeclineMode((value) => !value)}>{declineMode ? 'Keep reviewing' : 'Decline'}</button>
        <span className="spacer" />
        <button type="button" className="btn btn--primary" disabled={busy || (declineMode && !note.trim())} onClick={() => void review(declineMode ? 'DECLINE' : 'APPROVE')}>
          {busy ? 'Saving…' : declineMode ? 'Confirm decline' : 'Approve date'}
        </button>
      </>}
    >
      <div className="fee-review-workspace">
        <section className="fee-review-source">
          <span>Missed lesson</span>
          <h3>{request.courseCode} · {request.missedSessionDate ? formatSessionDateLabel(request.missedSessionDate) : 'Date unavailable'}</h3>
          <p>{request.studentNote || 'The student did not add a note.'}</p>
          <small>Credit expires {formatSessionDateLabel(request.creditExpiresOn)}</small>
        </section>
        <section className="fee-review-quote makeup-review-choice">
          <div><span>{declineMode ? 'Response' : 'Requested replacement'}</span><strong>{declineMode ? 'Explain why another date is needed' : formatSessionDateLabel(request.preferredSessionDate)}</strong></div>
          {!declineMode && (
            <dl>
              <div><dt>Time</dt><dd>{formatSessionTimeRange(request.preferredStartTime, request.preferredEndTime, request.preferredSessionDate)}</dd></div>
              <div><dt>Location</dt><dd>{[request.room, request.campus].filter(Boolean).join(' · ') || 'To be confirmed'}</dd></div>
            </dl>
          )}
          <label className="field">
            <span>{declineMode ? 'Reason' : 'Admin note'} <small>{declineMode ? 'Required' : 'Optional'}</small></span>
            <textarea rows={3} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder={declineMode ? 'Tell the student why this date cannot be used.' : 'Add a note for the audit trail.'} />
          </label>
          {!declineMode && <p className="makeup-review-choice__note">Approval books this exact lesson and checks capacity again.</p>}
          {error && <p className="field-error" role="alert">{error}</p>}
        </section>
      </div>
    </Modal>
  );
}

export default function AdminMakeupRequestsPanel({ onReviewed }: { readonly onReviewed: (message: string) => void }) {
  const [requests, setRequests] = useState<LessonMakeupRequest[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<LessonMakeupRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listAdminMakeupRequests(0, 10);
      setRequests(result.page.items);
      setCount(result.submittedCount);
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className={`admin-fee-requests admin-makeup-requests${count ? ' has-requests' : ''}`}>
      <header><div><span>Schedule requests</span><h2>Make-up lessons</h2><p>Approve a specific replacement lesson before the credit expires.</p></div><b>{count}</b></header>
      {error && <div className="notice notice--warn" role="alert">{error}</div>}
      {loading && <output className="admin-fee-requests__state">Checking make-up requests…</output>}
      {!loading && requests.length === 0 && <p className="admin-fee-requests__state">No make-up requests need review.</p>}
      {requests.length > 0 && (
        <div className="admin-fee-request-list">
          {requests.map((item) => (
            <button type="button" key={item.id} onClick={() => setSelected(item)}>
              <span><strong>{item.studentName}</strong><small>{item.studentNumber}</small></span>
              <span><strong>{item.courseCode} · {formatSessionDateLabel(item.preferredSessionDate)}</strong><small>Missed {item.missedSessionDate ? formatSessionDateLabel(item.missedSessionDate) : 'lesson'}</small></span>
              <em>Review</em><IconChevronRight />
            </button>
          ))}
        </div>
      )}
      {selected && (
        <ReviewMakeupModal
          request={selected}
          onClose={() => setSelected(null)}
          onResolved={(decision) => {
            setSelected(null);
            void load();
            onReviewed(decision === 'APPROVE' ? 'Make-up lesson approved and booked.' : 'Make-up request declined.');
          }}
        />
      )}
    </section>
  );
}
