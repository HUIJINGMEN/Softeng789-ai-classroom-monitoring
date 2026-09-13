import { EVENT_DESCRIPTIONS } from '../data/events';
import { confidenceClass, confidenceWidthClass, statusClass } from '../lib/format';
import { eventSessionLabel, eventStudentName } from '../lib/eventDisplay';
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
  onOpenStudent: (studentId: string) => void;
  onOpenSession: (sessionId: string) => void;
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
  onCorrect,
  onOpenStudent,
  onOpenSession
}: Props) {
  const confidence = Math.round(event.confidence * 100);
  // event.studentId can be null (the tracked person was never linked to a student record) — only
  // render the name as a link once there's somewhere real for it to go.
  const linkedStudent = event.studentId ? students.find(
    (student) =>
      student.id === event.studentId ||
      student.recordId === event.studentId ||
      student.studentNumber === event.studentId
  ) : undefined;
  const session = sessions.find((candidate) => candidate.id === event.sessionId);

  return (
    <article className={`event-card${selected ? ' event-card--selected' : ''}`}>
      <div className="event-card__select">
        {event.status === 'Pending Review' && (
        <button
          type="button"
          className={`checkbox${selected ? ' checkbox--on' : ''}`}
          title="Select for bulk review"
          aria-label={`Select ${event.type} for ${eventStudentName(event, students)}`}
          aria-pressed={selected}
          onClick={onToggleSelected}
        >
          {selected && (
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="m3.2 8.3 3 3 6.6-6.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        )}
      </div>

      <div className="event-card__event">
        <div className="event-card__title">{event.type}</div>
        <div className="event-card__observation">{EVENT_DESCRIPTIONS[event.type]}</div>
      </div>

      <div className="event-card__student">
        {linkedStudent ? (
          <button
            type="button"
            className="event-card__person event-card__person--link"
            onClick={() => onOpenStudent(linkedStudent.id)}
          >
            {eventStudentName(event, students)}
          </button>
        ) : (
          <div className="event-card__person">{eventStudentName(event, students)}</div>
        )}
        <div className="event-card__track mono">{event.trackId}</div>
      </div>

      <div className="event-card__session">
        {session ? (
          <button type="button" className="event-card__session-link" onClick={() => onOpenSession(session.id)}>
            {eventSessionLabel(event, sessions)}
          </button>
        ) : (
          <div>{eventSessionLabel(event, sessions)}</div>
        )}
        <div className="event-card__meta">{event.start} · {event.duration}</div>
      </div>

      <div className="event-card__confidence">
        <div className="event-card__confidence-value">{confidence}%</div>
        <div className="conf-track" aria-label={`AI confidence ${confidence}%`}>
          <div
            className={`${confidenceClass(event.confidence)} ${confidenceWidthClass(event.confidence)}`}
          />
        </div>
      </div>

      <div className="event-card__status">
        <span className={statusClass(event.status)}>{event.status}</span>
      </div>

      <div className="event-card__foot">
        <button type="button" className="btn btn--sm event-card__review" onClick={onReview}>
          Review
        </button>
        {event.status === 'Pending Review' && (
          <div className="event-card__quick-actions" aria-label="Quick review actions">
            <button type="button" className="btn btn--sm btn--quiet" onClick={onConfirm}>
              Confirm
            </button>
            <button type="button" className="btn btn--sm btn--quiet" onClick={onReject}>
              Reject
            </button>
            <button type="button" className="btn btn--sm btn--quiet" onClick={onCorrect}>
              Correct
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
