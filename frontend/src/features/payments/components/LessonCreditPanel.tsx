import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { IconAlertTriangle, IconX } from '../../../components/icons';
import { apiMessage } from '../../../lib/apiClient';
import { formatSessionTimeRange } from '../../../lib/sessionTime';
import {
  cancelLessonMakeup,
  decideLessonCredit,
  getLessonCreditDetail,
  listMakeupOptions,
  scheduleLessonMakeup,
  updateReconciliationAttendance
} from '../api';
import { formatMoney, formatPaymentDate, PAYMENT_STATUS_LABELS } from '../format';
import { lessonCreditLabel, lessonEventLabel } from '../lessonReconciliationModel';
import type {
  AbsenceReason,
  LessonCreditDetail,
  MakeupOption,
  ReconciliationCell,
  ReconciliationRow,
  ReconciliationSession
} from '../types';

interface Props {
  readonly row: ReconciliationRow;
  readonly cell: ReconciliationCell;
  readonly session: ReconciliationSession;
  readonly onClose: () => void;
  readonly onUpdated: () => void;
  readonly onOpenPayment?: () => void;
}

const REASONS: ReadonlyArray<{ value: AbsenceReason; label: string }> = [
  { value: 'ILLNESS', label: 'Sick / medical' },
  { value: 'ADVANCE_NOTICE', label: 'Approved leave / advance notice' },
  { value: 'NO_NOTICE', label: 'No notice / no-show' },
  { value: 'SCHOOL_CANCELLED', label: 'Class cancelled by school' },
  { value: 'OTHER', label: 'Other' }
];

const ATTENDANCE_OPTIONS: ReadonlyArray<{
  value: ReconciliationCell['attendanceStatus'];
  label: string;
}> = [
  { value: 'PRESENT', label: 'Present' },
  { value: 'LATE', label: 'Late' },
  { value: 'ABSENT', label: 'Absent' },
  { value: 'UNKNOWN', label: 'Not recorded' }
];

function optionLabel(option: MakeupOption) {
  const time = formatSessionTimeRange(option.startTime, option.endTime, option.date);
  return `${formatPaymentDate(option.date)} · ${time} · ${option.room}`;
}

function useLessonCreditPanel({ row, cell, session, onClose, onUpdated, onOpenPayment }: Props) {
  const [detail, setDetail] = useState<LessonCreditDetail | null>(null);
  const [options, setOptions] = useState<MakeupOption[]>([]);
  const [optionsVersion, setOptionsVersion] = useState(0);
  const [targetSessionId, setTargetSessionId] = useState('');
  const [attendanceStatus, setAttendanceStatus] = useState<ReconciliationCell['attendanceStatus']>(cell.attendanceStatus);
  const [savedAttendanceStatus, setSavedAttendanceStatus] = useState<ReconciliationCell['attendanceStatus']>(cell.attendanceStatus);
  const [reason, setReason] = useState<AbsenceReason | ''>(cell.absenceReason ?? '');
  const [savedReason, setSavedReason] = useState<AbsenceReason | ''>(cell.absenceReason ?? '');
  const [note, setNote] = useState(cell.absenceNote ?? cell.decisionNote ?? '');
  const [savedNote, setSavedNote] = useState(cell.absenceNote ?? cell.decisionNote ?? '');
  const [savedMessage, setSavedMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      openerRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    if (!cell.lessonCreditId) return;
    let active = true;
    setBusy(true);
    getLessonCreditDetail(cell.lessonCreditId)
      .then((result) => active && setDetail(result))
      .catch((cause) => active && setError(apiMessage(cause)))
      .finally(() => active && setBusy(false));
    return () => { active = false; };
  }, [cell.lessonCreditId]);

  useEffect(() => {
    if (!cell.lessonCreditId
      || (detail?.status !== 'MAKEUP_DUE' && detail?.status !== 'MAKEUP_SCHEDULED')) return;
    let active = true;
    listMakeupOptions(cell.lessonCreditId)
      .then((result) => {
        if (!active) return;
        setOptions(result);
        setTargetSessionId(result[0]?.sessionId ?? '');
      })
      .catch((cause) => active && setError(apiMessage(cause)));
    return () => { active = false; };
  }, [cell.lessonCreditId, detail?.status, optionsVersion]);

  const handlePanelKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
    ));
    if (focusable.length === 0) {
      event.preventDefault();
      panelRef.current.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const attendanceDirty = attendanceStatus !== savedAttendanceStatus
    || (attendanceStatus === 'ABSENT' && (reason !== savedReason || note.trim() !== savedNote));

  const saveAttendance = async () => {
    if (attendanceStatus === 'ABSENT' && (!reason || !note.trim())) {
      setError('Choose an absence reason and add a short note.');
      return;
    }
    setBusy(true);
    setError('');
    setSavedMessage('');
    try {
      const result = await updateReconciliationAttendance(session.id, row.studentId, {
        status: attendanceStatus,
        absenceReason: attendanceStatus === 'ABSENT' && reason ? reason : undefined,
        absenceNote: attendanceStatus === 'ABSENT' ? note.trim() : undefined
      });
      setAttendanceStatus(result.status);
      setSavedAttendanceStatus(result.status);
      setReason(result.absenceReason ?? '');
      setSavedReason(result.absenceReason ?? '');
      setNote(result.absenceNote ?? '');
      setSavedNote(result.absenceNote ?? '');
      setSavedMessage(result.status === 'ABSENT' ? 'Absence classification saved.' : 'Attendance updated.');
      onUpdated();
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const decide = async (decision: 'COUNT_AS_USED' | 'GRANT_MAKEUP') => {
    if (!cell.lessonCreditId || savedAttendanceStatus !== 'ABSENT' || !reason || !note.trim() || attendanceDirty) return;
    setBusy(true);
    setError('');
    try {
      const result = await decideLessonCredit(cell.lessonCreditId, { decision, reason, note });
      setDetail(result);
      onUpdated();
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const schedule = async () => {
    if (!cell.lessonCreditId || !targetSessionId) return;
    setBusy(true);
    setError('');
    try {
      const result = await scheduleLessonMakeup(cell.lessonCreditId, targetSessionId);
      setDetail(result);
      setOptionsVersion((version) => version + 1);
      onUpdated();
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const cancelBooking = async () => {
    if (!cell.lessonCreditId) return;
    setBusy(true);
    setError('');
    try {
      const result = await cancelLessonMakeup(cell.lessonCreditId);
      setDetail(result);
      setOptionsVersion((version) => version + 1);
      onUpdated();
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const currentStatus = detail?.status ?? cell.creditStatus;
  const currentMakeupDate = detail?.currentSessionDate ?? cell.makeupSessionDate;
  const attendanceLabel = ATTENDANCE_OPTIONS.find((option) => option.value === savedAttendanceStatus)?.label
    ?? 'Not recorded';
  const missingCoverage = !cell.lessonCreditId && !cell.creditStatus;
  const showCoverageIssue = cell.uncoveredAttendance || missingCoverage;
  const paymentLabel = row.paymentStatus ? PAYMENT_STATUS_LABELS[row.paymentStatus] : 'No invoice issued';
  const balanceLabel = row.balance !== null && row.balance > 0
    ? `${formatMoney(row.balance, row.currency)} due`
    : 'No outstanding balance';
  let coverageLabel = 'No active purchase';
  if (row.purchaseMode === 'LESSON_PACKAGE') {
    coverageLabel = `${row.purchasedSessions} bought · ${row.usedSessions} used · ${row.remainingSessions} left`;
  } else if (row.purchaseMode === 'COURSE_ENROLMENT') {
    coverageLabel = 'Full-course enrolment';
  } else if (row.purchaseMode === 'MEMBERSHIP') {
    coverageLabel = 'Membership access';
  } else if (row.purchaseMode === 'PAY_PER_LESSON') {
    coverageLabel = `${row.purchasedSessions} lesson${row.purchasedSessions === 1 ? '' : 's'} purchased`;
  }
  let attendanceSaveLabel = 'Attendance is up to date';
  if (savedMessage) attendanceSaveLabel = savedMessage;
  else if (attendanceDirty) attendanceSaveLabel = 'Unsaved changes';
  else if (savedAttendanceStatus === 'UNKNOWN') attendanceSaveLabel = 'Choose what happened in this lesson';

  return {
    onClose,
    panelRef,
    handlePanelKeyDown,
    row,
    session,
    error,
    savedAttendanceStatus,
    attendanceLabel,
    showCoverageIssue,
    currentStatus,
    currentMakeupDate,
    paymentLabel,
    cell,
    balanceLabel,
    coverageLabel,
    onOpenPayment,
    busy,
    onUpdated,
    attendanceStatus,
    setAttendanceStatus,
    setSavedMessage,
    setError,
    reason,
    setReason,
    note,
    setNote,
    savedMessage,
    attendanceSaveLabel,
    attendanceDirty,
    saveAttendance,
    decide,
    options,
    targetSessionId,
    setTargetSessionId,
    cancelBooking,
    schedule,
    detail
  };
}

function LessonMakeupBooking({ model }: { readonly model: ReturnType<typeof useLessonCreditPanel> }) {
  const {
    currentStatus,
    currentMakeupDate,
    options,
    targetSessionId,
    setTargetSessionId,
    busy,
    cancelBooking,
    schedule
  } = model;
  return (
    <section className="lesson-panel__makeup">
      <div>
        <h3>{currentStatus === 'MAKEUP_SCHEDULED' ? 'Manage make-up booking' : 'Choose a make-up date'}</h3>
        <p>{currentStatus === 'MAKEUP_SCHEDULED' && currentMakeupDate
          ? `Currently booked for ${formatPaymentDate(currentMakeupDate)}. Choose another available lesson to change it.`
          : 'Select an upcoming lesson from this class.'}</p>
      </div>
      {options.length > 0 ? (
        <>
          <label className="field">
            <span>Make-up lesson</span>
            <select value={targetSessionId} onChange={(event) => setTargetSessionId(event.target.value)}>
              {options.map((option) => (
                <option value={option.sessionId} key={option.sessionId}>{optionLabel(option)}</option>
              ))}
            </select>
          </label>
          {targetSessionId && (() => {
            const selected = options.find((option) => option.sessionId === targetSessionId);
            if (!selected) return null;
            return <p className="lesson-panel__capacity">{selected.reservedSeats} seats reserved · {selected.capacity > 0 ? `${selected.capacity} room capacity` : 'Capacity not set'}</p>;
          })()}
          <div className="lesson-panel__makeup-actions">
            {currentStatus === 'MAKEUP_SCHEDULED' && (
              <button type="button" className="btn" disabled={busy} onClick={() => void cancelBooking()}>Cancel booking</button>
            )}
            <button type="button" className="btn btn--primary" disabled={busy || !targetSessionId} onClick={() => void schedule()}>
              {currentStatus === 'MAKEUP_SCHEDULED' ? 'Change date' : 'Book make-up'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="lesson-panel__empty"><strong>No available lesson</strong><p>Add a future lesson with room capacity before returning here.</p></div>
          {currentStatus === 'MAKEUP_SCHEDULED' && (
            <button type="button" className="btn lesson-panel__cancel-booking" disabled={busy} onClick={() => void cancelBooking()}>Cancel current booking</button>
          )}
        </>
      )}
    </section>
  );
}

export default function LessonCreditPanel({ row, cell, session, onClose, onUpdated, onOpenPayment }: Props) {
  const model = useLessonCreditPanel({ row, cell, session, onClose, onUpdated, onOpenPayment });
  const {
    panelRef,
    handlePanelKeyDown,
    error,
    savedAttendanceStatus,
    attendanceLabel,
    showCoverageIssue,
    currentStatus,
    currentMakeupDate,
    paymentLabel,
    balanceLabel,
    coverageLabel,
    busy,
    attendanceStatus,
    setAttendanceStatus,
    setSavedMessage,
    setError,
    reason,
    setReason,
    note,
    setNote,
    savedMessage,
    attendanceSaveLabel,
    attendanceDirty,
    saveAttendance,
    decide,
    detail
  } = model;

  const accessLabel = row.purchaseMode === 'COURSE_ENROLMENT' ? 'full-course enrolment' : 'course access';
  const purchaseLabel = row.purchaseMode === 'MEMBERSHIP' ? 'membership' : accessLabel;
  return (
    <div className="lesson-panel-layer">
      <button type="button" className="lesson-panel-backdrop" tabIndex={-1} onClick={onClose} aria-label="Close lesson details" />
      <dialog open
        ref={panelRef}
        className="lesson-panel"
        aria-modal="true"
        aria-labelledby="lesson-panel-title"
        tabIndex={-1}
        onKeyDown={handlePanelKeyDown}
      >
        <header className="lesson-panel__head">
          <div>
            <h2 id="lesson-panel-title">{row.studentName}</h2>
            <p>{formatPaymentDate(session.date)} · {session.room}</p>
          </div>
          <button type="button" className="lesson-panel__close" onClick={onClose} aria-label="Close lesson details">
            <IconX />
          </button>
        </header>

        <div className="lesson-panel__body">
          {error && <div className="notice notice--warn" role="alert">{error}</div>}
          <section className="lesson-panel__summary" aria-label="Lesson status">
            <div className={savedAttendanceStatus === 'UNKNOWN' ? 'has-alert' : undefined}><span>Attendance</span><strong>{attendanceLabel}</strong></div>
            <div className={showCoverageIssue ? 'has-alert' : undefined}><span>Outcome</span><strong>{lessonCreditLabel(currentStatus, currentMakeupDate)}</strong></div>
            <div><span>Payment</span><strong>{paymentLabel}</strong></div>
          </section>

          {showCoverageIssue && (
            <section className="lesson-panel__issue" aria-labelledby="lesson-panel-coverage-title">
              <header>
                <span className="lesson-panel__issue-icon" aria-hidden="true"><IconAlertTriangle /></span>
                <h3 id="lesson-panel-coverage-title">
                  {cell.uncoveredAttendance ? 'This lesson has no payment coverage' : 'Payment coverage is missing'}
                </h3>
              </header>
              <p className="lesson-panel__issue-copy">
                {cell.uncoveredAttendance ? (
                  <>Attendance remains recorded as <strong>{attendanceLabel}</strong>. Current purchases or access dates do not cover this lesson.</>
                ) : (
                  <>This lesson has no invoice or active purchase. You can still record attendance separately below.</>
                )}
              </p>
              <dl>
                <div><dt>Account</dt><dd>{paymentLabel}</dd></div>
                <div><dt>Balance</dt><dd>{balanceLabel}</dd></div>
                <div><dt>Access</dt><dd>{coverageLabel}</dd></div>
              </dl>
              <p className="lesson-panel__issue-next">
                <strong>Next step:</strong>{' '}
                {cell.uncoveredAttendance
                  ? 'Correct coverage for this class and date, then refresh this status.'
                  : 'Open the payment account to create an invoice or correct the access dates for this class.'}
              </p>
              <div className="lesson-panel__issue-actions">
                {onOpenPayment && <button type="button" className="btn btn--primary" disabled={busy} onClick={onOpenPayment}>Open payment account</button>}
                <button type="button" className="btn lesson-panel__refresh" disabled={busy} onClick={() => { onUpdated(); onClose(); }}>Refresh status</button>
              </div>
            </section>
          )}

          <section className="lesson-panel__attendance">
            <div>
              <h3>Record attendance</h3>
              <p>Save what happened in this lesson. An explained absence is available for every purchase type.</p>
            </div>
            <fieldset className="lesson-panel__attendance-options" aria-label="Attendance status">
              {ATTENDANCE_OPTIONS.map((option) => (
                <button
                  type="button"
                  className={attendanceStatus === option.value ? 'is-selected' : ''}
                  aria-pressed={attendanceStatus === option.value}
                  disabled={busy}
                  key={option.value}
                  onClick={() => {
                    setAttendanceStatus(option.value);
                    setSavedMessage('');
                    setError('');
                  }}
                >
                  {option.label}
                </button>
              ))}
            </fieldset>
            {attendanceStatus === 'ABSENT' && <div className="lesson-panel__absence-fields">
              <label className="field">
                <span>Absence type <small>Required</small></span>
                <select required value={reason} onChange={(event) => { setReason(event.target.value as AbsenceReason | ''); setSavedMessage(''); }}>
                  <option value="">Select a reason</option>
                  {REASONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Admin note <small>Required</small></span>
                <textarea required rows={3} maxLength={500} value={note} onChange={(event) => { setNote(event.target.value); setSavedMessage(''); }} placeholder="For example: Leave approved through the student request." />
              </label>
            </div>}
            <div className="lesson-panel__attendance-save">
              <output className={savedMessage ? 'is-saved' : ''}>{attendanceSaveLabel}</output>
              <button type="button" className="btn btn--primary" disabled={busy || !attendanceDirty || (attendanceStatus === 'ABSENT' && (!reason || !note.trim()))} onClick={() => void saveAttendance()}>
                {busy ? 'Saving…' : 'Save attendance'}
              </button>
            </div>
          </section>

          {!cell.lessonCreditId && cell.creditStatus && (
            <div className="lesson-panel__coverage">
              <strong>No individual lesson balance</strong>
              <p>This student&apos;s {purchaseLabel} is unchanged by the attendance classification.</p>
            </div>
          )}

          {cell.lessonCreditId && savedAttendanceStatus === 'ABSENT'
            && currentStatus !== 'USED' && currentStatus !== 'MAKEUP_SCHEDULED' && (
            <section className="lesson-panel__decision">
              <div>
                <h3>Choose lesson treatment</h3>
                <p>The attendance fact is saved separately. Now decide whether this lesson is charged or can be made up.</p>
              </div>
              {attendanceDirty && <p className="lesson-panel__decision-note">Save the attendance changes before choosing lesson treatment.</p>}
              <div className="lesson-panel__decision-actions">
                <button type="button" className="btn" disabled={busy || attendanceDirty || !reason || !note.trim()} onClick={() => void decide('COUNT_AS_USED')}>Charge lesson</button>
                <button type="button" className="btn btn--primary" disabled={busy || attendanceDirty || !reason || !note.trim()} onClick={() => void decide('GRANT_MAKEUP')}>Allow make-up</button>
              </div>
            </section>
          )}

          {cell.lessonCreditId && (currentStatus === 'MAKEUP_DUE' || currentStatus === 'MAKEUP_SCHEDULED') && (
            <LessonMakeupBooking model={model} />
          )}

          {detail && (
            <details className="lesson-panel__history">
              <summary>View change history</summary>
              <section className="lesson-panel__timeline">
                <ol>
                  {detail.events.map((event) => (
                    <li key={event.id}>
                      <span className="lesson-panel__timeline-marker" aria-hidden="true" />
                      <div>
                        <strong>{lessonEventLabel(event.eventType)}</strong>
                        <span>{new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.createdAt))}</span>
                        {event.note && <p>{event.note}</p>}
                        {event.actorName && <small>Recorded by {event.actorName}</small>}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </details>
          )}

          {busy && !detail && <output className="payment-page-state">Loading lesson record…</output>}
        </div>
      </dialog>
    </div>
  );
}
