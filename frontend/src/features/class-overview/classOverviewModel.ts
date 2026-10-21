import { completedSessionBy } from '../../lib/attendanceAnalytics';
import type { Session, Student } from '../../types';

const PREVIEW_LIMIT = 3;
export const NEEDS_ATTENTION_THRESHOLD = 60;

/** Full facts are computed before preview limits. Never use a display slice as a population count. */
export function buildClassOverviewModel(sessions: readonly Session[], roster: readonly Student[], asOf = Date.now()) {
  const completed = sessions.filter(session => completedSessionBy(session, asOf));
  const attention = roster.filter((student): student is Student & {rate: number} =>
    student.rate !== null && student.rate < NEEDS_ATTENTION_THRESHOLD)
    .sort((left, right) => left.rate - right.rate || left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  return {
    completedCount: completed.length,
    recentSessions: [...completed].sort((left, right) => Date.parse(right.startTime) - Date.parse(left.startTime)
      || left.id.localeCompare(right.id)).slice(0, PREVIEW_LIMIT),
    attentionTotal: attention.length,
    attentionPreview: attention.slice(0, PREVIEW_LIMIT),
    hasRecordedRosterRates: roster.some(student => student.rate !== null)
  };
}
