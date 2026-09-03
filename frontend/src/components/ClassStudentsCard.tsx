import { useMemo, useState } from 'react';
import SelectMenu from './SelectMenu';
import {
  addClassStudents,
  removeClassStudent,
  transferClassStudent,
  type ClassApiResponse
} from '../lib/classAdminApi';
import type { Student } from '../types';

interface Props {
  readonly klass: ClassApiResponse;
  readonly classes: readonly ClassApiResponse[];
  readonly allStudents: readonly Student[];
  readonly students: readonly Student[];
  readonly studentsLoading: boolean;
  readonly studentsError: string;
  readonly busy: boolean;
  readonly runAction: (action: () => Promise<unknown>) => Promise<void>;
  readonly refreshStudents: () => void;
}

export default function ClassStudentsCard({
  klass,
  classes,
  allStudents,
  students,
  studentsLoading,
  studentsError,
  busy,
  runAction,
  refreshStudents
}: Props) {
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [movingStudentId, setMovingStudentId] = useState<string | null>(null);
  const [moveTargetId, setMoveTargetId] = useState('');

  const toggleAddStudent = (id: string) => {
    setSelectedStudentIds((current) =>
      current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]
    );
  };

  // Withdrawn students can't be handed a new class assignment either — the backend enforces this
  // too (AdminClassService.enrol), this just keeps them off the picker in the first place.
  const availableStudents = allStudents.filter(
    (student) =>
      student.accountStatus === 'active' && !students.some((existing) => existing.recordId === student.recordId)
  );
  const filteredAvailableStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return availableStudents;
    return availableStudents.filter(
      (student) =>
        student.name.toLowerCase().includes(query) ||
        (student.studentNumber ?? '').toLowerCase().includes(query)
    );
  }, [availableStudents, studentSearch]);
  const otherActiveClasses = classes.filter((candidate) => candidate.id !== klass.id && candidate.status === 'ACTIVE');

  return (
    <section className="card dashboard-enter stagger-2">
      <div className="card__body">
        <div className="card__title card__title--spaced">Students</div>

        {studentsError && (
          <div className="notice notice--warn">
            <span className="notice__mark" aria-hidden="true" />
            <span>{studentsError}</span>
          </div>
        )}

        {availableStudents.length > 0 && (
          <div className="add-panel add-panel--top">
            <label className="field">
              Search students
              <input
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                placeholder="Name or student number"
              />
            </label>
            <div className="course-checklist course-checklist--scroll" aria-label="Choose students to add">
              {filteredAvailableStudents.map((student) => (
                <label key={student.recordId} className="course-checklist__item">
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.includes(student.recordId as string)}
                    onChange={() => toggleAddStudent(student.recordId as string)}
                  />
                  <span>
                    {student.name} ({student.studentNumber ?? student.id})
                  </span>
                </label>
              ))}
              {filteredAvailableStudents.length === 0 && (
                <div className="empty empty--inline">No matching students.</div>
              )}
            </div>
            <button
              type="button"
              className="btn"
              disabled={busy || selectedStudentIds.length === 0}
              onClick={() =>
                runAction(() =>
                  addClassStudents(klass.id, selectedStudentIds).then(() => {
                    setSelectedStudentIds([]);
                    setStudentSearch('');
                    refreshStudents();
                  })
                )
              }
            >
              {selectedStudentIds.length > 0
                ? `Add ${selectedStudentIds.length} student${selectedStudentIds.length === 1 ? '' : 's'}`
                : 'Add students'}
            </button>
          </div>
        )}

        <div className="card__sub students-panel__roster-label">Enrolled</div>

        {students.map((student) => (
          <div key={student.recordId} className="kv">
            <div>
              <div className="cell-strong cell-strong--compact">{student.name}</div>
              <div className="cell-sub">{student.studentNumber ?? student.id}</div>
            </div>
            {movingStudentId === student.recordId ? (
              <div className="row-inline">
                <SelectMenu
                  value={moveTargetId}
                  options={[
                    { value: '', label: 'Move to…' },
                    ...otherActiveClasses.map((target) => ({
                      value: target.id,
                      label: `${target.courseCode} — ${target.academicTerm}`
                    }))
                  ]}
                  onChange={setMoveTargetId}
                  ariaLabel={`Move ${student.name} to another class`}
                />
                <button
                  type="button"
                  className="btn btn--sm"
                  disabled={busy || !moveTargetId}
                  onClick={() =>
                    runAction(() =>
                      transferClassStudent(klass.id, student.recordId as string, moveTargetId).then(() => {
                        setMovingStudentId(null);
                        setMoveTargetId('');
                        refreshStudents();
                      })
                    )
                  }
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => {
                    setMovingStudentId(null);
                    setMoveTargetId('');
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="row-inline">
                <button
                  type="button"
                  className="btn btn--sm"
                  disabled={busy || otherActiveClasses.length === 0}
                  onClick={() => setMovingStudentId(student.recordId ?? null)}
                >
                  Move
                </button>
                <button
                  type="button"
                  className="btn btn--sm"
                  disabled={busy}
                  onClick={() =>
                    runAction(() => removeClassStudent(klass.id, student.recordId as string).then(refreshStudents))
                  }
                >
                  Withdraw from class
                </button>
              </div>
            )}
          </div>
        ))}

        {!studentsLoading && students.length === 0 && (
          <div className="empty empty--inline">No students in this class yet.</div>
        )}
      </div>
    </section>
  );
}
