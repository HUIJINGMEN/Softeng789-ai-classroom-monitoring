import { IconActivity } from './icons';
import { eventSessionLabel, eventSubjectLabel } from '../lib/eventDisplay';
import { statusClass } from '../lib/format';
import type { CandidateEvent, Session, Student } from '../types';

interface Props {
  readonly pendingEvents: readonly CandidateEvent[];
  readonly students: readonly Student[];
  readonly sessions: readonly Session[];
  readonly onReviewSession: () => void;
  readonly onViewEvidence: (eventId: string) => void;
}

export default function RecentEventsCard({
  pendingEvents,
  students,
  sessions,
  onReviewSession,
  onViewEvidence
}: Props) {
  return (
    <section className="card dashboard-enter stagger-6">
      <div className="card__head">
        <div className="card__title-row">
          <span className="icon-inline icon-inline--title" aria-hidden="true">
            <IconActivity />
          </span>
          <div>
            <div className="card__title">Recent candidate events</div>
            <div className="card__sub">
              AI-generated events are candidate observations and require teacher review.
            </div>
          </div>
        </div>
        <button type="button" className="btn" onClick={onReviewSession}>
          Review session events
        </button>
      </div>

      {pendingEvents.slice(0, 4).map((event) => (
        <div key={event.id} className="event-row">
          <div className="evidence-slot evidence-slot--row">Evidence</div>
          <div className="event-row__main">
            <div className="cell-strong">{event.type}</div>
            <div className="cell-sub">
              {eventSubjectLabel(event, students)} · {eventSessionLabel(event, sessions)} · {event.start} ·{' '}
              {event.duration}
            </div>
          </div>
          <div className="mono event-row__confidence">conf {event.confidence.toFixed(2)}</div>
          <span className={`${statusClass(event.status)} event-row__status`}>{event.status}</span>
          <button type="button" className="btn btn--sm" onClick={() => onViewEvidence(event.id)}>
            View evidence
          </button>
        </div>
      ))}

      {pendingEvents.length === 0 && (
        <div className="empty empty--inline">No pending candidate events for the selected session.</div>
      )}
    </section>
  );
}
