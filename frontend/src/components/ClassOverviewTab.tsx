import AttendanceDonutChart, { type AttendanceBreakdown } from './AttendanceDonutChart';
import MiniAttendanceRing from './MiniAttendanceRing';
import PersonAvatar from './PersonAvatar';
import { IconArrowRight } from './icons';
import { sessionRoomLabel } from '../lib/classroomApi';
import { avatarTone, statusClass } from '../lib/format';
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
 *  link into the Sessions and Students tabs. The attendance and intervention queue share the
 *  left column because they describe class health; the session timeline owns the operational
 *  right column. The columns size independently so a longer session list never stretches a
 *  short attendance summary into an empty panel. */
export default function ClassOverviewTab({
  attendance,
  classSessions,
  nextSession,
  roster,
  onViewSessions,
  onViewStudents,
  onOpenStudent
}: Props) {
  // The upcoming session already has its own highlighted row. Excluding it from the preview
  // prevents the same date and room appearing twice immediately underneath itself.
  const sessionsPreview = classSessions
    .filter((session) => session.id !== nextSession?.id)
    .slice(0, 3);
  const completedCount = classSessions.filter((session) => session.status === 'Completed').length;

  const needsAttention = roster
    .filter((student): student is Student & { rate: number } => student.rate !== null && student.rate < NEEDS_ATTENTION_THRESHOLD)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 3);

  return (
    <div className="class-overview class-overview__grid">
      <div className="class-overview__health-column">
        <section className="card class-overview__attendance dashboard-enter stagger-2">
          <div className="card__head class-overview-card__head">
            <div>
              <div className="card__title">Overall attendance</div>
              <div className="card__sub">Present and late marks count towards the attendance rate.</div>
            </div>
          </div>
          <div className="card__body class-overview__attendance-body">
            <AttendanceDonutChart
              attendance={attendance}
              layout="compact"
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

        <section className="card class-overview__preview class-overview__attention dashboard-enter stagger-3">
          <div className="card__head class-overview-card__head">
            <div>
              <div className="card__title">Students needing attention</div>
              <div className="card__sub">
                {needsAttention.length === 0
                  ? 'No students are currently below the attendance threshold.'
                  : `${needsAttention.length} student${needsAttention.length === 1 ? '' : 's'} below 60% attendance`}
              </div>
            </div>
            <button type="button" className="btn btn--quiet btn--sm btn--with-icon" onClick={onViewStudents}>
              View all <IconArrowRight />
            </button>
          </div>
          <div className="card__body class-overview__attention-body">
            {needsAttention.length === 0 ? (
              <output className="class-overview__attention-clear">
                Everyone with recorded attendance is at or above 60%.
              </output>
            ) : (
              <div className="class-overview__attention-list">
                {needsAttention.map((student, index) => (
                  <button
                    key={student.id}
                    type="button"
                    className="class-overview__attention-student"
                    onClick={() => onOpenStudent(student.id)}
                  >
                    <div className="person">
                      <PersonAvatar name={student.name} tone={avatarTone(`${student.id}_________`, index)} alt="" />
                      <div className="person__details">
                        <div className="cell-strong cell-strong--compact">{student.name}</div>
                        <div className="cell-sub">{student.id}</div>
                      </div>
                    </div>
                    <MiniAttendanceRing rate={student.rate} tier="student" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="card class-overview__preview class-overview__sessions dashboard-enter stagger-3">
        <div className="card__head class-overview-card__head">
          <div>
            <div className="card__title">Sessions</div>
            <div className="card__sub">
              {classSessions.length} session{classSessions.length === 1 ? '' : 's'} in this class
            </div>
          </div>
          <button type="button" className="btn btn--quiet btn--sm btn--with-icon" onClick={onViewSessions}>
            View all <IconArrowRight />
          </button>
        </div>
        <div className="card__body class-overview__sessions-body">
          {nextSession && (
            <div className="class-overview__next-session">
              <div>
                <div className="class-overview__next-label">Next session</div>
                <div className="cell-strong">
                  {nextSession.dateLabel} · {nextSession.time}
                </div>
                <div className="cell-sub">{sessionRoomLabel(nextSession)}</div>
              </div>
              <span className={statusClass(nextSession.status)}>{nextSession.status}</span>
            </div>
          )}
          {sessionsPreview.length === 0 && !nextSession ? (
            <div className="empty empty--compact">No sessions scheduled for this class yet.</div>
          ) : (
            <>
              {nextSession && sessionsPreview.length > 0 && (
                <div className="class-overview__recent-label">Recent sessions</div>
              )}
              {sessionsPreview.map((session) => (
                <div key={session.id} className="kv class-overview__session-row">
                  <div>
                    <div className="cell-strong cell-strong--compact">
                      {session.dateLabel} · {sessionRoomLabel(session)}
                    </div>
                    <div className="cell-sub">{session.time}</div>
                  </div>
                  <span className={statusClass(session.status)}>{session.status}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
