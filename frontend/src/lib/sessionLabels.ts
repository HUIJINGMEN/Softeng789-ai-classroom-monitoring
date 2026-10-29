import type { Session } from '../types';

export function sessionTimeAndCampus(session?: Pick<Session, 'time' | 'campusName'> | null): string | undefined {
  if (!session) return undefined;
  return [session.time, session.campusName].filter(Boolean).join(' · ');
}

/** "City · Room 1" when the campus is known, otherwise the session's preserved room label. */
export function sessionRoomLabel(session: Pick<Session, 'room' | 'campusName'>): string {
  return session.campusName ? `${session.campusName} · ${session.room}` : session.room;
}
