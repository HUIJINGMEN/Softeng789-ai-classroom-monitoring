import { useCallback, useMemo, useState } from 'react';
import { useEventReview } from './useEventReview';
import { useGuidedDemo } from './useGuidedDemo';
import { useHealthAlerts } from './useHealthAlerts';
import { useHealthIncidentReports } from './useHealthIncidentReports';
import { useLiveMonitoring } from './useLiveMonitoring';
import { useSessionAttendance } from './useSessionAttendance';
import { useSoftLoading } from './useSoftLoading';
import { useStudentsData } from './useStudentsData';
import { useTheme } from './useTheme';
import { useToast } from './useToast';
import { percentageOf } from '../lib/attendanceAnalytics';
import { studentCourses } from '../lib/studentCourses';
import type { AttendanceStatus, DetectionSettings, EventStatus, Page } from '../types';

export type { DemoStep } from './useGuidedDemo';

const DEFAULT_SETTINGS: DetectionSettings = {
  headDown: 45,
  leaveSeat: 60,
  confidence: 0.75,
  requireConfirm: true,
  saveEvidence: true,
  blurFaces: true,
  notifyLive: true,
  retention: '30 days',
  privacy: 'Track ID only'
};

export function useConsole() {
  const [page, setPage] = useState<Page>('dashboard');
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<DetectionSettings>(DEFAULT_SETTINGS);

  const [course, setCourse] = useState('All courses');
  const [query, setQuery] = useState('');
  const [reviewFilter, setReviewFilter] = useState<'All' | EventStatus>('All');
  // Two months back rather than a fixed historical date — a hardcoded range silently stopped
  // covering any real session once the demo data moved past it, making Reports.tsx look empty
  // (0 sessions in range) for anyone opening it without first widening the date filter.
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 2);
    return date.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const [profileId, setProfileId] = useState<string | null>(null);
  const [correctRowId, setCorrectRowId] = useState<string | null>(null);
  // The Classes page's "am I looking at the list or one class's detail" state lives inside
  // AdminClasses.tsx/MyClasses.tsx (selectedClassId, purely local) — this mirrors just the
  // course code up to Console so TeacherApp's page header can show a breadcrumb, the same reason
  // profileId above is lifted for Student Profile's header title.
  const [classDetailTitle, setClassDetailTitle] = useState<string | null>(null);
  // A one-shot "open this class" instruction from somewhere outside the Classes page (e.g. a
  // room's "classes that use this room" list) — mirrors profileId's own cross-page deep-link
  // pattern. AdminClasses.tsx consumes it (sets its own local selectedClassId, then clears this
  // back to null) the same way Students.tsx consumes profileId.
  const [classFocusId, setClassFocusId] = useState<string | null>(null);

  const { loading, softLoad } = useSoftLoading();
  const { toast, showToast } = useToast();

  const studentsData = useStudentsData();

  const { students, studentsLoading, studentsError, refreshStudents } = studentsData;

  const sessionAttendance = useSessionAttendance({
    students,
    setCourse,
    setQuery,
    showToast
  });

  const {
    sessions,
    attendanceRows,
    sessionId,
    setSessionId,
    selectSession,
    sessionDate,
    setSessionDate,
    statusFilter,
    setStatusFilter,
    sessionsLoading,
    sessionsError,
    attendanceLoading,
    attendanceError,
    refreshSessions,
    refreshAttendance,
    correctAttendance: saveAttendanceCorrection,
    createSession,
    updateSession,
    cancelSession,
    activeSession,
    counts,
    sessionOptions,
    dateOptions,
    courseOptions,
    attendanceStatusFor,
    countsForSession
  } = sessionAttendance;

  const eventReview = useEventReview({
    sessions,
    setSessionId,
    setSessionDate,
    showToast
  });

  const {
    events,
    addEvent,
    pendingEvents,
    setEventStatus,
    goToNextPending,
    bulkReview,
    selected,
    toggleSelected,
    clearSelected,
    modalId,
    setModalId,
    correcting,
    setCorrecting
  } = eventReview;

  const liveMonitoring = useLiveMonitoring({
    events,
    students,
    settings,
    sessionId,
    addEvent
  });

  const {
    monitor,
    setMonitor,
    fps,
    liveAlerts,
    clearLiveAlerts,
    trackBoxes
  } = liveMonitoring;

  const correctAttendance = useCallback(
    async (studentId: string, status: AttendanceStatus) => {
      await saveAttendanceCorrection(studentId, status);
      setCorrectRowId(null);
    },
    [saveAttendanceCorrection]
  );

  const {
    healthAlerts,
    healthAlertsLoading,
    healthAlertsError,
    refreshHealthAlerts,
    awaitingReviewCount,
    confirmAlert,
    dismissAlert
  } = useHealthAlerts();

  const {
    healthIncidentReports,
    healthIncidentReportsLoading,
    healthIncidentReportsError,
    refreshHealthIncidentReports,
    createReport
  } = useHealthIncidentReports();

  const { demoStep, demoSteps, startDemo, nextDemoStep, prevDemoStep, exitDemo } = useGuidedDemo({
    events,
    sessions,
    setPage,
    setSessionId,
    setSessionDate,
    setModalId,
    setEventStatus,
    setMonitor
  });

  /* ---- derived ---- */
  // student.rate starts out null (see mapStudentApiToUi) — Students.tsx's sortable "Attendance
  // rate" column, StudentProfile.tsx's hero card, and Reports.tsx's student-level table all read
  // this same field, so it's computed once here (from the same per-session attendance lookups
  // StudentProfile.tsx's own attendance-history section already uses) rather than three times.
  // A student with no sessions in any of their enrolled courses yet keeps the null "Not
  // calculated" state rather than reading as a false 0%.
  const studentsWithRate = useMemo(
    () =>
      students.map((student) => {
        const relevantSessions = sessions.filter((session) =>
          studentCourses(student).includes(session.course)
        );
        if (relevantSessions.length === 0) return student;
        const totals = relevantSessions.reduce(
          (acc, session) => {
            const status = attendanceStatusFor(student.id, session.id);
            if (status === 'Present') acc.present += 1;
            else if (status === 'Late') acc.late += 1;
            acc.total += 1;
            return acc;
          },
          { present: 0, late: 0, total: 0 }
        );
        return { ...student, rate: percentageOf(totals.present + totals.late, totals.total, 0) };
      }),
    [students, sessions, attendanceStatusFor]
  );

  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return studentsWithRate.filter(
      (student) =>
        (course === 'All courses' || studentCourses(student).includes(course)) &&
        (!q || student.name.toLowerCase().includes(q) || student.id.toLowerCase().includes(q))
    );
  }, [course, query, studentsWithRate]);

  return {
    // navigation
    page,
    setPage,
    theme,
    setTheme,
    // data
    events,
    students: studentsWithRate,
    sessions,
    studentsLoading,
    studentsError,
    refreshStudents,
    sessionsLoading,
    sessionsError,
    refreshSessions,
    attendanceRows,
    attendanceLoading,
    attendanceError,
    refreshAttendance,
    pendingEvents,
    settings,
    setSettings,
    activeSession,
    counts,
    filteredStudents,
    sessionOptions,
    dateOptions,
    courseOptions,
    trackBoxes,
    // filters
    course,
    setCourse,
    sessionId,
    setSessionId,
    selectSession,
    sessionDate,
    setSessionDate,
    statusFilter,
    setStatusFilter,
    query,
    setQuery,
    reviewFilter,
    setReviewFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    // review
    setEventStatus,
    goToNextPending,
    bulkReview,
    selected,
    toggleSelected,
    clearSelected,
    correctAttendance,
    createSession,
    updateSession,
    cancelSession,
    // overlays
    profileId,
    setProfileId,
    classDetailTitle,
    setClassDetailTitle,
    classFocusId,
    setClassFocusId,
    modalId,
    setModalId,
    correcting,
    setCorrecting,
    correctRowId,
    setCorrectRowId,
    // live
    monitor,
    setMonitor,
    fps,
    liveAlerts,
    clearLiveAlerts,
    // chrome
    loading: loading || sessionsLoading || attendanceLoading,
    softLoad,
    toast,
    showToast,
    demoStep,
    demoSteps,
    startDemo,
    nextDemoStep,
    prevDemoStep,
    exitDemo,
    attendanceStatusFor,
    countsForSession,
    // health alerts
    healthAlerts,
    healthAlertsLoading,
    healthAlertsError,
    refreshHealthAlerts,
    awaitingReviewCount,
    confirmAlert,
    dismissAlert,
    // health incident reports
    healthIncidentReports,
    healthIncidentReportsLoading,
    healthIncidentReportsError,
    refreshHealthIncidentReports,
    createReport
  };
}

export type Console = ReturnType<typeof useConsole>;
