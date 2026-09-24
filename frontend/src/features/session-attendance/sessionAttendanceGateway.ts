import { apiMessage } from '../../lib/apiClient';
import { listSessionAttendanceBatch, mapAttendanceApiToUi } from '../../lib/classroomApi';
import type { AttendanceRow, Session } from '../../types';

interface AttendanceCacheResult {
  cache: Record<string, AttendanceRow[]>;
  errors: string[];
}

const MAX_SESSIONS_PER_BATCH = 100;

function chunksOf<T>(values: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size)
  );
}

/** Loads attendance in bounded batches so a long session history does not create one request per session. */
export async function loadAttendanceCache(
  sessions: readonly Session[]
): Promise<AttendanceCacheResult> {
  const savedSessions = sessions.filter(
    (session): session is Session & { recordId: string } => Boolean(session.recordId)
  );
  const cache: Record<string, AttendanceRow[]> = {};
  const errors: string[] = [];

  for (const batch of chunksOf(savedSessions, MAX_SESSIONS_PER_BATCH)) {
    try {
      const response = await listSessionAttendanceBatch(batch.map((session) => session.recordId));
      batch.forEach((session) => {
        cache[session.id] = (response.attendanceBySessionId[session.recordId] ?? []).map(
          mapAttendanceApiToUi
        );
      });
    } catch (error) {
      const message = apiMessage(error);
      batch.forEach((session) => errors.push(`${session.course}: ${message}`));
    }
  }

  return { cache, errors };
}
