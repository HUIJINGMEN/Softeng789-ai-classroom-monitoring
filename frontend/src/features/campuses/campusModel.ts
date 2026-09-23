import { compareNullableValues } from '../../lib/sort';
import type { Campus, Room, Session, SortState } from '../../types';

export interface RoomClassUsage {
  courseOfferingId: string;
  course: string;
  offeringCode: string | null;
  sessionCount: number;
}

export type RoomSortKey = 'room' | 'capacity' | 'classes';
export type RoomClassesById = Map<string, RoomClassUsage[]>;

export function campusDeletionSubtitle(campus: Campus) {
  if (campus.roomCount === 0) {
    return `${campus.name} has no rooms and can be safely removed.`;
  }
  const roomLabel = campus.roomCount === 1 ? 'room' : 'rooms';
  return `${campus.name} still has ${campus.roomCount} ${roomLabel} — remove them first.`;
}

export function roomClassOfferingLabel(entry: RoomClassUsage) {
  const offering = entry.offeringCode?.trim();
  if (!offering) return entry.course;
  if (!offering.toLocaleLowerCase().startsWith(entry.course.toLocaleLowerCase())) return offering;
  return offering.slice(entry.course.length).trim() || offering;
}

/** Derive room usage from session history; rooms and course offerings deliberately have no direct
 * relationship because multiple classes can share a room at different times. */
export function buildRoomClassesById(sessions: readonly Session[]): RoomClassesById {
  const byRoom = new Map<string, Map<string, RoomClassUsage>>();
  for (const session of sessions) {
    if (!session.roomId || !session.courseOfferingId) continue;
    const byOffering = byRoom.get(session.roomId) ?? new Map<string, RoomClassUsage>();
    const existing = byOffering.get(session.courseOfferingId);
    if (existing) {
      existing.sessionCount += 1;
    } else {
      byOffering.set(session.courseOfferingId, {
        courseOfferingId: session.courseOfferingId,
        course: session.course,
        offeringCode: session.courseOfferingCode ?? null,
        sessionCount: 1
      });
    }
    byRoom.set(session.roomId, byOffering);
  }

  return new Map(
    Array.from(byRoom.entries()).map(([roomId, byOffering]) => [
      roomId,
      Array.from(byOffering.values()).sort((left, right) =>
        left.course.localeCompare(right.course)
      )
    ])
  );
}

export function filterCampuses(campuses: readonly Campus[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [...campuses];
  return campuses.filter((campus) =>
    campus.name.toLocaleLowerCase().includes(normalizedQuery)
  );
}

export function filterAndSortRooms(
  rooms: readonly Room[],
  roomClassesById: RoomClassesById,
  query: string,
  sort: SortState<RoomSortKey>
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = normalizedQuery
    ? rooms.filter((room) => {
        const classText = (roomClassesById.get(room.id) ?? [])
          .flatMap((entry) => [entry.course, entry.offeringCode ?? ''])
          .join(' ')
          .toLocaleLowerCase();
        return (
          room.code.toLocaleLowerCase().includes(normalizedQuery) ||
          room.name.toLocaleLowerCase().includes(normalizedQuery) ||
          String(room.capacity).includes(normalizedQuery) ||
          classText.includes(normalizedQuery)
        );
      })
    : [...rooms];

  return filtered.sort((left, right) => {
    const valueFor = (room: Room) => {
      if (sort.key === 'capacity') return room.capacity;
      if (sort.key === 'classes') return roomClassesById.get(room.id)?.length ?? 0;
      return `${room.code} ${room.name}`.toLocaleLowerCase();
    };
    return compareNullableValues(valueFor(left), valueFor(right), sort.dir);
  });
}

export function filterRoomClasses(entries: readonly RoomClassUsage[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [...entries];
  return entries.filter((entry) =>
    [entry.course, entry.offeringCode ?? ''].some((value) =>
      value.toLocaleLowerCase().includes(normalizedQuery)
    )
  );
}
