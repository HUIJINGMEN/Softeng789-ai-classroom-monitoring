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
  const [dateFrom, setDateFrom] = useState('2026-07-27');
  const [dateTo, setDateTo] = useState('2026-08-07');

  const [profileId, setProfileId] = useState<string | null>(null);
  const [correctRowId, setCorrectRowId] = useState<string | null>(null);

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
    startSession,
    endSession,
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
  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter(
      (student) =>
        (course === 'All courses' || studentCourses(student).includes(course)) &&
        (!q || student.name.toLowerCase().includes(q) || student.id.toLowerCase().includes(q))
    );
  }, [course, query, students]);

  return {
    // navigation
    page,
    setPage,
    theme,
    setTheme,
    // data
    events,
    students,
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
    startSession,
    endSession,
    cancelSession,
    // overlays
    profileId,
    setProfileId,
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
