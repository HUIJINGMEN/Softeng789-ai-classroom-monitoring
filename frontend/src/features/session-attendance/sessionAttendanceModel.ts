import { percentageOf } from '../../lib/attendanceAnalytics';
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

export function attendanceCounts(rows: readonly AttendanceRow[]) {
  let present = 0;
  let late = 0;
  let absent = 0;
  let unknown = 0;

  for (const row of rows) {
    if (row.status === 'Present') present += 1;
    else if (row.status === 'Late') late += 1;
    else if (row.status === 'Absent') absent += 1;
    else unknown += 1;
  }

  const total = rows.length;
  return {
    present,
    late,
    absent,
    unknown,
    total,
    rate: percentageOf(present + late, total, 0)
  };
}

export function emptyAttendanceCounts(total = 0) {
  return {
    present: 0,
    late: 0,
    absent: 0,
    unknown: total,
    total,
    rate: 0
  };
}

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
  return targetSessionId === selectedSessionId
    ? [...selectedRows]
    : [...(cachedRows[targetSessionId] ?? [])];
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
