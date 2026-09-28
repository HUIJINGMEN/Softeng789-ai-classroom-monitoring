import type { AttendanceCounts } from '../../lib/attendanceAnalytics';
import type { AttendanceRow, AttendanceStatus, Student } from '../../types';

export type AttendanceRosterFilter = 'All' | AttendanceStatus;

export interface AttendanceCountColumn {
  readonly status: AttendanceStatus;
  readonly label: string;
  readonly countKey: keyof Pick<AttendanceCounts, 'present' | 'late' | 'absent' | 'unknown'>;
}

export interface AttendanceRosterEntry {
  readonly studentId: string;
  readonly studentNumber: string;
  readonly studentName: string;
  readonly status: AttendanceStatus;
  readonly photoUrl?: string;
  readonly profileAvailable: boolean;
}

export const ATTENDANCE_COUNT_COLUMNS: readonly AttendanceCountColumn[] = [
  { status: 'Present', label: 'Present', countKey: 'present' },
  { status: 'Late', label: 'Late', countKey: 'late' },
  { status: 'Absent', label: 'Absent', countKey: 'absent' },
  { status: 'Unknown', label: 'Not recorded', countKey: 'unknown' }
];

/** Attendance rows are the source of truth for a historical session. Current class students are
 * used only to enrich matching rows with a registration photo, never to reconstruct the roster. */
export function buildAttendanceRoster(
  attendanceRows: readonly AttendanceRow[],
  currentStudents: readonly Student[]
): AttendanceRosterEntry[] {
  const studentByIdentifier = new Map<string, Student>();
  currentStudents.forEach((student) => {
    [student.recordId, student.id, student.studentNumber]
      .filter((identifier): identifier is string => Boolean(identifier))
      .forEach((identifier) => studentByIdentifier.set(identifier, student));
  });

  return attendanceRows
    .map((row) => {
      const student = studentByIdentifier.get(row.studentRecordId)
        ?? studentByIdentifier.get(row.studentNumber);
      return {
        studentId: row.studentRecordId,
        studentNumber: row.studentNumber,
        studentName: row.studentName,
        status: row.status,
        photoUrl: student?.registrationPhoto,
        profileAvailable: Boolean(student)
      };
    })
    .sort((left, right) => left.studentName.localeCompare(right.studentName));
}

export function filterAttendanceRoster(
  rows: readonly AttendanceRosterEntry[],
  query: string,
  statusFilter: AttendanceRosterFilter
): AttendanceRosterEntry[] {
  const normalizedQuery = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (statusFilter !== 'All' && row.status !== statusFilter) return false;
    if (!normalizedQuery) return true;
    return row.studentName.toLowerCase().includes(normalizedQuery)
      || row.studentNumber.toLowerCase().includes(normalizedQuery);
  });
}
