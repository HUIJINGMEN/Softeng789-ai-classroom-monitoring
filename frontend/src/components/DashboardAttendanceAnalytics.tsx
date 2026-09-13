import { useCallback, useMemo, useState } from 'react';
import AdminAttendanceOverviewCard from './AdminAttendanceOverviewCard';
import AdminAttendanceTrendChart from './AdminAttendanceTrendChart';
import AdminLowestAttendanceCard from './AdminLowestAttendanceCard';
import CampusParticipationComparison from './CampusParticipationComparison';
import {
  ALL_STUDENT_LEVELS,
  ALL_ROOMS,
  ATTENDANCE_RANGE_OPTIONS,
  attendanceCountsForLevel,
  attendanceRangeStart,
  percentageOf,
  sessionCampusName,
  type AttendanceLevelFilter,
  type AttendanceRangeDays
} from '../lib/attendanceAnalytics';
import { formatIsoDateInAuckland } from '../lib/sessionTime';
import { sessionRoomLabel } from '../lib/classroomApi';
import { studentLevelLabel } from '../lib/studentLevels';
import type { Console } from '../hooks/useConsole';

type LowestAttendancePeriod = 'week' | 'month';

interface Props {
  readonly console: Console;
  readonly onOpenAttendance: () => void;
  readonly attendanceCtaLabel?: string;
}

/** Shared by teacher and admin dashboards; the data supplied by Console is already role-scoped. */
export default function DashboardAttendanceAnalytics({
  console: c,
  onOpenAttendance,
  attendanceCtaLabel = 'View attendance →'
}: Props) {
  const [campus, setCampus] = useState('All campuses');
  const [room, setRoom] = useState<string>(ALL_ROOMS);
  const [level, setLevel] = useState<AttendanceLevelFilter>(ALL_STUDENT_LEVELS);
  const [rangeDays, setRangeDays] = useState<AttendanceRangeDays>('30');
  const [lowestAttendancePeriod, setLowestAttendancePeriod] = useState<LowestAttendancePeriod>('week');

  const todayIso = formatIsoDateInAuckland(new Date());
  const rangeStartIso = attendanceRangeStart(todayIso, rangeDays);
  const lowestAttendanceRangeDays: AttendanceRangeDays = lowestAttendancePeriod === 'week' ? '7' : '30';
  const lowestAttendanceRangeStartIso = attendanceRangeStart(todayIso, lowestAttendanceRangeDays);

  const scopedSessions = useMemo(
    () =>
      c.sessions.filter(
        (session) =>
          session.status !== 'Cancelled' &&
          session.status !== 'Scheduled' &&
          (campus === 'All campuses' || sessionCampusName(session) === campus) &&
          (room === ALL_ROOMS || sessionRoomLabel(session) === room) &&
          session.date >= rangeStartIso &&
          session.date <= todayIso
      ),
    [c.sessions, campus, room, rangeStartIso, todayIso]
  );

  const scopedCounts = useMemo(() => {
    const counts = new Map<string, ReturnType<typeof attendanceCountsForLevel>>();
    for (const session of scopedSessions) {
      counts.set(
        session.id,
        attendanceCountsForLevel(
          session,
          level,
          c.students,
          c.attendanceStatusFor,
          c.countsForSession
        )
      );
    }
    return counts;
  }, [c.attendanceStatusFor, c.countsForSession, c.students, level, scopedSessions]);

  const sessionsWithAttendance = useMemo(
    () => scopedSessions.filter((session) => (scopedCounts.get(session.id)?.total ?? 0) > 0),
    [scopedCounts, scopedSessions]
  );

  const attendance = useMemo(() => {
    const totals = sessionsWithAttendance.reduce(
      (result, session) => {
        const counts = scopedCounts.get(session.id);
        if (!counts) return result;
        result.present += counts.present;
        result.late += counts.late;
        result.absent += counts.absent;
        result.unknown += counts.unknown;
        result.total += counts.total;
        return result;
      },
      { present: 0, late: 0, absent: 0, unknown: 0, total: 0 }
    );
    return {
      ...totals,
      rate: percentageOf(totals.present + totals.late, totals.total)
    };
  }, [scopedCounts, sessionsWithAttendance]);

  const lowestAttendanceSessions = useMemo(
    () =>
      c.sessions.filter(
        (session) =>
          session.status !== 'Cancelled' &&
          session.status !== 'Scheduled' &&
          (campus === 'All campuses' || sessionCampusName(session) === campus) &&
          (room === ALL_ROOMS || sessionRoomLabel(session) === room) &&
          session.date >= lowestAttendanceRangeStartIso &&
          session.date <= todayIso
      ),
    [c.sessions, campus, room, lowestAttendanceRangeStartIso, todayIso]
  );

  const lowestAttendanceCounts = useMemo(() => {
    const counts = new Map<string, ReturnType<typeof attendanceCountsForLevel>>();
    for (const session of lowestAttendanceSessions) {
      counts.set(
        session.id,
        attendanceCountsForLevel(
          session,
          level,
          c.students,
          c.attendanceStatusFor,
          c.countsForSession
        )
      );
    }
    return counts;
  }, [c.attendanceStatusFor, c.countsForSession, c.students, level, lowestAttendanceSessions]);

  const lowestAttendanceSessionsWithData = useMemo(
    () =>
      lowestAttendanceSessions.filter(
        (session) => (lowestAttendanceCounts.get(session.id)?.total ?? 0) > 0
      ),
    [lowestAttendanceCounts, lowestAttendanceSessions]
  );

  const countsForLowestAttendanceSession = useCallback(
    (sessionId: string) =>
      lowestAttendanceCounts.get(sessionId) ??
      { present: 0, late: 0, absent: 0, unknown: 0, total: 0, rate: 0 },
    [lowestAttendanceCounts]
  );

  const rangeLabel = ATTENDANCE_RANGE_OPTIONS.find((option) => option.value === rangeDays)?.label ?? '';
  const levelLabel = level === ALL_STUDENT_LEVELS ? 'All levels' : studentLevelLabel(level);
  const roomLabel =
    room === ALL_ROOMS
      ? ALL_ROOMS
      : c.sessions.find((session) => sessionRoomLabel(session) === room)?.room ?? room;
  const scopeLabel = [
    rangeLabel,
    campus,
    roomLabel,
    levelLabel
  ].filter(Boolean).join(' · ');
  const lowestAttendanceScopeLabel = [
    lowestAttendancePeriod === 'week' ? 'Last 7 days' : 'Last 30 days',
    campus,
    roomLabel,
    levelLabel
  ].filter(Boolean).join(' · ');

  const resetScope = () => {
    setCampus('All campuses');
    setRoom(ALL_ROOMS);
    setLevel(ALL_STUDENT_LEVELS);
    setRangeDays('30');
  };

  return (
    <section className="dashboard-attendance-stack" aria-label="Attendance analytics">
      <div className="dashboard-attendance-primary">
        <AdminAttendanceTrendChart
          sessions={c.sessions}
          students={c.students}
          countsForSession={c.countsForSession}
          attendanceStatusFor={c.attendanceStatusFor}
          campus={campus}
          room={room}
          level={level}
          rangeDays={rangeDays}
          onCampusChange={setCampus}
          onRoomChange={setRoom}
          onLevelChange={setLevel}
          onRangeDaysChange={setRangeDays}
          onResetFilters={resetScope}
          onGoToSession={(sessionId) => {
            c.selectSession(sessionId);
            c.setPage('session-detail');
          }}
        />

        <AdminAttendanceOverviewCard
          attendance={attendance}
          sessionsInScope={sessionsWithAttendance.length}
          scopeLabel={scopeLabel}
          onViewAllAttendance={onOpenAttendance}
        />
      </div>

      <div className="dashboard-attendance-secondary">
        <CampusParticipationComparison
          sessions={c.sessions}
          students={c.students}
          countsForSession={c.countsForSession}
          attendanceStatusFor={c.attendanceStatusFor}
        />

        <AdminLowestAttendanceCard
          sessions={lowestAttendanceSessionsWithData}
          countsForSession={countsForLowestAttendanceSession}
          period={lowestAttendancePeriod}
          scopeLabel={lowestAttendanceScopeLabel}
          onPeriodChange={setLowestAttendancePeriod}
          onOpenAttendance={onOpenAttendance}
          onOpenClass={(courseOfferingId) => {
            c.setClassFocusId(courseOfferingId);
            c.setPage('classes');
          }}
          ctaLabel={attendanceCtaLabel}
        />
      </div>
    </section>
  );
}
