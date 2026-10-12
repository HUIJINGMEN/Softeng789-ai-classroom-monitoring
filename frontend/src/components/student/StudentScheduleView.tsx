import { useEffect, useMemo, useRef, useState } from 'react';
import { IconCalendar, IconChevronLeft, IconChevronRight } from '../icons';
import Modal from '../Modal';
import { apiMessage } from '../../lib/apiClient';
import {
  addScheduleDays,
  initialScheduleWeekStart,
  scheduleWeekDates,
  scheduleWeekRangeLabel,
  scheduleWeekStart,
  sortScheduleByTime
} from '../../features/class-schedule';
import type {
  StudentSchedule,
  StudentScheduleCoverageStatus,
  StudentScheduleSession,
  StudentMakeupOption
} from '../../lib/studentPortalApi';
import {
  cancelStudentMakeupRequest,
  listStudentMakeupOptions,
  submitStudentMakeupRequest
} from '../../lib/studentPortalApi';
import {
  formatIsoDateInAuckland,
  formatSessionDateLabel,
  formatSessionTimeRange
} from '../../lib/sessionTime';

interface Props {
  readonly schedule: StudentSchedule | null;
  readonly loading: boolean;
  readonly loadError: string;
  readonly onRetry: () => void;
  readonly onRequestLeave: (session: StudentScheduleSession) => void;
}

const COVERAGE_COPY: Record<StudentScheduleCoverageStatus, { label: string; tone: string }> = {
  COVERED: { label: 'Paid lesson', tone: 'covered' },
  USED: { label: 'Attended · used', tone: 'used' },
  COUNTED_ABSENCE: { label: 'Absence counted', tone: 'counted' },
  MAKEUP_DUE: { label: 'Make-up available', tone: 'makeup' },
  MAKEUP_SCHEDULED: { label: 'Make-up booked', tone: 'makeup' },
  UNPAID_ATTENDANCE: { label: 'Payment review', tone: 'warning' },
  UNCOVERED: { label: 'Not covered', tone: 'warning' },
  NOT_REQUIRED: { label: 'Cancelled', tone: 'muted' }
};

function attendanceLabel(status: StudentScheduleSession['attendanceStatus']) {
  if (status === 'UNKNOWN') return null;
  if (status === 'PRESENT') return 'Present';
  if (status === 'LATE') return 'Late';
  return 'Absent';
}

function relatedLessonCopy(session: StudentScheduleSession) {
  if (!session.relatedSessionDate) return null;
  const label = formatSessionDateLabel(session.relatedSessionDate);
  return session.relatedSessionDate < session.date ? `Make-up for ${label}` : `Moved to ${label}`;
}

function sessionStartLabel(session: StudentScheduleSession) {
  return formatSessionTimeRange(session.startTime, session.endTime, session.date).split('–')[0];
}

function dayParts(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  return {
    weekday: new Intl.DateTimeFormat('en-NZ', { weekday: 'short', timeZone: 'UTC' }).format(value),
    date: new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(value)
  };
}

function compactWeekRangeLabel(dates: readonly string[]) {
  if (dates.length < 7) return '';
  const start = new Date(`${dates[0]}T12:00:00Z`);
  const end = new Date(`${dates[6]}T12:00:00Z`);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const day = new Intl.DateTimeFormat('en-NZ', { day: 'numeric', timeZone: 'UTC' });
  const month = new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const full = new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  if (sameMonth && sameYear) return `${day.format(start)}–${full.format(end)}`;
  if (sameYear) return `${month.format(start)}–${full.format(end)}`;
  return `${full.format(start)}–${full.format(end)}`;
}

function MakeupRequestModal({ studentId, session, onClose, onSubmitted }: {
  readonly studentId: string;
  readonly session: StudentScheduleSession;
  readonly onClose: () => void;
  readonly onSubmitted: () => void;
}) {
  const [options, setOptions] = useState<StudentMakeupOption[]>([]);
  const [selected, setSelected] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!session.lessonCreditId) return undefined;
    setLoading(true);
    listStudentMakeupOptions(studentId, session.lessonCreditId)
      .then((result) => {
        if (!active) return;
        setOptions(result);
        setSelected(result[0]?.sessionId ?? '');
      })
      .catch((cause) => active && setError(apiMessage(cause)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [session.lessonCreditId, studentId]);

  const submit = async () => {
    if (!session.lessonCreditId || !selected) return;
    setSaving(true);
    setError('');
    try {
      await submitStudentMakeupRequest(studentId, {
        lessonCreditId: session.lessonCreditId,
        preferredSessionId: selected,
        note: note.trim() || undefined
      });
      onSubmitted();
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      size="narrow"
      className="student-makeup-modal"
      title="Choose a make-up lesson"
      subtitle={`${session.courseCode} · missed ${formatSessionDateLabel(session.date)}`}
      closeButton
      onClose={onClose}
      footer={<>
        <button type="button" className="btn" disabled={saving} onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn--primary" disabled={saving || loading || !selected} onClick={submit}>
          {saving ? 'Sending…' : 'Send request'}
        </button>
      </>}
    >
      <div className="student-makeup-modal__body">
        <p>Your preferred date will be held only after an administrator approves it.</p>
        {loading && <output className="student-makeup-options__state">Checking available lessons…</output>}
        {!loading && options.length === 0 && !error && (
          <div className="student-makeup-options__state">
            <strong>No suitable dates are available</strong>
            <span>Please contact the school so they can arrange another option.</span>
          </div>
        )}
        {options.length > 0 && (
          <fieldset className="student-makeup-options">
            <legend>Available lessons</legend>
            {options.map((option) => (
              <label aria-label={`Make-up on ${formatSessionDateLabel(option.date)}, ${formatSessionTimeRange(option.startTime, option.endTime, option.date)}`} className={selected === option.sessionId ? 'is-selected' : ''} key={option.sessionId}>
                <input type="radio" name="makeup-session" value={option.sessionId} checked={selected === option.sessionId} onChange={() => setSelected(option.sessionId)} />
                <span>
                  <strong>{formatSessionDateLabel(option.date)}</strong>
                  <small>{formatSessionTimeRange(option.startTime, option.endTime, option.date)} · {[option.room, option.campus].filter(Boolean).join(' · ')}</small>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        <label className="field">
          <span>Note <small>Optional</small></span>
          <textarea rows={3} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add anything the administrator should know." />
        </label>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

function LessonCard({ session, compact = false, onRequestLeave }: {
  readonly session: StudentScheduleSession;
  readonly compact?: boolean;
  readonly onRequestLeave: (session: StudentScheduleSession) => void;
}) {
  const coverage = COVERAGE_COPY[session.coverageStatus];
  const attendance = attendanceLabel(session.attendanceStatus);
  const related = relatedLessonCopy(session);
  const location = [session.room, session.campus].filter(Boolean).join(' · ');
  const showCourseName = session.courseName.trim().toLowerCase() !== session.courseCode.trim().toLowerCase();
  const canRequestLeave = session.status === 'SCHEDULED'
    && session.attendanceStatus === 'UNKNOWN'
    && new Date(session.startTime).getTime() > Date.now()
    && !session.leaveRequestStatus;
  const lessonClasses = [
    'student-week-lesson',
    `is-${coverage.tone}`,
    session.status === 'CANCELLED' ? 'is-cancelled' : '',
    session.status === 'ACTIVE' ? 'is-active' : ''
  ].filter(Boolean).join(' ');
  return (
    <article className={lessonClasses}>
      <div className="student-week-lesson__heading">
        <strong>{session.courseCode}</strong>
        {session.status === 'ACTIVE' && <span className="student-week-lesson__live">In progress</span>}
      </div>
      {!compact && showCourseName && <span className="student-week-lesson__name">{session.courseName}</span>}
      <div className="student-week-lesson__details">
        <span className="student-week-lesson__time">{formatSessionTimeRange(session.startTime, session.endTime, session.date)}</span>
        <span className="student-week-lesson__place">{location || 'Location to be confirmed'}</span>
      </div>
      {!compact && <small>{session.teacher ? `With ${session.teacher}` : 'Teacher to be confirmed'}</small>}
      <div className="student-week-lesson__status">
        <span className={`student-schedule-status is-${coverage.tone}`}>{coverage.label}</span>
        {attendance && <small className="student-week-lesson__attendance">{attendance}</small>}
      </div>
      {session.leaveRequestStatus === 'SUBMITTED' && <span className="student-leave-state is-pending">Leave requested</span>}
      {session.leaveRequestStatus === 'APPROVED' && <span className="student-leave-state is-approved">Leave approved</span>}
      {canRequestLeave && <button type="button" className="student-request-leave" onClick={() => onRequestLeave(session)}>Request leave</button>}
      {related && <small className="student-week-lesson__related">{related}</small>}
    </article>
  );
}

function DesktopWeekTable({ dates, sessions, today, onRequestLeave }: {
  readonly dates: readonly string[];
  readonly sessions: readonly StudentScheduleSession[];
  readonly today: string;
  readonly onRequestLeave: (session: StudentScheduleSession) => void;
}) {
  // Sort by the school's 24-hour clock, not the displayed label (10 am precedes 2 pm).
  const orderedSessions = sortScheduleByTime(sessions);
  const timeRows = Array.from(new Set(orderedSessions.map(sessionStartLabel)));
  return (
    <div className="student-week-table-wrap">
      <table className="student-week-table">
        <caption className="sr-only">Weekly class timetable</caption>
        <thead>
          <tr>
            <th className="student-week-table__time">Time</th>
            {dates.map((date) => {
              const day = dayParts(date);
              return (
                <th className={date === today ? 'is-today' : ''} key={date} scope="col">
                  <span>{day.weekday}</span>
                  <strong>{day.date}</strong>
                  {date === today && <small>Today</small>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {timeRows.map((time) => (
            <tr key={time}>
              <th className="student-week-table__time" scope="row">{time}</th>
              {dates.map((date) => {
                const cellSessions = sessions.filter((session) => session.date === date && sessionStartLabel(session) === time);
                return (
                  <td className={date === today ? 'is-today' : ''} key={date}>
                    {cellSessions.map((session) => <LessonCard compact session={session} key={session.id} onRequestLeave={onRequestLeave} />)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MobileWeek({ dates, sessions, today, onRequestLeave }: {
  readonly dates: readonly string[];
  readonly sessions: readonly StudentScheduleSession[];
  readonly today: string;
  readonly onRequestLeave: (session: StudentScheduleSession) => void;
}) {
  const activeDays = dates
    .map((date) => ({ date, sessions: sessions.filter((session) => session.date === date) }))
    .filter((day) => day.sessions.length > 0);
  return (
    <div className="student-mobile-week">
      {activeDays.map((day) => {
        const label = dayParts(day.date);
        return (
          <section className={day.date === today ? 'is-today' : ''} key={day.date}>
            <header>
              <div><strong>{label.weekday}</strong><span>{label.date}</span></div>
              {day.date === today && <small>Today</small>}
            </header>
            <div>{day.sessions.map((session) => <LessonCard session={session} key={session.id} onRequestLeave={onRequestLeave} />)}</div>
          </section>
        );
      })}
    </div>
  );
}

export default function StudentScheduleView({ schedule, loading, loadError, onRetry, onRequestLeave }: Props) {
  const today = useMemo(() => formatIsoDateInAuckland(new Date()), []);
  const [course, setCourse] = useState('all');
  const [weekStart, setWeekStart] = useState(() => scheduleWeekStart(today));
  const initialised = useRef(false);
  const [requestingMakeup, setRequestingMakeup] = useState<StudentScheduleSession | null>(null);
  const [requestActionId, setRequestActionId] = useState('');
  const [requestError, setRequestError] = useState('');

  const courses = useMemo(() => {
    const values = new Map<string, string>();
    schedule?.sessions.forEach((session) => values.set(
      session.courseOfferingId,
      `${session.courseCode} · ${session.courseName}`
    ));
    return Array.from(values, ([id, label]) => ({ id, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [schedule]);

  useEffect(() => {
    if (!schedule || initialised.current) return;
    setWeekStart(initialScheduleWeekStart(schedule.sessions.map((session) => session.date), today));
    initialised.current = true;
  }, [schedule, today]);

  const filteredSessions = useMemo(() => (schedule?.sessions ?? []).filter(
    (session) => course === 'all' || session.courseOfferingId === course
  ), [course, schedule]);
  const weekDates = useMemo(() => scheduleWeekDates(weekStart), [weekStart]);
  const weekEnd = weekDates[6] ?? weekStart;
  const weekSessions = useMemo(() => filteredSessions.filter(
    (session) => session.date >= weekStart && session.date <= weekEnd
  ), [filteredSessions, weekEnd, weekStart]);
  const activeWeekSessions = weekSessions.filter((session) => session.status !== 'CANCELLED');
  const coveredThisWeek = activeWeekSessions.filter((session) => ![
    'UNCOVERED', 'UNPAID_ATTENDANCE', 'NOT_REQUIRED'
  ].includes(session.coverageStatus)).length;
  const uncoveredThisWeek = activeWeekSessions.filter((session) => [
    'UNCOVERED', 'UNPAID_ATTENDANCE'
  ].includes(session.coverageStatus)).length;
  const makeupLessons = Array.from(new Map(
    (schedule?.sessions ?? [])
      .filter((session) => session.coverageStatus === 'MAKEUP_DUE' && session.lessonCreditId)
      .map((session) => [session.lessonCreditId, session])
  ).values());

  const withdrawRequest = async (session: StudentScheduleSession) => {
    if (!schedule || !session.makeupRequestId) return;
    setRequestActionId(session.makeupRequestId);
    setRequestError('');
    try {
      await cancelStudentMakeupRequest(schedule.studentId, session.makeupRequestId);
      onRetry();
    } catch (cause) {
      setRequestError(apiMessage(cause));
    } finally {
      setRequestActionId('');
    }
  };

  const chooseCourse = (nextCourse: string) => {
    setCourse(nextCourse);
    const matchingDates = (schedule?.sessions ?? [])
      .filter((session) => nextCourse === 'all' || session.courseOfferingId === nextCourse)
      .map((session) => session.date);
    setWeekStart(initialScheduleWeekStart(matchingDates, today));
  };

  if (loading && !schedule) {
    return <div className="student-schedule-state" aria-live="polite"><span /><span /><span /></div>;
  }
  if (loadError || !schedule) {
    return (
      <div className="student-schedule-state is-error" role="alert">
        <strong>Your schedule is unavailable</strong>
        <p>{loadError || 'Please try again.'}</p>
        <button type="button" className="btn" onClick={onRetry}>Try again</button>
      </div>
    );
  }

  return (
    <div className="student-view student-view--schedule">
      <header className="student-page-head student-schedule-head">
        <div>
          <h1>My timetable</h1>
          <p>Choose a week to see when and where each class is running.</p>
        </div>
      </header>

      {schedule.summary.pendingPaymentLessons > 0 && (
        <div className="student-schedule-notice">
          <strong>{schedule.summary.pendingPaymentLessons} lesson{schedule.summary.pendingPaymentLessons === 1 ? '' : 's'} awaiting payment</strong>
          <span>They will become available after the payment is confirmed.</span>
        </div>
      )}

      {schedule.summary.expiringLessons > 0 && schedule.summary.nextExpiryDate && (
        <div className="student-schedule-notice student-schedule-notice--expiry">
          <strong>{schedule.summary.expiringLessons} paid lesson{schedule.summary.expiringLessons === 1 ? '' : 's'} expiring soon</strong>
          <span>Use them by {formatSessionDateLabel(schedule.summary.nextExpiryDate)}.</span>
        </div>
      )}

      {makeupLessons.length > 0 && (
        <section className="student-makeup-queue" aria-labelledby="makeup-queue-title">
          <header>
            <div><span>Action needed</span><h2 id="makeup-queue-title">Arrange your make-up lessons</h2></div>
            <b>{makeupLessons.length}</b>
          </header>
          <div>
            {makeupLessons.map((session) => (
              <article key={session.lessonCreditId}>
                <div>
                  <strong>{session.courseCode}</strong>
                  <span>Missed {formatSessionDateLabel(session.date)}</span>
                  {session.creditExpiresOn && <small>Credit expires {formatSessionDateLabel(session.creditExpiresOn)}</small>}
                </div>
                {session.makeupRequestStatus === 'SUBMITTED' && session.makeupRequestId ? (
                  <div className="student-makeup-queue__pending">
                    <span>Awaiting review</span>
                    <small>Requested {session.makeupRequestedSessionDate ? formatSessionDateLabel(session.makeupRequestedSessionDate) : 'date'}</small>
                    <button type="button" disabled={requestActionId === session.makeupRequestId} onClick={() => void withdrawRequest(session)}>
                      {requestActionId === session.makeupRequestId ? 'Withdrawing…' : 'Withdraw request'}
                    </button>
                  </div>
                ) : (
                  <button type="button" className="btn btn--primary" onClick={() => setRequestingMakeup(session)}>Choose a date</button>
                )}
              </article>
            ))}
          </div>
          {requestError && <p className="field-error" role="alert">{requestError}</p>}
        </section>
      )}

      <section className="student-week-shell" aria-labelledby="student-week-title">
        <header className="student-week-toolbar">
          <div className="student-week-navigation" aria-label="Choose timetable week">
            <button type="button" onClick={() => setWeekStart(addScheduleDays(weekStart, -7))} aria-label="Previous week"><IconChevronLeft /></button>
            <div className="student-week-heading">
              <h2 id="student-week-title">{compactWeekRangeLabel(weekDates) || scheduleWeekRangeLabel(weekStart)}</h2>
              <span>{activeWeekSessions.length} scheduled class{activeWeekSessions.length === 1 ? '' : 'es'}</span>
            </div>
            <button type="button" onClick={() => setWeekStart(addScheduleDays(weekStart, 7))} aria-label="Next week"><IconChevronRight /></button>
          </div>
          <div className="student-week-tools">
            <button type="button" className="student-week-today" onClick={() => setWeekStart(scheduleWeekStart(today))}>
              <IconCalendar />
              <span>This week</span>
            </button>
            <div className="student-week-filters">
              {courses.length > 1 && (
                <label className="field student-schedule-course">
                  <span>Class</span>
                  <select value={course} onChange={(event) => chooseCourse(event.target.value)}>
                    <option value="all">All classes</option>
                    {courses.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
                  </select>
                </label>
              )}
              <label className="field student-week-date">
                <span>Jump to date</span>
                <span className="student-week-date__control"><IconCalendar /><input type="date" value={weekStart} onChange={(event) => event.target.value && setWeekStart(scheduleWeekStart(event.target.value))} /></span>
              </label>
            </div>
          </div>
        </header>

        <div className="student-week-summary" aria-label="Selected week lesson coverage">
          <span className="student-week-summary__metric">
            <i className="is-covered" aria-hidden="true" />
            <span><strong>{coveredThisWeek}</strong><small>Covered this week</small></span>
          </span>
          <span className={`student-week-summary__metric${uncoveredThisWeek > 0 ? ' needs-attention' : ''}`}>
            <i className="is-warning" aria-hidden="true" />
            <span><strong>{uncoveredThisWeek}</strong><small>Need payment coverage</small></span>
          </span>
          <span className="student-week-summary__metric student-week-summary__remaining">
            <span><strong>{schedule.summary.remainingLessons}</strong><small>Paid lesson{schedule.summary.remainingLessons === 1 ? '' : 's'} remaining</small></span>
          </span>
        </div>

        {weekSessions.length > 0 ? (
          <>
            <DesktopWeekTable dates={weekDates} sessions={weekSessions} today={today} onRequestLeave={onRequestLeave} />
            <MobileWeek dates={weekDates} sessions={weekSessions} today={today} onRequestLeave={onRequestLeave} />
          </>
        ) : (
          <div className="student-schedule-empty">
            <IconCalendar />
            <strong>No classes this week</strong>
            <p>Choose another week or use “This week” to return to the current timetable.</p>
          </div>
        )}
      </section>

      {requestingMakeup && (
        <MakeupRequestModal
          studentId={schedule.studentId}
          session={requestingMakeup}
          onClose={() => setRequestingMakeup(null)}
          onSubmitted={() => { setRequestingMakeup(null); onRetry(); }}
        />
      )}
    </div>
  );
}
