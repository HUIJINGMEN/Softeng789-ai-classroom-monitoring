import { useMemo, useState } from 'react';
import AttendanceDistributionSummary from './AttendanceDistributionSummary';
import type { AttendanceBreakdown } from './AttendanceDonutChart';
import ClassAttendanceSessionRow from './ClassAttendanceSessionRow';
import SessionAttendanceRosterModal from './SessionAttendanceRosterModal';
import { ATTENDANCE_COUNT_COLUMNS } from '../features/class-attendance/classAttendanceModel';
import { sessionMatchesSearch } from '../lib/sessionSearch';
import { usePagination } from '../lib/table';
import Pager from './Pager';
import SearchField from './SearchField';
import SelectMenu, { type SelectMenuOption } from './SelectMenu';
import type { Console } from '../hooks/useConsole';
import type { Session, Student } from '../types';

interface Props {
  readonly attendance: AttendanceBreakdown;
  /** This class's own sessions, sorted most-current-first — see lib/classRows.ts. */
  readonly classSessions: readonly Session[];
  readonly countsForSession: Console['countsForSession'];
  readonly attendanceRowsForSession: Console['attendanceRowsForSession'];
  readonly students: readonly Student[];
  readonly onOpenStudent: (studentId: string) => void;
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
export default function ClassAttendanceTab({
  attendance,
  classSessions,
  countsForSession,
  attendanceRowsForSession,
  students,
  onOpenStudent
}: Props) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SessionStatusFilter>('All');
  const [page, setPage] = useState(0);
  const [rosterSessionId, setRosterSessionId] = useState<string | null>(null);
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
  const rosterSession = classSessions.find((session) => session.id === rosterSessionId) ?? null;

  const updateQuery = (value: string) => {
    setQuery(value);
    setPage(0);
    setRosterSessionId(null);
  };

  const updateStatus = (value: SessionStatusFilter) => {
    setStatusFilter(value);
    setPage(0);
    setRosterSessionId(null);
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
            <div className="card__sub">Use View roster to see the students behind each attendance total.</div>
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
                          {ATTENDANCE_COUNT_COLUMNS.map((column) => <th key={column.status}>{column.label}</th>)}
                          <th>Attendance rate</th>
                          <th>Roster</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paged.rows.map((session) => (
                          <ClassAttendanceSessionRow
                            key={session.id}
                            session={session}
                            countsForSession={countsForSession}
                            onOpenRoster={setRosterSessionId}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pager
                    label={paged.label}
                    page={paged.page}
                    pageCount={paged.pageCount}
                    canPrev={paged.canPrev}
                    canNext={paged.canNext}
                    onPrev={() => {
                      setRosterSessionId(null);
                      paged.prev();
                    }}
                    onNext={() => {
                      setRosterSessionId(null);
                      paged.next();
                    }}
                    onGoToPage={(targetPage) => {
                      setRosterSessionId(null);
                      paged.goToPage(targetPage);
                    }}
                  />
                </>
              )}
            </>
          )}
        </div>
      </section>

      {rosterSession && (
        <SessionAttendanceRosterModal
          session={rosterSession}
          attendanceRows={attendanceRowsForSession(rosterSession.id)}
          students={students}
          counts={countsForSession(rosterSession.id)}
          onOpenStudent={(studentId) => {
            setRosterSessionId(null);
            onOpenStudent(studentId);
          }}
          onClose={() => setRosterSessionId(null)}
        />
      )}
    </div>
  );
}
