import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  cancelClassroomSession,
  createClassroomSession,
  listClassroomSessions,
  listSessionAttendance,
  mapAttendanceApiToUi,
  mapClassroomSessionApiToUi,
  updateClassroomSession,
  updateSessionAttendance
} from '../lib/classroomApi';
import { apiMessage } from '../lib/apiClient';
import { toSessionInstant } from '../lib/sessionTime';
import { loadAttendanceCache } from '../features/session-attendance/sessionAttendanceGateway';
import {
  EMPTY_SESSION,
  attendanceCounts,
  attendanceRowsForSession,
  buildSessionCourseOptions,
  buildSessionDateOptions,
  emptyAttendanceCounts,
  enrolledCountForCourse,
  upsertAttendanceRow
} from '../features/session-attendance/sessionAttendanceModel';
import type {
  AttendanceRow,
  AttendanceStatus,
  NewClassroomSession,
  Session,
  Student
} from '../types';

interface UseSessionAttendanceOptions {
  students: Student[];
  setCourse: (course: string) => void;
  setQuery: (query: string) => void;
  showToast: (message: string) => void;
}

function attendanceLoadError(errors: readonly string[]): string {
  if (errors.length === 0) return '';
  const sessionLabel = errors.length === 1 ? 'session' : 'sessions';
  return `${errors.length} ${sessionLabel} could not load attendance. ${errors[0]}`;
}

export function useSessionAttendance({
  students,
  setCourse,
  setQuery,
  showToast
}: UseSessionAttendanceOptions) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [attendanceBySessionId, setAttendanceBySessionId] = useState<Record<string, AttendanceRow[]>>({});
  const [sessionId, setSessionId] = useState('');
  const [sessionDate, setSessionDate] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'All' | AttendanceStatus>('All');
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState('');
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  const sessionsRequestRef = useRef(0);
  const attendanceRequestRef = useRef(0);

  const refreshSessions = useCallback(async () => {
    const requestId = ++sessionsRequestRef.current;
    setSessionsLoading(true);
    try {
      const apiSessions = await listClassroomSessions();
      const mapped = apiSessions.map((session) =>
        mapClassroomSessionApiToUi(session, enrolledCountForCourse(session.course, students))
      );
      if (requestId !== sessionsRequestRef.current) return;
      setSessions(mapped);
      const attendanceCache = await loadAttendanceCache(mapped);
      if (requestId !== sessionsRequestRef.current) return;
      setAttendanceBySessionId(attendanceCache.cache);
      setAttendanceError(attendanceLoadError(attendanceCache.errors));
      setSessionsError('');
    } catch (error) {
      if (requestId !== sessionsRequestRef.current) return;
      setSessions([]);
      setAttendanceBySessionId({});
      setSessionsError(`Backend session API unavailable: ${apiMessage(error)}`);
    } finally {
      if (requestId === sessionsRequestRef.current) setSessionsLoading(false);
    }
  }, [students]);

  useEffect(() => {
    void refreshSessions();
    return () => {
      sessionsRequestRef.current += 1;
    };
  }, [refreshSessions]);

  useEffect(() => {
    if (sessions.length === 0) {
      if (sessionId) setSessionId('');
      if (sessionDate !== 'all') setSessionDate('all');
      return;
    }
    if (sessions.some((session) => session.id === sessionId)) return;
    const preferred = sessions.find((session) => session.status === 'Live') ?? sessions[0];
    setSessionId(preferred.id);
    setSessionDate(preferred.date);
  }, [sessionDate, sessionId, sessions]);

  const selectSession = useCallback(
    (nextSessionId: string) => {
      const session = sessions.find((candidate) => candidate.id === nextSessionId);
      setSessionId(nextSessionId);
      if (session) {
        setSessionDate(session.date);
      }
    },
    [sessions]
  );

  const refreshAttendance = useCallback(
    async (targetSessionId = sessionId) => {
      const requestId = ++attendanceRequestRef.current;
      const target = sessions.find((session) => session.id === targetSessionId);
      if (!target?.recordId) {
        setAttendanceRows([]);
        setAttendanceError('');
        setAttendanceLoading(false);
        return;
      }

      setAttendanceLoading(true);
      try {
        const records = await listSessionAttendance(target.recordId);
        if (requestId !== attendanceRequestRef.current) return;
        const mapped = records.map((record) => mapAttendanceApiToUi(record));
        setAttendanceRows(mapped);
        setAttendanceBySessionId((current) => ({ ...current, [target.id]: mapped }));
        setAttendanceError('');
      } catch (error) {
        if (requestId !== attendanceRequestRef.current) return;
        setAttendanceRows([]);
        setAttendanceError(`Backend attendance API unavailable: ${apiMessage(error)}`);
      } finally {
        if (requestId === attendanceRequestRef.current) setAttendanceLoading(false);
      }
    },
    [sessionId, sessions]
  );

  useEffect(() => {
    void refreshAttendance(sessionId);
    return () => {
      attendanceRequestRef.current += 1;
    };
  }, [refreshAttendance, sessionId]);

  const correctAttendance = useCallback(
    async (studentId: string, status: AttendanceStatus) => {
      const student = students.find((candidate) => candidate.id === studentId || candidate.recordId === studentId);
      const session = sessions.find((candidate) => candidate.id === sessionId);

      if (session?.recordId && student?.recordId) {
        setAttendanceLoading(true);
        try {
          const updated = mapAttendanceApiToUi(
            await updateSessionAttendance(session.recordId, student.recordId, status)
          );
          setAttendanceRows((current) => upsertAttendanceRow(current, updated));
          setAttendanceBySessionId((current) => {
            const rows = current[session.id] ?? [];
            return {
              ...current,
              [session.id]: upsertAttendanceRow(rows, updated)
            };
          });
          setAttendanceError('');
          showToast(`${student.name} manually marked ${status} for ${session.course}.`);
        } catch (error) {
          showToast(`Attendance was not saved: ${apiMessage(error)}`);
        } finally {
          setAttendanceLoading(false);
        }
        return;
      }

      showToast('Select a saved classroom session before correcting attendance.');
    },
    [sessionId, sessions, showToast, students]
  );

  const createSession = useCallback(
    async (draft: NewClassroomSession) => {
      setSessionsLoading(true);
      try {
        const created = mapClassroomSessionApiToUi(
          await createClassroomSession({
            courseOfferingId: draft.courseOfferingId,
            roomId: draft.roomId,
            teacherEmail: draft.teacherEmail,
            date: draft.date,
            startTime: toSessionInstant(draft.date, draft.startTime),
            endTime: toSessionInstant(draft.date, draft.endTime),
            status: 'SCHEDULED'
          }),
          enrolledCountForCourse(draft.courseLabel, students)
        );
        setSessions((current) => [
          created,
          ...current.filter((candidate) => candidate.id !== created.id)
        ]);
        setCourse(created.course);
        setSessionId(created.id);
        setSessionDate(created.date);
        setStatusFilter('All');
        setQuery('');
        if (created.recordId) {
          try {
            const records = await listSessionAttendance(created.recordId);
            const mapped = records.map((record) => mapAttendanceApiToUi(record));
            setAttendanceRows(mapped);
            setAttendanceBySessionId((current) => ({ ...current, [created.id]: mapped }));
            setAttendanceError('');
          } catch (error) {
            setAttendanceRows([]);
            setAttendanceError(`The session was created, but attendance could not load: ${apiMessage(error)}`);
          }
        } else {
          setAttendanceRows([]);
        }
        setSessionsError('');
        showToast(`${created.course} session created.`);
        return true;
      } catch (error) {
        showToast(`Session was not created: ${apiMessage(error)}`);
        return false;
      } finally {
        setSessionsLoading(false);
      }
    },
    [setCourse, setQuery, showToast, students]
  );

  // Unlike start/end (which always act on whichever session is currently selected), edit and
  // cancel are triggered from a row in the sessions table — any session, not just the selected
  // one — so both take the target session's id explicitly.
  const updateSession = useCallback(
    async (targetSessionId: string, draft: NewClassroomSession) => {
      const session = sessions.find((candidate) => candidate.id === targetSessionId);
      if (!session?.recordId) return false;

      setSessionsLoading(true);
      try {
        const updated = mapClassroomSessionApiToUi(
          await updateClassroomSession(session.recordId, {
            courseOfferingId: draft.courseOfferingId,
            roomId: draft.roomId,
            teacherEmail: draft.teacherEmail,
            date: draft.date,
            startTime: toSessionInstant(draft.date, draft.startTime),
            endTime: toSessionInstant(draft.date, draft.endTime),
            status: session.statusCode ?? 'SCHEDULED'
          }),
          enrolledCountForCourse(draft.courseLabel, students)
        );
        setSessions((current) =>
          current.map((candidate) => (candidate.id === updated.id ? updated : candidate))
        );
        showToast(`${updated.course} session updated.`);
        return true;
      } catch (error) {
        showToast(`Session was not updated: ${apiMessage(error)}`);
        return false;
      } finally {
        setSessionsLoading(false);
      }
    },
    [sessions, showToast, students]
  );

  const cancelSession = useCallback(
    async (targetSessionId: string) => {
      const session = sessions.find((candidate) => candidate.id === targetSessionId);
      if (!session?.recordId) return;

      setSessionsLoading(true);
      try {
        const updated = mapClassroomSessionApiToUi(
          await cancelClassroomSession(session.recordId),
          enrolledCountForCourse(session.course, students)
        );
        setSessions((current) =>
          current.map((candidate) => (candidate.id === updated.id ? updated : candidate))
        );
        showToast(`${updated.course} session cancelled.`);
      } catch (error) {
        showToast(`Session was not cancelled: ${apiMessage(error)}`);
      } finally {
        setSessionsLoading(false);
      }
    },
    [sessions, showToast, students]
  );

  const activeSession = sessions.find((session) => session.id === sessionId) ?? EMPTY_SESSION;

  const counts = useMemo(() => {
    if (activeSession.recordId) {
      return attendanceCounts(attendanceBySessionId[activeSession.id] ?? attendanceRows);
    }
    return emptyAttendanceCounts(activeSession.enrolled);
  }, [activeSession.enrolled, activeSession.id, activeSession.recordId, attendanceBySessionId, attendanceRows]);

  const sessionOptions = useMemo(
    () => sessions.filter((session) => sessionDate === 'all' || session.date === sessionDate),
    [sessionDate, sessions]
  );

  const dateOptions = useMemo(() => buildSessionDateOptions(sessions), [sessions]);
  const courseOptions = useMemo(
    () => buildSessionCourseOptions(sessions, students),
    [sessions, students]
  );

  const attendanceStatusFor = useCallback(
    (studentId: string, session = sessionId) => {
      const active = sessions.find((candidate) => candidate.id === session);
      if (active?.recordId) {
        const rows = attendanceRowsForSession(
          session,
          sessionId,
          attendanceRows,
          attendanceBySessionId
        );
        return (
          rows.find(
            (row) => row.studentNumber === studentId || row.studentRecordId === studentId
          )?.status ?? 'Unknown'
        );
      }
      return 'Unknown';
    },
    [attendanceBySessionId, attendanceRows, sessionId, sessions]
  );

  const countsForSession = useCallback(
    (targetSessionId: string) => {
      const session = sessions.find((candidate) => candidate.id === targetSessionId);
      if (session?.recordId) {
        const rows = attendanceRowsForSession(
          targetSessionId,
          sessionId,
          attendanceRows,
          attendanceBySessionId
        );
        return attendanceCounts(rows);
      }
      return emptyAttendanceCounts(session?.enrolled ?? 0);
    },
    [attendanceBySessionId, attendanceRows, sessionId, sessions]
  );

  return {
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
    correctAttendance,
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
  };
}
