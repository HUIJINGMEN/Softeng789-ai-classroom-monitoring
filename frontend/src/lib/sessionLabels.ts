import type { Session } from '../types';

/** "City · Room 1" when the campus is known, otherwise the session's preserved room label. */
export function sessionRoomLabel(session: Pick<Session, 'room' | 'campusName'>): string {
  return session.campusName ? `${session.campusName} · ${session.room}` : session.room;
}
