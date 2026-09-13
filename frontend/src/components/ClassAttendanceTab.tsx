import AttendanceDonutChart, { type AttendanceBreakdown } from './AttendanceDonutChart';
import { percentageOf } from '../lib/attendanceAnalytics';
import { sessionRoomLabel } from '../lib/classroomApi';
import { formatRate, statusClass } from '../lib/format';
import type { Console } from '../hooks/useConsole';
import type { Session } from '../types';

interface Props {
  readonly attendance: AttendanceBreakdown;
  /** This class's own sessions, sorted most-current-first — see lib/classRows.ts. */
  readonly classSessions: readonly Session[];
  readonly countsForSession: Console['countsForSession'];
}

/** The class-wide attendance donut plus a per-session breakdown table — the numbers
 *  ClassSessionsCard's status badges don't show. Shared by the Admin and teacher detail pages. */
export default function ClassAttendanceTab({ attendance, classSessions, countsForSession }: Props) {
  const completedCount = classSessions.filter((session) => session.status === 'Completed').length;

  return (
    <div className="class-attendance">
      <section className="card dashboard-enter stagger-2">
        <div className="card__body">
          <div className="card__title card__title--spaced">Overall Attendance</div>
          <AttendanceDonutChart
            attendance={attendance}
            layout="wide"
            emptyTitle="No attendance recorded yet."
            emptyHint="A breakdown will appear once this class has run a classroom session."
            note={
              completedCount > 0
                ? `Based on ${completedCount} completed session${completedCount === 1 ? '' : 's'}`
                : undefined
            }
          />
        </div>
      </section>

      <section className="card dashboard-enter stagger-3">
        <div className="card__body">
          <div className="card__title card__title--spaced">Session breakdown</div>
          {classSessions.length === 0 ? (
            <div className="empty empty--compact">No sessions scheduled for this class yet.</div>
          ) : (
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Status</th>
                  <th>Present</th>
                  <th>Late</th>
                  <th>Absent</th>
                  <th>Not recorded</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {classSessions.map((session) => {
                  // A session that hasn't finished yet still has one attendance row per enrolled
                  // student (all Unknown, since no one's checked in) — showing those as real
                  // numbers here would look like missing records for a class that simply hasn't
                  // happened. Only a Completed session's counts mean anything.
                  const isCompleted = session.status === 'Completed';
                  const counts = isCompleted ? countsForSession(session.id) : null;
                  const rate = counts ? percentageOf(counts.present + counts.late, counts.total) : null;
                  return (
                    <tr key={session.id}>
                      <td>
                        <div className="cell-strong">{session.dateLabel}</div>
                        <div className="cell-sub">{sessionRoomLabel(session)}</div>
                      </td>
                      <td>
                        <span className={statusClass(session.status)}>{session.status}</span>
                      </td>
                      <td>{counts ? counts.present : '–'}</td>
                      <td>{counts ? counts.late : '–'}</td>
                      <td>{counts ? counts.absent : '–'}</td>
                      <td>{counts ? counts.unknown : '–'}</td>
                      <td className="mono">{counts ? formatRate(rate) : '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
