import EventCard from '../components/EventCard';
import SelectMenu from '../components/SelectMenu';
import { sessionDisplayName } from '../lib/eventDisplay';
import type { EventStatus } from '../types';
import type { Console } from '../hooks/useConsole';

const TABS: ('All' | EventStatus)[] = [
  'All',
  'Pending Review',
  'Confirmed',
  'Rejected',
  'Corrected'
];

export default function Events({ console: c }: { console: Console }) {
  const sessionEvents = c.events.filter((event) => event.sessionId === c.sessionId);
  const visible = sessionEvents.filter(
    (event) => c.reviewFilter === 'All' || event.status === c.reviewFilter
  );

  return (
    <div className="page__inner">
      <div className="notice notice--info dashboard-enter stagger-0">
        <div className="notice__mark">i</div>
        <div>
          AI-generated events are candidate observations and require teacher review. Event types
          describe observable posture and movement only — not confirmed behaviour or intent.
        </div>
      </div>

      <div className="tabs dashboard-enter stagger-1">
        <span className="tabs__label">Review status</span>
        {TABS.map((tab) => {
          const count =
            tab === 'All'
              ? sessionEvents.length
              : sessionEvents.filter((event) => event.status === tab).length;
          return (
            <button
              key={tab}
              type="button"
              className={`tab${c.reviewFilter === tab ? ' tab--on' : ''}`}
              onClick={() => c.setReviewFilter(tab)}
            >
              {tab} ({count})
            </button>
          );
        })}
        <div className="spacer" />
        <SelectMenu
          className="tabs__select"
          buttonClassName="tab tab--select"
          value={c.sessionId}
          options={c.sessionOptions.map((session) => ({
            value: session.id,
            label: `${sessionDisplayName(session)} · ${session.dateLabel}`
          }))}
          ariaLabel="Filter AI events by classroom session"
          align="right"
          onChange={c.selectSession}
        />
      </div>

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

      <div className="event-grid">
        {visible.map((event, index) => (
          <div key={event.id} className={`dashboard-enter stagger-${Math.min(index, 7)}`}>
            <EventCard
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
            />
          </div>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="card empty">
          No candidate events with this status for the selected session.
        </div>
      )}
    </div>
  );
}
