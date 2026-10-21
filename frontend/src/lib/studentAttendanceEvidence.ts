import { completedSessionBy } from './attendanceAnalytics';
import type { AttendanceRow, Session, Student } from '../types';

/** Match exact identities on the historical roster; never infer attendance from today's enrolments. */
export function studentAttendanceEvidence(
  student: Student, sessions: readonly Session[], rowsForSession: (id: string) => readonly AttendanceRow[], asOf = Date.now()
): {session: Session; row: AttendanceRow}[] {
  return sessions.filter(session => completedSessionBy(session, asOf)).flatMap(session => {
    const row = rowsForSession(session.id).find(candidate => student.recordId
      ? candidate.studentRecordId === student.recordId
      : candidate.studentNumber === (student.studentNumber ?? student.id));
    return row ? [{session, row}] : [];
  });
}
