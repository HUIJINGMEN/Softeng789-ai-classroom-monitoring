import type { Session } from '../types';

/** Match the session details people can actually see in either session list. */
export function sessionMatchesSearch(session: Session, rawQuery: string): boolean {
  const query = rawQuery.trim().toLocaleLowerCase();
  if (!query) return true;

  return [
    session.course,
    session.courseOfferingCode,
    session.title,
    session.room,
    session.teacherName,
    session.teacherEmail,
    session.date,
    session.dateLabel,
    session.time,
    session.status,
    session.statusCode
  ].some((value) => value?.toLocaleLowerCase().includes(query));
}
