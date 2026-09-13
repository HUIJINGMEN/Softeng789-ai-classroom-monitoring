import { useEffect, useMemo, useState } from 'react';
import CreateCampusModal from '../components/CreateCampusModal';
import CreateRoomModal from '../components/CreateRoomModal';
import Modal from '../components/Modal';
import Pager from '../components/Pager';
import SearchField from '../components/SearchField';
import SortableHeader from '../components/SortableHeader';
import { IconBuilding, IconChevronRight, IconPlus } from '../components/icons';
import { apiMessage } from '../lib/apiClient';
import { createCampus, deleteCampus, listCampuses, updateCampus, type CampusApiResponse } from '../lib/campusApi';
import { createRoom, deleteRoom, listRooms, updateRoom, type RoomApiResponse } from '../lib/roomApi';
import { compareNullableValues, usePagination, useSort } from '../lib/table';
import type { Console } from '../hooks/useConsole';

interface Props {
  readonly console: Console;
}

interface RoomClassUsage {
  courseOfferingId: string;
  course: string;
  offeringCode: string | null;
  sessionCount: number;
}

type RoomSortKey = 'room' | 'capacity' | 'classes';

export default function AdminCampuses({ console: c }: Props) {
  const [campuses, setCampuses] = useState<CampusApiResponse[]>([]);
  const [rooms, setRooms] = useState<RoomApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [selectedCampusId, setSelectedCampusId] = useState('');
  const [campusQuery, setCampusQuery] = useState('');
  const [roomQuery, setRoomQuery] = useState('');
  const [campusPage, setCampusPage] = useState(0);
  const [roomPage, setRoomPage] = useState(0);
  const [creatingCampus, setCreatingCampus] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [editingCampus, setEditingCampus] = useState<CampusApiResponse | null>(null);
  const [editingRoom, setEditingRoom] = useState<RoomApiResponse | null>(null);
  const [deletingCampus, setDeletingCampus] = useState<CampusApiResponse | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<RoomApiResponse | null>(null);
  const [viewingClassesForRoom, setViewingClassesForRoom] = useState<RoomApiResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const { sort: roomSort, toggle: toggleRoomSort } = useSort<RoomSortKey>('room');

  const refresh = () => {
    setLoading(true);
    Promise.all([listCampuses(), listRooms()])
      .then(([campusResult, roomResult]) => {
        setCampuses(campusResult);
        setRooms(roomResult);
        setSelectedCampusId((current) =>
          current && campusResult.some((campus) => campus.id === current)
            ? current
            : campusResult[0]?.id || ''
        );
        setListError('');
      })
      .catch((error) => setListError(apiMessage(error)))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const selectedCampus = campuses.find((campus) => campus.id === selectedCampusId);
  const filteredCampuses = useMemo(() => {
    const query = campusQuery.trim().toLocaleLowerCase();
    if (!query) return campuses;
    return campuses.filter((campus) => campus.name.toLocaleLowerCase().includes(query));
  }, [campusQuery, campuses]);

  const roomsAtSelectedCampus = useMemo(
    () => rooms.filter((room) => room.campusId === selectedCampusId),
    [rooms, selectedCampusId]
  );

  // A room isn't tied to one fixed class — different classes can share it at different times
  // (see Campus/Room's whole design), so "the classes that use this room" is derived from actual
  // session history rather than stored anywhere. Sessions with no courseOfferingId (a class that
  // was since archived/deleted) are skipped — there's nothing left to jump to for those.
  const roomClassesById = useMemo(() => {
    const byRoom = new Map<string, Map<string, RoomClassUsage>>();
    for (const session of c.sessions) {
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
        Array.from(byOffering.values()).sort((a, b) => a.course.localeCompare(b.course))
      ])
    );
  }, [c.sessions]);

  const classesAtRoom = (roomId: string) => roomClassesById.get(roomId) ?? [];

  const filteredRooms = useMemo(() => {
    const query = roomQuery.trim().toLocaleLowerCase();
    if (!query) return roomsAtSelectedCampus;
    return roomsAtSelectedCampus.filter((room) => {
      const classText = (roomClassesById.get(room.id) ?? [])
        .flatMap((entry) => [entry.course, entry.offeringCode ?? ''])
        .join(' ')
        .toLocaleLowerCase();
      return (
        room.code.toLocaleLowerCase().includes(query) ||
        room.name.toLocaleLowerCase().includes(query) ||
        String(room.capacity).includes(query) ||
        classText.includes(query)
      );
    });
  }, [roomClassesById, roomQuery, roomsAtSelectedCampus]);

  const sortedRooms = useMemo(
    () =>
      [...filteredRooms].sort((left, right) => {
        const valueFor = (room: RoomApiResponse) => {
          if (roomSort.key === 'capacity') return room.capacity;
          if (roomSort.key === 'classes') return roomClassesById.get(room.id)?.length ?? 0;
          return `${room.code} ${room.name}`.toLocaleLowerCase();
        };
        return compareNullableValues(valueFor(left), valueFor(right), roomSort.dir);
      }),
    [filteredRooms, roomClassesById, roomSort]
  );
  const pagedCampuses = usePagination(filteredCampuses, campusPage, setCampusPage, 7);
  const pagedRooms = usePagination(sortedRooms, roomPage, setRoomPage, 8);
  const selectedCampusCapacity = useMemo(
    () => roomsAtSelectedCampus.reduce((total, room) => total + room.capacity, 0),
    [roomsAtSelectedCampus]
  );
  const selectedCampusClassCount = useMemo(
    () =>
      new Set(
        roomsAtSelectedCampus.flatMap((room) =>
          Array.from(roomClassesById.get(room.id)?.values() ?? []).map((entry) => entry.courseOfferingId)
        )
      ).size,
    [roomClassesById, roomsAtSelectedCampus]
  );

  useEffect(() => setCampusPage(0), [campusQuery]);
  useEffect(() => setRoomPage(0), [roomQuery, selectedCampusId]);

  const selectCampus = (campusId: string) => {
    setSelectedCampusId(campusId);
    setRoomQuery('');
    setRoomPage(0);
  };
  const handleRoomSort = (key: RoomSortKey) => {
    toggleRoomSort(key);
    setRoomPage(0);
  };
  const classesForViewedRoom = viewingClassesForRoom ? classesAtRoom(viewingClassesForRoom.id) : [];

  const handleCreateCampus = async (name: string) => {
    setSaving(true);
    try {
      const created = await createCampus(name);
      refresh();
      setSelectedCampusId(created.id);
      return true;
    } catch (error) {
      c.showToast(`Campus was not created: ${apiMessage(error)}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCampus = async (id: string, name: string) => {
    setSaving(true);
    try {
      await updateCampus(id, name);
      refresh();
      return true;
    } catch (error) {
      c.showToast(`Campus was not renamed: ${apiMessage(error)}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCampus = async () => {
    if (!deletingCampus) return;
    setSaving(true);
    try {
      await deleteCampus(deletingCampus.id);
      setDeletingCampus(null);
      refresh();
    } catch (error) {
      c.showToast(`Campus was not deleted: ${apiMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRoom = async (payload: { campusId: string; code: string; name: string; capacity: number }) => {
    setSaving(true);
    try {
      await createRoom(payload);
      refresh();
      return true;
    } catch (error) {
      c.showToast(`Room was not created: ${apiMessage(error)}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRoom = async (
    id: string,
    payload: { campusId: string; code: string; name: string; capacity: number }
  ) => {
    setSaving(true);
    try {
      await updateRoom(id, payload);
      refresh();
      return true;
    } catch (error) {
      c.showToast(`Room was not saved: ${apiMessage(error)}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!deletingRoom) return;
    setSaving(true);
    try {
      await deleteRoom(deletingRoom.id);
      setDeletingRoom(null);
      refresh();
    } catch (error) {
      c.showToast(`Room was not deleted: ${apiMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page__inner">
      {listError && (
        <div className="notice notice--warn">
          <span className="notice__mark" aria-hidden="true" />
          <span>{listError}</span>
          <span className="spacer" />
          <button type="button" className="btn btn--sm" onClick={refresh}>
            Retry
          </button>
        </div>
      )}

      <div className="campus-management">
        <section className="card campus-directory dashboard-enter stagger-1">
          <div className="card__head campus-directory__head">
            <div className="card__title-row">
              <span className="icon-inline icon-inline--title" aria-hidden="true">
                <IconBuilding />
              </span>
              <div>
                <div className="card__title">Campus directory</div>
                <div className="card__sub">
                  {campusQuery.trim()
                    ? `${filteredCampuses.length} of ${campuses.length} campuses`
                    : `${campuses.length} campus${campuses.length === 1 ? '' : 'es'}`}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn--primary btn--with-icon campus-directory__add"
              onClick={() => setCreatingCampus(true)}
            >
              <IconPlus /> Add campus
            </button>
          </div>

          {campuses.length > 0 && (
            <div className="campus-directory__search" role="search" aria-label="Filter campuses">
              <SearchField
                label="Search campuses"
                value={campusQuery}
                placeholder="Search by campus name"
                onChange={setCampusQuery}
              />
            </div>
          )}

          {loading && campuses.length === 0 && (
            <div className="empty campus-directory__state" role="status">Loading campuses…</div>
          )}

          {!loading && campuses.length === 0 && !listError && (
            <div className="empty campus-directory__state">
              <div className="empty__title">No campuses yet</div>
              <div className="empty__hint">Add a campus before creating rooms and scheduling sessions.</div>
              <button type="button" className="btn btn--primary btn--with-icon" onClick={() => setCreatingCampus(true)}>
                <IconPlus /> Add campus
              </button>
            </div>
          )}

          {!loading && campuses.length > 0 && filteredCampuses.length === 0 && (
            <div className="empty campus-directory__state">
              <div className="empty__title">No campus matches “{campusQuery.trim()}”</div>
              <div className="empty__hint">Try a shorter name or clear the search.</div>
              <button type="button" className="btn btn--sm" onClick={() => setCampusQuery('')}>
                Clear search
              </button>
            </div>
          )}

          {filteredCampuses.length > 0 && (
            <>
              <div className="campus-directory__list" role="list" aria-label="Campuses">
                {pagedCampuses.rows.map((campus) => {
                  const selected = campus.id === selectedCampusId;
                  return (
                    <button
                      key={campus.id}
                      type="button"
                      className={`campus-directory__item${selected ? ' campus-directory__item--selected' : ''}`}
                      aria-current={selected ? 'true' : undefined}
                      onClick={() => selectCampus(campus.id)}
                    >
                      <span className="campus-directory__select">
                        <span className="campus-directory__name">{campus.name}</span>
                        <span className="campus-directory__count">
                          {campus.roomCount} room{campus.roomCount === 1 ? '' : 's'}
                        </span>
                      </span>
                      <span className="campus-directory__arrow" aria-hidden="true">
                        <IconChevronRight />
                      </span>
                    </button>
                  );
                })}
              </div>
              <Pager
                label={pagedCampuses.label}
                page={pagedCampuses.page}
                pageCount={pagedCampuses.pageCount}
                canPrev={pagedCampuses.canPrev}
                canNext={pagedCampuses.canNext}
                onPrev={pagedCampuses.prev}
                onNext={pagedCampuses.next}
                onGoToPage={pagedCampuses.goToPage}
              />
            </>
          )}
        </section>

        <section className="card campus-rooms dashboard-enter stagger-2">
          <div className="card__head campus-rooms__head">
            <div className="card__title-row">
              <div>
                <div className="card__title">
                  {selectedCampus ? selectedCampus.name : 'Campus rooms'}
                </div>
                <div className="card__sub">
                  {selectedCampus ? 'Manage rooms and see which classes use them.' : 'Select a campus to see its rooms.'}
                </div>
              </div>
            </div>
            {selectedCampus && (
              <div className="card__actions campus-rooms__actions">
                <button type="button" className="btn btn--quiet" onClick={() => setEditingCampus(selectedCampus)}>
                  Rename
                </button>
                <button type="button" className="btn btn--quiet" onClick={() => setDeletingCampus(selectedCampus)}>
                  Delete
                </button>
                <button
                  type="button"
                  className="btn btn--primary btn--with-icon"
                  onClick={() => setCreatingRoom(true)}
                >
                  <IconPlus /> Add room
                </button>
              </div>
            )}
          </div>

          {selectedCampus && (
            <div className="campus-rooms__summary" aria-label={`${selectedCampus.name} summary`}>
              <div>
                <span>Rooms</span>
                <strong>{roomsAtSelectedCampus.length}</strong>
              </div>
              <div>
                <span>Total capacity</span>
                <strong>{selectedCampusCapacity}</strong>
              </div>
              <div>
                <span>Scheduled classes</span>
                <strong>{selectedCampusClassCount}</strong>
              </div>
            </div>
          )}

          {selectedCampus && roomsAtSelectedCampus.length > 0 && (
            <div className="campus-rooms__toolbar">
              <div className="campus-rooms__search" role="search" aria-label="Filter rooms">
                <SearchField
                  label="Search rooms"
                  value={roomQuery}
                  placeholder="Code, name, capacity or class"
                  onChange={setRoomQuery}
                />
              </div>
              <div className="campus-rooms__result-count" aria-live="polite">
                {roomQuery.trim()
                  ? `${filteredRooms.length} of ${roomsAtSelectedCampus.length} rooms`
                  : `${roomsAtSelectedCampus.length} room${roomsAtSelectedCampus.length === 1 ? '' : 's'}`}
              </div>
            </div>
          )}

          {!selectedCampus && !loading && (
            <div className="empty campus-rooms__state">
              <div className="empty__title">Select a campus</div>
              <div className="empty__hint">Its room inventory and scheduled classes will appear here.</div>
            </div>
          )}

          {selectedCampus && roomsAtSelectedCampus.length === 0 && (
            <div className="empty campus-rooms__state">
              <div className="empty__title">No rooms at {selectedCampus.name}</div>
              <div className="empty__hint">Add a room to make this campus available when scheduling sessions.</div>
              <button type="button" className="btn btn--primary btn--with-icon" onClick={() => setCreatingRoom(true)}>
                <IconPlus /> Add room
              </button>
            </div>
          )}

          {selectedCampus && roomsAtSelectedCampus.length > 0 && filteredRooms.length === 0 && (
            <div className="empty campus-rooms__state">
              <div className="empty__title">No room matches “{roomQuery.trim()}”</div>
              <div className="empty__hint">Search by room code, name, capacity or class.</div>
              <button type="button" className="btn btn--sm" onClick={() => setRoomQuery('')}>
                Clear search
              </button>
            </div>
          )}

          {filteredRooms.length > 0 && (
            <>
              <div className="campus-rooms__table-wrap">
                <table className="table table--compact campus-rooms__table">
                  <SortableHeader
                    columns={[
                      { key: 'room', label: 'Room', priority: true },
                      { key: 'capacity', label: 'Capacity' },
                      { key: 'classes', label: 'Scheduled classes' }
                    ]}
                    sort={roomSort}
                    onSort={handleRoomSort}
                  />
                  <tbody>
                    {pagedRooms.rows.map((room) => {
                      const roomClasses = classesAtRoom(room.id);
                      return (
                        <tr key={room.id}>
                          <td>
                            <div className="campus-room__identity">
                              <span className="campus-room__code mono">{room.code}</span>
                              <span className="cell-sub">{room.name}</span>
                            </div>
                          </td>
                          <td>
                            <span className="campus-room__capacity mono">{room.capacity}</span>
                            <span className="cell-sub"> seats</span>
                          </td>
                          <td>
                            {roomClasses.length > 0 ? (
                              <button
                                type="button"
                                className="btn btn--quiet btn--sm campus-room__classes"
                                onClick={() => setViewingClassesForRoom(room)}
                              >
                                {roomClasses.length} class{roomClasses.length === 1 ? '' : 'es'}
                                <IconChevronRight />
                              </button>
                            ) : (
                              <span className="cell-sub">Not scheduled</span>
                            )}
                          </td>
                          <td className="table__action-cell">
                            <span className="table__action-group">
                              <button type="button" className="btn btn--quiet btn--sm" onClick={() => setEditingRoom(room)}>
                                Edit
                              </button>
                              <button type="button" className="btn btn--quiet btn--sm" onClick={() => setDeletingRoom(room)}>
                                Delete
                              </button>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pager
                label={pagedRooms.label}
                page={pagedRooms.page}
                pageCount={pagedRooms.pageCount}
                canPrev={pagedRooms.canPrev}
                canNext={pagedRooms.canNext}
                onPrev={pagedRooms.prev}
                onNext={pagedRooms.next}
                onGoToPage={pagedRooms.goToPage}
              />
            </>
          )}
        </section>
      </div>

      {creatingCampus && (
        <CreateCampusModal
          saving={saving}
          onCreate={handleCreateCampus}
          onClose={() => setCreatingCampus(false)}
        />
      )}

      {editingCampus && (
        <CreateCampusModal
          saving={saving}
          onCreate={handleCreateCampus}
          onUpdate={handleUpdateCampus}
          editingCampus={editingCampus}
          onClose={() => setEditingCampus(null)}
        />
      )}

      {creatingRoom && selectedCampus && (
        <CreateRoomModal
          campusName={selectedCampus.name}
          campusId={selectedCampus.id}
          saving={saving}
          onCreate={handleCreateRoom}
          onClose={() => setCreatingRoom(false)}
        />
      )}

      {editingRoom && (
        <CreateRoomModal
          campusName={editingRoom.campusName}
          campusId={editingRoom.campusId}
          campuses={campuses}
          saving={saving}
          onCreate={handleCreateRoom}
          onUpdate={handleUpdateRoom}
          editingRoom={editingRoom}
          onClose={() => setEditingRoom(null)}
        />
      )}

      {deletingCampus && (
        <Modal
          size="confirm"
          role="alertdialog"
          titleId="delete-campus-title"
          title="Delete this campus?"
          subtitle={
            deletingCampus.roomCount > 0
              ? `${deletingCampus.name} still has ${deletingCampus.roomCount} room${deletingCampus.roomCount === 1 ? '' : 's'} — remove them first.`
              : `${deletingCampus.name} has no rooms and can be safely removed.`
          }
          onClose={() => setDeletingCampus(null)}
          footer={
            <>
              <button type="button" className="btn" disabled={saving} onClick={() => setDeletingCampus(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--danger"
                disabled={saving || deletingCampus.roomCount > 0}
                onClick={() => void handleDeleteCampus()}
              >
                {saving ? 'Deleting…' : 'Delete campus'}
              </button>
            </>
          }
        />
      )}

      {viewingClassesForRoom && (
        <Modal
          size="narrow"
          titleId="room-classes-title"
          title={`Classes at ${viewingClassesForRoom.code}`}
          compactTitle
          subtitle={`${viewingClassesForRoom.campusName} · different classes can share this room at different times.`}
          onClose={() => setViewingClassesForRoom(null)}
          footer={
            <button type="button" className="btn" onClick={() => setViewingClassesForRoom(null)}>
              Close
            </button>
          }
        >
          <div>
            {classesForViewedRoom.map((entry) => (
              <div key={entry.courseOfferingId} className="kv">
                <div>
                  <div className="cell-strong cell-strong--compact">{entry.course}</div>
                  <div className="cell-sub">
                    {entry.offeringCode ?? entry.course} · {entry.sessionCount} session
                    {entry.sessionCount === 1 ? '' : 's'} here
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => {
                    c.setClassFocusId(entry.courseOfferingId);
                    c.setPage('classes');
                  }}
                >
                  View class
                </button>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {deletingRoom && (
        <Modal
          size="confirm"
          role="alertdialog"
          titleId="delete-room-title"
          title="Delete this room?"
          subtitle={`${deletingRoom.code} at ${deletingRoom.campusName} will be removed. Past sessions that used it keep their own record of it.`}
          onClose={() => setDeletingRoom(null)}
          footer={
            <>
              <button type="button" className="btn" disabled={saving} onClick={() => setDeletingRoom(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn--danger" disabled={saving} onClick={() => void handleDeleteRoom()}>
                {saving ? 'Deleting…' : 'Delete room'}
              </button>
            </>
          }
        />
      )}
    </div>
  );
}
