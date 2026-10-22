export { attendanceCounts, emptyAttendanceCounts } from '../../lib/attendanceAnalytics';
import { studentCourses, studentIsEnrolledInSession } from '../../lib/studentCourses';
import type { AttendanceRow, Session, Student } from '../../types';

export const EMPTY_SESSION: Session = {
  id: '',
  course: 'No session selected',
  title: 'No classroom session selected',
  room: 'No room selected',
  date: '',
  dateLabel: 'No date',
  time: 'No scheduled time',
  startTime: '',
  endTime: '',
  enrolled: 0,
  status: 'Scheduled',
  statusCode: 'SCHEDULED'
};

export function enrolledCountForCourse(course: string, students: readonly Student[]) {
  return students.filter((student) => studentCourses(student).includes(course)).length;
}

export function enrolledCountForSession(session: Session, students: readonly Student[]) {
  return students.filter((student) => studentIsEnrolledInSession(student, session)).length;
}

export function upsertAttendanceRow(
  rows: readonly AttendanceRow[],
  updated: AttendanceRow
): AttendanceRow[] {
  const exists = rows.some((row) => row.studentRecordId === updated.studentRecordId);
  return exists
    ? rows.map((row) =>
        row.studentRecordId === updated.studentRecordId ? updated : row
      )
    : [...rows, updated];
}

export function attendanceRowsForSession(
  targetSessionId: string,
  selectedSessionId: string,
  selectedRows: readonly AttendanceRow[],
  cachedRows: Readonly<Record<string, AttendanceRow[]>>
) {
  const source = targetSessionId === selectedSessionId ? selectedRows : cachedRows[targetSessionId] ?? [];
  return source.filter(row => row.sessionId === targetSessionId);
}

export function buildSessionDateOptions(sessions: readonly Session[]) {
  const uniqueDates = [...new Set(sessions.map((session) => session.date))].sort((left, right) =>
    right.localeCompare(left)
  );
  return [
    { value: 'all', label: 'All dates' },
    ...uniqueDates.map((date) => ({
      value: date,
      label: sessions.find((session) => session.date === date)?.dateLabel ?? date
    }))
  ];
}

export function sessionsForCourse(sessions: readonly Session[], course: string): Session[] {
  return sessions.filter((session) => course === 'All courses' || session.course === course);
}

export function firstSessionForScope(
  sessions: readonly Session[],
  course: string,
  date: string,
  preferredDate?: string
): Session | undefined {
  const scoped = sessionsForCourse(sessions, course);
  if (date !== 'all') return scoped.find((session) => session.date === date);
  return scoped.find((session) => session.date === preferredDate) ?? scoped[0];
}

export function buildSessionCourseOptions(
  sessions: readonly Session[],
  students: readonly Student[]
) {
  const values = new Set<string>();
  sessions.forEach((session) => values.add(session.course));
  students.forEach((student) => studentCourses(student).forEach((course) => values.add(course)));
  values.delete('All courses');
  return ['All courses', ...Array.from(values).sort((left, right) => left.localeCompare(right))];
}
