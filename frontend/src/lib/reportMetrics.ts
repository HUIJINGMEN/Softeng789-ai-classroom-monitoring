import { attendanceCounts, attendanceRate, completedSessionBy, recordedAttendanceCount } from './attendanceAnalytics';
import { eventMatchesStudent } from './eventDisplay';
import { studentAttendanceEvidence } from './studentAttendanceEvidence';
import type { AttendanceBreakdown } from '../components/AttendanceDonutChart';
import type { Console } from '../hooks/useConsole';
import type { CandidateEvent, Session, Student } from '../types';

export interface StudentRangeMetrics {
  attendance: AttendanceBreakdown;
  attended: number;
  recorded: number;
  sessionCount: number;
  confirmedEventCount: number;
}

export function completedSessionsInRange(
  sessions: readonly Session[],
  dateFrom: string,
  dateTo: string,
  courseOfferingId?: string,
  asOf = Date.now()
): Session[] {
  return sessions
    .filter(
      (session) =>
        completedSessionBy(session, asOf) &&
        session.date >= dateFrom &&
        session.date <= dateTo &&
        (!courseOfferingId || session.courseOfferingId === courseOfferingId)
    )
    .slice()
    .sort((left, right) => right.startTime.localeCompare(left.startTime));
}

export function attendanceForSessions(
  sessions: readonly Session[],
  countsForSession: Console['countsForSession']
): AttendanceBreakdown {
  const totals = sessions.reduce(
    (acc, session) => {
      const counts = countsForSession(session.id);
      acc.present += counts.present;
      acc.late += counts.late;
      acc.absent += counts.absent;
      acc.unknown += counts.unknown;
      return acc;
    },
    { present: 0, late: 0, absent: 0, unknown: 0 }
  );
  const recorded = recordedAttendanceCount(totals);

  return {
    ...totals,
    total: recorded + totals.unknown,
    rate: attendanceRate(totals)
  };
}

export function confirmedEventsForSessions(
  events: readonly CandidateEvent[],
  sessions: readonly Session[]
): CandidateEvent[] {
  const sessionIds = new Set(sessions.map((session) => session.id));
  return events.filter(
    (event) =>
      sessionIds.has(event.sessionId) &&
      (event.status === 'Confirmed' || event.status === 'Corrected')
  );
}

export function eventTypeCounts(events: readonly CandidateEvent[]): Record<string, number> {
  return events.reduce<Record<string, number>>((counts, event) => {
    counts[event.type] = (counts[event.type] ?? 0) + 1;
    return counts;
  }, {});
}

export function metricsForStudent(
  student: Student,
  sessions: readonly Session[],
  events: readonly CandidateEvent[],
  attendanceRowsForSession: Console['attendanceRowsForSession']
): StudentRangeMetrics {
  const evidence = studentAttendanceEvidence(student, sessions, attendanceRowsForSession);
  const totals = attendanceCounts(evidence.map(item => item.row));
  const recorded = recordedAttendanceCount(totals);
  const attended = totals.present + totals.late;
  const sessionIds = new Set(evidence.map(item => item.session.id));
  const confirmedEventCount = events.filter(
    (event) => sessionIds.has(event.sessionId) && eventMatchesStudent(event, student)
  ).length;

  return {
    attended,
    recorded,
    sessionCount: evidence.length,
    confirmedEventCount,
    attendance: totals
  };
}
