import { useEffect, useMemo, useState } from 'react';
import BackButton from '../components/BackButton';
import ClassAttendanceTab from '../components/ClassAttendanceTab';
import ClassDetailTabs, { type ClassDetailTabDef } from '../components/ClassDetailTabs';
import ClassHeaderCard from '../components/ClassHeaderCard';
import ClassOverviewTab from '../components/ClassOverviewTab';
import ClassReportsTab from '../components/ClassReportsTab';
import ClassSessionsCard from '../components/ClassSessionsCard';
import ClassStudentsCard from '../components/ClassStudentsCard';
import ClassTeachersCard from '../components/ClassTeachersCard';
import { apiMessage } from '../lib/apiClient';
import { buildClassRow, withClassAttendanceRates } from '../lib/classRows';
import { listClassStudents, type ClassApiResponse } from '../lib/classAdminApi';
import { listClassroomSessions, mapClassroomSessionApiToUi } from '../lib/classroomApi';
import { listStudents, mapStudentApiToUi } from '../lib/studentApi';
import type { Console } from '../hooks/useConsole';
import type { Session, StaffMember, Student } from '../types';

type TabKey = 'overview' | 'students' | 'sessions' | 'attendance' | 'reports' | 'teachers';

const TABS: ClassDetailTabDef<TabKey>[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'students', label: 'Students' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'attendance', label: 'Class Attendance' },
  { key: 'reports', label: 'Reports' },
  { key: 'teachers', label: 'Teachers' }
];

interface Props {
  readonly klass: ClassApiResponse;
  readonly staff: readonly StaffMember[];
  readonly classes: readonly ClassApiResponse[];
  readonly console: Console;
  readonly onBack: () => void;
  readonly onChanged: () => void;
}

// The four cards below (header/teachers/students/sessions) each own their own section-specific
// state and are rendered with key={klass.id}, so switching to a different class remounts them
// fresh instead of needing a manual state-reset effect — the same pattern StudentProfile already
// uses for the same reason. Only the data that's either shared across cards (busy/actionError,
// since every action funnels through one runAction) or genuinely cross-card (attendanceRate is
// shown in the header but derived from the sessions the sessions card lists) stays up here.
//
// Overview/Attendance/Reports and the header's persistent stat row read from `row`, computed off
// Console's own c.sessions/c.countsForSession (already loaded for an admin caller across every
// class) — the separately-fetched `sessions` state below stays exactly as it was purely to back
// the Sessions tab's own loading/error UI, which c.sessions doesn't track per-class.
export default function ClassDetail({ klass, staff, classes, console: c, onBack, onChanged }: Props) {
  const [tab, setTab] = useState<TabKey>('overview');
  const [students, setStudents] = useState<Student[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState('');

  const row = useMemo(
    () => buildClassRow(klass.id, c.sessions, c.countsForSession),
    [klass.id, c.sessions, c.countsForSession]
  );

  // The Overview preview uses this offering's exact roster and this offering's completed sessions.
  // This prevents a student's attendance in another course from changing the current class view.
  const enrichedRoster = useMemo(
    () => withClassAttendanceRates(students, row.classSessions, c.attendanceStatusFor),
    [students, row.classSessions, c.attendanceStatusFor]
  );

  const refreshStudents = () => {
    setStudentsLoading(true);
    Promise.all([listClassStudents(klass.id), listStudents()])
      .then(([classStudents, everyStudent]) => {
        setStudents(classStudents.map((student) => mapStudentApiToUi(student)));
        setAllStudents(everyStudent.map((student) => mapStudentApiToUi(student)));
        setStudentsError('');
      })
      .catch((error) => setStudentsError(apiMessage(error)))
      .finally(() => setStudentsLoading(false));
  };

  const refreshSessions = () => {
    setSessionsLoading(true);
    listClassroomSessions()
      .then((all) => {
        const mapped = all
          .filter((session) => session.courseOfferingId === klass.id)
          .map((session) => mapClassroomSessionApiToUi(session, klass.studentCount));
        setSessions(mapped);
        setSessionsError('');
      })
      .catch((error) => setSessionsError(apiMessage(error)))
      .finally(() => setSessionsLoading(false));
  };

  useEffect(refreshStudents, [klass.id]);
  useEffect(refreshSessions, [klass.id]);

  const runAction = async (action: () => Promise<unknown>) => {
    setActionError('');
    setBusy(true);
    try {
      await action();
      onChanged();
    } catch (error) {
      setActionError(apiMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const openStudent = (studentId: string) => {
    c.setProfileId(studentId);
    c.setPage('students');
  };

  return (
    <div className="page__inner class-detail-page">
      <BackButton label="Back to classes" onClick={onBack} className="page-action" />

      <ClassHeaderCard
        key={`${klass.id}-header`}
        klass={klass}
        busy={busy}
        runAction={runAction}
        attendanceRate={row.attendance.rate}
        completedSessionCount={row.completedSessionCount}
        nextSession={row.nextSession}
      />

      {actionError && (
        <div className="notice notice--warn">
          <span className="notice__mark" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      <ClassDetailTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <ClassOverviewTab
          attendance={row.attendance}
          classSessions={row.classSessions}
          nextSession={row.nextSession}
          roster={enrichedRoster}
          onViewSessions={() => setTab('sessions')}
          onViewStudents={() => setTab('students')}
          onOpenStudent={openStudent}
        />
      )}

      {tab === 'students' && (
        <ClassStudentsCard
          key={`${klass.id}-students`}
          klass={klass}
          classes={classes}
          allStudents={allStudents}
          students={students}
          studentsLoading={studentsLoading}
          studentsError={studentsError}
          busy={busy}
          runAction={runAction}
          refreshStudents={refreshStudents}
          classSessions={row.classSessions}
          attendanceStatusFor={c.attendanceStatusFor}
          onOpenStudent={openStudent}
        />
      )}

      {tab === 'sessions' && (
        <ClassSessionsCard
          key={`${klass.id}-sessions`}
          courseOfferingId={klass.id}
          sessions={sessions}
          sessionsLoading={sessionsLoading}
          sessionsError={sessionsError}
          console={c}
          onRetry={refreshSessions}
        />
      )}

      {tab === 'attendance' && (
        <ClassAttendanceTab
          attendance={row.attendance}
          classSessions={row.classSessions}
          countsForSession={c.countsForSession}
        />
      )}

      {tab === 'reports' && (
        <ClassReportsTab
          courseOfferingId={klass.id}
          classLabel={`${klass.courseCode} · ${klass.academicTerm}`}
          console={c}
        />
      )}

      {tab === 'teachers' && (
        <ClassTeachersCard key={`${klass.id}-teachers`} klass={klass} staff={staff} busy={busy} runAction={runAction} />
      )}
    </div>
  );
}
