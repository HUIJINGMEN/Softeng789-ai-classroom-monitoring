import { useCallback, useMemo, useState } from 'react';
import { useEventReview } from './useEventReview';
import { useAccomplishments } from './useAccomplishments';
import { useGuidedDemo } from './useGuidedDemo';
import { useHealthAlerts } from './useHealthAlerts';
import { useHealthIncidentReports } from './useHealthIncidentReports';
import { useLiveMonitoring } from './useLiveMonitoring';
import { useConsoleFilters } from './useConsoleFilters';
import { useConsoleNavigation } from './useConsoleNavigation';
import { useSessionAttendance } from './useSessionAttendance';
import { useSoftLoading } from './useSoftLoading';
import { useStudentsData } from './useStudentsData';
import { useTheme } from './useTheme';
import { useToast } from './useToast';
import { percentageOf } from '../lib/attendanceAnalytics';
import { studentCourses, studentIsEnrolledInSession } from '../lib/studentCourses';
import type { AttendanceStatus, DetectionSettings } from '../types';

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
  const navigation = useConsoleNavigation();
  const filters = useConsoleFilters();
  const {
    page,
    setPage,
    profileId,
    setProfileId,
    correctRowId,
    setCorrectRowId,
    classDetailTitle,
    setClassDetailTitle,
    classFocusId,
    setClassFocusId
  } = navigation;
  const {
    course,
    setCourse,
    query,
    setQuery,
    reviewFilter,
    setReviewFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo
  } = filters;
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<DetectionSettings>(DEFAULT_SETTINGS);

  const { loading, softLoad } = useSoftLoading();
  const { toast, showToast } = useToast();

  const studentsData = useStudentsData();
  const accomplishmentsData = useAccomplishments();

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
          studentIsEnrolledInSession(student, session)
        );
        if (relevantSessions.length === 0) return student;
        const totals = relevantSessions.reduce(
          (acc, session) => {
            const status = attendanceStatusFor(student.id, session.id);
            if (status === 'Present') {
              acc.present += 1;
              acc.recorded += 1;
            } else if (status === 'Late') {
              acc.late += 1;
              acc.recorded += 1;
            } else if (status === 'Absent') {
              acc.recorded += 1;
            }
            return acc;
          },
          { present: 0, late: 0, recorded: 0 }
        );
        return {
          ...student,
          rate: percentageOf(totals.present + totals.late, totals.recorded)
        };
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
    accomplishments: accomplishmentsData.items,
    accomplishmentsLoading: accomplishmentsData.loading,
    accomplishmentsError: accomplishmentsData.error,
    pendingAccomplishmentReviewCount: accomplishmentsData.pendingReviewCount,
    refreshAccomplishments: accomplishmentsData.refresh,
    updateAccomplishment: accomplishmentsData.updateItem,
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
