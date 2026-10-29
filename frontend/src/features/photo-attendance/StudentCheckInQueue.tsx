import { useState } from 'react';
import { checkInLabel } from './checkInApi';
import { reviewRows, reviewSummary, type ReviewFilter } from './attendanceReviewModel';
import { useAttendanceReview } from './useAttendanceReview';
import './photoAttendance.css';

const PAGE_SIZE = 20;
const labels: Record<string, string> = { PENDING: 'Awaiting approval', UNKNOWN: 'Not recorded', PRESENT: 'Present', LATE: 'Late', ABSENT: 'Absent' };
const clock = (value: string) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function StudentCheckInQueue({ sessionId, onSaved, onCorrect }: {
  sessionId: string; onSaved: () => Promise<void> | void; onCorrect: (studentId: string) => void;
}) {
  const review = useAttendanceReview(sessionId, onSaved);
  const [filter, setFilter] = useState<ReviewFilter>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const data = review.workspace;
  const counts = data ? reviewSummary(data) : null;
  const rows = data ? reviewRows(data, filter, search) : [];
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const visibleIds = new Set(visible.flatMap(row => row.pending ? [row.pending.id] : []));
  const hiddenSelected = review.selected.filter(id => !visibleIds.has(id)).length;
  const tabs: { value: ReviewFilter; label: string; count: number }[] = counts ? [
    { value: 'ALL', label: 'All students', count: data!.attendance.length },
    { value: 'PENDING', label: labels.PENDING, count: counts.pending },
    { value: 'UNKNOWN', label: labels.UNKNOWN, count: counts.notRecorded },
    { value: 'PRESENT', label: labels.PRESENT, count: counts.present },
    { value: 'LATE', label: labels.LATE, count: counts.late },
    { value: 'ABSENT', label: labels.ABSENT, count: counts.absent },
  ] : [];
  return <section className="vision-panel vision-attendance-review" aria-label="Attendance review workspace">
    <div className="vision-review-heading">
      <div><h2>Attendance review</h2><span className="vision-review-muted" role="status">
        {review.updatedAt ? `Updated ${clock(new Date(review.updatedAt).toISOString())} · Auto-refresh 15s` : review.error ? 'Attendance unavailable' : 'Loading attendance…'}
      </span></div>
      <button type="button" className="btn" aria-label="Refresh attendance review" disabled={review.busy || review.loading} onClick={() => void review.refresh()}>
        {review.loading ? 'Refreshing…' : 'Refresh'}</button>
    </div>
    {review.error && <p role="alert">{review.error}</p>}{review.message && <p role="status">{review.message}</p>}
    {counts && <>
      <div className="vision-review-filters" role="group" aria-label="Attendance filter">
        {tabs.map(tab => <button type="button" key={tab.value} aria-pressed={filter === tab.value}
          onClick={() => { setFilter(tab.value); setPage(0); }}>
          {tab.label}<strong>{tab.count}</strong>
        </button>)}
      </div>
      <div className="vision-review-tools">
        <input className="vision-review-search" type="search" aria-label="Search review students" placeholder="Search name or student ID"
          value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
        <span className="vision-review-muted">Pending and unrecorded first · {rows.length} students</span>
      </div>
      <p className="vision-review-guidance" id={`participation-${sessionId}`}>Select only students whose participation you have checked. A face match does not verify liveness.</p>
      <div className="vision-batch-actions">
        <span role="status">{review.selected.length} selected{hiddenSelected > 0 ? ` (${hiddenSelected} outside this page/filter)` : ''}</span>
        {(['PRESENT', 'LATE', 'REJECTED'] as const).map(status => <button type="button" className="btn" key={status}
          disabled={review.busy || !review.selected.length} onClick={() => void review.decide(review.selected, status)}>
          {status === 'REJECTED' ? 'Reject selected' : status === 'LATE' ? 'Mark selected late' : 'Approve selected'}</button>)}
        {review.selected.length > 0 && <button type="button" className="btn" disabled={review.busy} onClick={() => review.setSelected([])}>Clear selection</button>}
      </div>
      <table className="vision-attendance-table" aria-label="Class attendance">
        <thead><tr><th scope="col">Select</th><th scope="col">Student</th><th scope="col">Status</th><th scope="col">Photo request</th><th scope="col">Actions</th></tr></thead>
        <tbody>{visible.map(row => {
          const pending = row.pending;
          const selected = !!pending && review.selected.includes(pending.id);
          return <tr key={row.studentId} className={[selected ? 'vision-review-selected' : '', pending ? 'vision-review-pending' : ''].filter(Boolean).join(' ')}>
            <td className="vision-review-select">{pending ? <input type="checkbox" disabled={review.busy} checked={selected}
              aria-label={`I checked ${row.studentName}'s participation`} aria-describedby={`participation-${sessionId}`}
              onChange={e => { const checked = e.target.checked; review.setSelected(current => checked ? [...current, pending.id] : current.filter(id => id !== pending.id)); }} />
              : <span className="vision-review-muted" aria-label="No request to select">—</span>}</td>
            <th scope="row" className="vision-review-student"><strong>{row.studentName}</strong><span className="vision-review-muted">{row.studentNumber}</span></th>
            <td className="vision-review-state"><span className={`vision-review-badge vision-review-badge--${row.state.toLowerCase()}`}>{labels[row.state] ?? row.state}</span></td>
            <td className="vision-review-time">{row.request ? <time dateTime={row.request.createdAt} title={`Submitted ${new Date(row.request.createdAt).toLocaleString()}${pending ? ` · Review by ${new Date(pending.expiresAt).toLocaleString()}` : ''}`}>{clock(row.request.createdAt)}</time> : '—'}</td>
            <td className="vision-review-actions">{pending && <>
              <button type="button" className="btn" aria-label={`Approve ${row.studentName} as present`} disabled={review.busy || !selected} onClick={() => void review.decide([pending.id], 'PRESENT')}>Approve</button>
              <button type="button" className="btn" aria-label={`Reject ${row.studentName}'s request`} disabled={review.busy || !selected} onClick={() => void review.decide([pending.id], 'REJECTED')}>Reject</button>
            </>}
              <button type="button" className="btn" aria-label={`Correct manually for ${row.studentName}`} disabled={review.busy} onClick={() => onCorrect(row.studentId)}>{row.status === 'UNKNOWN' ? 'Manual' : 'Correct'}</button>
            </td>
          </tr>;
        })}</tbody>
      </table>
      {!visible.length && <p>No students match this filter.</p>}
      <div className="vision-review-pagination">
        <span>{rows.length ? `${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, rows.length)} of ${rows.length} students` : '0 students'}</span>
        {pageCount > 1 && <div role="group" aria-label="Attendance pages">
          <button type="button" className="btn" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</button>
          <span>Page {currentPage + 1} of {pageCount}</span>
          <button type="button" className="btn" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>Next</button>
        </div>}
      </div>
      <details className="vision-review-details"><summary>Processing history (latest 100 changes)</summary>
        <p>History starts with this feature. Earlier changes are not reconstructed.</p>
        {!data?.history.length && <p>No recorded changes yet.</p>}
        <ol className="vision-history">{data?.history.map(row => <li key={row.id}>
          <strong>{row.studentName}</strong> · {row.action.replace(/_/g, ' ').toLowerCase()} · {row.previousStatus ?? '—'} → {row.resultingStatus}
          <p>{row.actorName} · {new Date(row.occurredAt).toLocaleString()}</p>
        </li>)}</ol>
      </details>
      <details className="vision-review-details"><summary>All check-in requests</summary><ul className="vision-roster">{data?.requests.map(row => <li key={row.id}>
        <div><strong>{row.studentName}</strong><p>{row.state === 'PENDING' && data.attendance.some(a => a.studentId === row.studentId && a.status !== 'UNKNOWN')
          ? 'Attendance is already recorded. This request cannot overwrite it; use manual correction.'
          : checkInLabel(row.state === 'PENDING' && new Date(row.expiresAt).getTime() <= Date.now() ? 'EXPIRED' : row.state)}</p>
          <p>{row.reviewedAt ? `Reviewed ${new Date(row.reviewedAt).toLocaleString()}` : `Submitted ${new Date(row.createdAt).toLocaleString()}`}</p></div>
      </li>)}</ul></details>
    </>}
  </section>;
}
