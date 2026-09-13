import { type FormEvent, useMemo, useState } from 'react';
import Modal from './Modal';
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
  const [error, setError] = useState('');
  const assignableTeachers = useMemo(
    () => staff.filter((member) => member.role === 'teacher' && member.status === 'active'),
    [staff]
  );

  const valid = useMemo(
    () => Boolean(courseCode.trim() && academicTerm.trim()),
    [courseCode, academicTerm]
  );

  const toggleTeacher = (id: string) => {
    setTeacherIds((current) =>
      current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]
    );
  };

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

  return (
    <Modal
      onClose={onClose}
      size="narrow"
      titleId="create-class-title"
      title="Create a class"
      compactTitle
      subtitle="A class is a course taught in a given year. Teachers can be assigned now or later; students are assigned from the class detail page, not at creation time."
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
      <div className="modal-form__grid">
        <label className="field">
          Course code
          <input
            value={courseCode}
            onChange={(event) => setCourseCode(event.target.value)}
            placeholder="SOFTENG 789"
            autoFocus
          />
        </label>
        <label className="field">
          Academic term
          <input
            value={academicTerm}
            onChange={(event) => setAcademicTerm(event.target.value)}
            placeholder="2026 Teaching Year"
          />
        </label>
        <div className="field field--wide">
          <span>Teachers (optional — can be assigned later)</span>
          {assignableTeachers.length > 0 ? (
            <div className="course-checklist" aria-label="Choose teachers for this class">
              {assignableTeachers.map((member) => (
                <label key={member.id} className="course-checklist__item">
                  <input
                    type="checkbox"
                    checked={teacherIds.includes(member.id)}
                    onChange={() => toggleTeacher(member.id)}
                  />
                  <span>{member.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="empty empty--inline">No active teachers are available.</div>
          )}
        </div>

        {error && <div className="form-error field--wide">{error}</div>}
      </div>
    </Modal>
  );
}
