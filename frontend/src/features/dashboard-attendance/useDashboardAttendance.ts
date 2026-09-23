import { useCallback, useMemo, useState } from 'react';
import type { Console } from '../../hooks/useConsole';
import {
  ALL_ROOMS,
  ALL_STUDENT_LEVELS,
  ATTENDANCE_RANGE_OPTIONS,
  attendanceCountsForLevel,
  attendanceRangeStart,
  percentageOf,
  sessionCampusName,
  type AttendanceCounts,
  type AttendanceLevelFilter,
  type AttendanceRangeDays
} from '../../lib/attendanceAnalytics';
import { sessionRoomLabel } from '../../lib/sessionLabels';
import { formatIsoDateInAuckland } from '../../lib/sessionTime';
import { studentLevelLabel } from '../../lib/studentLevels';

export type LowestAttendancePeriod = 'week' | 'month';

const EMPTY_COUNTS: AttendanceCounts = {
  present: 0,
  late: 0,
  absent: 0,
  unknown: 0,
  total: 0,
  rate: 0
};

/** Owns the shared teacher/admin dashboard attendance scope and all derived analytics. */
export function useDashboardAttendance(console: Console) {
  const [campus, setCampus] = useState('All campuses');
  const [room, setRoom] = useState<string>(ALL_ROOMS);
  const [level, setLevel] = useState<AttendanceLevelFilter>(ALL_STUDENT_LEVELS);
  const [rangeDays, setRangeDays] = useState<AttendanceRangeDays>('30');
  const [lowestAttendancePeriod, setLowestAttendancePeriod] =
    useState<LowestAttendancePeriod>('week');

  const todayIso = formatIsoDateInAuckland(new Date());
  const rangeStartIso = attendanceRangeStart(todayIso, rangeDays);
  const lowestRangeDays: AttendanceRangeDays = lowestAttendancePeriod === 'week' ? '7' : '30';
  const lowestRangeStartIso = attendanceRangeStart(todayIso, lowestRangeDays);

  const sessionsInRange = useMemo(
    () =>
      console.sessions.filter(
        (session) =>
          session.status !== 'Cancelled' &&
          session.status !== 'Scheduled' &&
          (campus === 'All campuses' || sessionCampusName(session) === campus) &&
          (room === ALL_ROOMS || sessionRoomLabel(session) === room) &&
          session.date >= rangeStartIso &&
          session.date <= todayIso
      ),
    [campus, console.sessions, rangeStartIso, room, todayIso]
  );

  const countsBySession = useMemo(() => {
    const counts = new Map<string, AttendanceCounts>();
    for (const session of sessionsInRange) {
      counts.set(
        session.id,
        attendanceCountsForLevel(
          session,
          level,
          console.students,
          console.attendanceStatusFor,
          console.countsForSession
        )
      );
    }
    return counts;
  }, [
    console.attendanceStatusFor,
    console.countsForSession,
    console.students,
    level,
    sessionsInRange
  ]);

  const sessionsWithAttendance = useMemo(
    () => sessionsInRange.filter((session) => (countsBySession.get(session.id)?.total ?? 0) > 0),
    [countsBySession, sessionsInRange]
  );
  const countsForScopedSession = useCallback(
    (sessionId: string) => countsBySession.get(sessionId) ?? EMPTY_COUNTS,
    [countsBySession]
  );

  const attendance = useMemo(() => {
    const totals = sessionsWithAttendance.reduce(
      (result, session) => {
        const counts = countsBySession.get(session.id);
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
  }, [countsBySession, sessionsWithAttendance]);

  const lowestAttendanceSessions = useMemo(
    () =>
      console.sessions.filter(
        (session) =>
          session.status !== 'Cancelled' &&
          session.status !== 'Scheduled' &&
          (campus === 'All campuses' || sessionCampusName(session) === campus) &&
          (room === ALL_ROOMS || sessionRoomLabel(session) === room) &&
          session.date >= lowestRangeStartIso &&
          session.date <= todayIso
      ),
    [campus, console.sessions, lowestRangeStartIso, room, todayIso]
  );

  const lowestCountsBySession = useMemo(() => {
    const counts = new Map<string, AttendanceCounts>();
    for (const session of lowestAttendanceSessions) {
      counts.set(
        session.id,
        attendanceCountsForLevel(
          session,
          level,
          console.students,
          console.attendanceStatusFor,
          console.countsForSession
        )
      );
    }
    return counts;
  }, [
    console.attendanceStatusFor,
    console.countsForSession,
    console.students,
    level,
    lowestAttendanceSessions
  ]);

  const lowestAttendanceSessionsWithData = useMemo(
    () =>
      lowestAttendanceSessions.filter(
        (session) => (lowestCountsBySession.get(session.id)?.total ?? 0) > 0
      ),
    [lowestAttendanceSessions, lowestCountsBySession]
  );
  const countsForLowestAttendanceSession = useCallback(
    (sessionId: string) => lowestCountsBySession.get(sessionId) ?? EMPTY_COUNTS,
    [lowestCountsBySession]
  );

  const rangeLabel =
    ATTENDANCE_RANGE_OPTIONS.find((option) => option.value === rangeDays)?.label ?? '';
  const levelLabel = level === ALL_STUDENT_LEVELS ? 'All levels' : studentLevelLabel(level);
  const roomLabel =
    room === ALL_ROOMS
      ? ALL_ROOMS
      : console.sessions.find((session) => sessionRoomLabel(session) === room)?.room ?? room;
  const scopeLabel = [rangeLabel, campus, roomLabel, levelLabel].filter(Boolean).join(' · ');
  const lowestAttendanceScopeLabel = [
    lowestAttendancePeriod === 'week' ? 'Last 7 days' : 'Last 30 days',
    campus,
    roomLabel,
    levelLabel
  ]
    .filter(Boolean)
    .join(' · ');

  const campusOptions = useMemo(
    () => [
      'All campuses',
      ...Array.from(new Set(console.sessions.map(sessionCampusName))).sort((left, right) =>
        left.localeCompare(right)
      )
    ],
    [console.sessions]
  );
  const roomOptions = useMemo(() => {
    const rooms = new Map<string, string>();
    for (const session of console.sessions) {
      if (campus !== 'All campuses' && sessionCampusName(session) !== campus) continue;
      const value = sessionRoomLabel(session);
      rooms.set(value, campus === 'All campuses' ? value : session.room);
    }
    return [
      { value: ALL_ROOMS, label: ALL_ROOMS },
      ...Array.from(rooms, ([value, label]) => ({ value, label })).sort((left, right) =>
        left.label.localeCompare(right.label)
      )
    ];
  }, [campus, console.sessions]);

  const resetScope = useCallback(() => {
    setCampus('All campuses');
    setRoom(ALL_ROOMS);
    setLevel(ALL_STUDENT_LEVELS);
    setRangeDays('30');
  }, []);

  return {
    campus,
    setCampus,
    room,
    setRoom,
    level,
    setLevel,
    rangeDays,
    setRangeDays,
    lowestAttendancePeriod,
    setLowestAttendancePeriod,
    attendance,
    rangeStartIso,
    todayIso,
    sessionsInRange,
    sessionsWithAttendance,
    countsForScopedSession,
    lowestAttendanceSessionsWithData,
    countsForLowestAttendanceSession,
    scopeLabel,
    lowestAttendanceScopeLabel,
    campusOptions,
    roomOptions,
    resetScope
  };
}

export type DashboardAttendanceWorkspace = ReturnType<typeof useDashboardAttendance>;
