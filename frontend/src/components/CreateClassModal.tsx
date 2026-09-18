import { type FormEvent, useMemo, useState } from 'react';
import Modal from './Modal';
import MultiSelectPickerModal, { MultiSelectSummary } from './MultiSelectPickerModal';
import type { StaffMember } from '../types';

interface Props {
  readonly staff: readonly StaffMember[];
  readonly saving: boolean;
  readonly onCreate: (payload: {
    courseCode: string;
    academicTerm: string;
    teacherIds: string[];
  }) => Promise<boolean>;
  readonly onClose: () => void;
}

export default function CreateClassModal({ staff, saving, onCreate, onClose }: Props) {
  const [courseCode, setCourseCode] = useState('');
  const [academicTerm, setAcademicTerm] = useState('');
  const [teacherIds, setTeacherIds] = useState<string[]>([]);
  const [teacherPickerOpen, setTeacherPickerOpen] = useState(false);
  const [error, setError] = useState('');
  const assignableTeachers = useMemo(
    () => staff.filter((member) => member.role === 'teacher' && member.status === 'active'),
    [staff]
  );
  const selectedTeacherLabels = useMemo(
    () => assignableTeachers.filter((member) => teacherIds.includes(member.id)).map((member) => member.name),
    [assignableTeachers, teacherIds]
  );

  const valid = useMemo(
    () => Boolean(courseCode.trim() && academicTerm.trim()),
    [courseCode, academicTerm]
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!courseCode.trim() || !academicTerm.trim()) {
      setError('Fill in the course and academic term.');
      return;
    }
    const created = await onCreate({
      courseCode: courseCode.trim(),
      academicTerm: academicTerm.trim(),
      teacherIds
    });
    if (created) onClose();
  };

  if (teacherPickerOpen) {
    return (
      <MultiSelectPickerModal
        title="Assign teachers"
        subtitle="Search active staff and choose who can access this class."
        searchLabel="Search teachers"
        searchPlaceholder="Name, staff ID or email"
        options={assignableTeachers.map((member) => ({ id: member.id, label: member.name, description: `${member.staffNumber} · ${member.email}` }))}
        selectedIds={teacherIds}
        onApply={setTeacherIds}
        onClose={() => setTeacherPickerOpen(false)}
      />
    );
  }

  return (
    <Modal
      onClose={onClose}
      size="narrow"
      className="modal--entity-form modal--create-class"
      titleId="create-class-title"
      title="Create a class"
      compactTitle
      closeButton
      subtitle="Set the course and teaching period. Teachers can be assigned now or later."
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving || !valid}>
            {saving ? 'Creating…' : 'Create class'}
          </button>
        </>
      }
    >
      <div className="modal-form__grid create-class-form">
        <label className="field">
          <span>Course code</span>
          <input
            value={courseCode}
            onChange={(event) => setCourseCode(event.target.value)}
            placeholder="SOFTENG 789"
            autoFocus
          />
        </label>
        <label className="field">
          <span>Academic term</span>
          <input
            value={academicTerm}
            onChange={(event) => setAcademicTerm(event.target.value)}
            placeholder="2026 Teaching Year"
          />
        </label>
        <div className="field--wide">
          <MultiSelectSummary
            label="Teachers (optional)"
            actionNoun="teachers"
            selectedLabels={selectedTeacherLabels}
            emptyLabel={assignableTeachers.length === 0 ? 'No active teachers available' : 'No teachers assigned'}
            disabled={assignableTeachers.length === 0}
            onOpen={() => setTeacherPickerOpen(true)}
          />
          <small className="create-class-form__help">Students are added from the class page after creation.</small>
        </div>

        {error && <div className="form-error field--wide">{error}</div>}
      </div>
    </Modal>
  );
}
