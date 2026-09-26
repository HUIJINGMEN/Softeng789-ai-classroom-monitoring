import { useEffect, useMemo, useState } from 'react';
import EventCard from '../components/EventCard';
import Pager from '../components/Pager';
import SelectMenu from '../components/SelectMenu';
import { useBehaviourEventPage } from '../hooks/useBehaviourEventPage';
import { sessionDisplayName } from '../lib/eventDisplay';
import type { EventStatus, EventType } from '../types';
import type { Console } from '../hooks/useConsole';

const TABS: ('All' | EventStatus)[] = [
  'All',
  'Pending Review',
  'Confirmed',
  'Rejected',
  'Corrected'
];

const ALL = 'All';
const PAGE_SIZE = 8;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// When every status is shown together (the common case), the ones still needing a decision
// should surface first rather than being scattered wherever they happen to sort by session/date.
const STATUS_SORT_ORDER: Record<EventStatus, number> = {
  'Pending Review': 0,
  Confirmed: 1,
  Corrected: 2,
  Rejected: 3
};

interface Props {
  readonly console: Console;
  readonly isAdmin: boolean;
}

export default function Events({ console: c, isAdmin }: Props) {
  const [classFilter, setClassFilter] = useState(ALL);
  const [sessionFilter, setSessionFilter] = useState(isAdmin ? ALL : c.sessionId);
  const [typeFilter, setTypeFilter] = useState<typeof ALL | EventType>(ALL);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(0);

  const sessionById = useMemo(
    () => new Map(c.sessions.map((session) => [session.id, session])),
    [c.sessions]
  );

  useEffect(() => {
    if (isAdmin) return;
    if (!sessionFilter && c.sessionId) {
      setSessionFilter(c.sessionId);
      return;
    }
    if (
      sessionFilter !== ALL &&
      sessionFilter !== '' &&
      !c.sessions.some((session) => session.id === sessionFilter)
    ) {
      setSessionFilter(c.sessionId || ALL);
    }
  }, [c.sessionId, c.sessions, isAdmin, sessionFilter]);

  const accessibleEvents = c.events.filter((event) => sessionById.has(event.sessionId));
  const classOptions = Array.from(new Set(c.sessions.map((session) => session.course))).sort((left, right) => left.localeCompare(right));
  const typeOptions = Array.from(new Set(accessibleEvents.map((event) => event.type))).sort((left, right) => left.localeCompare(right));

  const matchesNonStatusFilters = (event: (typeof accessibleEvents)[number]) => {
    const session = sessionById.get(event.sessionId);
    if (!session) return false;
    return (
      (classFilter === ALL || session.course === classFilter) &&
      (sessionFilter === ALL || event.sessionId === sessionFilter) &&
      (typeFilter === ALL || event.type === typeFilter) &&
      (!dateFrom || session.date >= dateFrom) &&
      (!dateTo || session.date <= dateTo)
    );
  };
  const statusScopeEvents = accessibleEvents.filter(matchesNonStatusFilters);
  const refreshKey = useMemo(
    () => `${c.eventRevision}:` + c.events
      .filter((event) => UUID_PATTERN.test(event.id))
      .map((event) => `${event.id}:${event.status}:${event.type}`)
      .join('|'),
    [c.eventRevision, c.events]
  );
  const directory = useBehaviourEventPage(page, PAGE_SIZE, {
    reviewStatus: c.reviewFilter === ALL ? undefined : c.reviewFilter,
    course: classFilter === ALL ? undefined : classFilter,
    sessionId: sessionFilter === ALL ? undefined : sessionFilter,
    eventType: typeFilter === ALL ? undefined : typeFilter,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined
  }, refreshKey);
  const currentEventById = useMemo(
    () => new Map(c.events.map((event) => [event.id, event])),
    [c.events]
  );
  const transientEvents = statusScopeEvents.filter(
    (event) => !UUID_PATTERN.test(event.id) && (c.reviewFilter === ALL || event.status === c.reviewFilter)
  );
  const visible = [
    ...transientEvents,
    ...directory.rows.map((event) => currentEventById.get(event.id) ?? event)
  ]
    .filter((event) => matchesNonStatusFilters(event))
    .filter((event) => c.reviewFilter === ALL || event.status === c.reviewFilter)
    .sort((a, b) => STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status]);
  const totalResults = directory.totalItems + transientEvents.length;
  const pageCount = Math.max(1, directory.totalPages);
  const resultLabel = directory.totalItems === 0
    ? transientEvents.length > 0 ? `${transientEvents.length} live observation${transientEvents.length === 1 ? '' : 's'}` : 'No records'
    : `Showing ${directory.page * directory.size + 1}–${directory.page * directory.size + directory.rows.length} of ${directory.totalItems}`;
  const activeFilterCount = [
    c.reviewFilter !== ALL,
    classFilter !== ALL,
    sessionFilter !== ALL && sessionFilter !== c.sessionId,
    typeFilter !== ALL,
    Boolean(dateFrom),
    Boolean(dateTo)
  ].filter(Boolean).length;

  useEffect(() => {
    c.clearSelected();
    setPage(0);
    // Selection is contextual to the visible review queue and must never survive a filter change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.reviewFilter, classFilter, sessionFilter, typeFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (!directory.loading && directory.totalPages > 0 && page >= directory.totalPages) {
      setPage(directory.totalPages - 1);
    }
  }, [directory.loading, directory.totalPages, page]);

  const resetFilters = () => {
    c.setReviewFilter(ALL);
    setClassFilter(ALL);
    setSessionFilter(isAdmin ? ALL : c.sessionId || ALL);
    setTypeFilter(ALL);
    setDateFrom('');
    setDateTo('');
    setFiltersOpen(false);
    setPage(0);
    c.clearSelected();
  };

  return (
    <div className="page__inner observation-workspace">
      <section className="review-summary dashboard-enter stagger-0" aria-label="AI event review summary">
        {TABS.filter((tab) => tab !== ALL).map((tab) => {
          const count = statusScopeEvents.filter((event) => event.status === tab).length;
          return (
            <button
              key={tab}
              type="button"
              className={`review-summary__item review-summary__item--${tab.toLowerCase().replace(' ', '-')}${c.reviewFilter === tab ? ' review-summary__item--active' : ''}`}
              onClick={() => c.setReviewFilter(tab)}
            >
              <span className="review-summary__label">{tab}</span>
              <strong className="review-summary__value">{count}</strong>
              <span className="review-summary__hint">
                {tab === 'Pending Review'
                    ? 'Needs a decision'
                    : tab === 'Confirmed'
                      ? 'Accepted by a teacher'
                      : tab === 'Rejected'
                        ? 'Excluded from reports'
                        : 'Type adjusted'}
              </span>
            </button>
          );
        })}
      </section>

      <button
        type="button"
        className={`workspace-filter-toggle${filtersOpen ? ' is-open' : ''}`}
        aria-expanded={filtersOpen}
        aria-controls="event-filters"
        onClick={() => setFiltersOpen((current) => !current)}
      >
        <span>
          <strong>Filter observations</strong>
          <small>{activeFilterCount > 0 ? `${activeFilterCount} active` : 'Status, class, type or date'}</small>
        </span>
        <span aria-hidden="true" />
      </button>

      <section
        id="event-filters"
        className={`workspace-filter dashboard-enter stagger-1${filtersOpen ? ' is-open' : ''}`}
        aria-label="Filter AI observations"
      >
        <div className="field">
          <span>Review status</span>
          <SelectMenu
            value={c.reviewFilter}
            options={TABS.map((value) => ({ value, label: value }))}
            ariaLabel="Filter by review status"
            onChange={(value) => c.setReviewFilter(value as typeof ALL | EventStatus)}
          />
        </div>
        <div className="field">
          <span>Class</span>
          <SelectMenu
            value={classFilter}
            options={[ALL, ...classOptions].map((value) => ({ value, label: value }))}
            ariaLabel="Filter AI observations by class"
            onChange={(value) => {
              setClassFilter(value);
              setSessionFilter(ALL);
            }}
          />
        </div>
        <div className="field">
          <span>Session</span>
          <SelectMenu
            value={sessionFilter}
            options={[
              { value: ALL, label: 'All sessions' },
              ...c.sessions
                .filter((session) => classFilter === ALL || session.course === classFilter)
                .map((session) => ({
                  value: session.id,
                  label: `${sessionDisplayName(session)} · ${session.dateLabel}`
                }))
            ]}
            ariaLabel="Filter AI observations by classroom session"
            onChange={setSessionFilter}
          />
        </div>
        <div className="field">
          <span>Event type</span>
          <SelectMenu
            value={typeFilter}
            options={[ALL, ...typeOptions].map((value) => ({ value, label: value }))}
            ariaLabel="Filter by event type"
            onChange={(value) => setTypeFilter(value as typeof ALL | EventType)}
          />
        </div>
        <label className="field">
          From
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>
        <label className="field">
          To
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>
        <button type="button" className="btn btn--quiet workspace-filter__reset" onClick={resetFilters}>
          Reset filters
        </button>
      </section>

      {c.selected.length > 0 && (
        <div className="bulk-bar">
          <div className="bulk-bar__title">
            {c.selected.length} event{c.selected.length === 1 ? '' : 's'} selected
          </div>
          <div className="spacer" />
          <button type="button" className="btn btn--ok" onClick={() => c.bulkReview('Confirmed')}>
            Confirm selected
          </button>
          <button type="button" className="btn btn--danger" onClick={() => c.bulkReview('Rejected')}>
            Reject selected
          </button>
          <button type="button" className="btn btn--quiet" onClick={c.clearSelected}>
            Clear
          </button>
        </div>
      )}

      <section className="review-queue dashboard-enter stagger-2">
        <div className="review-queue__head">
          <div>
            <h3>Observation queue</h3>
            <p>{totalResults} result{totalResults === 1 ? '' : 's'} in this view</p>
          </div>
          <span className="review-queue__guidance">
            {isAdmin ? 'System-wide' : 'Your classes'} · Select a row to review evidence
          </span>
        </div>
        {directory.error && <div className="notice notice--warn" role="alert">{directory.error}</div>}
        {visible.length > 0 && (
          <div className="event-list-head" aria-hidden="true">
            <span />
            <span>Observation</span>
            <span>Student</span>
            <span>Class / session</span>
            <span>Confidence</span>
            <span>Status</span>
            <span />
          </div>
        )}
        <div className="event-grid">
        {visible.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            students={c.students}
            sessions={c.sessions}
            selected={c.selected.includes(event.id)}
            onToggleSelected={() => c.toggleSelected(event.id)}
            onReview={() => {
              c.setModalId(event.id);
              c.setCorrecting(false);
            }}
            onConfirm={() => c.setEventStatus(event.id, 'Confirmed')}
            onReject={() => c.setEventStatus(event.id, 'Rejected')}
            onCorrect={() => {
              c.setModalId(event.id);
              c.setCorrecting(true);
            }}
            onOpenStudent={(studentId) => {
              c.setProfileId(studentId);
              c.setPage('students');
              window.scrollTo({ top: 0, behavior: 'auto' });
            }}
            onOpenSession={(sessionId) => {
              c.selectSession(sessionId);
              c.setPage('session-detail');
              window.scrollTo({ top: 0, behavior: 'auto' });
            }}
          />
        ))}
        </div>

      {!directory.loading && !directory.error && visible.length === 0 && (
        <div className="workspace-empty workspace-empty--observations">
          <div className="workspace-empty__mark" aria-hidden="true" />
          <div className="empty__title">No AI observations to review</div>
          <div className="empty__hint">
            {sessionFilter === ALL
              ? 'Candidate classroom observations will appear here when the AI service detects an observable event during an accessible session.'
              : 'This session has no candidate observations matching the current filters.'}
        </div>
        </div>
      )}
      {!directory.error && totalResults > 0 && (
        <Pager
          label={resultLabel}
          page={directory.page}
          pageCount={pageCount}
          canPrev={directory.hasPrevious}
          canNext={directory.hasNext}
          onPrev={() => setPage((current) => Math.max(0, current - 1))}
          onNext={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
          onGoToPage={(target) => setPage(Math.max(0, Math.min(pageCount - 1, target)))}
        />
      )}
      </section>
    </div>
  );
}
