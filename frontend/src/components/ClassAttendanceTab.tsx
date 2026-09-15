import { useMemo, useState } from 'react';
import AttendanceDistributionSummary from './AttendanceDistributionSummary';
import type { AttendanceBreakdown } from './AttendanceDonutChart';
import { percentageOf } from '../lib/attendanceAnalytics';
import { sessionRoomLabel } from '../lib/classroomApi';
import { formatRate, statusClass } from '../lib/format';
import { sessionMatchesSearch } from '../lib/sessionSearch';
import { usePagination } from '../lib/table';
import Pager from './Pager';
import SearchField from './SearchField';
import SelectMenu, { type SelectMenuOption } from './SelectMenu';
import type { Console } from '../hooks/useConsole';
import type { Session } from '../types';

interface Props {
  readonly attendance: AttendanceBreakdown;
  /** This class's own sessions, sorted most-current-first — see lib/classRows.ts. */
  readonly classSessions: readonly Session[];
  readonly countsForSession: Console['countsForSession'];
}

type SessionStatusFilter = 'All' | Session['status'];

const SESSION_STATUS_OPTIONS: readonly SelectMenuOption<SessionStatusFilter>[] = [
  { value: 'All', label: 'All statuses' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Scheduled', label: 'Scheduled' },
  { value: 'Live', label: 'Live' },
  { value: 'Cancelled', label: 'Cancelled' }
];

/** The class-wide attendance distribution plus a per-session breakdown table — the numbers
 *  ClassSessionsCard's status badges don't show. Shared by the Admin and teacher detail pages. */
export default function ClassAttendanceTab({ attendance, classSessions, countsForSession }: Props) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SessionStatusFilter>('All');
  const [page, setPage] = useState(0);
  const completedCount = classSessions.filter((session) => session.status === 'Completed').length;
  const filteredSessions = useMemo(
    () =>
      classSessions.filter(
        (session) =>
          (statusFilter === 'All' || session.status === statusFilter) && sessionMatchesSearch(session, query)
      ),
    [classSessions, query, statusFilter]
  );
  const paged = usePagination(filteredSessions, page, setPage);
  const attendingCount = attendance.present + attendance.late;

  const updateQuery = (value: string) => {
    setQuery(value);
    setPage(0);
  };

  const updateStatus = (value: SessionStatusFilter) => {
    setStatusFilter(value);
    setPage(0);
  };

  return (
    <div className="class-attendance">
      <section className="card class-attendance-summary dashboard-enter stagger-2">
        <div className="card__head class-attendance-summary__heading">
          <div>
            <div className="card__title">Overall attendance</div>
            <div className="card__sub">Attendance status across completed sessions for this class.</div>
          </div>
          {completedCount > 0 && (
            <span className="class-attendance-summary__scope">
              {completedCount} completed session{completedCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="card__body class-attendance-summary__body">
          <AttendanceDistributionSummary
            attendance={attendance}
            emptyTitle="No attendance recorded yet."
            emptyHint="A breakdown will appear once this class has run a classroom session."
            rateDescription={`${attendingCount} of ${attendance.total} marks were present or late.`}
          />
        </div>
      </section>

      <section className="card class-attendance-breakdown dashboard-enter stagger-3">
        <div className="card__head">
          <div>
            <div className="card__title">Session breakdown</div>
            <div className="card__sub">Review recorded attendance one session at a time.</div>
          </div>
          {classSessions.length > 0 && (
            <span className="class-attendance-breakdown__total">
              {classSessions.length} session{classSessions.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="card__body class-attendance-breakdown__body">
          {classSessions.length === 0 ? (
            <div className="empty empty--compact">No sessions scheduled for this class yet.</div>
          ) : (
            <>
              <div className="class-attendance-toolbar">
                <SearchField
                  className="class-attendance-toolbar__search"
                  label="Search sessions"
                  value={query}
                  placeholder="Date, room or status"
                  onChange={updateQuery}
                />
                <div className="field class-attendance-toolbar__filter">
                  <label>Status</label>
                  <SelectMenu
                    value={statusFilter}
                    options={SESSION_STATUS_OPTIONS}
                    onChange={updateStatus}
                    ariaLabel="Filter session attendance by status"
                  />
                </div>
                <div className="class-attendance-toolbar__result" aria-live="polite">
                  {filteredSessions.length} result{filteredSessions.length === 1 ? '' : 's'}
                </div>
              </div>

              {filteredSessions.length === 0 ? (
                <div className="empty empty--compact">No sessions match these filters.</div>
              ) : (
                <>
                  <div
                    className="class-attendance-table-wrap"
                    tabIndex={0}
                    role="region"
                    aria-label="Session attendance breakdown"
                  >
                    <table className="table table--compact class-attendance-table">
                      <thead>
                        <tr>
                          <th>Session</th>
                          <th>Status</th>
                          <th>Present</th>
                          <th>Late</th>
                          <th>Absent</th>
                          <th>Not recorded</th>
                          <th>Attendance rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paged.rows.map((session) => {
                          // A session that hasn't finished yet still has one attendance row per
                          // enrolled student, all marked Unknown. Treating those rows as real
                          // counts would make a future session look incomplete.
                          const isCompleted = session.status === 'Completed';
                          const counts = isCompleted ? countsForSession(session.id) : null;
                          const rate = counts
                            ? percentageOf(counts.present + counts.late, counts.total)
                            : null;

                          return (
                            <tr key={session.id}>
                              <td>
                                <div className="cell-strong">{session.dateLabel}</div>
                                <div className="cell-sub class-attendance-table__session-meta">
                                  <span className="mono">{session.time}</span>
                                  <span>{sessionRoomLabel(session)}</span>
                                </div>
                              </td>
                              <td>
                                <span className={statusClass(session.status)}>{session.status}</span>
                              </td>
                              {counts ? (
                                <>
                                  <td className="class-attendance-table__number">{counts.present}</td>
                                  <td className="class-attendance-table__number">{counts.late}</td>
                                  <td className="class-attendance-table__number">{counts.absent}</td>
                                  <td className="class-attendance-table__number">{counts.unknown}</td>
                                  <td>
                                    <span className="class-attendance-rate">{formatRate(rate)}</span>
                                  </td>
                                </>
                              ) : (
                                <td colSpan={5} className="class-attendance-table__unavailable">
                                  {session.status === 'Cancelled'
                                    ? 'No attendance is recorded for cancelled sessions.'
                                    : 'Attendance will be available after this session is completed.'}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <Pager
                    label={paged.label}
                    page={paged.page}
                    pageCount={paged.pageCount}
                    canPrev={paged.canPrev}
                    canNext={paged.canNext}
                    onPrev={paged.prev}
                    onNext={paged.next}
                    onGoToPage={paged.goToPage}
                  />
                </>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
