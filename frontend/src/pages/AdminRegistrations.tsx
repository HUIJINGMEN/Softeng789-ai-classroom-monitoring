import { useEffect, useState } from 'react';
import { IconUserPlus } from '../components/icons';
import { apiMessage } from '../lib/apiClient';
import { approveStudent, listPendingStudents, rejectStudent, type PendingStudentApiResponse } from '../lib/studentApi';
import { faceEnrollmentLabel, statusClass } from '../lib/format';
import { formatSessionDateLabel } from '../lib/sessionTime';

export default function AdminRegistrations() {
  const [pending, setPending] = useState<PendingStudentApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    listPendingStudents()
      .then((result) => {
        setPending(result);
        setListError('');
      })
      .catch((error) => setListError(apiMessage(error)))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const approve = async (id: string) => {
    setActionError('');
    setBusyId(id);
    try {
      await approveStudent(id);
      refresh();
    } catch (error) {
      setActionError(apiMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: string) => {
    setActionError('');
    setBusyId(id);
    try {
      await rejectStudent(id);
      refresh();
    } catch (error) {
      setActionError(apiMessage(error));
    } finally {
      setBusyId(null);
      setConfirmingId(null);
    }
  };

  return (
    <div className="page__inner">
      <section className="card card--min-list dashboard-enter stagger-1">
        <div className="card__head">
          <div className="card__title-row">
            <span className="icon-inline icon-inline--title" aria-hidden="true">
              <IconUserPlus />
            </span>
            <div>
              <div className="card__title">Pending registrations</div>
              <div className="card__sub">
                {pending.length} student{pending.length === 1 ? '' : 's'} waiting for review. Approving
                activates the account and enrols them in every class they requested.
              </div>
            </div>
          </div>
        </div>

        {listError && (
          <div className="notice notice--warn">
            <span className="notice__mark" aria-hidden="true" />
            <span>{listError}</span>
          </div>
        )}

        {actionError && (
          <div className="notice notice--warn">
            <span className="notice__mark" aria-hidden="true" />
            <span>{actionError}</span>
          </div>
        )}

        <table className="table table--compact">
          <thead>
            <tr>
              <th>Student</th>
              <th>Requested classes</th>
              <th>Face enrolment</th>
              <th>Consent</th>
              <th>Submitted</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pending.map((student) => (
              <tr key={student.id}>
                <td>
                  <div className="cell-strong">{student.fullName}</div>
                  <div className="cell-sub">
                    {student.studentNumber} · {student.universityEmail}
                  </div>
                </td>
                <td>{student.requestedClasses.join(', ') || '—'}</td>
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
                <td>{formatSessionDateLabel(student.createdAt.slice(0, 10))}</td>
                <td className="table__action-cell">
                  {confirmingId === student.id ? (
                    <span className="table__action-group">
                      <span className="cell-sub">Reject this registration?</span>
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        disabled={busyId === student.id}
                        onClick={() => reject(student.id)}
                      >
                        {busyId === student.id ? 'Rejecting…' : 'Confirm'}
                      </button>
                      <button
                        type="button"
                        className="btn btn--quiet btn--sm"
                        disabled={busyId === student.id}
                        onClick={() => setConfirmingId(null)}
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <span className="table__action-group">
                      <button
                        type="button"
                        className="btn btn--quiet btn--sm"
                        disabled={busyId === student.id}
                        onClick={() => setConfirmingId(student.id)}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        disabled={busyId === student.id}
                        onClick={() => approve(student.id)}
                      >
                        {busyId === student.id ? 'Approving…' : 'Approve'}
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && pending.length === 0 && !listError && (
          <div className="empty">No registrations waiting for review.</div>
        )}
      </section>
    </div>
  );
}
