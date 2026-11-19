import type { AttendanceRow } from '../../types';

export function rosterAttendanceLabel(rows: readonly AttendanceRow[], studentId: string, unavailable: boolean): string {
  if (unavailable) return 'Unavailable';
  const status = rows.find(row => row.studentRecordId === studentId)?.status;
  return !status || status === 'Unknown' ? 'Not recorded' : status;
}
