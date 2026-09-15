import { useEffect, useMemo, useState } from 'react';
import CreateStaffModal from '../components/CreateStaffModal';
import DirectoryState from '../components/DirectoryState';
import { IconPlus, IconSearch, IconUser } from '../components/icons';
import Pager from '../components/Pager';
import PersonAvatar from '../components/PersonAvatar';
import SearchField from '../components/SearchField';
import SelectMenu from '../components/SelectMenu';
import SortableHeader from '../components/SortableHeader';
import { apiMessage } from '../lib/apiClient';
import { createStaff, listStaff, updateStaffStatus } from '../lib/adminApi';
import { avatarTone } from '../lib/format';
import { sortRows, usePagination, useSort } from '../lib/table';
import type { Console } from '../hooks/useConsole';
import type { StaffMember } from '../types';

const PAGE_SIZE = 10;
type StaffSortKey = 'name' | 'email' | 'role' | 'status';
const ALL_ROLES = 'all';
const ALL_STATUSES = 'all';

function accountState(member: StaffMember) {
  if (member.status === 'deactivated') return 'deactivated';
  return member.passwordSet ? 'active' : 'awaiting';
}

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
  const [roleFilter, setRoleFilter] = useState(ALL_ROLES);
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [page, setPage] = useState(0);
  const { sort, toggle } = useSort<StaffSortKey>('name');

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
    return staff.filter((member) => {
      if (roleFilter !== ALL_ROLES && member.role !== roleFilter) return false;
      if (statusFilter !== ALL_STATUSES && accountState(member) !== statusFilter) return false;
      if (!trimmed) return true;
      return (
        member.name.toLowerCase().includes(trimmed) ||
        member.staffNumber.toLowerCase().includes(trimmed) ||
        member.email.toLowerCase().includes(trimmed)
      );
    });
  }, [query, roleFilter, staff, statusFilter]);

  const sortedStaff = useMemo(
    () =>
      sortRows(filteredStaff, sort, (member, key) => {
        if (key === 'status') {
          const state = accountState(member);
          if (state === 'active') return 0;
          if (state === 'awaiting') return 1;
          return 2;
        }
        return member[key];
      }),
    [filteredStaff, sort]
  );

  const paged = usePagination(sortedStaff, page, setPage, PAGE_SIZE);

  return (
    <div className="page__inner">
      <section className="card staff-directory dashboard-enter stagger-1">
        <div className="card__head">
          <div className="card__title-row">
            <span className="icon-inline icon-inline--title" aria-hidden="true">
              <IconUser />
            </span>
            <div>
              <div className="card__title">Teachers &amp; admins</div>
              <div className="card__sub">Manage staff access, roles and activation status.</div>
            </div>
          </div>
          <div className="card__actions">
            <span className="directory-count" aria-live="polite">
              {filteredStaff.length} of {staff.length} accounts
            </span>
            <button type="button" className="btn btn--primary btn--with-icon" onClick={() => setCreatingStaff(true)}>
              <IconPlus /> Create staff
            </button>
          </div>
        </div>

        <div className="list-toolbar staff-directory__toolbar" role="search" aria-label="Filter staff">
          <SearchField
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(0);
            }}
            placeholder="Name, staff ID or email"
          />
          <div className="field">
            <span>Role</span>
            <SelectMenu
              value={roleFilter}
              options={[
                { value: ALL_ROLES, label: 'All roles' },
                { value: 'teacher', label: 'Teachers' },
                { value: 'admin', label: 'Admins' }
              ]}
              ariaLabel="Filter staff by role"
              onChange={(value) => {
                setRoleFilter(value);
                setPage(0);
              }}
            />
          </div>
          <div className="field">
            <span>Status</span>
            <SelectMenu
              value={statusFilter}
              options={[
                { value: ALL_STATUSES, label: 'All statuses' },
                { value: 'active', label: 'Active' },
                { value: 'awaiting', label: 'Awaiting activation' },
                { value: 'deactivated', label: 'Deactivated' }
              ]}
              ariaLabel="Filter staff by status"
              onChange={(value) => {
                setStatusFilter(value);
                setPage(0);
              }}
            />
          </div>
        </div>

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

        {(loading || paged.rows.length > 0) && <div className="staff-directory__table-wrap" tabIndex={0} role="region" aria-label="Staff accounts table">
          <table className="table table--compact staff-directory__table">
            <SortableHeader
              columns={[
                { key: 'name', label: 'Staff member' },
                { key: 'email', label: 'Email' },
                { key: 'role', label: 'Role' },
                { key: 'status', label: 'Status', priority: true }
              ]}
              sort={sort}
              onSort={(key) => {
                toggle(key);
                setPage(0);
              }}
            />
            <tbody>
            {paged.rows.map((member, index) => {
              const isSelf = member.id === currentUserId;
              const state = accountState(member);
              return (
                <tr key={member.id} className={isSelf ? 'staff-directory__row--self' : undefined}>
                  <td>
                    <div className="person">
                      <PersonAvatar name={member.name} tone={avatarTone(member.id, index)} alt="" />
                      <div>
                        <div className="cell-strong">{member.name}</div>
                        <div className="cell-sub mono">{member.staffNumber}</div>
                      </div>
                    </div>
                  </td>
                  <td>{member.email}</td>
                  <td>
                    <span className={member.role === 'admin' ? 'tag staff-directory__role--admin' : 'tag'}>
                      {member.role === 'admin' ? 'Admin' : 'Teacher'}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        state === 'deactivated'
                          ? 'badge--neutral'
                          : state === 'active'
                            ? 'badge--present'
                            : 'badge--pending-review'
                      }`}
                    >
                      {state === 'deactivated'
                        ? 'Deactivated'
                        : state === 'active'
                          ? 'Active'
                          : 'Awaiting activation'}
                    </span>
                  </td>
                  <td className="table__action-cell">
                    {isSelf ? (
                      <span className="staff-directory__self">Current account</span>
                    ) : (
                      <button
                        type="button"
                        className={state === 'deactivated' ? 'btn btn--sm btn--primary' : 'btn btn--sm'}
                        disabled={updatingId === member.id}
                        onClick={() => toggleStatus(member)}
                      >
                        {updatingId === member.id
                          ? 'Updating…'
                          : state === 'deactivated'
                            ? 'Reactivate'
                            : 'Deactivate'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {loading && staff.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <output className="empty empty--inline">Loading staff…</output>
                </td>
              </tr>
            )}
            </tbody>
          </table>
        </div>}

        {!loading && filteredStaff.length === 0 && !listError && (
          <DirectoryState
            icon={staff.length === 0 ? <IconUser /> : <IconSearch />}
            title={staff.length === 0 ? 'No staff accounts yet' : 'No matching accounts'}
            description={staff.length === 0 ? 'Create the first staff account to get started.' : 'Adjust the search, role or status filters and try again.'}
            action={
              staff.length === 0 ? (
                <button type="button" className="btn btn--primary btn--with-icon" onClick={() => setCreatingStaff(true)}>
                  <IconPlus /> Create staff
                </button>
              ) : (
                <button type="button" className="btn btn--sm" onClick={() => { setQuery(''); setRoleFilter(ALL_ROLES); setStatusFilter(ALL_STATUSES); }}>
                  Clear filters
                </button>
              )
            }
          />
        )}

        {sortedStaff.length > 0 && (
          <Pager
            label={paged.label}
            page={paged.page}
            pageCount={paged.pageCount}
            canPrev={paged.canPrev}
            canNext={paged.canNext}
            onPrev={paged.prev}
            onNext={paged.next}
            onGoToPage={paged.goToPage}
          />
        )}
      </section>

      {creatingStaff && (
        <CreateStaffModal saving={saving} onCreate={handleCreateStaff} onClose={() => setCreatingStaff(false)} />
      )}
    </div>
  );
}
