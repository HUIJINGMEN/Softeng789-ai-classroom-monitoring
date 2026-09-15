import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { percentageOf } from '../lib/attendanceAnalytics';
import { toSessionInstant } from '../lib/sessionTime';
import { studentCourses } from '../lib/studentCourses';
import type {
  AttendanceRow,
  AttendanceStatus,
  NewClassroomSession,
  Session,
  Student
} from '../types';

const EMPTY_SESSION: Session = {
  id: '',
  course: 'No session selected',
  title: 'No classroom session selected',
  room: 'No room selected',
  date: '',
  dateLabel: 'No date',
  time: 'No scheduled time',
  startTime: '',
  endTime: '',
  enrolled: 0,
  status: 'Scheduled',
  statusCode: 'SCHEDULED'
};

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

  const refreshSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const apiSessions = await listClassroomSessions();
      const mapped = apiSessions.map((session) =>
        mapClassroomSessionApiToUi(session, enrolledCountForCourse(session.course, students))
      );
      setSessions(mapped);
      try {
        setAttendanceBySessionId(await refreshAttendanceCache(mapped));
        setAttendanceError('');
      } catch (error) {
        setAttendanceBySessionId({});
        setAttendanceError(`Backend attendance API unavailable: ${apiMessage(error)}`);
      }
      setSessionsError('');
    } catch (error) {
      setSessions([]);
      setAttendanceBySessionId({});
      setSessionsError(`Backend session API unavailable: ${apiMessage(error)}`);
    } finally {
      setSessionsLoading(false);
    }
  }, [students]);

  useEffect(() => {
    void refreshSessions();
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
      const target = sessions.find((session) => session.id === targetSessionId);
      if (!target?.recordId) {
        setAttendanceRows([]);
        setAttendanceError('');
        return;
      }

      setAttendanceLoading(true);
      try {
        const records = await listSessionAttendance(target.recordId);
        const mapped = records.map((record) => mapAttendanceApiToUi(record));
        setAttendanceRows(mapped);
        setAttendanceBySessionId((current) => ({ ...current, [target.id]: mapped }));
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
          setAttendanceBySessionId((current) => {
            const rows = current[session.id] ?? [];
            const exists = rows.some((row) => row.studentRecordId === updated.studentRecordId);
            return {
              ...current,
              [session.id]: exists
                ? rows.map((row) =>
                    row.studentRecordId === updated.studentRecordId ? updated : row
                  )
                : [...rows, updated]
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
          const records = await listSessionAttendance(created.recordId);
          const mapped = records.map((record) => mapAttendanceApiToUi(record));
          setAttendanceRows(mapped);
          setAttendanceBySessionId((current) => ({ ...current, [created.id]: mapped }));
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
    return emptyCounts(activeSession.enrolled);
  }, [activeSession.enrolled, activeSession.id, activeSession.recordId, attendanceBySessionId, attendanceRows]);

  const sessionOptions = useMemo(
    () => sessions.filter((session) => sessionDate === 'all' || session.date === sessionDate),
    [sessionDate, sessions]
  );

  const dateOptions = useMemo(() => {
    const unique = [...new Set(sessions.map((session) => session.date))]
      .sort((left, right) => right.localeCompare(left));
    return [
      { value: 'all', label: 'All dates' },
      ...unique.map((date) => ({
        value: date,
        label: sessions.find((session) => session.date === date)?.dateLabel ?? date
      }))
    ];
  }, [sessions]);

  const courseOptions = useMemo(() => {
    const values = new Set<string>();
    sessions.forEach((session) => values.add(session.course));
    students.forEach((student) => studentCourses(student).forEach((course) => values.add(course)));
    values.delete('All courses');
    return ['All courses', ...Array.from(values).sort((left, right) => left.localeCompare(right))];
  }, [sessions, students]);

  const attendanceStatusFor = useCallback(
    (studentId: string, session = sessionId) => {
      const active = sessions.find((candidate) => candidate.id === session);
      if (active?.recordId) {
        const rows = session === sessionId ? attendanceRows : (attendanceBySessionId[session] ?? []);
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
        const rows = targetSessionId === sessionId
          ? attendanceRows
          : (attendanceBySessionId[targetSessionId] ?? []);
        return attendanceCounts(rows);
      }
      return emptyCounts(session?.enrolled ?? 0);
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
    rate: percentageOf(present + late, total, 0)
  };
}

function emptyCounts(total = 0) {
  return {
    present: 0,
    late: 0,
    absent: 0,
    unknown: total,
    total,
    rate: 0
  };
}

function enrolledCountForCourse(course: string, students: readonly Student[]) {
  return students.filter((student) => studentCourses(student).includes(course)).length;
}

async function refreshAttendanceCache(sessions: readonly Session[]) {
  const entries = await Promise.all(
    sessions
      .filter((session) => session.recordId)
      .map(async (session) => {
        const records = await listSessionAttendance(session.recordId as string);
        return [session.id, records.map((record) => mapAttendanceApiToUi(record))] as const;
      })
  );
  return Object.fromEntries(entries);
}
