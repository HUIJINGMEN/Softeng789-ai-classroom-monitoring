import Modal from './Modal';
import { EVENT_DESCRIPTIONS, EVENT_TYPES } from '../data/events';
import { eventSessionLabel, eventStudentName, eventSubjectLabel } from '../lib/eventDisplay';
import { statusClass } from '../lib/format';
import type { CandidateEvent, EventType, Session, Student } from '../types';

interface Props {
  event: CandidateEvent;
  students: readonly Student[];
  sessions: readonly Session[];
  pendingCount: number;
  correcting: boolean;
  onToggleCorrecting: () => void;
  onConfirm: () => void;
  onReject: () => void;
  onCorrect: (type: EventType) => void;
  onNext: () => void;
  onClose: () => void;
}

export default function EvidenceModal({
  event,
  students,
  sessions,
  pendingCount,
  correcting,
  onToggleCorrecting,
  onConfirm,
  onReject,
  onCorrect,
  onNext,
  onClose
}: Props) {
  const who = eventSubjectLabel(event, students);

  const meta: [string, string][] = [
    ['Event ID', event.id],
    ['Track ID', event.trackId],
    ['Student', eventStudentName(event, students)],
    ['Session', eventSessionLabel(event, sessions)],
    ['Start time', event.start],
    ['Duration', event.duration],
    ['Confidence', event.confidence.toFixed(2)],
    ['Original type', event.correctedFrom ?? '—']
  ];

  return (
    <Modal
      onClose={onClose}
      size="wide"
      className="modal--review modal--evidence-review"
      title={(
        <span className="modal-task-title">
          <span>Review {event.type.toLowerCase()}</span>
          <span className="badge badge--warn">{pendingCount} pending</span>
        </span>
      )}
      subtitle="Candidate AI observation — confirm, correct or reject it before it can enter reports."
      closeButton
      footCompact={false}
      footer={
        <>
          <div className="shortcut-row" aria-label="Evidence review keyboard shortcuts">
            <kbd>C</kbd> confirm <kbd>R</kbd> reject <kbd>Right</kbd> next <kbd>Esc</kbd> close
          </div>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onToggleCorrecting}>
            Correct type
          </button>
          <button type="button" className="btn btn--danger" onClick={onReject}>
            Reject
          </button>
          <button type="button" className="btn btn--ok" onClick={onConfirm}>
            Confirm
          </button>
          <button type="button" className="btn" onClick={onNext}>
            Next pending →
          </button>
        </>
      }
    >
      <div className="modal__grid">
        <div>
          <div className="evidence-slot modal__evidence">
            <div className="evidence-slot__label">Evidence frame unavailable</div>
            <div>
              {who} · {event.start}
            </div>
          </div>
          <div className="modal__evidence-note">
            Observable description only: {EVENT_DESCRIPTIONS[event.type]} No inference about
            attention, intent, or misconduct is made by the system.
          </div>
        </div>

        <div className="modal__meta">
          {meta.map(([key, value]) => (
            <div key={key} className="kv kv--plain">
              <span className="kv__k">{key}</span>
              <span className="kv__v">{value}</span>
            </div>
          ))}
          <span className={`${statusClass(event.status)} modal__status`}>
            {event.status}
          </span>
        </div>
      </div>

      {correcting && (
        <div className="modal__correction">
          <div className="modal__section-title">Correct event type</div>
          <div className="modal__option-list">
            {EVENT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={`option-btn option-btn--choice${type === event.type ? ' option-btn--on' : ''}`}
                onClick={() => onCorrect(type)}
              >
                Correct to: {type}
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
