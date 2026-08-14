import { useCallback, useEffect, useMemo, useState } from 'react';
import { useEventReview } from './useEventReview';
import { useLiveMonitoring } from './useLiveMonitoring';
import { useSessionAttendance } from './useSessionAttendance';
import { useSoftLoading } from './useSoftLoading';
import { useStudentsData } from './useStudentsData';
import { useToast } from './useToast';
import { studentCourses } from '../lib/studentCourses';
import type {
  AttendanceStatus,
  DetectionSettings,
  EventStatus,
  Page,
  Student,
  Theme
} from '../types';

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

export interface DemoStep {
  page: Page;
  title: string;
  tip: string;
  run?: () => void;
}

export function useConsole() {
  const [page, setPage] = useState<Page>('dashboard');
  const [theme, setThemeState] = useState<Theme>('dark');
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
  const [demoStep, setDemoStep] = useState(0);

  const setTheme = useCallback((next: Theme) => {
    document.body.dataset.theme = next;
    setThemeState(next);
  }, []);

  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  const handleStudentCreated = useCallback((student: Student) => {
    setCourse(student.course);
    setQuery('');
    setProfileId(student.id);
  }, []);

  const studentsData = useStudentsData({
    onStudentCreated: handleStudentCreated,
    showToast
  });

  const {
    students,
    studentsLoading,
    studentsError,
    refreshStudents,
    addStudent
  } = studentsData;

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
    startSession,
    endSession,
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

  /* ---- guided demo ---- */
  const demoSteps: DemoStep[] = useMemo(
    () => [
      {
        page: 'dashboard',
        title: 'Start on the dashboard',
        tip: "Today's attendance, session list and the number of candidate events still waiting for review."
      },
      {
        page: 'attendance',
        title: 'Open a classroom session',
        tip: 'Attendance for the selected session. Sort any column, or correct a record manually.'
      },
      {
        page: 'live',
        title: 'Watch the session live',
        tip: 'Simulated detection stream. Candidate events appear in the panel on the right as they are created.',
        run: () => setMonitor('running')
      },
      {
        page: 'events',
        title: 'Review candidate events',
        tip: 'Every event starts as Pending Review. Nothing reaches a report before a teacher acts on it.'
      },
      {
        page: 'events',
        title: 'Open the evidence',
        tip: 'Check the still frame, duration and confidence — then confirm, reject or correct the event type. Keys: C confirm, R reject, → next.',
        run: () => {
          const first = events.find((event) => event.status === 'Pending Review');
          if (first) {
            const session = sessions.find((candidate) => candidate.id === first.sessionId);
            setModalId(first.id);
            setSessionId(first.sessionId);
            if (session) setSessionDate(session.date);
          }
        }
      },
      {
        page: 'events',
        title: 'Confirm the observation',
        tip: 'The status badge updates immediately and the event becomes reportable.',
        run: () => {
          setModalId((current) => {
            if (current) setEventStatus(current, 'Confirmed');
            return current;
          });
        }
      },
      {
        page: 'reports',
        title: 'See it in the report',
        tip: 'Reports count confirmed and corrected events only — pending and rejected ones are excluded.',
        run: () => setModalId(null)
      }
    ],
    [events, sessions, setEventStatus]
  );

  const startDemo = useCallback(() => {
    setModalId(null);
    setDemoStep(1);
    setPage(demoSteps[0].page);
  }, [demoSteps]);

  const nextDemoStep = useCallback(() => {
    if (demoStep >= demoSteps.length) {
      setDemoStep(0);
      return;
    }
    const step = demoSteps[demoStep];
    setDemoStep(demoStep + 1);
    setPage(step.page);
    step.run?.();
  }, [demoStep, demoSteps]);

  const prevDemoStep = useCallback(() => {
    if (demoStep <= 1) return;
    setDemoStep(demoStep - 1);
    setPage(demoSteps[demoStep - 2].page);
  }, [demoStep, demoSteps]);

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
    addStudent,
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
    startSession,
    endSession,
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
    exitDemo: () => setDemoStep(0),
    attendanceStatusFor,
    countsForSession
  };
}

export type Console = ReturnType<typeof useConsole>;
