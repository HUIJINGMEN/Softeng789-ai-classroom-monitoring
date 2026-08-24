import AttendanceCorrectionModal from '../components/AttendanceCorrectionModal';
import DemoCoach from '../components/DemoCoach';
import EvidenceModal from '../components/EvidenceModal';
import Header from '../components/Header';
import Sidebar, { type NavEntry } from '../components/Sidebar';
import Toast from '../components/Toast';
import { useConsole } from '../hooks/useConsole';
import { initials } from '../lib/format';
import { sessionDisplayName } from '../lib/eventDisplay';
import Attendance from './Attendance';
import Dashboard from './Dashboard';
import Events from './Events';
import LiveMonitoring from './LiveMonitoring';
import Reports from './Reports';
import Settings from './Settings';
import Students from './Students';
import type { AuthUser, Page } from '../types';

const PAGE_META: Record<Page, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: "Overview of today's teaching activity" },
  live: { title: 'Live Monitoring', subtitle: 'Prototype using simulated data' },
  attendance: {
    title: 'Attendance',
    subtitle: 'Session attendance records and manual corrections'
  },
  students: { title: 'Students', subtitle: 'Student records, enrolment and classroom history' },
  events: { title: 'AI Events', subtitle: 'Candidate observations awaiting teacher review' },
  reports: { title: 'Reports', subtitle: 'Confirmed and corrected results only' },
  settings: { title: 'Settings', subtitle: 'Detection thresholds, retention and privacy' }
};

interface Props {
  readonly user: AuthUser;
  readonly onLogout: () => void;
}

export default function TeacherApp({ user, onLogout }: Props) {
  const c = useConsole();
  const meta = PAGE_META[c.page];
  const pendingEventCount = c.events.filter(
    (event) => event.sessionId === c.sessionId && event.status === 'Pending Review'
  ).length;

  const navEntries: NavEntry[] = [
    { page: 'dashboard', label: 'Dashboard' },
    {
      page: 'live',
      label: 'Live Monitoring',
      count: c.monitor === 'running' ? 'ON' : undefined,
      countLabel: 'Live monitoring is running'
    },
    {
      page: 'attendance',
      label: 'Attendance',
      count: String(c.counts.total),
      countLabel: `${c.counts.total} students in the selected session`
    },
    {
      page: 'students',
      label: 'Students',
      count: String(c.students.length),
      countLabel: `${c.students.length} student records`
    },
    {
      page: 'events',
      label: 'AI Events',
      count: pendingEventCount > 0 ? String(pendingEventCount) : undefined,
      countLabel: `${pendingEventCount} candidate events pending teacher review`
    },
    { page: 'reports', label: 'Reports' },
    { page: 'settings', label: 'Settings' }
  ];

  const modalEvent = c.modalId ? c.events.find((event) => event.id === c.modalId) : null;
  const correctStudent = c.correctRowId
    ? c.students.find(
        (student) => student.id === c.correctRowId || student.recordId === c.correctRowId
      )
    : null;

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Sidebar
        current={c.page}
        entries={navEntries}
        onNavigate={(page) => {
          c.setPage(page);
          c.setProfileId(null);
        }}
      />

      <main className="main" id="main-content" tabIndex={-1}>
        <Header
          title={meta.title}
          subtitle={meta.subtitle}
          session={c.activeSession}
          theme={c.theme}
          onToggleTheme={() => c.setTheme(c.theme === 'light' ? 'dark' : 'light')}
          onStartDemo={c.startDemo}
          userName={user.name}
          userInitials={initials(user.name)}
          onLogout={onLogout}
        />

        <div className="page">
          {c.page === 'dashboard' && <Dashboard console={c} />}
          {c.page === 'live' && <LiveMonitoring console={c} />}
          {c.page === 'attendance' && <Attendance console={c} />}
          {c.page === 'students' && <Students console={c} />}
          {c.page === 'events' && <Events console={c} />}
          {c.page === 'reports' && <Reports console={c} />}
          {c.page === 'settings' && <Settings console={c} />}
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
    </div>
  );
}
