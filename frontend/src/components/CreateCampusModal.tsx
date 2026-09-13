import { type FormEvent, useMemo, useState } from 'react';
import Modal from './Modal';
import type { CampusApiResponse } from '../lib/campusApi';

interface Props {
  readonly saving: boolean;
  readonly onCreate: (name: string) => Promise<boolean>;
  /** Present only when editing an existing campus — its id is passed back on submit. */
  readonly onUpdate?: (id: string, name: string) => Promise<boolean>;
  readonly editingCampus?: CampusApiResponse;
  readonly onClose: () => void;
}

export default function CreateCampusModal({ saving, onCreate, onUpdate, editingCampus, onClose }: Props) {
  const isEditing = Boolean(editingCampus);
  const [name, setName] = useState(editingCampus?.name ?? '');
  const [error, setError] = useState('');

  const valid = useMemo(() => Boolean(name.trim()), [name]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Enter a campus name.');
      return;
    }
    const succeeded =
      editingCampus && onUpdate ? await onUpdate(editingCampus.id, name.trim()) : await onCreate(name.trim());
    if (succeeded) onClose();
  };

  return (
    <Modal
      onClose={onClose}
      size="narrow"
      titleId="create-campus-title"
      title={isEditing ? 'Rename campus' : 'Add a campus'}
      compactTitle
      subtitle={
        isEditing ? undefined : 'Rooms are provisioned separately, once the campus exists.'
      }
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
                : 'Add campus'}
          </button>
        </>
      }
    >
      <div className="modal-form__grid">
        <label className="field field--wide">
          Campus name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="City"
            autoFocus
          />
        </label>

        {error && <div className="form-error field--wide">{error}</div>}
      </div>
    </Modal>
  );
}
