import { confidenceClass, confidenceWidthClass, statusClass } from '../lib/format';
import { eventSessionLabel, eventSubjectLabel } from '../lib/eventDisplay';
import type { CandidateEvent, Session, Student } from '../types';

interface Props {
  event: CandidateEvent;
  students: readonly Student[];
  sessions: readonly Session[];
  selected: boolean;
  onToggleSelected: () => void;
  onReview: () => void;
  onConfirm: () => void;
  onReject: () => void;
  onCorrect: () => void;
}

export default function EventCard({
  event,
  students,
  sessions,
  selected,
  onToggleSelected,
  onReview,
  onConfirm,
  onReject,
  onCorrect
}: Props) {
  return (
    <article className={`event-card${selected ? ' event-card--selected' : ''}`}>
      <div className="event-card__body">
        <div className="evidence-slot event-card__thumb">
          <div className="evidence-slot__label">Evidence</div>
          <div>Frame unavailable</div>
        </div>

        <div className="event-card__main">
          <div className="event-card__topline">
            <div className="event-card__title-row">
              <button
                type="button"
                className={`checkbox${selected ? ' checkbox--on' : ''}`}
                title="Select for bulk review"
                aria-pressed={selected}
                onClick={onToggleSelected}
              >
                {selected ? '✓' : ''}
              </button>
              <div className="event-card__title">{event.type}</div>
            </div>
            <span className={statusClass(event.status)}>{event.status}</span>
          </div>

          <div className="event-card__person">{eventSubjectLabel(event, students)}</div>
          <div className="mono event-card__meta">
            {eventSessionLabel(event, sessions)} · {event.start} · {event.duration} · conf{' '}
            {event.confidence.toFixed(2)}
          </div>

          <div className="conf-track">
            <div
              className={`${confidenceClass(event.confidence)} ${confidenceWidthClass(event.confidence)}`}
            />
          </div>
        </div>
      </div>

      <div className="event-card__foot">
        <button type="button" className="btn btn--sm" onClick={onReview}>
          View evidence
        </button>
        <button type="button" className="btn btn--sm btn--ok" onClick={onConfirm}>
          Confirm
        </button>
        <button type="button" className="btn btn--sm btn--danger" onClick={onReject}>
          Reject
        </button>
        <button type="button" className="btn btn--sm" onClick={onCorrect}>
          Correct event type
        </button>
      </div>
    </article>
  );
}
