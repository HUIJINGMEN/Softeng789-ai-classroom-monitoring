import { formatIsoDateInAuckland } from './sessionTime';
import { STUDENT_LEVEL_OPTIONS } from './studentLevels';
import type { AttendanceRow, Session, StudentLevel } from '../types';

export const ALL_STUDENT_LEVELS = 'ALL_LEVELS' as const;
export const ALL_ROOMS = 'All rooms' as const;
export const UNASSIGNED_LEVEL = 'UNASSIGNED_LEVEL' as const;

export type AttendanceLevelFilter = StudentLevel | typeof ALL_STUDENT_LEVELS | typeof UNASSIGNED_LEVEL;
export type AttendanceRangeDays = '7' | '30' | '90';

export const ATTENDANCE_LEVEL_OPTIONS: readonly { value: AttendanceLevelFilter; label: string }[] = [
  { value: ALL_STUDENT_LEVELS, label: 'All levels' },
  ...STUDENT_LEVEL_OPTIONS,
  { value: UNASSIGNED_LEVEL, label: 'Unassigned level' }
];

export function attendanceLevelLabel(level: AttendanceLevelFilter): string {
  return ATTENDANCE_LEVEL_OPTIONS.find(option => option.value === level)?.label ?? 'Unassigned level';
}

/** Mirrors backend AttendanceMetricPolicy: historical summaries exclude live/future/cancelled lessons. */
export function completedSessionBy(session: Pick<Session, 'status' | 'date' | 'startTime'>, asOf = Date.now()): boolean {
  const start = Date.parse(session.startTime);
  return session.status === 'Completed' && Number.isFinite(start) && start <= asOf
    && session.date <= formatIsoDateInAuckland(new Date(asOf));
}

export interface AttendanceCounts {
  present: number;
  late: number;
  absent: number;
  unknown: number;
  total: number;
  rate: number | null;
}

export const ATTENDANCE_RANGE_OPTIONS: readonly { value: AttendanceRangeDays; label: string }[] = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' }
];

export function attendanceRangeStart(todayIso: string, rangeDays: AttendanceRangeDays): string {
  const start = new Date(`${todayIso}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (Number(rangeDays) - 1));
  return start.toISOString().slice(0, 10);
}

/**
 * Rounds numerator/denominator to a whole-number percentage — the one piece of arithmetic behind
 * every attendance and data-completeness rate in the app. Centralized so a future change to the
 * rounding rule (or to what counts as "no data yet") happens once instead of being hunted down
 * across every screen that shows a rate. `whenEmpty` is a parameter rather than baked in because
 * "no denominator yet" genuinely means different things to different callers — no rate to display
 * (null) vs. 0% (e.g. a chart that still needs a plottable point) — and that's a real per-caller
 * product decision, not something safe to unify away.
 */
export function percentageOf(numerator: number, denominator: number, whenEmpty: number): number;
export function percentageOf(numerator: number, denominator: number, whenEmpty?: null): number | null;
export function percentageOf(
  numerator: number,
  denominator: number,
  whenEmpty: number | null = null
): number | null {
  return denominator === 0 ? whenEmpty : Math.round((numerator / denominator) * 100);
}

type RecordedAttendance = Pick<AttendanceCounts, 'present' | 'late' | 'absent'>;

export function recordedAttendanceCount(counts: RecordedAttendance): number {
  return counts.present + counts.late + counts.absent;
}

/** Missing marks affect completeness, never the attendance denominator. Null means no evidence. */
export function attendanceRate(counts: RecordedAttendance, whenEmpty: number): number;
export function attendanceRate(counts: RecordedAttendance, whenEmpty?: null): number | null;
export function attendanceRate(counts: RecordedAttendance, whenEmpty: number | null = null): number | null {
  return whenEmpty === null
    ? percentageOf(counts.present + counts.late, recordedAttendanceCount(counts))
    : percentageOf(counts.present + counts.late, recordedAttendanceCount(counts), whenEmpty);
}

export function sessionCampusName(session: Pick<Session, 'campusName'>): string {
  return session.campusName?.trim() || 'Unassigned campus';
}

export function attendanceCounts(rows: readonly Pick<AttendanceRow, 'status'>[]): AttendanceCounts {
  let present = 0;
  let late = 0;
  let absent = 0;
  let unknown = 0;

  for (const { status } of rows) {
    if (status === 'Present') present += 1;
    else if (status === 'Late') late += 1;
    else if (status === 'Absent') absent += 1;
    else unknown += 1;
  }

  const total = rows.length;
  return {
    present,
    late,
    absent,
    unknown,
    total,
    rate: attendanceRate({ present, late, absent })
  };
}

export function emptyAttendanceCounts(total = 0): AttendanceCounts {
  return { present: 0, late: 0, absent: 0, unknown: total, total, rate: null };
}

/** All levels and each partition use the same server-owned historical roster, including withdrawals. */
export function attendanceCountsForLevel(rows: readonly AttendanceRow[], level: AttendanceLevelFilter): AttendanceCounts {
  return attendanceCounts(level === ALL_STUDENT_LEVELS ? rows
    : rows.filter(row => (row.studentLevel ?? UNASSIGNED_LEVEL) === level));
}
