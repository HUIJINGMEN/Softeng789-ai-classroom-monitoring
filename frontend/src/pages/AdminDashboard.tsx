import { useEffect, useMemo, useState } from 'react';
import AdminAttendanceOverviewCard from '../components/AdminAttendanceOverviewCard';
import AdminAttendanceTrendChart from '../components/AdminAttendanceTrendChart';
import AdminLowestAttendanceCard from '../components/AdminLowestAttendanceCard';
import AdminStatsRow from '../components/AdminStatsRow';
import { apiMessage } from '../lib/apiClient';
import { listStaff } from '../lib/adminApi';
import { listClasses, type ClassApiResponse } from '../lib/classAdminApi';
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
  const [trendHasData, setTrendHasData] = useState(false);

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
  const activeSessions = c.sessions.filter((session) => session.status === 'Live');

  const todayIso = new Date().toISOString().slice(0, 10);
  // A cancelled session never actually happened — leaving it in would show up as a phantom 0%
  // entry in "today's" attendance breakdown and the lowest-attendance table, for a class that
  // was never really at risk.
  const todaySessions = useMemo(
    () => c.sessions.filter((session) => session.date === todayIso && session.status !== 'Cancelled'),
    [c.sessions, todayIso]
  );
  const sessionsToday = todaySessions.length;

  // Reuses the same candidate-event state the teacher Dashboard's "Pending AI events" tile
  // already reads from — just summed across every session today instead of one active session.
  const aiEventsToday = useMemo(() => {
    const todaySessionIds = new Set(todaySessions.map((session) => session.id));
    return c.events.filter((event) => todaySessionIds.has(event.sessionId)).length;
  }, [c.events, todaySessions]);

  // "Attendance Overview" answers "how did today go" — always today, regardless of the trend
  // chart's own course/room/range filters, so the denominator is unambiguous.
  const attendance = useMemo(() => {
    const totals = todaySessions.reduce(
      (acc, session) => {
        const counts = c.countsForSession(session.id);
        return {
          present: acc.present + counts.present,
          late: acc.late + counts.late,
          absent: acc.absent + counts.absent,
          unknown: acc.unknown + counts.unknown,
          total: acc.total + counts.total
        };
      },
      { present: 0, late: 0, absent: 0, unknown: 0, total: 0 }
    );
    return {
      ...totals,
      rate: totals.total === 0 ? null : Math.round(((totals.present + totals.late) / totals.total) * 100)
    };
  }, [todaySessions, c]);

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
        aiEventsToday={aiEventsToday}
        onOpenActiveSession={
          activeSessions.length > 0
            ? () => {
                c.selectSession(activeSessions[0].id);
                c.setPage('live');
              }
            : undefined
        }
      />

      {/* Only force the two cards to match height when at least one actually has a chart/donut to
          show — otherwise two short, unrelated empty-state messages get stretched into a tall
          card with a lot of dead space in the middle. */}
      <div className={`grid-main${trendHasData || attendance.total > 0 ? ' grid-main--stretch' : ''}`}>
        <AdminAttendanceTrendChart
          sessions={c.sessions}
          courseOptions={c.courseOptions}
          countsForSession={c.countsForSession}
          onGoToSession={(sessionId) => {
            c.selectSession(sessionId);
            c.setPage('attendance');
          }}
          onHasDataChange={setTrendHasData}
        />

        <AdminAttendanceOverviewCard
          attendance={attendance}
          totalStudents={c.students.length}
          sessionsToday={sessionsToday}
          onViewAllAttendance={() => c.setPage('attendance')}
        />
      </div>

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

      <AdminLowestAttendanceCard
        todaySessions={todaySessions}
        countsForSession={c.countsForSession}
        onGoToClasses={() => c.setPage('classes')}
      />
    </div>
  );
}
