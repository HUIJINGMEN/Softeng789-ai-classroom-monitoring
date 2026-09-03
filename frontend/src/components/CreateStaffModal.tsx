import { type FormEvent, useMemo, useState } from 'react';
import Modal from './Modal';
import SelectMenu from './SelectMenu';

const ROLE_OPTIONS = [
  { value: 'teacher' as const, label: 'Teacher' },
  { value: 'admin' as const, label: 'Admin' }
];

interface Props {
  readonly saving: boolean;
  readonly onCreate: (payload: {
    staffNumber: string;
    email: string;
    name: string;
    role: 'teacher' | 'admin';
  }) => Promise<boolean>;
  readonly onClose: () => void;
}

export default function CreateStaffModal({ saving, onCreate, onClose }: Props) {
  const [staffNumber, setStaffNumber] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'teacher' | 'admin'>('teacher');
  const [error, setError] = useState('');

  const valid = useMemo(
    () => Boolean(staffNumber.trim() && email.trim() && name.trim()),
    [staffNumber, email, name]
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!staffNumber.trim() || !email.trim() || !name.trim()) {
      setError('Fill in every field.');
      return;
    }
    const created = await onCreate({
      staffNumber: staffNumber.trim(),
      email: email.trim(),
      name: name.trim(),
      role
    });
    if (created) onClose();
  };

  return (
    <Modal
      onClose={onClose}
      size="narrow"
      titleId="create-staff-title"
      title="Add a teacher or admin"
      compactTitle
      subtitle="Creates a placeholder account — the invited person sets their own password by registering with this exact staff ID and email."
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving || !valid}>
            {saving ? 'Adding…' : 'Add staff member'}
          </button>
        </>
      }
    >
      <div className="modal-form__grid">
        <label className="field field--wide">
          Full name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Dr. Dana Kessler"
            autoFocus
          />
        </label>
        <label className="field">
          Staff ID
          <input
            value={staffNumber}
            onChange={(event) => setStaffNumber(event.target.value)}
            placeholder="STAFF-0142"
          />
        </label>
        <label className="field">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="dana.kessler@auckland.ac.nz"
          />
        </label>
        <label className="field">
          Role
          <SelectMenu value={role} options={ROLE_OPTIONS} onChange={setRole} ariaLabel="Staff role" />
        </label>

        {error && <div className="form-error field--wide">{error}</div>}
      </div>
    </Modal>
  );
}
