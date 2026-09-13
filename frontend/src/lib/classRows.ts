import type { AttendanceBreakdown } from '../components/AttendanceDonutChart';
import type { Console } from '../hooks/useConsole';
import { percentageOf } from './attendanceAnalytics';
import { formatIsoDateInAuckland } from './sessionTime';
import type { Session, Student } from '../types';

export interface ClassRow {
  /** This class's own sessions, sorted most-current-first (see nextOrLatestSession) — exposed so
   *  callers (list rows, the detail hero, and the Overview/Attendance tabs) don't each re-filter
   *  and re-sort c.sessions themselves. Includes every status (Scheduled/Live/Completed/
   *  Cancelled) — for the full schedule, not just what's already happened. */
  classSessions: Session[];
  sessionCount: number;
  /** How many of classSessions have actually finished — the only sessions with attendance data
   *  that means anything (see attendance below). */
  completedSessionCount: number;
  /** Aggregated only over Completed sessions. A session the backend hasn't run yet still returns
   *  one attendance row per enrolled student (status UNKNOWN, since no one has checked in) — if a
   *  still-Scheduled or in-progress session were included here, its whole roster would count as
   *  "not recorded" and drag the class's rate down for a class that simply hasn't happened yet. */
  attendance: AttendanceBreakdown;
  /** The nearest not-yet-finished session, used by class detail headers. */
  nextSession: Session | null;
  /** The nearest upcoming session when one exists, otherwise the most recent past session. */
  nextOrLatestSession: Session | null;
}

/** Shared by the Admin and teacher Classes list pages, and by the class detail hero's persistent
 *  stat row — one place computing "how is this class doing" from the sessions already loaded
 *  into Console, so both pages read the same numbers the same way. */
export function buildClassRow(
  courseOfferingId: string,
  sessions: readonly Session[],
  countsForSession: Console['countsForSession']
): ClassRow {
  const classSessions = sessions
    .filter((session) => session.courseOfferingId === courseOfferingId)
    .slice()
    .sort((a, b) => b.startTime.localeCompare(a.startTime));

  const completedSessions = classSessions.filter((session) => session.status === 'Completed');
  const todayIso = formatIsoDateInAuckland(new Date());
  const nextSession = classSessions
    .filter(
      (session) =>
        session.date >= todayIso &&
        (session.status === 'Scheduled' || session.status === 'Live')
    )
    .sort((a, b) => a.startTime.localeCompare(b.startTime))[0] ?? null;
  const latestPastSession = classSessions.find(
    (session) => session.date <= todayIso && session.status !== 'Cancelled'
  ) ?? null;

  const totals = completedSessions.reduce(
    (acc, session) => {
      const counts = countsForSession(session.id);
      return {
        present: acc.present + counts.present,
        late: acc.late + counts.late,
        absent: acc.absent + counts.absent,
        unknown: acc.unknown + counts.unknown,
        total: acc.total + counts.total
      };
    },
    { present: 0, late: 0, absent: 0, unknown: 0, total: 0 }
  );

  return {
    classSessions,
    sessionCount: classSessions.length,
    completedSessionCount: completedSessions.length,
    attendance: {
      ...totals,
      rate: percentageOf(totals.present + totals.late, totals.total)
    },
    nextSession,
    nextOrLatestSession: nextSession ?? latestPastSession
  };
}

/** For a roster row's "Last recorded" value — the most recent session in this class for which
 *  the student has a real attendance mark. classSessions must already be sorted most-current-first
 *  (buildClassRow's own output already is). */
export function lastRecordedSessionForStudent(
  studentId: string,
  classSessions: readonly Session[],
  attendanceStatusFor: Console['attendanceStatusFor']
): Session | null {
  return classSessions.find((session) => attendanceStatusFor(studentId, session.id) !== 'Unknown') ?? null;
}

/** Attendance shown inside a class roster must be based only on that offering's completed
 *  sessions. Unknown marks are omitted rather than treated as absences: recording completeness
 *  is shown separately elsewhere, and an unrecorded mark must not lower a student's rate. */
export function studentClassAttendanceRate(
  studentId: string,
  classSessions: readonly Session[],
  attendanceStatusFor: Console['attendanceStatusFor']
): number | null {
  const statuses = classSessions
    .filter((session) => session.status === 'Completed')
    .map((session) => attendanceStatusFor(studentId, session.id))
    .filter((status) => status !== 'Unknown');
  const participating = statuses.filter((status) => status === 'Present' || status === 'Late').length;
  return percentageOf(participating, statuses.length);
}

export function withClassAttendanceRates(
  students: readonly Student[],
  classSessions: readonly Session[],
  attendanceStatusFor: Console['attendanceStatusFor']
): Student[] {
  return students.map((student) => ({
    ...student,
    rate: studentClassAttendanceRate(student.id, classSessions, attendanceStatusFor)
  }));
}
