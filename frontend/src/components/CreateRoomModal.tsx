import { type FormEvent, useMemo, useState } from 'react';
import Modal from './Modal';
import SelectMenu from './SelectMenu';
import type { CampusApiResponse } from '../lib/campusApi';
import type { RoomApiResponse } from '../lib/roomApi';

interface RoomFormPayload {
  campusId: string;
  code: string;
  name: string;
  capacity: number;
}

interface Props {
  readonly campusName: string;
  readonly campusId: string;
  /** Every campus — only used to let an edit reassign the room, so create (which always targets
   *  whichever campus is currently selected on the page) doesn't need this at all. */
  readonly campuses?: readonly CampusApiResponse[];
  readonly saving: boolean;
  readonly onCreate: (payload: RoomFormPayload) => Promise<boolean>;
  /** Present only when editing an existing room — its id is passed back on submit. */
  readonly onUpdate?: (id: string, payload: RoomFormPayload) => Promise<boolean>;
  readonly editingRoom?: RoomApiResponse;
  readonly onClose: () => void;
}

export default function CreateRoomModal({
  campusName,
  campusId,
  campuses,
  saving,
  onCreate,
  onUpdate,
  editingRoom,
  onClose
}: Props) {
  const isEditing = Boolean(editingRoom);
  const [targetCampusId, setTargetCampusId] = useState(editingRoom?.campusId ?? campusId);
  const [code, setCode] = useState(editingRoom?.code ?? '');
  const [name, setName] = useState(editingRoom?.name ?? '');
  const [capacity, setCapacity] = useState(String(editingRoom?.capacity ?? 30));
  const [error, setError] = useState('');

  const campusOptions = useMemo(
    () => (campuses ?? []).map((campus) => ({ value: campus.id, label: campus.name })),
    [campuses]
  );

  const parsedCapacity = Number(capacity);
  const valid = useMemo(() => {
    return Boolean(
      code.trim() &&
      name.trim() &&
      capacity.trim() &&
      Number.isInteger(parsedCapacity) &&
      parsedCapacity >= 0
    );
  }, [code, name, capacity, parsedCapacity]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!code.trim()) {
      setError('Enter a room code.');
      return;
    }
    if (!name.trim()) {
      setError('Enter a room name.');
      return;
    }
    if (!capacity.trim() || !Number.isInteger(parsedCapacity) || parsedCapacity < 0) {
      setError('Capacity must be a whole number of zero or more.');
      return;
    }
    const payload: RoomFormPayload = {
      campusId: isEditing ? targetCampusId : campusId,
      code: code.trim(),
      name: name.trim(),
      capacity: parsedCapacity
    };
    const succeeded =
      editingRoom && onUpdate ? await onUpdate(editingRoom.id, payload) : await onCreate(payload);
    if (succeeded) onClose();
  };

  return (
    <Modal
      onClose={onClose}
      size="narrow"
      titleId="create-room-title"
      title={isEditing ? 'Edit room' : `Add a room at ${campusName}`}
      compactTitle
      subtitle="The room code only needs to be unique within its own campus."
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving || !valid}>
            {isEditing
              ? saving
                ? 'Saving…'
                : 'Save changes'
              : saving
                ? 'Adding…'
                : 'Add room'}
          </button>
        </>
      }
    >
      <div className="modal-form__grid">
        {isEditing && campusOptions.length > 0 && (
          <label className="field field--wide">
            Campus
            <SelectMenu
              value={targetCampusId}
              options={campusOptions}
              onChange={setTargetCampusId}
              ariaLabel="Campus"
            />
          </label>
        )}
        <label className="field">
          Room code
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="405-460"
            autoFocus
          />
        </label>
        <label className="field">
          Capacity
          <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
          />
        </label>
        <label className="field field--wide">
          Room name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Engineering computer lab"
          />
        </label>

        {error && <div className="form-error field--wide">{error}</div>}
      </div>
    </Modal>
  );
}
