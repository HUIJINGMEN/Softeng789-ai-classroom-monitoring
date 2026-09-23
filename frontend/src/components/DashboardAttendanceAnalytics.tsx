import {
  MobileAttendanceInsight,
  MobileAttendanceScope
} from '../features/dashboard-attendance/MobileAttendanceControls';
import { useDashboardAttendance } from '../features/dashboard-attendance/useDashboardAttendance';
import useMediaQuery from '../hooks/useMediaQuery';
import type { Console } from '../hooks/useConsole';
import AdminAttendanceOverviewCard from './AdminAttendanceOverviewCard';
import AdminAttendanceTrendChart from './AdminAttendanceTrendChart';
import AdminLowestAttendanceCard from './AdminLowestAttendanceCard';
import CampusParticipationComparison from './CampusParticipationComparison';

interface Props {
  readonly console: Console;
  readonly onOpenAttendance: () => void;
  readonly attendanceCtaLabel?: string;
  readonly compactOnMobile?: boolean;
}

/** Shared by teacher and admin dashboards; Console data is already scoped to the active role. */
export default function DashboardAttendanceAnalytics({
  console: c,
  onOpenAttendance,
  attendanceCtaLabel = 'View attendance →',
  compactOnMobile = false
}: Props) {
  const isCompactMobile = useMediaQuery('(max-width: 760px)') && compactOnMobile;
  const workspace = useDashboardAttendance(c);

  const trendChart = (
    <AdminAttendanceTrendChart
      sessions={c.sessions}
      scopedSessions={workspace.sessionsInRange}
      countsForScopedSession={workspace.countsForScopedSession}
      rangeStartIso={workspace.rangeStartIso}
      rangeEndIso={workspace.todayIso}
      campus={workspace.campus}
      room={workspace.room}
      level={workspace.level}
      rangeDays={workspace.rangeDays}
      onCampusChange={workspace.setCampus}
      onRoomChange={workspace.setRoom}
      onLevelChange={workspace.setLevel}
      onRangeDaysChange={workspace.setRangeDays}
      onResetFilters={workspace.resetScope}
      onGoToSession={(sessionId) => {
        c.selectSession(sessionId);
        c.setPage('session-detail');
      }}
      showFilters={!isCompactMobile}
    />
  );
  const overviewCard = (
    <AdminAttendanceOverviewCard
      attendance={workspace.attendance}
      sessionsInScope={workspace.sessionsWithAttendance.length}
      scopeLabel={workspace.scopeLabel}
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
      sessions={workspace.lowestAttendanceSessionsWithData}
      countsForSession={workspace.countsForLowestAttendanceSession}
      period={workspace.lowestAttendancePeriod}
      scopeLabel={workspace.lowestAttendanceScopeLabel}
      onPeriodChange={workspace.setLowestAttendancePeriod}
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
        <MobileAttendanceScope
          campus={workspace.campus}
          room={workspace.room}
          level={workspace.level}
          rangeDays={workspace.rangeDays}
          scopeLabel={workspace.scopeLabel}
          campusOptions={workspace.campusOptions}
          roomOptions={workspace.roomOptions}
          onCampusChange={workspace.setCampus}
          onRoomChange={workspace.setRoom}
          onLevelChange={workspace.setLevel}
          onRangeDaysChange={workspace.setRangeDays}
          onReset={workspace.resetScope}
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
          <MobileAttendanceInsight
            title="Attendance trend"
            description="See how participation changes over time"
          >
            {trendChart}
          </MobileAttendanceInsight>
          <MobileAttendanceInsight
            title="Compare participation"
            description="Compare campuses or student levels"
          >
            {comparisonChart}
          </MobileAttendanceInsight>
          <MobileAttendanceInsight
            title="Classes needing attention"
            description="Review the lowest weekly or monthly attendance"
          >
            {lowestAttendanceCard}
          </MobileAttendanceInsight>
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
