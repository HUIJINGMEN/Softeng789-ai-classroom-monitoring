import { type FormEvent, useEffect, useState } from 'react';
import SelectMenu from '../components/SelectMenu';
import { apiMessage } from '../lib/apiClient';
import { createStaff, listStaff } from '../lib/adminApi';
import type { StaffMember } from '../types';

const ROLE_OPTIONS = [
  { value: 'teacher' as const, label: 'Teacher' },
  { value: 'admin' as const, label: 'Admin' }
];

export default function AdminStaff() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [staffNumber, setStaffNumber] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'teacher' | 'admin'>('teacher');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = () => {
    setLoading(true);
    listStaff()
      .then((result) => {
        setStaff(result);
        setListError('');
      })
      .catch((error) => setListError(apiMessage(error)))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    if (!staffNumber.trim() || !email.trim() || !name.trim()) {
      setFormError('Fill in every field.');
      return;
    }
    setSaving(true);
    try {
      await createStaff({ staffNumber: staffNumber.trim(), email: email.trim(), name: name.trim(), role });
      setStaffNumber('');
      setEmail('');
      setName('');
      setRole('teacher');
      refresh();
    } catch (error) {
      setFormError(apiMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <section className="card">
        <div className="card__head">
          <div>
            <div className="card__title">Add a teacher or admin</div>
            <div className="card__sub">
              Creates a placeholder account — the invited person sets their own password by
              registering with this exact staff ID and email.
            </div>
          </div>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <div className="auth-form__grid">
            <label className="field field--wide">
              Full name
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Dr. Dana Kessler" />
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
          </div>

          {formError && <div className="form-error">{formError}</div>}

          <button type="submit" className="btn btn--primary auth-form__submit" disabled={saving}>
            {saving ? 'Adding…' : 'Add staff member'}
          </button>
        </form>
      </section>

      <section className="card dashboard-enter stagger-1">
        <div className="card__head">
          <div>
            <div className="card__title">Teachers &amp; admins</div>
            <div className="card__sub">{staff.length} account{staff.length === 1 ? '' : 's'}</div>
          </div>
        </div>

        {listError && (
          <div className="notice notice--warn">
            <span className="notice__mark" aria-hidden="true" />
            <span>{listError}</span>
          </div>
        )}

        <table className="table table--compact">
          <thead>
            <tr>
              <th>Name</th>
              <th>Staff ID</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => (
              <tr key={member.id}>
                <td className="cell-strong">{member.name}</td>
                <td className="mono">{member.staffNumber}</td>
                <td>{member.email}</td>
                <td>{member.role === 'admin' ? 'Admin' : 'Teacher'}</td>
                <td>{member.passwordSet ? 'Active' : 'Pending — not claimed yet'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && staff.length === 0 && !listError && <div className="empty">No staff accounts yet.</div>}
      </section>
    </div>
  );
}
