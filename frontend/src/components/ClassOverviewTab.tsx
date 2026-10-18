import AttendanceDonutChart, { type AttendanceBreakdown } from './AttendanceDonutChart';
import AttendanceCoveragePanel from './AttendanceCoveragePanel';
import MiniAttendanceRing from './MiniAttendanceRing';
import PersonAvatar from './PersonAvatar';
import { IconArrowRight } from './icons';
import { sessionRoomLabel } from '../lib/classroomApi';
import { avatarTone, statusClass } from '../lib/format';
import type { Session, Student } from '../types';
import { buildClassOverviewModel } from '../features/class-overview/classOverviewModel';

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
  const {recentSessions: sessionsPreview, completedCount, hasRecordedRosterRates, attentionTotal,
    attentionPreview: needsAttention} = buildClassOverviewModel(classSessions, roster);
  const sessionSuffix = completedCount === 1 ? '' : 's';
  const attendanceNote = completedCount > 0 ? `Based on ${completedCount} completed session${sessionSuffix}` : undefined;
  let attentionCopy = hasRecordedRosterRates
    ? 'No students with recorded attendance are below the threshold.'
    : 'No recorded rates for the current roster.';
  if (attentionTotal > 0) attentionCopy = `${attentionTotal} student${attentionTotal === 1 ? '' : 's'} below 60% attendance`;

  return (
    <div className="class-overview class-overview__grid">
      <div className="class-overview__health-column">
        <section className="card class-overview__attendance dashboard-enter stagger-2">
          <div className="card__head class-overview-card__head">
            <div>
              <div className="card__title">Overall attendance</div>
              <div className="card__sub">Present and late ÷ recorded marks. Unrecorded marks are not absences.</div>
            </div>
          </div>
          <div className="card__body class-overview__attendance-body">
            <AttendanceDonutChart
              attendance={attendance}
              layout="compact"
              emptyTitle="No attendance recorded yet."
              emptyHint="A breakdown will appear once this class has run a classroom session."
              note={attendanceNote}
            />
            <AttendanceCoveragePanel attendance={attendance} />
          </div>
        </section>

        <section className="card class-overview__preview class-overview__attention dashboard-enter stagger-3">
          <div className="card__head class-overview-card__head">
            <div>
              <div className="card__title">Students needing attention</div>
              <div className="card__sub">
                {attentionCopy}
              </div>
            </div>
            <button type="button" className="btn btn--quiet btn--sm btn--with-icon" onClick={onViewStudents}>
              View all <IconArrowRight />
            </button>
          </div>
          <div className="card__body class-overview__attention-body">
            {attentionTotal === 0 ? (
              <output className="class-overview__attention-clear">
                {hasRecordedRosterRates
                  ? 'Everyone with recorded attendance is at or above 60%.'
                  : 'No recorded attendance for the current roster. Check missing marks before assessing attendance.'}
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
            {attentionTotal > needsAttention.length && (
              <p className="cell-sub">Showing {needsAttention.length} of {attentionTotal}. View all students to review the full roster.</p>
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
            Open schedule <IconArrowRight />
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
            <div className="empty empty--compact">No completed or upcoming sessions to show.</div>
          ) : (
            <>
              {sessionsPreview.length > 0 && (
                <div className="class-overview__recent-label">Recent completed sessions</div>
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
