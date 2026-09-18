import DashboardAttendanceAnalytics from '../components/DashboardAttendanceAnalytics';
import AchievementReviewNotice from '../components/AchievementReviewNotice';
import TeacherDashboardStatsRow from '../components/TeacherDashboardStatsRow';
import { formatIsoDateInAuckland } from '../lib/sessionTime';
import type { Console } from '../hooks/useConsole';

/**
 * Mirrors AdminDashboard.tsx's layout (stats row → scoped trend + overview → campus comparison
 * → lowest attendance) rather than the old session-centric personal dashboard — but every number
 * here comes from c.sessions/c.students/c.events, which are already scoped server-side to this
 * teacher's own classes (see StudentService.listStudents/ClassroomSessionService.listSessions).
 * No admin-only endpoint is called from this page.
 */
export default function Dashboard({ console: c }: { readonly console: Console }) {
  const myClassesCount = Math.max(0, c.courseOptions.length - 1);
  const todayIso = formatIsoDateInAuckland(new Date());
  const activeSessions = c.sessions.filter(
    (session) => session.status === 'Live' && session.date === todayIso
  );

  const pendingAiEvents = c.events.filter((event) => event.status === 'Pending Review').length;

  return (
    <div className="page__inner">
      <TeacherDashboardStatsRow
        myClassesCount={myClassesCount}
        totalStudents={c.students.length}
        activeSessionsCount={activeSessions.length}
        pendingAiEvents={pendingAiEvents}
        onOpenActiveSession={
          activeSessions.length > 0
            ? () => {
                c.selectSession(activeSessions[0].id);
                c.setPage('live');
              }
            : undefined
        }
        onOpenStudents={() => c.setPage('students')}
        onOpenClasses={() => c.setPage('classes')}
        onOpenEvents={() => c.setPage('events')}
      />

      <AchievementReviewNotice console={c} />

      <DashboardAttendanceAnalytics
        console={c}
        onOpenAttendance={() => c.setPage('attendance')}
        attendanceCtaLabel="Go to Attendance →"
        compactOnMobile
      />
    </div>
  );
}
