import CreateCampusModal from '../../components/CreateCampusModal';
import CreateRoomModal from '../../components/CreateRoomModal';
import CourseTile from '../../components/CourseTile';
import Modal from '../../components/Modal';
import Pager from '../../components/Pager';
import SearchField from '../../components/SearchField';
import { IconChevronRight } from '../../components/icons';
import { campusDeletionSubtitle, roomClassOfferingLabel } from './campusModel';
import type { CampusManagement } from './useCampusManagement';

interface Props {
  readonly workspace: CampusManagement;
}

export default function CampusManagementDialogs({ workspace: w }: Props) {
  return (
    <>
      {w.creatingCampus && (
        <CreateCampusModal
          saving={w.saving}
          onCreate={w.handleCreateCampus}
          onClose={() => w.setCreatingCampus(false)}
        />
      )}

      {w.editingCampus && (
        <CreateCampusModal
          saving={w.saving}
          onCreate={w.handleCreateCampus}
          onUpdate={w.handleUpdateCampus}
          editingCampus={w.editingCampus}
          onClose={() => w.setEditingCampus(null)}
        />
      )}

      {w.creatingRoom && w.selectedCampus && (
        <CreateRoomModal
          campusName={w.selectedCampus.name}
          campusId={w.selectedCampus.id}
          saving={w.saving}
          onCreate={w.handleCreateRoom}
          onClose={() => w.setCreatingRoom(false)}
        />
      )}

      {w.editingRoom && (
        <CreateRoomModal
          campusName={w.editingRoom.campusName}
          campusId={w.editingRoom.campusId}
          campuses={w.campuses}
          saving={w.saving}
          onCreate={w.handleCreateRoom}
          onUpdate={w.handleUpdateRoom}
          editingRoom={w.editingRoom}
          onClose={() => w.setEditingRoom(null)}
        />
      )}

      {w.viewingClassesForRoom && (
        <Modal
          size="confirm"
          className="room-classes-modal"
          titleId="room-classes-title"
          title={
            <>
              <span className="room-classes-modal__total">{w.classesForViewedRoom.length}</span>{' '}
              {w.classesForViewedRoom.length === 1 ? 'class' : 'classes'} in{' '}
              {w.viewingClassesForRoom.code}
            </>
          }
          closeButton
          compactTitle
          subtitle={`${w.viewingClassesForRoom.campusName} campus · Select a class to open its details.`}
          onClose={() => w.setViewingClassesForRoom(null)}
          footer={
            <button type="button" className="btn" onClick={() => w.setViewingClassesForRoom(null)}>
              Close
            </button>
          }
        >
          <div className="room-classes-modal__body">
            {w.classesForViewedRoom.length > 5 && (
              <div className="campus-room-classes__search" role="search">
                <SearchField
                  label="Search these classes"
                  value={w.roomClassQuery}
                  placeholder="Course or offering code"
                  onChange={w.setRoomClassQuery}
                  autoFocus
                />
              </div>
            )}

            {w.filteredClassesForViewedRoom.length > 0 ? (
              <div className="campus-room-classes__list">
                {w.pagedRoomClasses.rows.map((entry) => (
                  <button
                    key={entry.courseOfferingId}
                    type="button"
                    className="campus-room-class"
                    aria-label={`Open ${entry.course}, ${entry.offeringCode ?? entry.course}`}
                    onClick={() => w.openClass(entry)}
                  >
                    <span className="campus-room-class__main">
                      <CourseTile courseCode={entry.course} />
                      <span className="campus-room-class__identity">
                        <strong>{entry.course}</strong>
                        <span>{roomClassOfferingLabel(entry)}</span>
                      </span>
                    </span>
                    <span className="campus-room-class__usage">
                      {entry.sessionCount} session{entry.sessionCount === 1 ? '' : 's'} here
                    </span>
                    <span className="campus-room-class__arrow" aria-hidden="true">
                      <IconChevronRight />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="campus-room-classes__empty">
                <span>No class matches “{w.roomClassQuery.trim()}”.</span>
                <button
                  type="button"
                  className="btn btn--quiet btn--sm"
                  onClick={() => w.setRoomClassQuery('')}
                >
                  Clear search
                </button>
              </div>
            )}

            {w.filteredClassesForViewedRoom.length > 5 && (
              <Pager
                label={w.pagedRoomClasses.label}
                page={w.pagedRoomClasses.page}
                pageCount={w.pagedRoomClasses.pageCount}
                canPrev={w.pagedRoomClasses.canPrev}
                canNext={w.pagedRoomClasses.canNext}
                onPrev={w.pagedRoomClasses.prev}
                onNext={w.pagedRoomClasses.next}
                onGoToPage={w.pagedRoomClasses.goToPage}
              />
            )}
          </div>
        </Modal>
      )}

      {w.deletingCampus && (
        <Modal
          size="confirm"
          role="alertdialog"
          titleId="delete-campus-title"
          title="Delete this campus?"
          subtitle={campusDeletionSubtitle(w.deletingCampus)}
          onClose={() => w.setDeletingCampus(null)}
          footer={
            <>
              <button
                type="button"
                className="btn"
                disabled={w.saving}
                onClick={() => w.setDeletingCampus(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--danger"
                disabled={w.saving || w.deletingCampus.roomCount > 0}
                onClick={() => void w.handleDeleteCampus()}
              >
                {w.saving ? 'Deleting…' : 'Delete campus'}
              </button>
            </>
          }
        />
      )}

      {w.deletingRoom && (
        <Modal
          size="confirm"
          role="alertdialog"
          titleId="delete-room-title"
          title="Delete this room?"
          subtitle={`${w.deletingRoom.code} at ${w.deletingRoom.campusName} will be removed. Past sessions that used it keep their own record of it.`}
          onClose={() => w.setDeletingRoom(null)}
          footer={
            <>
              <button
                type="button"
                className="btn"
                disabled={w.saving}
                onClick={() => w.setDeletingRoom(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--danger"
                disabled={w.saving}
                onClick={() => void w.handleDeleteRoom()}
              >
                {w.saving ? 'Deleting…' : 'Delete room'}
              </button>
            </>
          }
        />
      )}
    </>
  );
}
