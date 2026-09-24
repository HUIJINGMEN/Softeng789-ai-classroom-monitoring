import { apiMessage } from '../../lib/apiClient';
import { listSessionAttendance, mapAttendanceApiToUi } from '../../lib/classroomApi';
import type { AttendanceRow, Session } from '../../types';

interface AttendanceCacheResult {
  cache: Record<string, AttendanceRow[]>;
  errors: string[];
}

const MAX_CONCURRENT_ATTENDANCE_REQUESTS = 6;

/** Loads every saved session independently so one unavailable record does not discard the rest. */
export async function loadAttendanceCache(
  sessions: readonly Session[]
): Promise<AttendanceCacheResult> {
  const savedSessions = sessions.filter(
    (session): session is Session & { recordId: string } => Boolean(session.recordId)
  );
  const cache: Record<string, AttendanceRow[]> = {};
  const errors: string[] = [];
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < savedSessions.length) {
      const session = savedSessions[nextIndex];
      nextIndex += 1;
      try {
        cache[session.id] = (await listSessionAttendance(session.recordId)).map(mapAttendanceApiToUi);
      } catch (error) {
        errors.push(`${session.course}: ${apiMessage(error)}`);
      }
    }
  };
  const workerCount = Math.min(MAX_CONCURRENT_ATTENDANCE_REQUESTS, savedSessions.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return { cache, errors };
}
