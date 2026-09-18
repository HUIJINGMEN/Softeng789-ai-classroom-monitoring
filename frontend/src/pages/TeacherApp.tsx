import { useCallback, useEffect, useState } from 'react';
import AttendanceCorrectionModal from '../components/AttendanceCorrectionModal';
import DemoCoach from '../components/DemoCoach';
import EvidenceModal from '../components/EvidenceModal';
import Header from '../components/Header';
import ReportLevelTabs, { type ReportLevel } from '../components/ReportLevelTabs';
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
  IconSettings,
  IconUser,
  IconUserPlus,
  IconUsers
} from '../components/icons';
import Sidebar, { type NavEntry } from '../components/Sidebar';
import Toast from '../components/Toast';
import TeacherCaptureFlow from '../components/mobile/TeacherCaptureFlow';
import MobileConsoleChrome from '../components/mobile/MobileConsoleChrome';
import { useConsole } from '../hooks/useConsole';
import useMediaQuery from '../hooks/useMediaQuery';
import { initials } from '../lib/format';
import { sessionDisplayName } from '../lib/eventDisplay';
import { formatIsoDateInAuckland } from '../lib/sessionTime';
import { apiMessage } from '../lib/apiClient';
import { listFeedbackClasses, type FeedbackClassOption } from '../lib/progressReportApi';
import AdminCampuses from './AdminCampuses';
import AdminClasses from './AdminClasses';
import AdminDashboard from './AdminDashboard';
import AdminHealthAlerts from './AdminHealthAlerts';
import AdminRegistrations from './AdminRegistrations';
import AdminStaff from './AdminStaff';
import Achievements from './Achievements';
import Attendance from './Attendance';
import Dashboard from './Dashboard';
import Events from './Events';
import HealthAlerts from './HealthAlerts';
import LiveMonitoring from './LiveMonitoring';
import MyClasses from './MyClasses';
import Reports from './Reports';
import SessionDetail from './SessionDetail';
import Settings from './Settings';
import Students from './Students';
import type { AuthUser, Page } from '../types';

const PAGE_META: Record<Page, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Teaching activity, attendance and review priorities' },
  live: { title: 'Live Monitoring', subtitle: 'Prototype using simulated data' },
  attendance: {
    title: 'Attendance',
    subtitle: 'Create and open classroom sessions'
  },
  'session-detail': {
    title: 'Session Attendance',
    subtitle: 'Attendance records for the selected classroom session.'
  },
  students: { title: 'Students', subtitle: 'Student records, enrolment and classroom history' },
  achievements: { title: 'Achievements', subtitle: 'Review student responses and record completed work' },
  events: { title: 'AI Events', subtitle: 'Candidate observations awaiting teacher review' },
  reports: { title: 'Reports', subtitle: 'Confirmed and corrected results only' },
  settings: { title: 'Settings', subtitle: 'Detection thresholds, retention and privacy' },
  staff: { title: 'Staff', subtitle: 'Manage teacher and admin accounts' },
  classes: { title: 'Classes', subtitle: 'Create classes, assign teachers and students' },
  campuses: { title: 'Campuses', subtitle: 'Manage campuses and their rooms' },
  registrations: { title: 'Registrations', subtitle: 'Review and approve student sign-ups' },
  'health-alerts': { title: 'Health Alerts', subtitle: 'AI-detected and teacher-reported student health incidents' }
};

interface Props {
  readonly user: AuthUser;
  readonly onLogout: () => void;
}

function resolvePageMeta(c: ReturnType<typeof useConsole>, isAdmin: boolean) {
  if (isAdmin && c.page === 'dashboard') {
    return { title: 'Dashboard', subtitle: 'System-wide overview across every class and teacher' };
  }
  if (isAdmin && c.page === 'health-alerts') {
    return { title: 'Health Alerts', subtitle: 'System-wide oversight across every class and teacher' };
  }
  if (c.page === 'classes' && c.classDetailTitle) {
    return { title: c.classDetailTitle, subtitle: `Classes / ${c.classDetailTitle}` };
  }
  if (!isAdmin && c.page === 'classes') {
    return { title: 'Classes', subtitle: 'Classes you teach, their rosters and sessions' };
  }
  if (c.page === 'students' && c.profileId) {
    return { title: 'Student Profile', subtitle: 'Academic, attendance and classroom record' };
  }
  return PAGE_META[c.page];
}

export default function TeacherApp({ user, onLogout }: Props) {
  const c = useConsole();
  const isAdmin = user.role === 'admin';
  const isMobile = useMediaQuery('(max-width: 760px)');
  const [reportLevel, setReportLevel] = useState<ReportLevel>('overview');
  const [feedbackClasses, setFeedbackClasses] = useState<FeedbackClassOption[]>([]);
  const [captureFile, setCaptureFile] = useState<File | null>(null);
  const [preferredClassId, setPreferredClassId] = useState(
    () => window.localStorage.getItem('teacher-mobile-feedback-class') ?? ''
  );
  const meta = resolvePageMeta(c, isAdmin);
  // A Teacher's badges are scoped to whatever single session they've currently got selected —
  // that's meaningful for them (it's the class they're looking at). An Admin isn't looking at any
  // one session in particular, so the same per-session numbers would just be whatever session
  // happens to be selected in shared state, not anything real about the system. Admin gets
  // system-wide equivalents instead: sessions running today, and the whole review backlog.
  const pendingEventCount = isAdmin
    ? c.events.filter((event) => event.status === 'Pending Review').length
    : c.events.filter((event) => event.sessionId === c.sessionId && event.status === 'Pending Review').length;
  const todayIso = formatIsoDateInAuckland(new Date());
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

  useEffect(() => {
    if (isAdmin) return;
    let cancelled = false;
    listFeedbackClasses()
      .then((options) => {
        if (cancelled) return;
        setFeedbackClasses(options);
        setPreferredClassId((current) => {
          if (options.some((option) => option.courseOfferingId === current)) return current;
          return options[0]?.courseOfferingId ?? '';
        });
      })
      .catch((error) => {
        if (!cancelled) c.showToast(`Quick feedback could not load: ${apiMessage(error)}`);
      });
    return () => { cancelled = true; };
  }, [isAdmin]);

  const navigate = useCallback((page: Page) => {
    c.setPage(page);
    c.setProfileId(null);
    c.setClassFocusId(null);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [c.setPage, c.setProfileId, c.setClassFocusId]);

  const rememberFeedbackClass = useCallback((id: string) => {
    setPreferredClassId(id);
    window.localStorage.setItem('teacher-mobile-feedback-class', id);
  }, []);

  const modalEvent = c.modalId ? c.events.find((event) => event.id === c.modalId) : null;
  const correctStudent = c.correctRowId
    ? c.students.find(
        (student) => student.id === c.correctRowId || student.recordId === c.correctRowId
      )
    : null;

  return (
    <div className={`app app--mobile-console ${isAdmin ? 'app--admin' : 'app--teacher'}`}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Sidebar
        current={c.page === 'session-detail' ? 'attendance' : c.page}
        entries={navEntries}
        subtitle={isAdmin ? 'Admin Console' : 'Teacher Console'}
        onNavigate={navigate}
      />

      <main className="main" id="main-content" tabIndex={-1}>
        <MobileConsoleChrome
            role={isAdmin ? 'admin' : 'teacher'}
            current={c.page === 'session-detail' ? 'attendance' : c.page}
            title={meta.title}
            userName={user.name}
            userInitials={initials(user.name)}
            theme={c.theme}
            entries={navEntries}
            onNavigate={navigate}
            onCapture={isAdmin ? undefined : setCaptureFile}
            onToggleTheme={() => c.setTheme(c.theme === 'light' ? 'dark' : 'light')}
            onLogout={onLogout}
          />
        <Header
          title={meta.title}
          subtitle={meta.subtitle}
          session={isAdmin ? undefined : c.activeSession}
          theme={c.theme}
          onToggleTheme={() => c.setTheme(c.theme === 'light' ? 'dark' : 'light')}
          onStartDemo={c.startDemo}
          userName={user.name}
          userInitials={initials(user.name)}
          onLogout={onLogout}
          secondaryNavigation={
            c.page === 'reports' && !isMobile ? (
              <ReportLevelTabs
                level={reportLevel}
                onChange={(nextLevel) => {
                  setReportLevel(nextLevel);
                  window.scrollTo({ top: 0, behavior: 'auto' });
                }}
              />
            ) : undefined
          }
        />

        <div className="page">
          {c.page === 'dashboard' && (isAdmin ? <AdminDashboard console={c} /> : <Dashboard console={c} />)}
          {c.page === 'live' && <LiveMonitoring console={c} />}
          {c.page === 'attendance' && <Attendance console={c} />}
          {c.page === 'session-detail' && <SessionDetail console={c} />}
          {c.page === 'students' && <Students console={c} isAdmin={isAdmin} />}
          {c.page === 'achievements' && <Achievements console={c} isAdmin={isAdmin} />}
          {c.page === 'events' && <Events console={c} isAdmin={isAdmin} />}
          {c.page === 'health-alerts' &&
            (isAdmin ? <AdminHealthAlerts console={c} /> : <HealthAlerts console={c} />)}
          {c.page === 'reports' && (
            <Reports
              console={c}
              isAdmin={isAdmin}
              level={reportLevel}
              onLevelChange={(nextLevel) => {
                setReportLevel(nextLevel);
                window.scrollTo({ top: 0, behavior: 'auto' });
              }}
            />
          )}
          {c.page === 'settings' && <Settings console={c} />}
          {c.page === 'staff' && isAdmin && <AdminStaff console={c} currentUserId={user.id} />}
          {c.page === 'campuses' && isAdmin && <AdminCampuses console={c} />}
          {c.page === 'classes' && (isAdmin ? <AdminClasses console={c} /> : <MyClasses console={c} />)}
          {c.page === 'registrations' && isAdmin && <AdminRegistrations />}
        </div>
      </main>

      {modalEvent && (
        <EvidenceModal
          event={modalEvent}
          students={c.students}
          sessions={c.sessions}
          pendingCount={
            c.events.filter(
              (event) =>
                event.sessionId === modalEvent.sessionId && event.status === 'Pending Review'
            ).length
          }
          correcting={c.correcting}
          onToggleCorrecting={() => c.setCorrecting(!c.correcting)}
          onConfirm={() => {
            c.setEventStatus(modalEvent.id, 'Confirmed');
            c.goToNextPending(modalEvent.id, true);
          }}
          onReject={() => {
            c.setEventStatus(modalEvent.id, 'Rejected');
            c.goToNextPending(modalEvent.id, true);
          }}
          onCorrect={(type) =>
            c.setEventStatus(modalEvent.id, 'Corrected', {
              type,
              correctedFrom: modalEvent.correctedFrom ?? modalEvent.type
            })
          }
          onNext={() => c.goToNextPending(modalEvent.id)}
          onClose={() => {
            c.setModalId(null);
            c.setCorrecting(false);
          }}
        />
      )}

      {correctStudent && (
        <AttendanceCorrectionModal
          student={correctStudent}
          sessionLabel={sessionDisplayName(c.activeSession)}
          current={c.attendanceStatusFor(correctStudent.recordId ?? correctStudent.id)}
          onPick={(status) => c.correctAttendance(correctStudent.recordId ?? correctStudent.id, status)}
          onClose={() => c.setCorrectRowId(null)}
        />
      )}

      <DemoCoach
        step={c.demoStep}
        steps={c.demoSteps}
        onNext={c.nextDemoStep}
        onPrev={c.prevDemoStep}
        onExit={c.exitDemo}
      />

      <Toast message={c.toast} />

      {!isAdmin && captureFile && (
        <TeacherCaptureFlow
          initialFile={captureFile}
          classes={feedbackClasses}
          defaultClassId={preferredClassId}
          onClassSelected={rememberFeedbackClass}
          onClose={() => setCaptureFile(null)}
          onSaved={(studentName) => {
            setCaptureFile(null);
            c.showToast(`Feedback added to ${studentName}'s report.`);
          }}
        />
      )}
    </div>
  );
}
