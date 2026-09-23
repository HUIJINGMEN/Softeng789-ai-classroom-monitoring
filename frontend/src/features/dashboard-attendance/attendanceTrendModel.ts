import { percentageOf, type AttendanceCounts } from '../../lib/attendanceAnalytics';
import { chartSessionLabel, type ChartPoint } from '../../lib/chart';
import { sessionRoomLabel } from '../../lib/sessionLabels';
import type { Session } from '../../types';

const DAY_AGGREGATION_THRESHOLD = 10;

export interface TrendPointMeta {
  title: string;
  dateLabel: string;
  present: number;
  late: number;
  absent: number;
  unknown: number;
  total: number;
  /** A day-aggregated point has no single session destination. */
  sessionId: string | null;
}

export interface AttendanceTrendSeries {
  points: ChartPoint[];
  pointMeta: TrendPointMeta[];
  aggregateByDay: boolean;
}

interface SessionWithCounts {
  session: Session;
  counts: AttendanceCounts;
}

function buildDailySeries(scopedSessions: readonly SessionWithCounts[]): AttendanceTrendSeries {
  const byDay = new Map<
    string,
    {
      date: string;
      dateLabel: string;
      present: number;
      late: number;
      absent: number;
      unknown: number;
      total: number;
      sessions: number;
    }
  >();

  for (const { session, counts } of scopedSessions) {
    const entry = byDay.get(session.date) ?? {
      date: session.date,
      dateLabel: session.dateLabel,
      present: 0,
      late: 0,
      absent: 0,
      unknown: 0,
      total: 0,
      sessions: 0
    };
    entry.present += counts.present;
    entry.late += counts.late;
    entry.absent += counts.absent;
    entry.unknown += counts.unknown;
    entry.total += counts.total;
    entry.sessions += 1;
    byDay.set(session.date, entry);
  }

  const days = Array.from(byDay.values()).sort((left, right) =>
    left.date.localeCompare(right.date)
  );

  return {
    aggregateByDay: true,
    points: days.map((day) => ({
      label: day.dateLabel.replace(/,? \d{4}$/, ''),
      sub: `${day.sessions} session${day.sessions === 1 ? '' : 's'}`,
      rate: percentageOf(day.present + day.late, day.total, 0),
      present: day.present,
      pending: 0
    })),
    pointMeta: days.map((day) => ({
      title: `${day.sessions} session${day.sessions === 1 ? '' : 's'}`,
      dateLabel: day.dateLabel,
      present: day.present,
      late: day.late,
      absent: day.absent,
      unknown: day.unknown,
      total: day.total,
      sessionId: null
    }))
  };
}

function buildSessionSeries(scopedSessions: readonly SessionWithCounts[]): AttendanceTrendSeries {
  return {
    aggregateByDay: false,
    points: scopedSessions.map(({ session, counts }) => ({
      label: session.dateLabel.replace(/,? \d{4}$/, ''),
      sub: chartSessionLabel(session),
      rate: counts.rate,
      present: counts.present,
      pending: 0
    })),
    pointMeta: scopedSessions.map(({ session, counts }) => ({
      title: `${session.course} · ${sessionRoomLabel(session)}`,
      dateLabel: session.dateLabel,
      present: counts.present,
      late: counts.late,
      absent: counts.absent,
      unknown: counts.unknown,
      total: counts.total,
      sessionId: session.id
    }))
  };
}

/** Creates the chart's view model from already-scoped attendance data. */
export function buildAttendanceTrendSeries(
  sessions: readonly Session[],
  countsForSession: (sessionId: string) => AttendanceCounts
): AttendanceTrendSeries {
  const scopedSessions = sessions
    .map((session) => ({ session, counts: countsForSession(session.id) }))
    .filter(({ counts }) => counts.total > 0)
    .sort((left, right) => left.session.date.localeCompare(right.session.date));

  const uniqueDateCount = new Set(scopedSessions.map(({ session }) => session.date)).size;
  const aggregateByDay =
    scopedSessions.length > DAY_AGGREGATION_THRESHOLD ||
    uniqueDateCount < scopedSessions.length;

  return aggregateByDay
    ? buildDailySeries(scopedSessions)
    : buildSessionSeries(scopedSessions);
}
