import { useEffect, useState } from 'react';
import AdminStatsRow from '../components/AdminStatsRow';
import DashboardAttendanceAnalytics from '../components/DashboardAttendanceAnalytics';
import { apiMessage } from '../lib/apiClient';
import { listStaff } from '../lib/adminApi';
import { listClasses, type ClassApiResponse } from '../lib/classAdminApi';
import { formatIsoDateInAuckland } from '../lib/sessionTime';
import type { Console } from '../hooks/useConsole';
import type { StaffMember } from '../types';

/**
 * The Admin sees the whole system at a glance instead of having to select a session first —
 * everything here is either already loaded globally by useConsole (students, sessions,
 * per-session attendance) or a couple of small admin-only calls (classes, staff).
 */
export default function AdminDashboard({ console: c }: { readonly console: Console }) {
  const [classes, setClasses] = useState<ClassApiResponse[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    Promise.all([listClasses(), listStaff()])
      .then(([classResult, staffResult]) => {
        setClasses(classResult);
        setStaff(staffResult);
        setLoadError('');
      })
      .catch((error) => setLoadError(apiMessage(error)));
  }, []);

  const activeClasses = classes.filter((klass) => klass.status === 'ACTIVE');
  const classesWithoutTeacher = activeClasses.filter((klass) => klass.teachers.length === 0);
  const teacherCount = staff.filter((member) => member.role === 'teacher').length;
  const todayIso = formatIsoDateInAuckland(new Date());
  const activeSessions = c.sessions.filter(
    (session) => session.status === 'Live' && session.date === todayIso
  );

  const pendingAiEvents = c.events.filter((event) => event.status === 'Pending Review').length;

  const archivedClassesCount = classes.length - activeClasses.length;

  return (
    <div className="page__inner">
      {loadError && (
        <div className="notice notice--warn">
          <span className="notice__mark" aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      )}

      <AdminStatsRow
        activeClassesCount={activeClasses.length}
        archivedClassesCount={archivedClassesCount}
        totalClassesCount={classes.length}
        totalStudents={c.students.length}
        teacherCount={teacherCount}
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
        onOpenClasses={() => c.setPage('classes')}
        onOpenStudents={() => c.setPage('students')}
        onOpenStaff={() => c.setPage('staff')}
        onOpenEvents={() => c.setPage('events')}
      />

      {classesWithoutTeacher.length > 0 && (
        <div className="notice notice--warn">
          <span className="notice__mark" aria-hidden="true" />
          <span>
            {classesWithoutTeacher.length} active class{classesWithoutTeacher.length === 1 ? '' : 'es'} with
            no teacher assigned: {classesWithoutTeacher.map((klass) => klass.courseCode).join(', ')}.{' '}
            <button type="button" className="btn btn--sm" onClick={() => c.setPage('classes')}>
              Go to Classes
            </button>
          </span>
        </div>
      )}

      <DashboardAttendanceAnalytics
        console={c}
        onOpenAttendance={() => c.setPage('attendance')}
      />
    </div>
  );
}
