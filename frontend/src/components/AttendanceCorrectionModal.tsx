import Modal from './Modal';
import { attendanceStatusLabel } from '../lib/format';
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
      className="modal--choice-picker"
      title="Manual attendance correction"
      compactTitle
      subtitle={`${student.name} · ${student.id} · ${sessionLabel}`}
      closeButton
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
            {option === current
              ? `${attendanceStatusLabel(option)} (current)`
              : `Mark as ${attendanceStatusLabel(option)}`}
          </button>
        ))}
      </div>
    </Modal>
  );
}
