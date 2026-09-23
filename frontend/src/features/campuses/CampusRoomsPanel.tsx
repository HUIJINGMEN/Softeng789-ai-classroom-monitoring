import Pager from '../../components/Pager';
import SearchField from '../../components/SearchField';
import SortableHeader from '../../components/SortableHeader';
import { IconBuilding, IconChevronRight, IconPlus } from '../../components/icons';
import type { CampusManagement } from './useCampusManagement';

interface Props {
  readonly workspace: CampusManagement;
}

function roomResultLabel(filtered: number, total: number, hasQuery: boolean): string {
  if (hasQuery) return `${filtered} of ${total} rooms`;
  return `${total} room${total === 1 ? '' : 's'}`;
}

export default function CampusRoomsPanel({ workspace: w }: Props) {
  return (
    <section className="card campus-rooms dashboard-enter stagger-2">
      <div className="card__head campus-rooms__head">
        <div className="card__title-row campus-rooms__heading">
          {w.selectedCampus && (
            <span className="campus-rooms__building" aria-hidden="true">
              <IconBuilding />
            </span>
          )}
          <div>
            <div className="card__title">
              {w.selectedCampus ? w.selectedCampus.name : 'Campus rooms'}
            </div>
            <div className="card__sub">
              {w.selectedCampus
                ? 'Manage rooms and see which classes use them.'
                : 'Select a campus to see its rooms.'}
            </div>
          </div>
        </div>
        {w.selectedCampus && (
          <div className="card__actions campus-rooms__actions">
            <button
              type="button"
              className="btn btn--primary btn--with-icon"
              onClick={() => w.setCreatingRoom(true)}
            >
              <IconPlus /> Add room
            </button>
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => w.setEditingCampus(w.selectedCampus ?? null)}
            >
              Rename
            </button>
            <button
              type="button"
              className="btn btn--quiet campus-rooms__danger-action"
              onClick={() => w.setDeletingCampus(w.selectedCampus ?? null)}
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {w.selectedCampus && (
        <div className="campus-rooms__summary" aria-label={`${w.selectedCampus.name} summary`}>
          <div>
            <span>Rooms</span>
            <strong>{w.roomsAtSelectedCampus.length}</strong>
            <small>
              {w.roomsAtSelectedCampus.length === 1 ? 'teaching space' : 'teaching spaces'}
            </small>
          </div>
          <div>
            <span>Total capacity</span>
            <strong>{w.selectedCampusCapacity}</strong>
            <small>
              {w.roomsAtSelectedCampus.length > 0
                ? `${Math.round(w.selectedCampusCapacity / w.roomsAtSelectedCampus.length)} seats per room avg.`
                : 'No seats configured'}
            </small>
          </div>
          <div>
            <span>Scheduled classes</span>
            <strong>{w.selectedCampusClassCount}</strong>
            <small>
              {w.selectedCampusClassCount === 1
                ? 'class using this campus'
                : 'classes using this campus'}
            </small>
          </div>
        </div>
      )}

      {w.selectedCampus && w.roomsAtSelectedCampus.length > 0 && (
        <div className="campus-rooms__toolbar">
          <div className="campus-rooms__search" role="search" aria-label="Filter rooms">
            <SearchField
              label="Search rooms"
              value={w.roomQuery}
              placeholder="Code, name, capacity or class"
              onChange={w.setRoomQuery}
            />
          </div>
          <div className="campus-rooms__result-count" aria-live="polite">
            {roomResultLabel(
              w.filteredRooms.length,
              w.roomsAtSelectedCampus.length,
              Boolean(w.roomQuery.trim())
            )}
          </div>
        </div>
      )}

      {w.loading && !w.selectedCampus && (
        <output className="empty campus-rooms__state">
          <span className="empty__title">Loading campus workspace…</span>
        </output>
      )}

      {!w.selectedCampus && !w.loading && (
        <div className="empty campus-rooms__state">
          <div className="empty__title">Select a campus</div>
          <div className="empty__hint">
            Its room inventory and scheduled classes will appear here.
          </div>
        </div>
      )}

      {w.selectedCampus && w.roomsAtSelectedCampus.length === 0 && (
        <div className="empty campus-rooms__state">
          <div className="empty__title">No rooms at {w.selectedCampus.name}</div>
          <div className="empty__hint">
            Add a room to make this campus available when scheduling sessions.
          </div>
          <button
            type="button"
            className="btn btn--primary btn--with-icon"
            onClick={() => w.setCreatingRoom(true)}
          >
            <IconPlus /> Add room
          </button>
        </div>
      )}

      {w.selectedCampus &&
        w.roomsAtSelectedCampus.length > 0 &&
        w.filteredRooms.length === 0 && (
          <div className="empty campus-rooms__state">
            <div className="empty__title">No room matches “{w.roomQuery.trim()}”</div>
            <div className="empty__hint">Search by room code, name, capacity or class.</div>
            <button type="button" className="btn btn--sm" onClick={() => w.setRoomQuery('')}>
              Clear search
            </button>
          </div>
        )}

      {w.filteredRooms.length > 0 && (
        <>
          <div className="campus-rooms__table-wrap">
            <table className="table table--compact campus-rooms__table">
              <SortableHeader
                columns={[
                  { key: 'room', label: 'Room', priority: true },
                  { key: 'capacity', label: 'Capacity' },
                  { key: 'classes', label: 'Scheduled classes' }
                ]}
                sort={w.roomSort}
                onSort={w.handleRoomSort}
              />
              <tbody>
                {w.pagedRooms.rows.map((room) => {
                  const roomClasses = w.classesAtRoom(room.id);
                  return (
                    <tr
                      key={room.id}
                      className={`campus-room__row${roomClasses.length > 0 ? ' campus-room__row--clickable' : ''}`}
                      onClick={() => {
                        if (roomClasses.length > 0) w.openRoomClasses(room);
                      }}
                    >
                      <td data-label="">
                        <div className="campus-room__identity">
                          <span className="campus-room__code mono">{room.code}</span>
                          <span className="cell-sub">{room.name}</span>
                        </div>
                      </td>
                      <td data-label="Capacity">
                        <span className="campus-room__capacity mono">{room.capacity}</span>
                        <span className="cell-sub"> seats</span>
                      </td>
                      <td data-label="Scheduled classes">
                        {roomClasses.length > 0 ? (
                          <button
                            type="button"
                            className="btn btn--quiet btn--sm btn--with-icon campus-room__classes"
                            aria-label={`View classes using ${room.code}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              w.openRoomClasses(room);
                            }}
                          >
                            View {roomClasses.length} class{roomClasses.length === 1 ? '' : 'es'}
                            <IconChevronRight />
                          </button>
                        ) : (
                          <span className="cell-sub">Not scheduled</span>
                        )}
                      </td>
                      <td className="table__action-cell" data-label="">
                        <span className="table__action-group">
                          <button
                            type="button"
                            className="btn btn--quiet btn--sm"
                            aria-label={`Edit ${room.code}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              w.setEditingRoom(room);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn--quiet btn--sm campus-room__delete"
                            aria-label={`Delete ${room.code}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              w.setDeletingRoom(room);
                            }}
                          >
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
            label={w.pagedRooms.label}
            page={w.pagedRooms.page}
            pageCount={w.pagedRooms.pageCount}
            canPrev={w.pagedRooms.canPrev}
            canNext={w.pagedRooms.canNext}
            onPrev={w.pagedRooms.prev}
            onNext={w.pagedRooms.next}
            onGoToPage={w.pagedRooms.goToPage}
          />
        </>
      )}
    </section>
  );
}
