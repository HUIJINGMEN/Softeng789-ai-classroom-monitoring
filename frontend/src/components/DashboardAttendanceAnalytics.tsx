import { useCallback, useMemo, useState, type ReactNode } from 'react';
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
import { STUDENT_LEVEL_OPTIONS, studentLevelLabel } from '../lib/studentLevels';
import useMediaQuery from '../hooks/useMediaQuery';
import type { Console } from '../hooks/useConsole';

type LowestAttendancePeriod = 'week' | 'month';

interface Props {
  readonly console: Console;
  readonly onOpenAttendance: () => void;
  readonly attendanceCtaLabel?: string;
  readonly compactOnMobile?: boolean;
}

interface MobileInsightProps {
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}

interface MobileScopeProps {
  readonly campus: string;
  readonly room: string;
  readonly level: AttendanceLevelFilter;
  readonly rangeDays: AttendanceRangeDays;
  readonly scopeLabel: string;
  readonly campusOptions: readonly string[];
  readonly roomOptions: readonly { value: string; label: string }[];
  readonly onCampusChange: (value: string) => void;
  readonly onRoomChange: (value: string) => void;
  readonly onLevelChange: (value: AttendanceLevelFilter) => void;
  readonly onRangeDaysChange: (value: AttendanceRangeDays) => void;
  readonly onReset: () => void;
}

function MobileScope({
  campus,
  room,
  level,
  rangeDays,
  scopeLabel,
  campusOptions,
  roomOptions,
  onCampusChange,
  onRoomChange,
  onLevelChange,
  onRangeDaysChange,
  onReset
}: MobileScopeProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className={`teacher-mobile-scope${open ? ' is-open' : ''}`} aria-label="Attendance scope">
      <button
        type="button"
        className="teacher-mobile-scope__summary"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          <strong>Attendance scope</strong>
          <small>{scopeLabel}</small>
        </span>
        <span>{open ? 'Done' : 'Change'}</span>
      </button>
      {open && (
        <div className="teacher-mobile-scope__fields">
          <label>
            <span>Campus</span>
            <select
              value={campus}
              onChange={(event) => {
                onCampusChange(event.target.value);
                onRoomChange(ALL_ROOMS);
              }}
            >
              {campusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span>Room</span>
            <select value={room} onChange={(event) => onRoomChange(event.target.value)}>
              {roomOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span>Level</span>
            <select
              value={level}
              onChange={(event) => onLevelChange(event.target.value as AttendanceLevelFilter)}
            >
              <option value={ALL_STUDENT_LEVELS}>All levels</option>
              {STUDENT_LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Time</span>
            <select
              value={rangeDays}
              onChange={(event) => onRangeDaysChange(event.target.value as AttendanceRangeDays)}
            >
              {ATTENDANCE_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <button type="button" className="teacher-mobile-scope__reset" onClick={onReset}>
            Reset scope
          </button>
        </div>
      )}
    </section>
  );
}

function MobileInsight({ title, description, children }: MobileInsightProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className={`teacher-mobile-insight${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="teacher-mobile-insight__trigger"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        <span className="teacher-mobile-insight__chevron" aria-hidden="true" />
      </button>
      {open && <div className="teacher-mobile-insight__content">{children}</div>}
    </section>
  );
}

/** Shared by teacher and admin dashboards; the data supplied by Console is already role-scoped. */
export default function DashboardAttendanceAnalytics({
  console: c,
  onOpenAttendance,
  attendanceCtaLabel = 'View attendance →',
  compactOnMobile = false
}: Props) {
  const isCompactMobile = useMediaQuery('(max-width: 760px)') && compactOnMobile;
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

  const campusOptions = useMemo(
    () => [
      'All campuses',
      ...Array.from(new Set(c.sessions.map(sessionCampusName))).sort((left, right) => left.localeCompare(right))
    ],
    [c.sessions]
  );
  const roomOptions = useMemo(() => {
    const rooms = new Map<string, string>();
    for (const session of c.sessions) {
      if (campus !== 'All campuses' && sessionCampusName(session) !== campus) continue;
      const value = sessionRoomLabel(session);
      rooms.set(value, campus === 'All campuses' ? value : session.room);
    }
    return [
      { value: ALL_ROOMS, label: ALL_ROOMS },
      ...Array.from(rooms, ([value, label]) => ({ value, label }))
        .sort((left, right) => left.label.localeCompare(right.label))
    ];
  }, [c.sessions, campus]);

  const trendChart = (
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
      showFilters={!isCompactMobile}
    />
  );

  const overviewCard = (
    <AdminAttendanceOverviewCard
      attendance={attendance}
      sessionsInScope={sessionsWithAttendance.length}
      scopeLabel={scopeLabel}
      onViewAllAttendance={onOpenAttendance}
    />
  );

  const comparisonChart = (
    <CampusParticipationComparison
      sessions={c.sessions}
      students={c.students}
      countsForSession={c.countsForSession}
      attendanceStatusFor={c.attendanceStatusFor}
    />
  );

  const lowestAttendanceCard = (
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
  );

  if (isCompactMobile) {
    return (
      <section
        className="dashboard-attendance-stack dashboard-attendance-stack--mobile"
        aria-label="Attendance analytics"
      >
        <MobileScope
          campus={campus}
          room={room}
          level={level}
          rangeDays={rangeDays}
          scopeLabel={scopeLabel}
          campusOptions={campusOptions}
          roomOptions={roomOptions}
          onCampusChange={setCampus}
          onRoomChange={setRoom}
          onLevelChange={setLevel}
          onRangeDaysChange={setRangeDays}
          onReset={resetScope}
        />
        {overviewCard}
        <section className="teacher-mobile-insights" aria-labelledby="mobile-insights-title">
          <header className="teacher-mobile-insights__head">
            <div>
              <h2 id="mobile-insights-title">Attendance insights</h2>
              <p>Open a view when you need more detail.</p>
            </div>
            <span>3 views</span>
          </header>
          <MobileInsight title="Attendance trend" description="See how participation changes over time">
            {trendChart}
          </MobileInsight>
          <MobileInsight title="Compare participation" description="Compare campuses or student levels">
            {comparisonChart}
          </MobileInsight>
          <MobileInsight
            title="Classes needing attention"
            description="Review the lowest weekly or monthly attendance"
          >
            {lowestAttendanceCard}
          </MobileInsight>
        </section>
      </section>
    );
  }

  return (
    <section className="dashboard-attendance-stack" aria-label="Attendance analytics">
      <div className="dashboard-attendance-primary">
        {trendChart}
        {overviewCard}
      </div>

      <div className="dashboard-attendance-secondary">
        {comparisonChart}
        {lowestAttendanceCard}
      </div>
    </section>
  );
}
