import type { AttendanceStatus, Student } from '../types';

const OPTIONS: AttendanceStatus[] = ['Present', 'Late', 'Absent', 'Unknown'];

interface Props {
  student: Student;
  sessionLabel: string;
  current: AttendanceStatus;
  onPick: (status: AttendanceStatus) => void;
  onClose: () => void;
}

export default function AttendanceCorrectionModal({
  student,
  sessionLabel,
  current,
  onPick,
  onClose
}: Props) {
  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="modal modal--narrow"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <div>
            <div className="modal__title modal__title--compact">Manual attendance correction</div>
            <div className="card__sub">
              {student.name} · {student.id} · {sessionLabel}
            </div>
          </div>
        </div>

        <div className="modal__option-panel">
          {OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={`option-btn option-btn--choice${option === current ? ' option-btn--on' : ''}`}
              onClick={() => onPick(option)}
            >
              {option === current ? `${option} (current)` : `Mark as ${option}`}
            </button>
          ))}
        </div>

        <div className="modal__foot modal__foot--compact">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
