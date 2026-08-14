import { useCallback, useEffect, useMemo, useState } from 'react';
import { COURSES, SESSIONS } from '../data/sessions';
import {
  attendanceStatus,
  correctionKey,
  getSession,
  sessionCounts,
  type CorrectionMap
} from '../lib/attendance';
import {
  createClassroomSession,
  endClassroomSession,
  listClassroomSessions,
  listSessionAttendance,
  mapAttendanceApiToUi,
  mapClassroomSessionApiToUi,
  startClassroomSession,
  updateSessionAttendance
} from '../lib/classroomApi';
import { toSessionInstant } from '../lib/sessionTime';
import { studentCourses } from '../lib/studentCourses';
import { apiMessage } from '../lib/studentApi';
import type {
  AttendanceRow,
  AttendanceStatus,
  NewClassroomSession,
  Session,
  Student
} from '../types';

const FALLBACK_SESSION = SESSIONS[0];

interface UseSessionAttendanceOptions {
  students: Student[];
  setCourse: (course: string) => void;
  setQuery: (query: string) => void;
  showToast: (message: string) => void;
}

export function useSessionAttendance({
  students,
  setCourse,
  setQuery,
  showToast
}: UseSessionAttendanceOptions) {
  const [sessions, setSessions] = useState<Session[]>(() =>
    SESSIONS.map((session) => ({ ...session }))
  );
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [corrections, setCorrections] = useState<CorrectionMap>({});
  const [sessionId, setSessionId] = useState(FALLBACK_SESSION.id);
  const [sessionDate, setSessionDate] = useState<string>(FALLBACK_SESSION.date);
  const [statusFilter, setStatusFilter] = useState<'All' | AttendanceStatus>('All');
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState('');
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');

  const refreshSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const apiSessions = await listClassroomSessions();
      const mapped = apiSessions.map((session) =>
        mapClassroomSessionApiToUi(session, students.length)
      );
      setSessions(mapped.length > 0 ? mapped : SESSIONS.map((session) => ({ ...session })));
      setSessionsError('');
    } catch (error) {
      setSessions((current) =>
        current.length > 0 ? current : SESSIONS.map((session) => ({ ...session }))
      );
      setSessionsError(`Backend session API unavailable: ${apiMessage(error)}`);
    } finally {
      setSessionsLoading(false);
    }
  }, [students.length]);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    if (sessions.length === 0 || sessions.some((session) => session.id === sessionId)) return;
    const preferred = sessions.find((session) => session.status === 'Live') ?? sessions[0];
    setSessionId(preferred.id);
    setSessionDate(preferred.date);
  }, [sessionId, sessions]);

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
      const target = sessions.find((session) => session.id === targetSessionId);
      if (!target?.recordId) {
        setAttendanceRows([]);
        setAttendanceError('');
        return;
      }

      setAttendanceLoading(true);
      try {
        const records = await listSessionAttendance(target.recordId);
        setAttendanceRows(records.map((record) => mapAttendanceApiToUi(record)));
        setAttendanceError('');
      } catch (error) {
        setAttendanceRows([]);
        setAttendanceError(`Backend attendance API unavailable: ${apiMessage(error)}`);
      } finally {
        setAttendanceLoading(false);
      }
    },
    [sessionId, sessions]
  );

  useEffect(() => {
    void refreshAttendance(sessionId);
  }, [refreshAttendance, sessionId, students.length]);

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
          setAttendanceRows((current) => {
            const exists = current.some((row) => row.studentRecordId === updated.studentRecordId);
            return exists
              ? current.map((row) =>
                  row.studentRecordId === updated.studentRecordId ? updated : row
                )
              : [...current, updated];
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

      setCorrections((current) => ({ ...current, [correctionKey(studentId, sessionId)]: status }));
      showToast(`${student?.name ?? studentId} manually marked ${status} for ${sessionId}.`);
    },
    [sessionId, sessions, showToast, students]
  );

  const createSession = useCallback(
    async (draft: NewClassroomSession) => {
      setSessionsLoading(true);
      try {
        const created = mapClassroomSessionApiToUi(
          await createClassroomSession({
            course: draft.course,
            room: draft.room,
            teacherName: draft.teacherName,
            teacherEmail: draft.teacherEmail,
            date: draft.date,
            startTime: toSessionInstant(draft.date, draft.startTime),
            endTime: toSessionInstant(draft.date, draft.endTime),
            status: 'SCHEDULED'
          }),
          students.length
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
          const records = await listSessionAttendance(created.recordId);
          setAttendanceRows(records.map((record) => mapAttendanceApiToUi(record)));
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
    [setCourse, setQuery, showToast, students.length]
  );

  const startSession = useCallback(async () => {
    const session = sessions.find((candidate) => candidate.id === sessionId);
    if (!session?.recordId) return;

    setSessionsLoading(true);
    try {
      const updated = mapClassroomSessionApiToUi(
        await startClassroomSession(session.recordId),
        students.length
      );
      setSessions((current) =>
        current.map((candidate) => (candidate.id === updated.id ? updated : candidate))
      );
      setSessionId(updated.id);
      setSessionDate(updated.date);
      showToast(`${updated.course} started.`);
      await refreshAttendance(updated.id);
    } catch (error) {
      showToast(`Session was not started: ${apiMessage(error)}`);
    } finally {
      setSessionsLoading(false);
    }
  }, [refreshAttendance, sessionId, sessions, showToast, students.length]);

  const endSession = useCallback(async () => {
    const session = sessions.find((candidate) => candidate.id === sessionId);
    if (!session?.recordId) return;

    setSessionsLoading(true);
    try {
      const updated = mapClassroomSessionApiToUi(
        await endClassroomSession(session.recordId),
        students.length
      );
      setSessions((current) =>
        current.map((candidate) => (candidate.id === updated.id ? updated : candidate))
      );
      showToast(`${updated.course} completed.`);
    } catch (error) {
      showToast(`Session was not ended: ${apiMessage(error)}`);
    } finally {
      setSessionsLoading(false);
    }
  }, [sessionId, sessions, showToast, students.length]);

  const activeSession = sessions.find((session) => session.id === sessionId) ?? getSession(sessionId);

  const counts = useMemo(() => {
    if (activeSession.recordId) {
      return attendanceCounts(attendanceRows);
    }
    return sessionCounts(sessionId, corrections);
  }, [activeSession.recordId, attendanceRows, corrections, sessionId]);

  const sessionOptions = useMemo(
    () => sessions.filter((session) => sessionDate === 'all' || session.date === sessionDate),
    [sessionDate, sessions]
  );

  const dateOptions = useMemo(() => {
    const unique = [...new Set(sessions.map((session) => session.date))].sort().reverse();
    return [
      { value: 'all', label: 'All dates' },
      ...unique.map((date) => ({
        value: date,
        label: sessions.find((session) => session.date === date)?.dateLabel ?? date
      }))
    ];
  }, [sessions]);

  const courseOptions = useMemo(() => {
    const values = new Set<string>(COURSES);
    sessions.forEach((session) => values.add(session.course));
    students.forEach((student) => studentCourses(student).forEach((course) => values.add(course)));
    values.delete('All courses');
    return ['All courses', ...Array.from(values).sort()];
  }, [sessions, students]);

  const attendanceStatusFor = useCallback(
    (studentId: string, session = sessionId) => {
      const active = sessions.find((candidate) => candidate.id === session);
      if (active?.recordId) {
        return (
          attendanceRows.find(
            (row) => row.studentNumber === studentId || row.studentRecordId === studentId
          )?.status ?? 'Unknown'
        );
      }
      return attendanceStatus(studentId, session, corrections);
    },
    [attendanceRows, corrections, sessionId, sessions]
  );

  const countsForSession = useCallback(
    (targetSessionId: string) => {
      const session = sessions.find((candidate) => candidate.id === targetSessionId);
      if (session?.recordId) {
        if (targetSessionId === sessionId) {
          return attendanceCounts(attendanceRows);
        }
        return {
          present: 0,
          late: 0,
          absent: 0,
          unknown: session.enrolled,
          total: session.enrolled,
          rate: 0
        };
      }
      return sessionCounts(targetSessionId, corrections);
    },
    [attendanceRows, corrections, sessionId, sessions]
  );

  return {
    sessions,
    attendanceRows,
    corrections,
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
    startSession,
    endSession,
    activeSession,
    counts,
    sessionOptions,
    dateOptions,
    courseOptions,
    attendanceStatusFor,
    countsForSession
  };
}

function attendanceCounts(rows: AttendanceRow[]) {
  let present = 0;
  let late = 0;
  let absent = 0;
  let unknown = 0;

  for (const row of rows) {
    if (row.status === 'Present') present += 1;
    else if (row.status === 'Late') late += 1;
    else if (row.status === 'Absent') absent += 1;
    else unknown += 1;
  }

  const total = rows.length;
  return {
    present,
    late,
    absent,
    unknown,
    total,
    rate: total === 0 ? 0 : Math.round(((present + late) / total) * 100)
  };
}
