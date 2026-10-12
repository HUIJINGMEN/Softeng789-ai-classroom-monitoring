import { useEffect, useMemo, useState } from 'react';
import {
  addScheduleDays,
  initialScheduleWeekStart,
  scheduleWeekDates,
  scheduleWeekRangeLabel,
  scheduleWeekStart
} from '../features/class-schedule';
import { sessionRoomLabel } from '../lib/classroomApi';
import { statusClass } from '../lib/format';
import { formatIsoDateInAuckland } from '../lib/sessionTime';
import type { Session } from '../types';
import { IconArrowRight, IconChevronLeft, IconChevronRight } from './icons';

interface Props {
  readonly sessions: readonly Session[];
  readonly onOpenSession: (session: Session) => void;
  readonly editable?: boolean;
  readonly onEditSession?: (session: Session) => void;
}

function dayLabel(value: string): { weekday: string; date: string } {
  const date = new Date(`${value}T00:00:00Z`);
  return {
    weekday: new Intl.DateTimeFormat('en-NZ', { weekday: 'short', timeZone: 'UTC' }).format(date),
    date: new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date)
  };
}

export default function ClassScheduleTimetable({
  sessions,
  onOpenSession,
  editable = false,
  onEditSession
}: Props) {
  const today = formatIsoDateInAuckland(new Date());
  const suggestedWeek = useMemo(
    () => initialScheduleWeekStart(sessions.map((session) => session.date), today),
    [sessions, today]
  );
  const [weekStart, setWeekStart] = useState(suggestedWeek);
  const weekDates = scheduleWeekDates(weekStart);
  const weekEnd = weekDates[6] ?? weekStart;

  useEffect(() => {
    if (sessions.length > 0 && !sessions.some((session) => session.date >= weekStart && session.date <= weekEnd)) {
      setWeekStart(suggestedWeek);
    }
  }, [sessions.length, suggestedWeek]);

  const sessionsByDate = useMemo(() => {
    const grouped = new Map<string, Session[]>();
    sessions.forEach((session) => {
      if (session.date < weekStart || session.date > weekEnd) return;
      const existing = grouped.get(session.date) ?? [];
      existing.push(session);
      grouped.set(session.date, existing);
    });
    grouped.forEach((items) => items.sort((left, right) => left.startTime.localeCompare(right.startTime)));
    return grouped;
  }, [sessions, weekEnd, weekStart]);
  const visibleCount = [...sessionsByDate.values()].reduce((total, items) => total + items.length, 0);

  return (
    <section className="class-timetable" aria-label="Weekly class timetable">
      <div className="class-timetable__toolbar">
        <div className="class-timetable__navigation">
          <button type="button" className="btn btn--quiet btn--sm btn--icon" aria-label="Previous week" onClick={() => setWeekStart((current) => addScheduleDays(current, -7))}>
            <IconChevronLeft />
          </button>
          <button type="button" className="btn btn--sm" onClick={() => setWeekStart(scheduleWeekStart(today))}>
            Today
          </button>
          <button type="button" className="btn btn--quiet btn--sm btn--icon" aria-label="Next week" onClick={() => setWeekStart((current) => addScheduleDays(current, 7))}>
            <IconChevronRight />
          </button>
        </div>
        <div className="class-timetable__range">
          <strong>{scheduleWeekRangeLabel(weekStart)}</strong>
          <span>{visibleCount} session{visibleCount === 1 ? '' : 's'} this week</span>
        </div>
      </div>

      <div className="class-timetable__scroll" tabIndex={0} role="region" aria-label={`${scheduleWeekRangeLabel(weekStart)} timetable`}>
        <div className="class-timetable__grid">
          {weekDates.map((date) => {
            const label = dayLabel(date);
            const daySessions = sessionsByDate.get(date) ?? [];
            return (
              <section className={`class-timetable__day${date === today ? ' is-today' : ''}`} key={date} aria-label={`${label.weekday} ${label.date}`}>
                <header>
                  <span>{label.weekday}</span>
                  <strong>{label.date}</strong>
                </header>
                <div className="class-timetable__day-body">
                  {daySessions.map((session) => (
                    <article
                      key={session.id}
                      className={`class-timetable__session class-timetable__session--${session.status.toLowerCase()}`}
                    >
                      <div className="class-timetable__session-details">
                        <strong>{session.time}</strong>
                        <span>{sessionRoomLabel(session)}</span>
                        <small>{session.teacherName || 'Teacher not assigned'}</small>
                        <span className={statusClass(session.status)}>{session.status}</span>
                      </div>
                      <div className="class-timetable__session-actions">
                        {editable
                          && onEditSession
                          && (session.status === 'Scheduled' || session.status === 'Live') && (
                            <button type="button" onClick={() => onEditSession(session)}>
                              Edit schedule
                            </button>
                        )}
                        <button type="button" onClick={() => onOpenSession(session)}>
                          Attendance <IconArrowRight />
                        </button>
                      </div>
                    </article>
                  ))}
                  {daySessions.length === 0 && <span className="class-timetable__free">No class</span>}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}
