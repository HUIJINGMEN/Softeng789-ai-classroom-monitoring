import { formatIsoDateInAuckland } from '../../lib/sessionTime';
import type { CheckInSession } from './checkInApi';

export function splitCheckInSessions(sessions: readonly CheckInSession[], now: Date) {
  const today = formatIsoDateInAuckland(now);
  const primary: CheckInSession[] = [], nearby: CheckInSession[] = [];
  for (const session of [...sessions].sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))) {
    const isToday = formatIsoDateInAuckland(new Date(session.startTime)) === today;
    (isToday || session.canSubmit ? primary : nearby).push(session);
  }
  return { primary, nearby };
}
