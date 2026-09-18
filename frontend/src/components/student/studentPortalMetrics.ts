import type { AttendanceStatus, ProgressReport, StudentAttendanceHistoryEntry } from '../../types';

export interface StudentAttendanceCounts extends Record<AttendanceStatus, number> {
  readonly attended: number;
  readonly recorded: number;
  readonly rate: number;
  readonly total: number;
}

export function reportCourse(report: ProgressReport) {
  return report.classLabel.split(' · ')[0]?.trim() || report.classLabel;
}

export function studentDateLabel(value: string) {
  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value));
}

export function attendanceCounts(rows: readonly StudentAttendanceHistoryEntry[]): StudentAttendanceCounts {
  const counts: Record<AttendanceStatus, number> = { Present: 0, Late: 0, Absent: 0, Unknown: 0 };
  rows.forEach((row) => {
    counts[row.status] += 1;
  });
  const attended = counts.Present + counts.Late;
  const recorded = attended + counts.Absent;
  return {
    ...counts,
    attended,
    recorded,
    rate: recorded > 0 ? Math.round((attended / recorded) * 100) : 0,
    total: rows.length
  };
}

export function attendanceStatusLabel(status: AttendanceStatus) {
  return status === 'Unknown' ? 'Not recorded' : status;
}
