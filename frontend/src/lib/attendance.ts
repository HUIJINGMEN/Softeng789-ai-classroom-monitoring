import { SESSIONS } from '../data/sessions';
import { STUDENTS } from '../data/students';
import type { AttendanceStatus, Session } from '../types';

export type CorrectionMap = Record<string, AttendanceStatus>;

export const correctionKey = (studentId: string, sessionId: string) => `${studentId}|${sessionId}`;

export function getSession(sessionId: string): Session {
  return SESSIONS.find((s) => s.id === sessionId) ?? SESSIONS[0];
}

/**
 * Deterministic stand-in for a real attendance record: the same student in the
 * same session always resolves to the same status, so the prototype is stable
 * across renders. Manual teacher corrections take precedence.
 */
export function attendanceStatus(
  studentId: string,
  sessionId: string,
  corrections: CorrectionMap
): AttendanceStatus {
  const override = corrections[correctionKey(studentId, sessionId)];
  if (override) return override;

  const index = STUDENTS.findIndex((s) => s.id === studentId);
  const seed = (index * 7 + sessionId.charCodeAt(4) * 3 + sessionId.charCodeAt(5)) % 12;
  if (seed === 9 || seed === 4) return 'Late';
  if (seed === 11) return 'Absent';
  return 'Present';
}

const pad = (n: number) => String(n).padStart(2, '0');
const format = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

export function attendanceTimes(
  studentId: string,
  sessionId: string,
  status: AttendanceStatus
): [string, string] {
  if (status === 'Absent' || status === 'Unknown') return ['—', '—'];

  const session = getSession(sessionId);
  const [start, end] = session.time.split(/[–-]/);
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  const index = STUDENTS.findIndex((s) => s.id === studentId);

  const offset = status === 'Late' ? 9 + (index % 7) : -(3 + (index % 5));
  return [
    format(startHour * 60 + startMinute + offset),
    format(endHour * 60 + endMinute + (index % 3))
  ];
}

/** Students on the roster for a session's course. */
export function sessionRoster(sessionId: string) {
  const session = getSession(sessionId);
  const enrolled = STUDENTS.filter((s) => s.course === session.course);
  return enrolled.length >= 6 ? enrolled : STUDENTS;
}

export interface SessionCounts {
  present: number;
  late: number;
  absent: number;
  unknown: number;
  total: number;
  rate: number;
}

export function sessionCounts(sessionId: string, corrections: CorrectionMap): SessionCounts {
  const roster = sessionRoster(sessionId);
  let present = 0;
  let late = 0;
  let absent = 0;
  let unknown = 0;

  for (const student of roster) {
    const status = attendanceStatus(student.id, sessionId, corrections);
    if (status === 'Present') present += 1;
    else if (status === 'Late') late += 1;
    else if (status === 'Absent') absent += 1;
    else unknown += 1;
  }

  const total = roster.length || 1;
  return { present, late, absent, unknown, total, rate: Math.round(((present + late) / total) * 100) };
}
