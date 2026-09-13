import { studentCourses } from './studentCourses';
import type { AttendanceStatus, Session, Student, StudentLevel } from '../types';

export const ALL_STUDENT_LEVELS = 'ALL_LEVELS' as const;
export const ALL_ROOMS = 'All rooms' as const;

export type AttendanceLevelFilter = StudentLevel | typeof ALL_STUDENT_LEVELS;
export type AttendanceRangeDays = '7' | '30' | '90';

export interface AttendanceCounts {
  present: number;
  late: number;
  absent: number;
  unknown: number;
  total: number;
  rate: number;
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

export function sessionCampusName(session: Pick<Session, 'campusName'>): string {
  return session.campusName?.trim() || 'Unassigned campus';
}

/**
 * Counts one session for a selected student level. The all-level path deliberately delegates to
 * the server-backed aggregate, while a specific level is rebuilt from the scoped roster so the
 * filter changes the denominator as well as the labels shown on the chart.
 */
export function attendanceCountsForLevel(
  session: Session,
  level: AttendanceLevelFilter,
  students: readonly Student[],
  attendanceStatusFor: (studentId: string, sessionId: string) => AttendanceStatus,
  allLevelCounts: (sessionId: string) => AttendanceCounts
): AttendanceCounts {
  if (level === ALL_STUDENT_LEVELS) return allLevelCounts(session.id);

  const roster = students.filter(
    (student) => student.level === level && studentCourses(student).includes(session.course)
  );

  let present = 0;
  let late = 0;
  let absent = 0;
  let unknown = 0;

  for (const student of roster) {
    const status = attendanceStatusFor(student.id, session.id);
    if (status === 'Present') present += 1;
    else if (status === 'Late') late += 1;
    else if (status === 'Absent') absent += 1;
    else unknown += 1;
  }

  const total = roster.length;
  return {
    present,
    late,
    absent,
    unknown,
    total,
    rate: percentageOf(present + late, total, 0)
  };
}
