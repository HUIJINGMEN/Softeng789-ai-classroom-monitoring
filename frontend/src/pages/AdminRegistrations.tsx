import { useCallback, useEffect, useMemo, useState } from 'react';
import { IconUserPlus } from '../components/icons';
import Modal from '../components/Modal';
import Pager from '../components/Pager';
import PersonAvatar from '../components/PersonAvatar';
import SearchField from '../components/SearchField';
import SelectMenu from '../components/SelectMenu';
import SortableHeader from '../components/SortableHeader';
import { apiMessage } from '../lib/apiClient';
import { avatarTone, faceEnrollmentLabel, formatDateTime, statusClass } from '../lib/format';
import { approveStudent, listPendingStudents, rejectStudent, type PendingStudentApiResponse } from '../lib/studentApi';
import { sortRows, usePagination, useSort } from '../lib/table';

const PAGE_SIZE = 8;
const ALL_STATES = 'All states';
const READY = 'Ready to approve';
const NEEDS_ATTENTION = 'Needs attention';

type RegistrationSortKey = 'student' | 'classes' | 'face' | 'consent' | 'submitted';
type RegistrationAction = 'approve' | 'reject';

function isReadyToApprove(student: PendingStudentApiResponse): boolean {
  return student.faceEnrollmentStatus === 'PHOTO_CAPTURED' && student.consentGiven;
}

export default function AdminRegistrations() {
  const [pending, setPending] = useState<PendingStudentApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [busy, setBusy] = useState<{ id: string; action: RegistrationAction } | null>(null);
  const [actionError, setActionError] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [reviewState, setReviewState] = useState(ALL_STATES);
  const [page, setPage] = useState(0);
  const { sort, toggle } = useSort<RegistrationSortKey>('submitted', -1);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listPendingStudents();
      setPending(result);
      setListError('');
    } catch (error) {
      setListError(apiMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const approve = async (id: string) => {
    setActionError('');
    setBusy({ id, action: 'approve' });
    try {
      await approveStudent(id);
      setPending((current) => current.filter((student) => student.id !== id));
    } catch (error) {
      setActionError(apiMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const reject = async (id: string) => {
    setActionError('');
    setBusy({ id, action: 'reject' });
    try {
      await rejectStudent(id);
      setPending((current) => current.filter((student) => student.id !== id));
      setConfirmingId(null);
    } catch (error) {
      setActionError(apiMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const readyCount = useMemo(() => pending.filter(isReadyToApprove).length, [pending]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return pending.filter((student) => {
      const ready = isReadyToApprove(student);
      if (reviewState === READY && !ready) return false;
      if (reviewState === NEEDS_ATTENTION && ready) return false;
      if (!normalized) return true;
      return [
        student.fullName,
        student.studentNumber,
        student.universityEmail,
        ...student.requestedClasses
      ].some((value) => value.toLowerCase().includes(normalized));
    });
  }, [pending, query, reviewState]);

  const sorted = useMemo(
    () =>
      sortRows(filtered, sort, (student, key) => {
        if (key === 'student') return student.fullName.toLowerCase();
        if (key === 'classes') return student.requestedClasses.join(' ').toLowerCase();
        if (key === 'face') {
          if (student.faceEnrollmentStatus === 'PHOTO_CAPTURED') return 0;
          return student.faceEnrollmentStatus === 'NOT_ENROLLED' ? 1 : 2;
        }
        if (key === 'consent') return student.consentGiven ? 0 : 1;
        return student.createdAt;
      }),
    [filtered, sort]
  );
  const paged = usePagination(sorted, page, setPage, PAGE_SIZE);
  const confirmingStudent = pending.find((student) => student.id === confirmingId) ?? null;

  return (
    <div className="page__inner registrations-page">
      <section className="card registrations-card dashboard-enter stagger-1">
        <div className="card__head">
          <div className="card__title-row">
            <span className="icon-inline icon-inline--title" aria-hidden="true">
              <IconUserPlus />
            </span>
            <div>
              <div className="card__title">Pending registrations</div>
              <div className="card__sub">
                Review identity enrolment and requested classes before activating a student account.
              </div>
            </div>
          </div>
          <div className="registration-review-counts" aria-label="Registration review status" aria-live="polite">
            <span><strong>{pending.length}</strong> waiting</span>
            <span><strong>{readyCount}</strong> ready</span>
          </div>
        </div>

        <div className="list-toolbar registrations-toolbar" role="search" aria-label="Filter registrations">
          <SearchField
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(0);
            }}
            placeholder="Search name, ID, email or course"
          />
          <div className="field">
            <span>Review status</span>
            <SelectMenu
              value={reviewState}
              options={[ALL_STATES, READY, NEEDS_ATTENTION].map((value) => ({ value, label: value }))}
              ariaLabel="Filter registrations by review status"
              onChange={(value) => {
                setReviewState(value);
                setPage(0);
              }}
            />
          </div>
        </div>

        {listError && (
          <div className="notice notice--warn" role="alert">
            <span className="notice__mark" aria-hidden="true" />
            <span>{listError}</span>
            <span className="spacer" />
            <button type="button" className="btn btn--sm" onClick={() => void refresh()}>Retry</button>
          </div>
        )}

        {actionError && (
          <div className="notice notice--warn" role="alert">
            <span className="notice__mark" aria-hidden="true" />
            <span>{actionError}</span>
          </div>
        )}

        <table className="table table--compact registrations-table">
          <SortableHeader
            columns={[
              { key: 'student', label: 'Student' },
              { key: 'classes', label: 'Requested classes' },
              { key: 'face', label: 'Face enrolment' },
              { key: 'consent', label: 'Consent' },
              { key: 'submitted', label: 'Submitted', priority: true }
            ]}
            sort={sort}
            onSort={(key) => {
              toggle(key);
              setPage(0);
            }}
          />
          <tbody>
            {paged.rows.map((student, index) => {
              const ready = isReadyToApprove(student);
              return (
                <tr key={student.id} aria-busy={busy?.id === student.id}>
                  <td>
                    <div className="person">
                      <PersonAvatar
                        name={student.fullName}
                        tone={avatarTone(student.id, index)}
                        alt={`${student.fullName} registration`}
                      />
                      <div>
                        <div className="cell-strong">{student.fullName}</div>
                        <div className="cell-sub">{student.studentNumber} · {student.universityEmail}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {student.requestedClasses.length > 0 ? (
                      <div className="registration-class-list">
                        {student.requestedClasses.map((className) => <span key={className}>{className}</span>)}
                      </div>
                    ) : (
                      <span className="cell-sub">No classes requested</span>
                    )}
                  </td>
                  <td>
                    <span className={statusClass(student.faceEnrollmentStatus)}>
                      {faceEnrollmentLabel(student.faceEnrollmentStatus)}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${student.consentGiven ? 'badge--present' : 'badge--absent'}`}>
                      {student.consentGiven ? 'Given' : 'Not given'}
                    </span>
                  </td>
                  <td>
                    <span className="registration-submitted">{formatDateTime(student.createdAt)}</span>
                  </td>
                  <td className="table__action-cell">
                    <span className="table__action-group registration-actions">
                      <button
                        type="button"
                        className="btn btn--quiet btn--sm"
                        disabled={busy?.id === student.id}
                        onClick={() => setConfirmingId(student.id)}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        title={ready ? 'Approve registration' : 'Face enrolment and consent are required before approval'}
                        disabled={busy?.id === student.id || !ready}
                        onClick={() => void approve(student.id)}
                      >
                        {busy?.id === student.id && busy.action === 'approve' ? 'Approving…' : 'Approve'}
                      </button>
                    </span>
                  </td>
                </tr>
              );
            })}
            {loading && pending.length === 0 && (
              <tr><td colSpan={6}><div className="empty empty--inline" role="status">Loading registrations…</div></td></tr>
            )}
          </tbody>
        </table>

        {!loading && filtered.length === 0 && !listError && (
          <div className="empty registrations-empty">
            {pending.length === 0
              ? 'No registrations are waiting for review.'
              : 'No registrations match the current search and review status.'}
          </div>
        )}

        {sorted.length > 0 && (
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

      {confirmingStudent && (
        <Modal
          onClose={() => {
            if (busy?.id !== confirmingStudent.id) setConfirmingId(null);
          }}
          size="confirm"
          role="alertdialog"
          titleId="reject-registration-title"
          title="Reject this registration?"
          subtitle={`${confirmingStudent.fullName} will need to submit a new registration before an account can be activated.`}
          footer={
            <>
              <button
                type="button"
                className="btn"
                disabled={busy?.id === confirmingStudent.id}
                onClick={() => setConfirmingId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--danger"
                disabled={busy?.id === confirmingStudent.id}
                onClick={() => void reject(confirmingStudent.id)}
              >
                {busy?.id === confirmingStudent.id && busy.action === 'reject' ? 'Rejecting…' : 'Reject registration'}
              </button>
            </>
          }
        />
      )}
    </div>
  );
}
