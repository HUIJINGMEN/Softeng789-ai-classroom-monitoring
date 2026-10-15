import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Console } from '../../hooks/useConsole';
import { apiMessage } from '../../lib/apiClient';
import { createClassFeedback, listClassFeedback } from '../../lib/classFeedbackApi';
import {
  attendanceForSessions,
  completedSessionsInRange,
  confirmedEventsForSessions,
  eventTypeCounts
} from '../../lib/reportMetrics';
import { usePagination } from '../../lib/table';
import type { ClassFeedback } from '../../types';
import {
  buildClassReportSessionRows,
  feedbackWithinReportRange,
  filterClassReportSessionRows
} from './classReportModel';

type ClassReportConsole = Pick<
  Console,
  'dateFrom' | 'dateTo' | 'sessions' | 'events' | 'countsForSession' | 'showToast'
>;

export function useClassReportWorkspace(
  courseOfferingId: string,
  console: ClassReportConsole
) {
  const showToast = console.showToast;
  const [classFeedback, setClassFeedback] = useState<ClassFeedback[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackPage, setFeedbackPage] = useState(0);
  const [sessionQuery, setSessionQuery] = useState('');
  const [sessionPage, setSessionPage] = useState(0);
  const [addingFeedback, setAddingFeedback] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const feedbackRequestRef = useRef(0);
  const rangeValid = console.dateFrom <= console.dateTo;

  const loadClassFeedback = useCallback(async () => {
    const requestId = ++feedbackRequestRef.current;
    setFeedbackLoading(true);
    setFeedbackError('');
    try {
      const feedback = await listClassFeedback(courseOfferingId);
      if (requestId === feedbackRequestRef.current) setClassFeedback(feedback);
    } catch (error) {
      if (requestId === feedbackRequestRef.current) setFeedbackError(apiMessage(error));
    } finally {
      if (requestId === feedbackRequestRef.current) setFeedbackLoading(false);
    }
  }, [courseOfferingId]);

  useEffect(() => {
    void loadClassFeedback();
    return () => {
      feedbackRequestRef.current += 1;
    };
  }, [loadClassFeedback]);

  useEffect(() => {
    setFeedbackPage(0);
    setSessionPage(0);
  }, [console.dateFrom, console.dateTo, courseOfferingId]);

  const sessions = useMemo(
    () =>
      completedSessionsInRange(
        console.sessions,
        console.dateFrom,
        console.dateTo,
        courseOfferingId
      ).filter((session) => new Date(session.startTime).getTime() <= Date.now()),
    [console.dateFrom, console.dateTo, console.sessions, courseOfferingId]
  );
  const attendance = useMemo(
    () => attendanceForSessions(sessions, console.countsForSession),
    [console.countsForSession, sessions]
  );
  const confirmedEvents = useMemo(
    () => confirmedEventsForSessions(console.events, sessions),
    [console.events, sessions]
  );
  const eventCounts = useMemo(() => eventTypeCounts(confirmedEvents), [confirmedEvents]);
  const classFeedbackInRange = useMemo(
    () => feedbackWithinReportRange(classFeedback, console.dateFrom, console.dateTo),
    [classFeedback, console.dateFrom, console.dateTo]
  );
  const pagedClassFeedback = usePagination(
    classFeedbackInRange,
    feedbackPage,
    setFeedbackPage,
    5
  );
  const sessionRows = useMemo(
    () => buildClassReportSessionRows(sessions, console.countsForSession),
    [console.countsForSession, sessions]
  );
  const filteredSessionRows = useMemo(
    () => filterClassReportSessionRows(sessionRows, sessionQuery),
    [sessionQuery, sessionRows]
  );
  const pagedSessionRows = usePagination(filteredSessionRows, sessionPage, setSessionPage, 6);

  const updateSessionQuery = useCallback((value: string) => {
    setSessionQuery(value);
    setSessionPage(0);
  }, []);

  const addClassFeedback = useCallback(
    async (payload: { courseOfferingId: string; comment: string }) => {
      setSavingFeedback(true);
      try {
        const created = await createClassFeedback(payload);
        setClassFeedback((current) => [created, ...current]);
        showToast('Class feedback added. Refresh report sources to include it.');
        return true;
      } catch (error) {
        showToast(apiMessage(error));
        return false;
      } finally {
        setSavingFeedback(false);
      }
    },
    [showToast]
  );

  return {
    rangeValid,
    classFeedback,
    classFeedbackInRange,
    feedbackLoading,
    feedbackError,
    loadClassFeedback,
    pagedClassFeedback,
    sessionQuery,
    setSessionQuery: updateSessionQuery,
    sessionRows,
    filteredSessionRows,
    pagedSessionRows,
    sessions,
    attendance,
    confirmedEvents,
    eventCounts,
    recordedAttendanceCount: attendance.present + attendance.late + attendance.absent,
    attendingAttendanceCount: attendance.present + attendance.late,
    addingFeedback,
    setAddingFeedback,
    savingFeedback,
    addClassFeedback
  };
}

export type ClassReportWorkspace = ReturnType<typeof useClassReportWorkspace>;
