import Modal from './Modal';
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
    <Modal
      onClose={onClose}
      size="narrow"
      title="Manual attendance correction"
      compactTitle
      subtitle={`${student.name} · ${student.id} · ${sessionLabel}`}
      footer={
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
      }
    >
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
    </Modal>
  );
}
