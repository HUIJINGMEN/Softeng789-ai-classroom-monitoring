import { useCallback, useEffect, useState } from 'react';
import { apiMessage } from '../../lib/apiClient';
import {
  listAdminStudentSupportRequests,
  reviewStudentSupportRequest,
  type LeaveLessonTreatment,
  type StudentRequestReviewDecision,
  type StudentRequestType,
  type StudentSupportRequest
} from '../../lib/studentSupportApi';
import { formatSessionDateLabel, formatSessionTimeRange } from '../../lib/sessionTime';
import Modal from '../../components/Modal';

const TYPE_LABELS: Record<StudentRequestType, string> = {
  LEAVE: 'Leave request',
  SCHEDULE_CHANGE: 'Class or timetable',
  PAYMENT_QUESTION: 'Payment question',
  MAKEUP: 'Make-up question',
  GENERAL: 'General enquiry'
};

const REASON_LABELS: Record<NonNullable<StudentSupportRequest['leaveReason']>, string> = {
  ILLNESS: 'Illness or medical appointment',
  FAMILY: 'Family reason',
  SCHOOL_COMMITMENT: 'School or study commitment',
  EMERGENCY: 'Emergency',
  OTHER: 'Other reason'
};

function submittedLabel(value: string) {
  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Pacific/Auckland'
  }).format(new Date(value));
}

function RequestReviewModal({ request, onClose, onResolved }: {
  readonly request: StudentSupportRequest;
  readonly onClose: () => void;
  readonly onResolved: (message: string) => void;
}) {
  const [note, setNote] = useState('');
  const [lessonTreatment, setLessonTreatment] = useState<LeaveLessonTreatment | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const decide = async (decision: StudentRequestReviewDecision) => {
    if (!note.trim()) {
      setError('Write a reply for the student or parent.');
      return;
    }
    if (decision === 'APPROVE' && request.lessonTreatmentRequired && !lessonTreatment) {
      setError('Choose what happens to the prepaid lesson.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await reviewStudentSupportRequest(
        request.id,
        decision,
        note.trim(),
        decision === 'APPROVE' && lessonTreatment ? lessonTreatment : undefined
      );
      const approvalMessage = lessonTreatment === 'ALLOW_MAKEUP'
        ? 'Leave approved, attendance updated and a make-up created.'
        : lessonTreatment === 'KEEP_CHARGED'
          ? 'Leave approved, attendance updated and the lesson kept charged.'
          : 'Leave approved and attendance updated.';
      onResolved(decision === 'APPROVE' ? approvalMessage : decision === 'DECLINE' ? 'Request declined with a reply.' : 'Request answered and resolved.');
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const sessionCopy = request.sessionDate && request.sessionStartTime && request.sessionEndTime
    ? `${formatSessionDateLabel(request.sessionDate)} · ${formatSessionTimeRange(request.sessionStartTime, request.sessionEndTime, request.sessionDate)}`
    : null;
  const isLeaveRequest = request.type === 'LEAVE';
  const hasLessonContext = Boolean(request.courseCode || sessionCopy || request.leaveReason);
  const requesterCopy = request.requesterRole === 'PARENT_GUARDIAN'
    ? `${request.contactName} · ${request.relationshipToStudent ?? 'Parent or guardian'}`
    : `${request.contactName} · Student`;
  const approvedAttendanceLabel = request.leaveReason === 'ILLNESS' ? 'Sick / medical absence' : 'Approved leave';
  const approveDisabled = busy || !note.trim() || (request.lessonTreatmentRequired && !lessonTreatment);

  return (
    <Modal
      size="wide"
      className="student-request-review-modal"
      title="Review request"
      compactTitle
      subtitle={`${request.studentName} · ${request.studentNumber} · Submitted ${submittedLabel(request.submittedAt)}`}
      closeButton
      closeDisabled={busy}
      onClose={onClose}
      footer={<>
        <button type="button" className="btn student-request-review-modal__close-action" disabled={busy} onClick={onClose}>Close</button>
        <div className="student-request-review-modal__actions">
          {isLeaveRequest && <button type="button" className="btn" disabled={busy || !note.trim()} onClick={() => void decide('DECLINE')}>Decline leave</button>}
          <button type="button" className="btn btn--primary" disabled={isLeaveRequest ? approveDisabled : busy || !note.trim()} onClick={() => void decide(isLeaveRequest ? 'APPROVE' : 'RESOLVE')}>
            {busy ? 'Saving…' : isLeaveRequest ? 'Approve leave' : 'Save reply & resolve'}
          </button>
        </div>
      </>}
    >
      <div className="student-request-review-layout">
        <section className="student-request-review-message">
          <header>
            <div>
              <h2>{request.subject}</h2>
              <p>Message from {request.contactName}</p>
            </div>
            <span className={`student-request-review-message__type is-${request.type.toLowerCase()}`}>{TYPE_LABELS[request.type]}</span>
          </header>
          <blockquote>{request.message}</blockquote>
          <div className="student-request-review-message__contact">
            <div><span>Submitted by</span><strong>{requesterCopy}</strong></div>
            <div><span>Reply to</span><strong>{request.contactEmail}</strong>{request.contactPhone && <small>{request.contactPhone}</small>}</div>
          </div>
        </section>
        <section className="student-request-review-context">
          {hasLessonContext && <div className="student-request-review-context__lesson">
            <h3>Lesson details</h3>
            <dl>
              {request.courseCode && <div><dt>Class</dt><dd>{request.courseCode}<small>{request.courseName}</small></dd></div>}
              {sessionCopy && <div><dt>Lesson</dt><dd>{sessionCopy}</dd></div>}
              {request.leaveReason && <div><dt>Reason</dt><dd>{REASON_LABELS[request.leaveReason]}</dd></div>}
            </dl>
          </div>}
          <div className="student-request-review-context__head">
            <h3>{isLeaveRequest ? 'Decision and reply' : 'Reply to the requester'}</h3>
            <p>{isLeaveRequest ? 'Confirm the attendance record and explain the decision.' : `Your reply will be saved for ${request.contactName} and this request will be marked as resolved.`}</p>
          </div>
          {isLeaveRequest && (
            <section className="student-request-review-outcome" aria-labelledby="leave-outcome-title">
              <div className="student-request-review-outcome__summary">
                <span id="leave-outcome-title">Approval will record</span>
                <strong>{approvedAttendanceLabel}</strong>
                <small>The selected lesson will update in the class register immediately.</small>
              </div>
              {request.lessonTreatmentRequired ? (
                <fieldset className="student-request-review-treatment">
                  <legend>Prepaid lesson treatment <small>Required</small></legend>
                  <label className={lessonTreatment === 'KEEP_CHARGED' ? 'is-selected' : ''}>
                    <input type="radio" name="lesson-treatment" value="KEEP_CHARGED" checked={lessonTreatment === 'KEEP_CHARGED'} disabled={busy} onChange={() => { setLessonTreatment('KEEP_CHARGED'); setError(''); }} />
                    <span><strong>Keep lesson charged</strong><small>The absence is recorded and this paid lesson is used.</small></span>
                  </label>
                  <label className={lessonTreatment === 'ALLOW_MAKEUP' ? 'is-selected' : ''}>
                    <input type="radio" name="lesson-treatment" value="ALLOW_MAKEUP" checked={lessonTreatment === 'ALLOW_MAKEUP'} disabled={busy} onChange={() => { setLessonTreatment('ALLOW_MAKEUP'); setError(''); }} />
                    <span><strong>Allow a make-up</strong><small>The absence is recorded and a replacement lesson becomes available.</small></span>
                  </label>
                </fieldset>
              ) : (
                <p className="student-request-review-outcome__access"><strong>Course access stays unchanged.</strong> No individual lesson balance needs adjusting.</p>
              )}
            </section>
          )}
          <label className="field">
            <span>Reply <small>Required</small></span>
            <textarea autoFocus rows={7} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder={isLeaveRequest ? 'Confirm the outcome and explain what happens to attendance or the lesson.' : 'Write a clear answer and include any next step.'} />
          </label>
          <div className="student-request-review-context__helper">
            <span>{isLeaveRequest ? 'Approval updates attendance and saves this reply to the student account.' : 'The requester can read this reply in their student account.'}</span>
            <span>{note.length} / 2000</span>
          </div>
          {error && <p className="field-error" role="alert">{error}</p>}
        </section>
      </div>
    </Modal>
  );
}

export default function AdminStudentRequestsPanel({ onReviewed }: { readonly onReviewed: (message: string) => void }) {
  const [requests, setRequests] = useState<StudentSupportRequest[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<StudentSupportRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listAdminStudentSupportRequests(0, 30);
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
    <section className={`admin-student-requests${count ? ' has-requests' : ''}`}>
      <header><div><h3>Student and parent requests</h3><p>Questions, leave notices and class requests sent through Contact school.</p></div><b>{count}</b></header>
      {loading && <output className="admin-student-requests__state">Checking requests…</output>}
      {error && <div className="admin-student-requests__state is-error" role="alert"><span>{error}</span><button type="button" className="btn btn--sm" onClick={() => void load()}>Try again</button></div>}
      {!loading && !error && requests.length === 0 && <p className="admin-student-requests__state">No Contact school requests need review.</p>}
      {!loading && !error && requests.length > 0 && (
        <div className="admin-student-requests__list">
          {requests.map((request) => (
            <button type="button" key={request.id} onClick={() => setSelected(request)}>
              <span className={`admin-student-requests__type is-${request.type.toLowerCase()}`}>{TYPE_LABELS[request.type]}</span>
              <span className="admin-student-requests__person"><strong>{request.studentName}</strong><small>{request.requesterRole === 'PARENT_GUARDIAN' ? `Sent by ${request.contactName}` : request.studentNumber}</small></span>
              <span className="admin-student-requests__subject"><strong>{request.subject}</strong><small>{request.courseCode ?? 'School office'}{request.sessionDate ? ` · ${formatSessionDateLabel(request.sessionDate)}` : ''}</small></span>
              <time>{submittedLabel(request.submittedAt)}</time>
              <span className="admin-student-requests__review">Review</span>
            </button>
          ))}
        </div>
      )}
      {selected && <RequestReviewModal request={selected} onClose={() => setSelected(null)} onResolved={(message) => { setSelected(null); onReviewed(message); void load(); }} />}
    </section>
  );
}
