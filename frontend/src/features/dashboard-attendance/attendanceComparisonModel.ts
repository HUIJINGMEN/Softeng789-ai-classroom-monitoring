import {
  attendanceCounts, attendanceLevelLabel, percentageOf, recordedAttendanceCount,
  sessionCampusName, UNASSIGNED_LEVEL, type AttendanceCounts, type AttendanceLevelFilter
} from '../../lib/attendanceAnalytics';
import type { AttendanceRow, Session } from '../../types';

export type ComparisonDimension = 'campus' | 'level';
export interface ParticipationGroup {
  key: string;
  label: string;
  participating: number;
  expected: number;
  recorded: number;
  sessions: number;
  rate: number | null;
}

/** A row contributes exactly once in either partition. Current class membership is never consulted. */
export function buildAttendanceComparisonGroups(
  sessions: readonly Session[], dimension: ComparisonDimension,
  rowsForSession: (id: string) => readonly AttendanceRow[]
): ParticipationGroup[] {
  const groups = new Map<string, Omit<ParticipationGroup, 'rate'>>();
  const add = (key: string, label: string, counts: AttendanceCounts) => {
    if (counts.total === 0) return;
    const group = groups.get(key) ?? { key, label, participating: 0, expected: 0, recorded: 0, sessions: 0 };
    group.participating += counts.present + counts.late;
    group.expected += counts.total;
    group.recorded += recordedAttendanceCount(counts);
    group.sessions++;
    groups.set(key, group);
  };
  for (const session of sessions) {
    const rows = rowsForSession(session.id);
    if (dimension === 'campus') {
      const campus = sessionCampusName(session);
      add(campus, campus, attendanceCounts(rows));
    } else {
      const byLevel = new Map<AttendanceLevelFilter, AttendanceRow[]>();
      for (const row of rows) {
        const level = row.studentLevel ?? UNASSIGNED_LEVEL;
        const bucket = byLevel.get(level) ?? [];
        bucket.push(row);
        byLevel.set(level, bucket);
      }
      byLevel.forEach((bucket, level) => add(level, attendanceLevelLabel(level), attendanceCounts(bucket)));
    }
  }
  return [...groups.values()].map(group => ({ ...group, rate: percentageOf(group.participating, group.recorded) }))
    .sort((left, right) => (right.rate ?? -1) - (left.rate ?? -1) || left.label.localeCompare(right.label));
}
