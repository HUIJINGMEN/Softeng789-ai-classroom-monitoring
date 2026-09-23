import { percentageOf, type AttendanceCounts } from '../../lib/attendanceAnalytics';
import { sessionRoomLabel } from '../../lib/sessionLabels';
import { formatIsoDateInAuckland } from '../../lib/sessionTime';
import type { ClassFeedback, Session } from '../../types';

export interface ClassReportSessionRow {
  id: string;
  label: string;
  detail: string;
  present: number;
  late: number;
  absent: number;
  notRecorded: number;
  attendanceRate: number | null;
}

export function feedbackWithinReportRange(
  feedback: readonly ClassFeedback[],
  dateFrom: string,
  dateTo: string
) {
  return feedback.filter((item) => {
    const date = formatIsoDateInAuckland(new Date(item.createdAt));
    return date >= dateFrom && date <= dateTo;
  });
}

export function buildClassReportSessionRows(
  sessions: readonly Session[],
  countsForSession: (sessionId: string) => AttendanceCounts
): ClassReportSessionRow[] {
  return sessions.map((session) => {
    const counts = countsForSession(session.id);
    const recorded = counts.present + counts.late + counts.absent;
    return {
      id: session.id,
      label: session.dateLabel,
      detail: `${session.time} · ${sessionRoomLabel(session)}`,
      present: counts.present,
      late: counts.late,
      absent: counts.absent,
      notRecorded: counts.unknown,
      attendanceRate: percentageOf(counts.present + counts.late, recorded)
    };
  });
}

export function filterClassReportSessionRows(
  rows: readonly ClassReportSessionRow[],
  query: string
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [...rows];
  return rows.filter((row) =>
    `${row.label} ${row.detail}`.toLocaleLowerCase().includes(normalizedQuery)
  );
}
