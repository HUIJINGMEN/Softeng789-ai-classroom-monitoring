import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { AuthUser, Student } from '../../types';
import type { StudentSchedule } from '../../lib/studentPortalApi';
import {
  cancelStudentSupportRequest,
  listStudentSupportRequests,
  submitStudentSupportRequest,
  type LeaveReason,
  type StudentRequesterRole,
  type StudentRequestType,
  type StudentSupportRequest
} from '../../lib/studentSupportApi';
import { apiMessage } from '../../lib/apiClient';
import { formatSessionDateLabel, formatSessionTimeRange } from '../../lib/sessionTime';
import Modal from '../Modal';

export interface ContactSchoolPreset {
  readonly type?: StudentRequestType;
  readonly sessionId?: string;
}

interface Props {
  readonly user: AuthUser;
  readonly profile: Student | null;
  readonly schedule: StudentSchedule | null;
  readonly preset?: ContactSchoolPreset;
  readonly onClose: () => void;
  readonly onSubmitted?: () => void;
}

const REQUEST_TYPES: ReadonlyArray<{ value: StudentRequestType; label: string; description: string; subject: string }> = [
  { value: 'LEAVE', label: 'Report an absence', description: 'Tell the school about an upcoming lesson you cannot attend.', subject: 'Leave request' },
  { value: 'SCHEDULE_CHANGE', label: 'Class or timetable request', description: 'Ask about a class, time, room or enrolment change.', subject: 'Class or timetable request' },
  { value: 'MAKEUP', label: 'Make-up lesson question', description: 'Ask about an existing or possible replacement lesson.', subject: 'Make-up lesson question' },
  { value: 'PAYMENT_QUESTION', label: 'Payment or invoice question', description: 'Ask a question only. Payments still happen in the Payments page.', subject: 'Payment or invoice question' },
  { value: 'GENERAL', label: 'Something else', description: 'Send another question or request to the school office.', subject: 'Question for the school' }
];

const LEAVE_REASONS: ReadonlyArray<{ value: LeaveReason; label: string }> = [
  { value: 'ILLNESS', label: 'Illness or medical appointment' },
  { value: 'FAMILY', label: 'Family reason' },
  { value: 'SCHOOL_COMMITMENT', label: 'School or study commitment' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'OTHER', label: 'Other reason' }
];

const STATUS_LABELS: Record<StudentSupportRequest['status'], string> = {
  SUBMITTED: 'Awaiting review',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
  RESOLVED: 'Answered',
  CANCELLED: 'Withdrawn'
};

function typeCopy(type: StudentRequestType) {
  return REQUEST_TYPES.find((item) => item.value === type) ?? REQUEST_TYPES[REQUEST_TYPES.length - 1];
}

function requestContext(request: StudentSupportRequest) {
  if (request.sessionDate && request.sessionStartTime && request.sessionEndTime) {
    return `${request.courseCode ?? 'Class'} · ${formatSessionDateLabel(request.sessionDate)} · ${formatSessionTimeRange(request.sessionStartTime, request.sessionEndTime, request.sessionDate)}`;
  }
  return request.courseCode ?? typeCopy(request.type).label;
}

export default function ContactSchoolModal({ user, profile, schedule, preset, onClose, onSubmitted }: Props) {
  const studentId = profile?.recordId ?? user.id;
  const studentName = profile?.name ?? user.name;
  const studentNumber = profile?.studentNumber ?? 'Student account';
  const studentEmail = profile?.email ?? user.email;
  const studentInitials = studentName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const initialType = preset?.type ?? 'GENERAL';
  const [type, setType] = useState<StudentRequestType>(initialType);
  const [requesterRole, setRequesterRole] = useState<StudentRequesterRole>('STUDENT');
  const [contactName, setContactName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [courseOfferingId, setCourseOfferingId] = useState('');
  const [sessionId, setSessionId] = useState(preset?.sessionId ?? '');
  const [leaveReason, setLeaveReason] = useState<LeaveReason>('ILLNESS');
  const [subject, setSubject] = useState(typeCopy(initialType).subject);
  const [message, setMessage] = useState('');
  const [requests, setRequests] = useState<StudentSupportRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [saving, setSaving] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState('');
  const [error, setError] = useState('');
  const [created, setCreated] = useState<StudentSupportRequest | null>(null);

  const sessions = useMemo(() => (schedule?.sessions ?? [])
    .filter((session) => session.status !== 'CANCELLED' && new Date(session.startTime).getTime() > Date.now())
    .sort((left, right) => left.startTime.localeCompare(right.startTime)), [schedule]);
  const courses = useMemo(() => Array.from(new Map(
    (schedule?.sessions ?? []).map((session) => [session.courseOfferingId, {
      id: session.courseOfferingId,
      label: `${session.courseCode} · ${session.courseName}`
    }])
  ).values()).sort((left, right) => left.label.localeCompare(right.label)), [schedule]);
  const selectedType = typeCopy(type);
  const selectedSession = sessions.find((session) => session.id === sessionId) ?? null;

  useEffect(() => {
    let active = true;
    listStudentSupportRequests(studentId)
      .then((items) => active && setRequests(items))
      .catch(() => undefined)
      .finally(() => active && setLoadingRequests(false));
    return () => { active = false; };
  }, [studentId]);

  useEffect(() => {
    if (!preset?.sessionId) return;
    const session = sessions.find((item) => item.id === preset.sessionId);
    if (session) setCourseOfferingId(session.courseOfferingId);
  }, [preset?.sessionId, sessions]);

  const changeType = (nextType: StudentRequestType) => {
    setType(nextType);
    setSubject(typeCopy(nextType).subject);
    setError('');
    if (nextType !== 'LEAVE') setSessionId('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (type === 'LEAVE' && !sessionId) {
      setError('Choose the lesson you will miss.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await submitStudentSupportRequest(studentId, {
        type,
        requesterRole,
        contactName: requesterRole === 'PARENT_GUARDIAN' ? contactName.trim() : undefined,
        relationshipToStudent: requesterRole === 'PARENT_GUARDIAN' ? relationship.trim() : undefined,
        contactEmail: requesterRole === 'PARENT_GUARDIAN' ? contactEmail.trim() : undefined,
        contactPhone: contactPhone.trim() || undefined,
        courseOfferingId: selectedSession?.courseOfferingId ?? (courseOfferingId || undefined),
        sessionId: type === 'LEAVE' ? sessionId : undefined,
        leaveReason: type === 'LEAVE' ? leaveReason : undefined,
        subject: subject.trim(),
        message: message.trim()
      });
      setCreated(result);
      setRequests((current) => [result, ...current]);
      onSubmitted?.();
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const withdraw = async (request: StudentSupportRequest) => {
    setWithdrawingId(request.id);
    setError('');
    try {
      const updated = await cancelStudentSupportRequest(studentId, request.id);
      setRequests((items) => items.map((item) => item.id === updated.id ? updated : item));
      onSubmitted?.();
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setWithdrawingId('');
    }
  };

  if (created) {
    return (
      <Modal
        size="narrow"
        className="contact-school-modal contact-school-modal--success"
        title="Your request has been sent"
        subtitle="The school office can now review the full details."
        closeButton
        onClose={onClose}
        footer={<button type="button" className="btn btn--primary" onClick={onClose}>Done</button>}
      >
        <div className="contact-school-success">
          <span aria-hidden="true">Sent</span>
          <div>
            <strong>{created.subject}</strong>
            <p>{requestContext(created)}</p>
            <small>Reference {created.id.slice(0, 8).toUpperCase()} · {STATUS_LABELS[created.status]}</small>
          </div>
        </div>
        <p className="contact-school-success__note">A request does not automatically change attendance, enrolment or payment. Staff will review it and reply to the contact details provided.</p>
      </Modal>
    );
  }

  return (
    <Modal
      size="wide"
      className="contact-school-modal"
      title="Contact school"
      subtitle="Send a question or request to the school office."
      closeButton
      closeDisabled={saving}
      onClose={onClose}
      onSubmit={submit}
      footer={<>
        <span className="contact-school-modal__footnote">This sends a request only. It does not change attendance or payment records.</span>
        <button type="button" className="btn" disabled={saving} onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={saving || !subject.trim() || !message.trim()}>
          {saving ? 'Sending…' : 'Send to school'}
        </button>
      </>}
    >
      <div className="contact-school-layout">
        <div className="contact-school-form">
          <div className="contact-school-identity">
            <span className="contact-school-identity__avatar" aria-hidden="true">{studentInitials}</span>
            <div className="contact-school-identity__copy">
              <span>Request for</span>
              <strong>{studentName}</strong>
              <small>{studentNumber} · {studentEmail}</small>
            </div>
            <button
              type="button"
              className="contact-school-identity__switch"
              aria-expanded={requesterRole === 'PARENT_GUARDIAN'}
              aria-controls="contact-school-parent-details"
              onClick={() => setRequesterRole((current) => current === 'STUDENT' ? 'PARENT_GUARDIAN' : 'STUDENT')}
            >
              {requesterRole === 'PARENT_GUARDIAN' ? 'Use student contact' : 'Add parent or guardian contact'}
            </button>
          </div>

          {requesterRole === 'PARENT_GUARDIAN' && (
            <section id="contact-school-parent-details" className="contact-school-contact-panel" aria-labelledby="contact-parent-title">
              <div className="contact-school-contact-panel__head">
                <div>
                  <h3 id="contact-parent-title">Parent or guardian details</h3>
                  <p>The school will send its reply to this contact.</p>
                </div>
              </div>
              <div className="contact-school-contact-grid">
                <label className="field"><span>Your name <small>Required</small></span><input required maxLength={160} value={contactName} onChange={(event) => setContactName(event.target.value)} autoComplete="name" /></label>
                <label className="field"><span>Relationship to student <small>Required</small></span><input required maxLength={80} value={relationship} onChange={(event) => setRelationship(event.target.value)} placeholder="e.g. Parent, guardian" /></label>
                <label className="field"><span>Email <small>Required</small></span><input required type="email" maxLength={255} value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} autoComplete="email" /></label>
                <label className="field"><span>Phone <small>Optional</small></span><input type="tel" maxLength={40} value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} autoComplete="tel" /></label>
              </div>
            </section>
          )}

          <section className="contact-school-section" aria-labelledby="contact-request-title">
            <div className="contact-school-section__head">
              <h3 id="contact-request-title">How can we help?</h3>
              <p>{selectedType.description}</p>
            </div>

            <div className="contact-school-primary-fields">
              <label className="field">
                <span>Request type <small>Required</small></span>
                <select value={type} onChange={(event) => changeType(event.target.value as StudentRequestType)}>
                  {REQUEST_TYPES.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                </select>
              </label>

              {type !== 'LEAVE' && courses.length > 0 && (
                <label className="field">
                  <span>Class <small>Optional</small></span>
                  <select value={courseOfferingId} onChange={(event) => setCourseOfferingId(event.target.value)}>
                    <option value="">Not about a specific class</option>
                    {courses.map((course) => <option value={course.id} key={course.id}>{course.label}</option>)}
                  </select>
                </label>
              )}
            </div>

            {type === 'LEAVE' && (
              <div className="contact-school-leave-fields">
                <label className="field">
                  <span>Lesson you will miss <small>Required</small></span>
                  <select required value={sessionId} onChange={(event) => {
                    const nextId = event.target.value;
                    const session = sessions.find((item) => item.id === nextId);
                    setSessionId(nextId);
                    setCourseOfferingId(session?.courseOfferingId ?? '');
                  }}>
                    <option value="">Choose an upcoming lesson</option>
                    {sessions.map((session) => (
                      <option value={session.id} key={session.id}>{session.courseCode} · {formatSessionDateLabel(session.date)} · {formatSessionTimeRange(session.startTime, session.endTime, session.date)}</option>
                    ))}
                  </select>
                  {sessions.length === 0 && <small>No upcoming lessons are available. Choose “Something else” to contact the office.</small>}
                </label>
                <label className="field">
                  <span>Reason <small>Required</small></span>
                  <select value={leaveReason} onChange={(event) => setLeaveReason(event.target.value as LeaveReason)}>
                    {LEAVE_REASONS.map((reason) => <option value={reason.value} key={reason.value}>{reason.label}</option>)}
                  </select>
                </label>
              </div>
            )}

            {type === 'GENERAL' && (
              <label className="field contact-school-subject"><span>Subject <small>Required</small></span><input required maxLength={160} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="A short summary of your question" /></label>
            )}

            <label className="field contact-school-message"><span>Message <small>Required</small></span><textarea required rows={6} maxLength={2000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={type === 'LEAVE' ? 'Add anything the school should know about this absence.' : 'Add the details the school needs to help you.'} /></label>
            <div className="contact-school-count"><span>{message.length}/2000</span></div>
            {error && <p className="field-error" role="alert">{error}</p>}
          </section>
        </div>

        <aside className="contact-school-history" aria-label="Recent school requests">
          <div><h3>Recent requests</h3><p>Track replies without sending the same request again.</p></div>
          {loadingRequests && <output>Loading…</output>}
          {!loadingRequests && requests.length === 0 && <p className="contact-school-history__empty">No requests have been sent yet.</p>}
          <div className="contact-school-history__list">
            {requests.slice(0, 4).map((request) => (
              <article key={request.id}>
                <div><strong>{request.subject}</strong><span className={`is-${request.status.toLowerCase()}`}>{STATUS_LABELS[request.status]}</span></div>
                <p>{requestContext(request)}</p>
                {request.reviewNote && <blockquote>{request.reviewNote}</blockquote>}
                {request.status === 'SUBMITTED' && (
                  <button type="button" disabled={withdrawingId === request.id} onClick={() => void withdraw(request)}>
                    {withdrawingId === request.id ? 'Withdrawing…' : 'Withdraw'}
                  </button>
                )}
              </article>
            ))}
          </div>
        </aside>
      </div>
    </Modal>
  );
}
