import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  confirmAccomplishment,
  listAccomplishmentsForClass,
  revokeAccomplishment
} from '../lib/accomplishmentApi';
import {
  accomplishmentCategoryLabel,
  accomplishmentStatusClass,
  accomplishmentStatusLabel,
  formatAccomplishmentPoints
} from '../lib/accomplishments';
import { apiMessage } from '../lib/apiClient';
import { studentDateLabel } from '../components/student/studentPortalMetrics';
import { usePagination } from '../lib/table';
import type { Accomplishment, Student } from '../types';
import type { Console } from '../hooks/useConsole';
import CreateAccomplishmentModal from './CreateAccomplishmentModal';
import ReviewAccomplishmentCorrectionModal from './ReviewAccomplishmentCorrectionModal';
import Pager from './Pager';
import SearchField from './SearchField';
import SelectMenu from './SelectMenu';
import { IconAward, IconPlus } from './icons';

interface Props {
  readonly courseOfferingId: string;
  readonly classLabel: string;
  readonly students: readonly Student[];
  readonly console: Console;
}

function matchesStatus(item: Accomplishment, status: string): boolean {
  if (status === 'CORRECTION_REQUESTED') return item.latestCorrection?.status === 'PENDING';
  if (status === 'ALL') return true;
  if (status === 'ACTIVE') return item.status !== 'REVOKED';
  return item.status === status;
}

export default function ClassAccomplishmentsTab({ courseOfferingId, classLabel, students, console: c }: Props) {
  const [items, setItems] = useState<Accomplishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<Accomplishment | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listAccomplishmentsForClass(courseOfferingId));
      setError('');
    } catch (caught) {
      setError(apiMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [courseOfferingId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items
      .filter((item) => {
        const statusMatches = matchesStatus(item, status);
        const queryMatches = !query
          || item.studentName.toLowerCase().includes(query)
          || item.studentNumber.toLowerCase().includes(query)
          || item.title.toLowerCase().includes(query);
        return statusMatches && queryMatches;
      })
      .sort((left, right) => {
        const leftPending = left.latestCorrection?.status === 'PENDING';
        const rightPending = right.latestCorrection?.status === 'PENDING';
        if (leftPending !== rightPending) return leftPending ? -1 : 1;
        return right.achievementDate.localeCompare(left.achievementDate);
      });
  }, [items, search, status]);
  const paged = usePagination(rows, page, setPage, 7);
  const draftCount = items.filter((item) => item.status === 'DRAFT').length;
  const sharedCount = items.filter((item) => item.status === 'CONFIRMED').length;
  const pendingCorrectionCount = items.filter((item) => item.latestCorrection?.status === 'PENDING').length;

  const runStatusAction = async (item: Accomplishment, action: 'confirm' | 'revoke') => {
    setBusyId(item.id);
    try {
      const updated = action === 'confirm'
        ? await confirmAccomplishment(item.id)
        : await revokeAccomplishment(item.id);
      setItems((current) => current.map((candidate) => candidate.id === updated.id ? updated : candidate));
      c.updateAccomplishment(updated);
      c.showToast(action === 'confirm' ? 'Achievement shared with the student.' : 'Achievement removed from the student view.');
    } catch (caught) {
      c.showToast(apiMessage(caught));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="card accomplishment-manager dashboard-enter stagger-2">
      <div className="card__head accomplishment-manager__head">
        <div className="accomplishment-manager__title">
          <span className="accomplishment-manager__icon"><IconAward /></span>
          <div>
            <div className="card__title">Achievements</div>
            <div className="card__sub">Recognise work students have already completed. This does not create or assign coursework.</div>
          </div>
        </div>
        <button type="button" className="btn btn--primary btn--with-icon" disabled={students.length === 0} onClick={() => setCreating(true)}>
          <IconPlus /> Add achievement
        </button>
      </div>

      <div className="accomplishment-manager__summary" aria-label="Achievement status summary">
        <div><strong>{sharedCount}</strong><span>Shared with students</span></div>
        <div><strong>{draftCount}</strong><span>Drafts</span></div>
        <button
          type="button"
          className={pendingCorrectionCount > 0 ? 'is-attention' : ''}
          disabled={pendingCorrectionCount === 0}
          aria-pressed={status === 'CORRECTION_REQUESTED'}
          onClick={() => { setStatus('CORRECTION_REQUESTED'); setPage(0); }}
        >
          <strong>{pendingCorrectionCount}</strong><span>Need your response</span>
        </button>
        <p>Students can review and respond after an achievement is shared.</p>
      </div>

      <div className="accomplishment-manager__toolbar">
        <SearchField
          label="Search achievements"
          value={search}
          onChange={(value) => { setSearch(value); setPage(0); }}
          placeholder="Student, number or achievement"
        />
        <SelectMenu
          value={status}
          options={[
            { value: 'ACTIVE', label: 'Current records' },
            { value: 'DRAFT', label: 'Drafts' },
            { value: 'CONFIRMED', label: 'Shared' },
            { value: 'CORRECTION_REQUESTED', label: 'Needs response' },
            { value: 'REVOKED', label: 'Removed' },
            { value: 'ALL', label: 'All statuses' }
          ]}
          onChange={(value) => { setStatus(value); setPage(0); }}
          ariaLabel="Achievement status"
        />
      </div>

      {error && (
        <div className="notice notice--warn accomplishment-manager__notice">
          <span className="notice__mark" aria-hidden="true" />
          <span>{error}</span><span className="spacer" />
          <button type="button" className="btn btn--sm" onClick={() => void refresh()}>Retry</button>
        </div>
      )}

      <div className="accomplishment-manager__list" aria-live="polite">
        {paged.rows.map((item) => (
          <article className={`accomplishment-row${item.latestCorrection?.status === 'PENDING' ? ' accomplishment-row--attention' : ''}`} key={item.id}>
            <div className="accomplishment-row__date">
              <strong>{new Date(`${item.achievementDate}T00:00:00`).getDate()}</strong>
              <span>{new Date(`${item.achievementDate}T00:00:00`).toLocaleDateString('en-NZ', { month: 'short' })}</span>
            </div>
            <div className="accomplishment-row__main">
              <div className="accomplishment-row__title-line">
                <strong>{item.title}</strong>
                <span className={accomplishmentStatusClass(item.status)}>{accomplishmentStatusLabel(item.status)}</span>
              </div>
              <p>{item.studentName} · {item.studentNumber}</p>
              <div className="accomplishment-row__meta">
                <span>{accomplishmentCategoryLabel(item.category)}</span>
                {formatAccomplishmentPoints(item.points) && <span>{formatAccomplishmentPoints(item.points)}</span>}
                <span>{studentDateLabel(item.createdAt)}</span>
                {item.includeInReport && <span>Report ready</span>}
                {item.acknowledgedAt && item.latestCorrection?.status !== 'PENDING' && <span>Details confirmed by student</span>}
              </div>
              {item.latestCorrection?.status === 'PENDING' && (
                <div className="accomplishment-row__request">
                  <span>Student requested a correction</span>
                  <p>{item.latestCorrection.message}</p>
                </div>
              )}
            </div>
            <div className="accomplishment-row__actions">
              {item.latestCorrection?.status === 'PENDING' && (
                <button type="button" className="btn btn--primary btn--sm" onClick={() => setReviewing(item)}>
                  Review request
                </button>
              )}
              {item.status === 'DRAFT' && (
                <button type="button" className="btn btn--primary btn--sm" disabled={busyId === item.id} onClick={() => void runStatusAction(item, 'confirm')}>
                  {busyId === item.id ? 'Sharing…' : 'Share with student'}
                </button>
              )}
              {item.status === 'CONFIRMED' && item.latestCorrection?.status !== 'PENDING' && (
                <button type="button" className="btn btn--quiet btn--sm" disabled={busyId === item.id} onClick={() => void runStatusAction(item, 'revoke')}>
                  {busyId === item.id ? 'Removing…' : 'Remove from student view'}
                </button>
              )}
            </div>
          </article>
        ))}
        {!loading && rows.length === 0 && !error && (
          <div className="accomplishment-manager__empty">
            <IconAward />
            <strong>{items.length === 0 ? 'No achievements recorded yet' : 'No matching records'}</strong>
            <span>{items.length === 0 ? 'Recognise a project, milestone or award after a student completes it.' : 'Try another search or status filter.'}</span>
            {items.length === 0 && students.length > 0 && <button type="button" className="btn" onClick={() => setCreating(true)}>Add the first achievement</button>}
          </div>
        )}
        {loading && items.length === 0 && <output className="empty empty--inline">Loading achievements…</output>}
      </div>

      {rows.length > 0 && (
        <Pager label={paged.label} page={paged.page} pageCount={paged.pageCount} canPrev={paged.canPrev} canNext={paged.canNext} onPrev={paged.prev} onNext={paged.next} onGoToPage={paged.goToPage} />
      )}

      {creating && (
        <CreateAccomplishmentModal
          courseOfferingId={courseOfferingId}
          classLabel={classLabel}
          students={students}
          onClose={() => setCreating(false)}
          onCreated={async () => { await Promise.all([refresh(), c.refreshAccomplishments()]); }}
          showToast={c.showToast}
        />
      )}

      {reviewing && (
        <ReviewAccomplishmentCorrectionModal
          accomplishment={reviewing}
          onClose={() => setReviewing(null)}
          onReviewed={(updated) => {
            setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
            c.updateAccomplishment(updated);
          }}
          showToast={c.showToast}
        />
      )}
    </section>
  );
}
