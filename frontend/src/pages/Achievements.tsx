import { useEffect, useMemo, useRef, useState } from 'react';
import CreateAccomplishmentModal from '../components/CreateAccomplishmentModal';
import Pager from '../components/Pager';
import ReviewAccomplishmentCorrectionModal from '../components/ReviewAccomplishmentCorrectionModal';
import SearchField from '../components/SearchField';
import SelectMenu from '../components/SelectMenu';
import { IconAward, IconPlus } from '../components/icons';
import type { Console } from '../hooks/useConsole';
import { confirmAccomplishment, revokeAccomplishment } from '../lib/accomplishmentApi';
import {
  accomplishmentCategoryLabel,
  formatAccomplishmentPoints
} from '../lib/accomplishments';
import { apiMessage } from '../lib/apiClient';
import { listMyClassOptions } from '../lib/healthIncidentApi';
import { usePagination } from '../lib/table';
import type { Accomplishment, HealthClassOption } from '../types';

interface Props {
  readonly console: Console;
  readonly isAdmin: boolean;
}

type View = 'review' | 'all' | 'drafts';

function dateLabel(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function matchesView(item: Accomplishment, view: View): boolean {
  if (view === 'review') return item.latestCorrection?.status === 'PENDING';
  if (view === 'drafts') return item.status === 'DRAFT';
  return item.status === 'CONFIRMED';
}

export default function Achievements({ console: c, isAdmin }: Props) {
  const items = c.accomplishments;
  const loading = c.accomplishmentsLoading;
  const error = c.accomplishmentsError;
  const pendingReviewCount = c.pendingAccomplishmentReviewCount;
  const refresh = c.refreshAccomplishments;
  const updateItem = c.updateAccomplishment;
  const [view, setView] = useState<View>(() => pendingReviewCount > 0 ? 'review' : 'all');
  const [search, setSearch] = useState('');
  const [classId, setClassId] = useState('ALL');
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const [reviewing, setReviewing] = useState<Accomplishment | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [classOptions, setClassOptions] = useState<HealthClassOption[]>([]);
  const viewChosenByUser = useRef(false);

  useEffect(() => {
    listMyClassOptions()
      .then(setClassOptions)
      .catch((caught) => c.showToast(apiMessage(caught)));
  }, [c.showToast]);

  useEffect(() => {
    if (!loading && !viewChosenByUser.current && pendingReviewCount > 0) {
      setView('review');
      setPage(0);
    }
  }, [loading, pendingReviewCount]);

  const sharedCount = items.filter((item) => item.status === 'CONFIRMED').length;
  const draftCount = items.filter((item) => item.status === 'DRAFT').length;
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items
      .filter((item) => matchesView(item, view))
      .filter((item) => classId === 'ALL' || item.courseOfferingId === classId)
      .filter((item) => !query || [item.studentName, item.studentNumber, item.title, item.classLabel]
        .some((value) => value.toLowerCase().includes(query)))
      .sort((left, right) => {
        const leftPending = left.latestCorrection?.status === 'PENDING';
        const rightPending = right.latestCorrection?.status === 'PENDING';
        if (leftPending !== rightPending) return leftPending ? -1 : 1;
        return right.achievementDate.localeCompare(left.achievementDate);
      });
  }, [classId, items, search, view]);
  const paged = usePagination(filtered, page, setPage, 8);

  const setActiveView = (next: View) => {
    viewChosenByUser.current = true;
    setView(next);
    setPage(0);
  };

  const updateStatus = async (item: Accomplishment, action: 'confirm' | 'revoke') => {
    setBusyId(item.id);
    try {
      const updated = action === 'confirm'
        ? await confirmAccomplishment(item.id)
        : await revokeAccomplishment(item.id);
      updateItem(updated);
      c.showToast(action === 'confirm' ? 'Achievement shared with the student.' : 'Achievement removed from the student view.');
    } catch (caught) {
      c.showToast(apiMessage(caught));
    } finally {
      setBusyId(null);
    }
  };

  const openStudent = (studentId: string) => {
    c.setProfileId(studentId);
    c.setPage('students');
  };

  return (
    <div className="page__inner achievement-center">
      <section className="card dashboard-enter achievement-center__workspace">
        <header className="achievement-center__head">
          <div className="achievement-center__identity">
            <span className="achievement-center__icon" aria-hidden="true"><IconAward /></span>
            <div>
              <h2>Achievement records</h2>
              <p>Recognise completed work, share it with students and include it in reports.</p>
            </div>
          </div>
          <div className="achievement-center__head-actions">
            {pendingReviewCount > 0 && (
              <button type="button" className="achievement-center__review-callout" onClick={() => setActiveView('review')}>
                <span>{pendingReviewCount}</span>
                <span><strong>Student {pendingReviewCount === 1 ? 'request' : 'requests'} waiting</strong><small>Review requested changes</small></span>
              </button>
            )}
            <button type="button" className="btn btn--primary btn--with-icon" disabled={classOptions.length === 0} title={classOptions.length === 0 ? 'No available classes' : undefined} onClick={() => setCreating(true)}>
              <IconPlus /> Add achievement
            </button>
          </div>
        </header>

        <nav className="achievement-center__views" aria-label="Achievement views">
          <button type="button" className={view === 'review' ? 'is-active' : ''} aria-current={view === 'review' ? 'page' : undefined} aria-label={`Needs review, ${pendingReviewCount} records`} onClick={() => setActiveView('review')}>
            <span>Needs review</span><b>{pendingReviewCount}</b>
          </button>
          <button type="button" className={view === 'all' ? 'is-active' : ''} aria-current={view === 'all' ? 'page' : undefined} aria-label={`Shared, ${sharedCount} records`} onClick={() => setActiveView('all')}>
            <span>Shared</span><b>{sharedCount}</b>
          </button>
          <button type="button" className={view === 'drafts' ? 'is-active' : ''} aria-current={view === 'drafts' ? 'page' : undefined} aria-label={`Drafts, ${draftCount} records`} onClick={() => setActiveView('drafts')}>
            <span>Drafts</span><b>{draftCount}</b>
          </button>
        </nav>

        <div className="achievement-center__toolbar">
          <SearchField
            label="Search records"
            value={search}
            onChange={(value) => { setSearch(value); setPage(0); }}
            placeholder="Student, number or achievement"
          />
          <label className="field">
            <span>Class</span>
            <SelectMenu
              value={classId}
              options={[
                { value: 'ALL', label: isAdmin ? 'All classes' : 'All my classes' },
                ...classOptions.map((option) => ({ value: option.courseOfferingId, label: option.label }))
              ]}
              onChange={(value) => { setClassId(value); setPage(0); }}
              ariaLabel="Filter achievement records by class"
            />
          </label>
        </div>

        {error && (
          <div className="notice notice--warn achievement-center__notice">
            <span>Achievement records could not be loaded.</span>
            <button type="button" className="btn btn--sm" onClick={() => void refresh()}>Retry</button>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="achievement-center__columns" aria-hidden="true">
            <span>Student</span>
            <span>{view === 'review' ? 'Achievement and requested change' : 'Achievement'}</span>
            <span>Action</span>
          </div>
        )}

        <div className="achievement-center__list" aria-live="polite">
          {paged.rows.map((item) => {
            const needsReview = item.latestCorrection?.status === 'PENDING';
            const points = formatAccomplishmentPoints(item.points);
            return (
              <article key={item.id} className={`achievement-center-row${needsReview ? ' achievement-center-row--attention' : ''}`}>
                <div className="achievement-center-row__student">
                  <span className="achievement-center-row__avatar" aria-hidden="true">{item.studentName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)}</span>
                  <div>
                    <button type="button" onClick={() => openStudent(item.studentId)}>{item.studentName}</button>
                    <span>{item.studentNumber} · {item.classLabel}</span>
                  </div>
                </div>
                <div className="achievement-center-row__record">
                  <div className="achievement-center-row__title">
                    <strong>{item.title}</strong>
                    {needsReview && <span className="badge badge--warn">Change requested</span>}
                  </div>
                  <div className="achievement-center-row__meta">
                    <span className="achievement-center-row__category">{accomplishmentCategoryLabel(item.category)}</span>
                    <time dateTime={item.achievementDate}>{dateLabel(item.achievementDate)}</time>
                    {points && <strong>{points}</strong>}
                  </div>
                  {needsReview && item.latestCorrection && (
                    <div className="achievement-center-row__request">
                      <strong>Student requested a change</strong>
                      <span title={item.latestCorrection.message}>{item.latestCorrection.message}</span>
                    </div>
                  )}
                </div>
                <div className="achievement-center-row__actions">
                  {needsReview && <button type="button" className="btn btn--primary btn--sm" onClick={() => setReviewing(item)}>Review request</button>}
                  {item.status === 'DRAFT' && <button type="button" className="btn btn--primary btn--sm" disabled={busyId === item.id} onClick={() => void updateStatus(item, 'confirm')}>{busyId === item.id ? 'Sharing…' : 'Share'}</button>}
                  {item.status === 'CONFIRMED' && !needsReview && <button type="button" className="btn btn--quiet btn--sm" title="Remove from the student view" disabled={busyId === item.id} onClick={() => void updateStatus(item, 'revoke')}>{busyId === item.id ? 'Unsharing…' : 'Unshare'}</button>}
                </div>
              </article>
            );
          })}

          {!loading && filtered.length === 0 && !error && (
            <div className="achievement-center__empty">
              <strong>{view === 'review' ? 'Nothing needs review' : 'No matching achievement records'}</strong>
              <span>{view === 'review' ? 'Student change requests will collect here automatically.' : 'Try a different search or class filter.'}</span>
              {view === 'review' && items.length > 0 && <button type="button" className="btn btn--sm" onClick={() => setActiveView('all')}>View shared achievements</button>}
            </div>
          )}
          {loading && items.length === 0 && <output className="empty empty--inline">Loading achievement records…</output>}
        </div>

        {filtered.length > 0 && (
          <Pager label={paged.label} page={paged.page} pageCount={paged.pageCount} canPrev={paged.canPrev} canNext={paged.canNext} onPrev={paged.prev} onNext={paged.next} onGoToPage={paged.goToPage} />
        )}
      </section>

      {creating && (
        <CreateAccomplishmentModal
          courseOptions={classOptions.map((option) => ({
            id: option.courseOfferingId,
            label: option.label,
            studentIds: option.students.map((student) => student.id)
          }))}
          students={c.students}
          onClose={() => setCreating(false)}
          onCreated={refresh}
          showToast={c.showToast}
        />
      )}

      {reviewing && (
        <ReviewAccomplishmentCorrectionModal
          accomplishment={reviewing}
          onClose={() => setReviewing(null)}
          onReviewed={updateItem}
          showToast={c.showToast}
        />
      )}
    </div>
  );
}
