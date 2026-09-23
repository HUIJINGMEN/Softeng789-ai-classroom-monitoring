import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Console } from '../../hooks/useConsole';
import { apiMessage } from '../../lib/apiClient';
import { createClassFeedback, listClassFeedback } from '../../lib/classFeedbackApi';
import { generateReportInsight } from '../../lib/feedbackSummaryApi';
import {
  attendanceForSessions,
  completedSessionsInRange,
  confirmedEventsForSessions,
  eventTypeCounts
} from '../../lib/reportMetrics';
import { usePagination } from '../../lib/table';
import type { ClassFeedback, ReportInsight } from '../../types';
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
  const [insight, setInsight] = useState<ReportInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState('');
  const [classFeedback, setClassFeedback] = useState<ClassFeedback[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackPage, setFeedbackPage] = useState(0);
  const [sessionQuery, setSessionQueryState] = useState('');
  const [sessionPage, setSessionPage] = useState(0);
  const [addingFeedback, setAddingFeedback] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const feedbackRequestRef = useRef(0);
  const insightRequestRef = useRef(0);
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

  const loadInsight = useCallback(() => {
    if (!rangeValid) return Promise.resolve();
    const requestId = ++insightRequestRef.current;
    setInsightLoading(true);
    setInsightError('');
    return generateReportInsight({
      scope: 'CLASS',
      courseOfferingId,
      dateFrom: console.dateFrom,
      dateTo: console.dateTo
    })
      .then((result) => {
        if (requestId === insightRequestRef.current) setInsight(result);
      })
      .catch((error) => {
        if (requestId !== insightRequestRef.current) return;
        setInsight(null);
        setInsightError(apiMessage(error));
      })
      .finally(() => {
        if (requestId === insightRequestRef.current) setInsightLoading(false);
      });
  }, [console.dateFrom, console.dateTo, courseOfferingId, rangeValid]);

  useEffect(() => {
    insightRequestRef.current += 1;
    setInsight(null);
    setInsightLoading(false);
    setInsightError('');
    setFeedbackPage(0);
    setSessionPage(0);
    return () => {
      insightRequestRef.current += 1;
    };
  }, [console.dateFrom, console.dateTo, courseOfferingId]);

  const sessions = useMemo(
    () =>
      completedSessionsInRange(
        console.sessions,
        console.dateFrom,
        console.dateTo,
        courseOfferingId
      ),
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

  const setSessionQuery = useCallback((value: string) => {
    setSessionQueryState(value);
    setSessionPage(0);
  }, []);

  const addClassFeedback = useCallback(
    async (payload: { courseOfferingId: string; comment: string }) => {
      setSavingFeedback(true);
      try {
        const created = await createClassFeedback(payload);
        setClassFeedback((current) => [created, ...current]);
        setInsight(null);
        showToast('Class feedback added. Generate the AI summary again to include it.');
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
    insight,
    insightLoading,
    insightError,
    loadInsight,
    classFeedback,
    classFeedbackInRange,
    feedbackLoading,
    feedbackError,
    loadClassFeedback,
    pagedClassFeedback,
    sessionQuery,
    setSessionQuery,
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
