import { useEffect, useMemo, useState } from 'react';
import { buildRoomOptions, chartSessionLabel, latestSessionByDate, type ChartPoint } from '../lib/chart';
import RecentEventsCard from '../components/RecentEventsCard';
import RecentSessionsCard from '../components/RecentSessionsCard';
import TeacherAttendanceTrendChart from '../components/TeacherAttendanceTrendChart';
import TeacherStatsRow from '../components/TeacherStatsRow';
import type { Console } from '../hooks/useConsole';

export default function Dashboard({ console: c }: { readonly console: Console }) {
  const [chartCourse, setChartCourse] = useState('All courses');
  const [chartRoom, setChartRoom] = useState('All rooms');

  const recentSessions = c.sessions.slice(0, 4);
  const roomOptions = useMemo(() => buildRoomOptions(c.sessions), [c.sessions]);

  useEffect(() => {
    if (!c.courseOptions.includes(chartCourse)) {
      setChartCourse('All courses');
    }
  }, [c.courseOptions, chartCourse]);

  useEffect(() => {
    if (!roomOptions.some((option) => option.value === chartRoom)) {
      setChartRoom('All rooms');
    }
  }, [chartRoom, roomOptions]);

  const chartSessions = useMemo(
    () =>
      latestSessionByDate(
        c.sessions.filter(
          (session) =>
            session.status !== 'Cancelled' &&
            (chartCourse === 'All courses' || session.course === chartCourse) &&
            (chartRoom === 'All rooms' || session.room === chartRoom)
        ),
        8
      ).reverse(),
    [c.sessions, chartCourse, chartRoom]
  );
  // Shared between the trend chart and the stat cards' sparklines above it — both need to move
  // together when the course/room filters change, so this is computed once here rather than by
  // each of them separately.
  const points: ChartPoint[] = chartSessions.map((session) => {
    const counts = c.countsForSession(session.id);
    return {
      label: session.dateLabel.replace(', 2026', ''),
      sub: chartSessionLabel(session),
      rate: counts.rate,
      present: counts.present,
      pending: c.events.filter((e) => e.sessionId === session.id && e.status === 'Pending Review').length
    };
  });
  const latestSession = c.sessions.find((session) => session.status === 'Live') ?? c.sessions[0];
  const enrolledCourseCount = Math.max(0, c.courseOptions.length - 1);

  const currentSessionPendingEvents = c.events.filter(
    (event) => event.sessionId === c.sessionId && event.status === 'Pending Review'
  );

  return (
    <div className="page__inner">
      <TeacherStatsRow
        totalStudents={c.filteredStudents.length}
        enrolledCourseCount={enrolledCourseCount}
        presentToday={c.counts.present + c.counts.late}
        lateToday={c.counts.late}
        attendanceRate={c.counts.rate}
        activeSessionLabel={`${c.activeSession.course} · ${c.activeSession.room}`}
        pendingCount={currentSessionPendingEvents.length}
        points={points}
        onReviewPending={() => {
          c.setReviewFilter('Pending Review');
          c.setPage('events');
        }}
      />

      <div className="grid-main">
        <RecentSessionsCard
          recentSessions={recentSessions}
          countsForSession={c.countsForSession}
          onOpenLatestSession={() => {
            if (latestSession) {
              c.selectSession(latestSession.id);
            }
            c.setPage('live');
          }}
          onOpenSession={(sessionId) => {
            c.selectSession(sessionId);
            c.setPage('attendance');
          }}
        />

        <TeacherAttendanceTrendChart
          sessions={c.sessions}
          chartSessions={chartSessions}
          points={points}
          chartCourse={chartCourse}
          chartRoom={chartRoom}
          courseOptions={c.courseOptions}
          onChartCourseChange={setChartCourse}
          onChartRoomChange={setChartRoom}
        />
      </div>

      <RecentEventsCard
        pendingEvents={currentSessionPendingEvents}
        students={c.students}
        sessions={c.sessions}
        onReviewSession={() => {
          c.setReviewFilter('Pending Review');
          c.setPage('events');
        }}
        onViewEvidence={(eventId) => {
          c.setModalId(eventId);
          c.setCorrecting(false);
        }}
      />
    </div>
  );
}
