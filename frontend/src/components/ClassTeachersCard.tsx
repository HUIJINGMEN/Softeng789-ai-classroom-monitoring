import { useState } from 'react';
import { addClassTeacher, removeClassTeacher, type ClassApiResponse } from '../lib/classAdminApi';
import type { StaffMember } from '../types';

interface Props {
  readonly klass: ClassApiResponse;
  readonly staff: readonly StaffMember[];
  readonly busy: boolean;
  readonly runAction: (action: () => Promise<unknown>) => Promise<void>;
}

export default function ClassTeachersCard({ klass, staff, busy, runAction }: Props) {
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);

  const toggleAddTeacher = (id: string) => {
    setSelectedTeacherIds((current) =>
      current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]
    );
  };

  // Deactivated staff can't be handed a new class assignment — the backend enforces this too
  // (AdminClassService.requireActiveTeacher), this just keeps them off the picker in the first
  // place rather than letting someone select one and then see a rejection.
  const availableTeachers = staff.filter(
    (member) =>
      member.role === 'teacher' &&
      member.status === 'active' &&
      !klass.teachers.some((teacher) => teacher.id === member.id)
  );

  return (
    <section className="card dashboard-enter stagger-1">
      <div className="card__body">
        <div className="card__title card__title--spaced">Teachers</div>
        {klass.teachers.length === 0 && <div className="empty empty--inline">No teacher assigned.</div>}
        {klass.teachers.map((teacher) => (
          <div key={teacher.id} className="kv">
            <span className="kv__k row-inline">
              {teacher.name}
              {teacher.status === 'DEACTIVATED' && <span className="badge badge--neutral">Deactivated</span>}
            </span>
            <button
              type="button"
              className="btn btn--sm"
              disabled={busy}
              onClick={() => runAction(() => removeClassTeacher(klass.id, teacher.id))}
            >
              Remove
            </button>
          </div>
        ))}

        {availableTeachers.length > 0 && (
          <div className="add-panel">
            <div className="course-checklist" aria-label="Choose teachers to add">
              {availableTeachers.map((member) => (
                <label key={member.id} className="course-checklist__item">
                  <input
                    type="checkbox"
                    checked={selectedTeacherIds.includes(member.id)}
                    onChange={() => toggleAddTeacher(member.id)}
                  />
                  <span>{member.name}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              className="btn"
              disabled={busy || selectedTeacherIds.length === 0}
              onClick={() =>
                runAction(async () => {
                  for (const teacherId of selectedTeacherIds) {
                    await addClassTeacher(klass.id, teacherId);
                  }
                  setSelectedTeacherIds([]);
                })
              }
            >
              {selectedTeacherIds.length > 0
                ? `Add ${selectedTeacherIds.length} teacher${selectedTeacherIds.length === 1 ? '' : 's'}`
                : 'Add teacher'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
