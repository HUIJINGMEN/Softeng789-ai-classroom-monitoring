import { IconAlertTriangle, IconX } from '../../../components/icons';
import { formatPaymentDate } from '../format';
import { ATTENDANCE_OPTIONS, ABSENCE_REASONS, makeupOptionLabel } from '../lessonCreditPanelModel';
import { lessonCreditLabel, lessonEventLabel } from '../lessonReconciliationModel';
import { useLessonCreditPanel, type LessonCreditPanelOptions } from '../useLessonCreditPanel';
import type { AbsenceReason } from '../types';
import LessonPanelHeading from './LessonPanelHeading';

interface Props extends LessonCreditPanelOptions {
  readonly courseCode?: string;
  readonly academicTerm?: string;
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
                <option value={option.sessionId} key={option.sessionId}>{makeupOptionLabel(option)}</option>
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

export default function LessonCreditPanel({ row, cell, session, courseCode, academicTerm, onClose, onUpdated, onOpenPayment }: Props) {
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
      <button type="button" className="lesson-panel-backdrop" tabIndex={-1} disabled={model.refreshing} onClick={onClose} aria-label="Close lesson details" />
      <dialog open
        ref={panelRef}
        className="lesson-panel"
        aria-modal="true"
        aria-labelledby="lesson-panel-title"
        aria-describedby="lesson-panel-context"
        tabIndex={-1}
        onKeyDown={handlePanelKeyDown}
      >
        <header className="lesson-panel__head">
          <LessonPanelHeading row={row} session={session} courseCode={courseCode} academicTerm={academicTerm} />
          <button type="button" className="lesson-panel__close" disabled={model.refreshing} onClick={onClose} aria-label="Close lesson details">
            <IconX />
          </button>
        </header>

        <div className="lesson-panel__body">
          {error && <div className="notice notice--warn" role="alert">{error}
            {model.refreshFailed && <button type="button" className="btn btn--sm" disabled={model.refreshing} onClick={() => void model.retryRefresh()}>Refresh saved records</button>}
          </div>}
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
                  {ABSENCE_REASONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
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
