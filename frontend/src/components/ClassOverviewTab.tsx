import AttendanceDonutChart, { type AttendanceBreakdown } from './AttendanceDonutChart';
import MiniAttendanceRing from './MiniAttendanceRing';
import { sessionRoomLabel } from '../lib/classroomApi';
import { statusClass } from '../lib/format';
import type { Session, Student } from '../types';

// Matches studentRateLabel's own "Needs attention" cutoff (lib/format.ts) — a student only
// shows up here if their own individual label would already read that way.
const NEEDS_ATTENTION_THRESHOLD = 60;

interface Props {
  readonly attendance: AttendanceBreakdown;
  /** This class's own sessions, sorted most-current-first — see lib/classRows.ts. */
  readonly classSessions: readonly Session[];
  /** A genuinely upcoming session (date >= today, not yet completed/cancelled), or null — passed
   *  in rather than recomputed here so the detail page's persistent stat row and this tab always
   *  agree on the same "next session" definition. */
  readonly nextSession: Session | null;
  readonly roster: readonly Student[];
  readonly onViewSessions: () => void;
  readonly onViewStudents: () => void;
  readonly onOpenStudent: (studentId: string) => void;
}

/** The detail page's landing tab — a glance at this class's health plus two short previews that
 *  link into the Sessions and Students tabs, the same "summary card that links to the full page"
 *  pattern the app's own Dashboard pages already use. Shared by the Admin and teacher detail
 *  pages, since neither needs any write access here. */
export default function ClassOverviewTab({
  attendance,
  classSessions,
  nextSession,
  roster,
  onViewSessions,
  onViewStudents,
  onOpenStudent
}: Props) {
  const sessionsPreview = classSessions.slice(0, 3);
  const completedCount = classSessions.filter((session) => session.status === 'Completed').length;

  const needsAttention = roster
    .filter((student): student is Student & { rate: number } => student.rate !== null && student.rate < NEEDS_ATTENTION_THRESHOLD)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 3);

  return (
    <div className="class-overview">
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

      <div className="grid-2">
        <section className="card dashboard-enter stagger-3">
          <div className="card__body">
            <div className="card__title-line">
              <div className="card__title">Sessions</div>
              <button type="button" className="btn btn--quiet btn--sm" onClick={onViewSessions}>
                View all →
              </button>
            </div>
            {nextSession && (
              <div className="notice notice--info">
                <span className="notice__mark" aria-hidden="true">
                  i
                </span>
                <span>
                  Next session: {nextSession.dateLabel} · {nextSession.time} · {sessionRoomLabel(nextSession)}
                </span>
              </div>
            )}
            {sessionsPreview.length === 0 ? (
              <div className="empty empty--compact">No sessions scheduled for this class yet.</div>
            ) : (
              sessionsPreview.map((session) => (
                <div key={session.id} className="kv">
                  <div>
                    <div className="cell-strong cell-strong--compact">
                      {session.dateLabel} · {sessionRoomLabel(session)}
                    </div>
                    <div className="cell-sub">{session.time}</div>
                  </div>
                  <span className={statusClass(session.status)}>{session.status}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="card dashboard-enter stagger-3">
          <div className="card__body">
            <div className="card__title-line">
              <div className="card__title">Students needing attention</div>
              <button type="button" className="btn btn--quiet btn--sm" onClick={onViewStudents}>
                View all →
              </button>
            </div>
            {needsAttention.length === 0 ? (
              <div className="empty empty--compact">No students below the attendance threshold.</div>
            ) : (
              needsAttention.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  className="kv kv--history"
                  onClick={() => onOpenStudent(student.id)}
                >
                  <div>
                    <div className="cell-strong cell-strong--compact">{student.name}</div>
                    <div className="cell-sub">{student.id}</div>
                  </div>
                  <MiniAttendanceRing rate={student.rate} tier="student" />
                </button>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
