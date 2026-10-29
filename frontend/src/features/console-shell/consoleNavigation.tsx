import type { Console } from '../../hooks/useConsole';
import type { NavEntry } from '../../components/Sidebar';
import { formatIsoDateInAuckland } from '../../lib/sessionTime';
import {
  IconActivity,
  IconAward,
  IconBarChart,
  IconBuilding,
  IconClipboardCheck,
  IconGraduationCap,
  IconHeartPulse,
  IconHome,
  IconMonitor,
  IconMessageSquare,
  IconSettings,
  IconUser,
  IconUserPlus,
  IconUsers,
  IconWallet
} from '../../components/icons';

type NavigationState = Pick<
  Console,
  | 'events'
  | 'sessionId'
  | 'sessions'
  | 'students'
  | 'pendingAccomplishmentReviewCount'
  | 'monitor'
  | 'counts'
  | 'awaitingReviewCount'
>;

/** Role-scoped navigation badges. Accept a date for deterministic tests; no fetching or writes. */
export function buildConsoleNavigation(
  c: NavigationState,
  isAdmin: boolean,
  todayIso = formatIsoDateInAuckland(new Date())
): NavEntry[] {
  const pendingEventCount = isAdmin
    ? c.events.filter((event) => event.status === 'Pending Review').length
    : c.events.filter((event) => event.sessionId === c.sessionId && event.status === 'Pending Review').length;
  const sessionsTodayCount = c.sessions.filter(
    (session) => session.date === todayIso && session.status !== 'Cancelled'
  ).length;

  const navDashboard: NavEntry = { page: 'dashboard', label: 'Dashboard', icon: <IconHome /> };
  const navClasses: NavEntry = { page: 'classes', label: 'Classes', icon: <IconGraduationCap /> };
  const navStudents: NavEntry = {
    page: 'students',
    label: 'Students',
    icon: <IconUsers />,
    count: String(c.students.length),
    countLabel: `${c.students.length} student records`
  };
  const navStaff: NavEntry = { page: 'staff', label: 'Staff', icon: <IconUser /> };
  const navAchievements: NavEntry = {
    page: 'achievements',
    label: 'Achievements',
    icon: <IconAward />,
    count: c.pendingAccomplishmentReviewCount > 0 ? String(c.pendingAccomplishmentReviewCount) : undefined,
    countLabel: `${c.pendingAccomplishmentReviewCount} student change request${c.pendingAccomplishmentReviewCount === 1 ? '' : 's'} need review`,
    urgent: c.pendingAccomplishmentReviewCount > 0
  };
  const navCampuses: NavEntry = { page: 'campuses', label: 'Campuses', icon: <IconBuilding /> };
  const navLive: NavEntry = {
    page: 'live',
    label: 'Live Monitoring',
    icon: <IconMonitor />,
    count: c.monitor === 'running' ? 'ON' : undefined,
    countLabel: 'Live monitoring is running'
  };
  const navAttendance: NavEntry = isAdmin
    ? {
        page: 'attendance',
        label: 'Attendance',
        icon: <IconClipboardCheck />,
        count: sessionsTodayCount > 0 ? String(sessionsTodayCount) : undefined,
        countLabel: `${sessionsTodayCount} session${sessionsTodayCount === 1 ? '' : 's'} today`
      }
    : {
        page: 'attendance',
        label: 'Attendance',
        icon: <IconClipboardCheck />,
        count: String(c.counts.total),
        countLabel: `${c.counts.total} students in the selected session`
      };
  const navEvents: NavEntry = {
    page: 'events',
    label: 'AI Events',
    icon: <IconActivity />,
    count: pendingEventCount > 0 ? String(pendingEventCount) : undefined,
    countLabel: isAdmin
      ? `${pendingEventCount} candidate events pending review across all sessions`
      : `${pendingEventCount} candidate events pending teacher review`
  };
  const navReports: NavEntry = { page: 'reports', label: 'Reports', icon: <IconBarChart /> };
  const navHealthAlerts: NavEntry = {
    page: 'health-alerts',
    label: 'Health Alerts',
    icon: <IconHeartPulse />,
    count: c.awaitingReviewCount > 0 ? String(c.awaitingReviewCount) : undefined,
    countLabel: `${c.awaitingReviewCount} health alert${c.awaitingReviewCount === 1 ? '' : 's'} awaiting review`,
    urgent: c.awaitingReviewCount > 0
  };
  const navRegistrations: NavEntry = {
    page: 'registrations',
    label: 'Registrations',
    icon: <IconUserPlus />
  };
  const navRequests: NavEntry = { page: 'requests', label: 'Requests', icon: <IconMessageSquare /> };
  const navPayments: NavEntry = { page: 'payments', label: 'Payments', icon: <IconWallet /> };
  const navSettings: NavEntry = { page: 'settings', label: 'Settings', icon: <IconSettings /> };

  // Admin's order mirrors the reference layout (classes/people first, then day-to-day
  // monitoring, then account-level pages) — the teacher list keeps its original order since
  // that wasn't part of what changed.
  const navEntries: NavEntry[] = isAdmin
    ? [
        navDashboard,
        navClasses,
        navStudents,
        navAchievements,
        navStaff,
        navCampuses,
        navLive,
        navAttendance,
        navEvents,
        navHealthAlerts,
        navReports,
        navRequests,
        navPayments,
        navRegistrations,
        navSettings
      ]
    : [
        navDashboard,
        navClasses,
        navLive,
        navAttendance,
        navStudents,
        navAchievements,
        navEvents,
        navHealthAlerts,
        navReports,
        navSettings
      ];
  return navEntries;
}
