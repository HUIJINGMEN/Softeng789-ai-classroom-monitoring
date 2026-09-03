import { useEffect, useMemo, useState } from 'react';
import CreateStaffModal from '../components/CreateStaffModal';
import { IconUser } from '../components/icons';
import Pager from '../components/Pager';
import { apiMessage } from '../lib/apiClient';
import { createStaff, listStaff, updateStaffStatus } from '../lib/adminApi';
import { usePagination } from '../lib/table';
import type { Console } from '../hooks/useConsole';
import type { StaffMember } from '../types';

const PAGE_SIZE = 10;

interface Props {
  readonly console: Console;
  /** The signed-in admin's own staff id — their own row can't offer a Deactivate action, since
   *  that would let an admin lock themselves out with no one left able to reverse it. */
  readonly currentUserId: string;
}

export default function AdminStaff({ console: c, currentUserId }: Props) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

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

  const handleCreateStaff = async (payload: {
    staffNumber: string;
    email: string;
    name: string;
    role: 'teacher' | 'admin';
  }) => {
    setSaving(true);
    try {
      await createStaff(payload);
      refresh();
      return true;
    } catch (error) {
      c.showToast(`Staff account was not created: ${apiMessage(error)}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (member: StaffMember) => {
    setUpdatingId(member.id);
    try {
      await updateStaffStatus(member.id, member.status === 'active' ? 'deactivated' : 'active');
      refresh();
    } catch (error) {
      c.showToast(apiMessage(error));
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredStaff = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return staff;
    return staff.filter(
      (member) =>
        member.name.toLowerCase().includes(trimmed) ||
        member.staffNumber.toLowerCase().includes(trimmed) ||
        member.email.toLowerCase().includes(trimmed)
    );
  }, [staff, query]);

  const paged = usePagination(filteredStaff, page, setPage, PAGE_SIZE);

  return (
    <div className="page__inner">
      <section className="card card--min-list dashboard-enter stagger-1">
        <div className="card__head">
          <div className="card__title-row">
            <span className="icon-inline icon-inline--title" aria-hidden="true">
              <IconUser />
            </span>
            <div>
              <div className="card__title">Teachers &amp; admins</div>
              <div className="card__sub">{staff.length} account{staff.length === 1 ? '' : 's'}</div>
            </div>
          </div>
          <div className="card__actions">
            <button type="button" className="btn btn--primary" onClick={() => setCreatingStaff(true)}>
              + Create staff
            </button>
          </div>
        </div>

        <label className="field">
          Search
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Name, staff ID or email"
          />
        </label>

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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map((member) => {
              const isSelf = member.id === currentUserId;
              return (
                <tr key={member.id}>
                  <td className="cell-strong">{member.name}</td>
                  <td className="mono">{member.staffNumber}</td>
                  <td>{member.email}</td>
                  <td>
                    <span className="tag">{member.role === 'admin' ? 'Admin' : 'Teacher'}</span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        member.status === 'deactivated'
                          ? 'badge--neutral'
                          : member.passwordSet
                            ? 'badge--present'
                            : 'badge--pending-review'
                      }`}
                    >
                      {member.status === 'deactivated'
                        ? 'Deactivated'
                        : member.passwordSet
                          ? 'Active'
                          : 'Awaiting activation'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn--sm"
                      disabled={isSelf || updatingId === member.id}
                      title={isSelf ? "You can't deactivate your own account." : undefined}
                      onClick={() => toggleStatus(member)}
                    >
                      {member.status === 'active' ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!loading && filteredStaff.length === 0 && !listError && (
          <div className="empty">{staff.length === 0 ? 'No staff accounts yet.' : 'No staff match your search.'}</div>
        )}

        <Pager
          label={paged.label}
          pageLabel={paged.pageLabel}
          canPrev={paged.canPrev}
          canNext={paged.canNext}
          onPrev={paged.prev}
          onNext={paged.next}
        />
      </section>

      {creatingStaff && (
        <CreateStaffModal saving={saving} onCreate={handleCreateStaff} onClose={() => setCreatingStaff(false)} />
      )}
    </div>
  );
}
