import { useEffect, useMemo, useState } from 'react';
import Pager from './Pager';
import { IconAlertTriangle, IconArrowRight } from './icons';
import { percentageOf } from '../lib/attendanceAnalytics';
import { sessionRoomLabel } from '../lib/classroomApi';
import { usePagination } from '../lib/table';
import type { Session } from '../types';

type AttendancePeriod = 'week' | 'month';

const LOWEST_ATTENDANCE_PAGE_SIZE = 4;

function lowAttendanceRateClass(rate: number): string {
  if (rate < 50) return 'rate-text rate-text--danger';
  if (rate < 65) return 'rate-text rate-text--warn';
  return 'rate-text rate-text--ok';
}

interface Props {
  readonly sessions: readonly Session[];
  readonly countsForSession: (sessionId: string) => { present: number; late: number; absent: number; total: number };
  readonly period: AttendancePeriod;
  readonly onPeriodChange: (period: AttendancePeriod) => void;
  readonly onOpenAttendance: () => void;
  readonly onOpenClass: (courseOfferingId: string) => void;
  readonly scopeLabel?: string;
  readonly ctaLabel?: string;
}

export default function AdminLowestAttendanceCard({
  sessions,
  countsForSession,
  period,
  onPeriodChange,
  onOpenAttendance,
  onOpenClass,
  scopeLabel,
  ctaLabel = 'View attendance →'
}: Props) {
  const [page, setPage] = useState(0);
  const lowestAttendance = useMemo(() => {
    const byClassRoom = new Map<
      string,
      {
        courseOfferingId: string | null;
        course: string;
        room: string;
        present: number;
        late: number;
        absent: number;
        total: number;
        sessions: number;
      }
    >();
    for (const session of sessions) {
      const roomLabel = sessionRoomLabel(session);
      const key = `${session.courseOfferingId ?? session.course}__${roomLabel}`;
      const counts = countsForSession(session.id);
      const entry = byClassRoom.get(key) ?? {
        courseOfferingId: session.courseOfferingId ?? null,
        course: session.course,
        room: roomLabel,
        present: 0,
        late: 0,
        absent: 0,
        total: 0,
        sessions: 0
      };
      entry.present += counts.present;
      entry.late += counts.late;
      entry.absent += counts.absent;
      entry.total += counts.total;
      entry.sessions += 1;
      byClassRoom.set(key, entry);
    }
    return Array.from(byClassRoom.values())
      .map((entry) => ({
        ...entry,
        rate: percentageOf(entry.present + entry.late, entry.total, 0)
      }))
      .sort((a, b) => a.rate - b.rate || a.course.localeCompare(b.course));
  }, [sessions, countsForSession]);
  const pagedAttendance = usePagination(
    lowestAttendance,
    page,
    setPage,
    LOWEST_ATTENDANCE_PAGE_SIZE
  );
  const periodLabel = period === 'week' ? 'Weekly' : 'Monthly';
  const periodDays = period === 'week' ? 7 : 30;

  useEffect(() => {
    setPage(0);
  }, [period, scopeLabel]);

  return (
    <section className="card dashboard-lowest-attendance dashboard-enter stagger-6">
      <div className="card__head">
        <div className="card__title-row">
          <span className="icon-inline icon-inline--title" aria-hidden="true">
            <IconAlertTriangle />
          </span>
          <div>
            <div className="card__title">Lowest Attendance ({periodLabel})</div>
            <div className="card__sub">Classes that may need attention · {scopeLabel ?? 'Current scope'}</div>
          </div>
        </div>
        <div className="card__actions">
          <div className="lowest-attendance__period" role="group" aria-label="Lowest attendance period">
            <button
              type="button"
              className={period === 'week' ? 'is-active' : ''}
              aria-pressed={period === 'week'}
              onClick={() => onPeriodChange('week')}
            >
              Week
            </button>
            <button
              type="button"
              className={period === 'month' ? 'is-active' : ''}
              aria-pressed={period === 'month'}
              onClick={() => onPeriodChange('month')}
            >
              Month
            </button>
          </div>
          <button type="button" className="btn btn--sm" onClick={onOpenAttendance}>
            {ctaLabel}
          </button>
        </div>
      </div>

      {lowestAttendance.length === 0 ? (
        <div className="empty empty--inline">
          <div className="empty__title">No attendance recorded in the last {periodDays} days.</div>
          <div className="empty__hint">Change the Campus or Level filters to widen this view.</div>
        </div>
      ) : (
        <>
          <div
            className="dashboard-lowest-attendance__table-wrap"
            role="region"
            tabIndex={0}
            aria-label="Scrollable lowest attendance table"
          >
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Attendance</th>
                  <th>Absent</th>
                  <th>Sessions</th>
                  <th className="table__action-cell">Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedAttendance.rows.map((row) => {
                  const canOpenClass = Boolean(row.courseOfferingId);
                  const openClass = () => {
                    if (row.courseOfferingId) onOpenClass(row.courseOfferingId);
                  };
                  return (
                    <tr
                      key={`${row.courseOfferingId ?? row.course}__${row.room}`}
                      className={canOpenClass ? 'table__row--clickable' : undefined}
                      tabIndex={canOpenClass ? 0 : undefined}
                      aria-label={canOpenClass ? `Open ${row.course} class details` : undefined}
                      onClick={openClass}
                      onKeyDown={(event) => {
                        if (!canOpenClass || (event.key !== 'Enter' && event.key !== ' ')) return;
                        event.preventDefault();
                        openClass();
                      }}
                    >
                      <td>
                        <div className="cell-strong">{row.course}</div>
                        <div className="dashboard-lowest-attendance__room">{row.room}</div>
                      </td>
                      <td>
                        <span className={lowAttendanceRateClass(row.rate)}>{row.rate}%</span>
                        <span className="dashboard-lowest-attendance__participating">
                          {row.present + row.late} participating
                        </span>
                      </td>
                      <td>{row.absent}</td>
                      <td>{row.sessions}</td>
                      <td className="table__action-cell">
                        {canOpenClass && (
                          <button
                            type="button"
                            className="btn btn--sm dashboard-lowest-attendance__open"
                            aria-label={`Open ${row.course} class details`}
                            onClick={(event) => {
                              event.stopPropagation();
                              openClass();
                            }}
                          >
                            <IconArrowRight />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager
            label={pagedAttendance.label}
            page={pagedAttendance.page}
            pageCount={pagedAttendance.pageCount}
            canPrev={pagedAttendance.canPrev}
            canNext={pagedAttendance.canNext}
            onPrev={pagedAttendance.prev}
            onNext={pagedAttendance.next}
            onGoToPage={pagedAttendance.goToPage}
          />
        </>
      )}
    </section>
  );
}
