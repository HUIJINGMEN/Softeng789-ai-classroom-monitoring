import { apiMessage } from '../../lib/apiClient';
import { listSessionAttendance, mapAttendanceApiToUi } from '../../lib/classroomApi';
import type { AttendanceRow, Session } from '../../types';

interface AttendanceCacheResult {
  cache: Record<string, AttendanceRow[]>;
  errors: string[];
}

/** Loads every saved session independently so one unavailable record does not discard the rest. */
export async function loadAttendanceCache(
  sessions: readonly Session[]
): Promise<AttendanceCacheResult> {
  const savedSessions = sessions.filter(
    (session): session is Session & { recordId: string } => Boolean(session.recordId)
  );
  const results = await Promise.allSettled(
    savedSessions.map(async (session) => ({
      sessionId: session.id,
      rows: (await listSessionAttendance(session.recordId)).map(mapAttendanceApiToUi)
    }))
  );

  const cache: Record<string, AttendanceRow[]> = {};
  const errors: string[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      cache[result.value.sessionId] = result.value.rows;
    } else {
      errors.push(`${savedSessions[index].course}: ${apiMessage(result.reason)}`);
    }
  });
  return { cache, errors };
}
