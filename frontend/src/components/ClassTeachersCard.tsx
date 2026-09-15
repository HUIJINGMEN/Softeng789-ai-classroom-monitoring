import { useMemo, useState } from 'react';
import Modal from './Modal';
import Pager from './Pager';
import PersonAvatar from './PersonAvatar';
import SearchField from './SearchField';
import { IconUserPlus } from './icons';
import { addClassTeacher, removeClassTeacher, type ClassApiResponse } from '../lib/classAdminApi';
import { avatarTone } from '../lib/format';
import { usePagination } from '../lib/table';
import type { StaffMember } from '../types';

interface Props {
  readonly klass: ClassApiResponse;
  readonly staff: readonly StaffMember[];
  readonly busy: boolean;
  readonly runAction: (action: () => Promise<unknown>) => Promise<void>;
}

const teacherTone = (id: string, index: number) => avatarTone(`${id}_________`, index);

export default function ClassTeachersCard({ klass, staff, busy, runAction }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerPage, setPickerPage] = useState(0);
  const [assignedQuery, setAssignedQuery] = useState('');
  const [assignedPage, setAssignedPage] = useState(0);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [removingTeacherId, setRemovingTeacherId] = useState<string | null>(null);

  // Deactivated staff cannot receive a new assignment. The backend enforces the same rule; this
  // keeps the picker focused on choices an administrator can actually make.
  const availableTeachers = useMemo(
    () =>
      staff
        .filter(
          (member) =>
            member.role === 'teacher' &&
            member.status === 'active' &&
            !klass.teachers.some((teacher) => teacher.id === member.id)
        )
        .sort((left, right) => left.name.localeCompare(right.name)),
    [klass.teachers, staff]
  );

  const filteredAssignedTeachers = useMemo(() => {
    const query = assignedQuery.trim().toLowerCase();
    return [...klass.teachers]
      .filter(
        (teacher) =>
          !query ||
          teacher.name.toLowerCase().includes(query) ||
          teacher.email.toLowerCase().includes(query)
      )
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [assignedQuery, klass.teachers]);

  const filteredAvailableTeachers = useMemo(() => {
    const query = pickerQuery.trim().toLowerCase();
    return availableTeachers.filter(
      (member) =>
        !query ||
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query) ||
        member.staffNumber.toLowerCase().includes(query)
    );
  }, [availableTeachers, pickerQuery]);

  const pagedAssignedTeachers = usePagination(filteredAssignedTeachers, assignedPage, setAssignedPage, 8);
  const pagedAvailableTeachers = usePagination(filteredAvailableTeachers, pickerPage, setPickerPage, 6);
  const removingTeacher = klass.teachers.find((teacher) => teacher.id === removingTeacherId) ?? null;

  const toggleTeacher = (id: string) => {
    setSelectedTeacherIds((current) =>
      current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]
    );
  };

  const closePicker = () => {
    if (busy) return;
    setPickerOpen(false);
    setPickerQuery('');
    setPickerPage(0);
    setSelectedTeacherIds([]);
  };

  const assignSelectedTeachers = () => {
    if (selectedTeacherIds.length === 0) return;
    void runAction(async () => {
      for (const teacherId of selectedTeacherIds) {
        await addClassTeacher(klass.id, teacherId);
      }
      setSelectedTeacherIds([]);
      setPickerQuery('');
      setPickerPage(0);
      setPickerOpen(false);
    });
  };

  const confirmRemoval = () => {
    if (!removingTeacher) return;
    void runAction(async () => {
      await removeClassTeacher(klass.id, removingTeacher.id);
      setRemovingTeacherId(null);
    });
  };

  return (
    <>
      <section className="card class-teachers-card dashboard-enter stagger-1">
        <div className="card__head class-teachers-card__head">
          <div>
            <div className="card__title">Teaching team</div>
            <div className="card__sub">
              {klass.teachers.length === 0
                ? 'No teachers are assigned to this class.'
                : `${klass.teachers.length} teacher${klass.teachers.length === 1 ? '' : 's'} assigned to this class.`}
            </div>
          </div>
          {availableTeachers.length > 0 ? (
            <button
              type="button"
              className="btn btn--primary btn--with-icon"
              disabled={busy}
              onClick={() => setPickerOpen(true)}
            >
              <IconUserPlus />
              Add teacher
            </button>
          ) : (
            <span className="class-teachers-card__availability">All active teachers assigned</span>
          )}
        </div>

        <div className="card__body class-teachers-card__body">
          {klass.teachers.length > 6 && (
            <div className="class-teachers-card__toolbar">
              <SearchField
                label="Search teaching team"
                value={assignedQuery}
                onChange={(value) => {
                  setAssignedQuery(value);
                  setAssignedPage(0);
                }}
                placeholder="Name or email"
              />
              <span className="cell-sub">Search within assigned teachers</span>
            </div>
          )}

          {klass.teachers.length === 0 ? (
            <div className="class-teachers-card__empty">
              <strong>Build the teaching team</strong>
              <span>Assign an active teacher so they can access this class and its sessions.</span>
            </div>
          ) : filteredAssignedTeachers.length === 0 ? (
            <div className="class-teachers-card__empty">
              <strong>No matching teachers</strong>
              <span>Try a different name or email address.</span>
            </div>
          ) : (
            <div className="class-teachers-list" aria-label="Teachers assigned to this class">
              <div className="class-teachers-list__head" aria-hidden="true">
                <span>Teacher</span>
                <span>Account status</span>
                <span>Action</span>
              </div>
              {pagedAssignedTeachers.rows.map((teacher, index) => (
                <div key={teacher.id} className="class-teachers-list__row">
                  <div className="person">
                    <PersonAvatar
                      name={teacher.name}
                      tone={teacherTone(teacher.id, index)}
                      alt=""
                    />
                    <div className="person__details">
                      <div className="cell-strong">{teacher.name}</div>
                      <div className="cell-sub class-teachers-list__email">{teacher.email}</div>
                    </div>
                  </div>
                  <span className={teacher.status === 'DEACTIVATED' ? 'badge badge--neutral' : 'badge badge--present'}>
                    {teacher.status === 'DEACTIVATED' ? 'Deactivated' : 'Active'}
                  </span>
                  <button
                    type="button"
                    className="btn btn--quiet btn--sm class-teachers-list__remove"
                    disabled={busy}
                    aria-label={`Remove ${teacher.name} from this class`}
                    onClick={() => setRemovingTeacherId(teacher.id)}
                  >
                    Remove from class
                  </button>
                </div>
              ))}
            </div>
          )}

          {filteredAssignedTeachers.length > 8 && (
            <Pager
              label={pagedAssignedTeachers.label}
              page={pagedAssignedTeachers.page}
              pageCount={pagedAssignedTeachers.pageCount}
              canPrev={pagedAssignedTeachers.canPrev}
              canNext={pagedAssignedTeachers.canNext}
              onPrev={pagedAssignedTeachers.prev}
              onNext={pagedAssignedTeachers.next}
              onGoToPage={pagedAssignedTeachers.goToPage}
            />
          )}
        </div>
      </section>

      {pickerOpen && (
        <Modal
          onClose={closePicker}
          size="narrow"
          className="modal--teacher-picker"
          titleId="assign-class-teachers-title"
          title="Add teachers"
          compactTitle
          subtitle={`Choose active teachers to assign to ${klass.courseCode}.`}
          footer={
            <>
              <span className="teacher-picker__selection" aria-live="polite">
                {selectedTeacherIds.length === 0
                  ? 'No teachers selected'
                  : `${selectedTeacherIds.length} selected`}
              </span>
              <span className="spacer" />
              <button type="button" className="btn" disabled={busy} onClick={closePicker}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy || selectedTeacherIds.length === 0}
                onClick={assignSelectedTeachers}
              >
                {busy
                  ? 'Adding…'
                  : selectedTeacherIds.length > 0
                    ? `Add ${selectedTeacherIds.length} teacher${selectedTeacherIds.length === 1 ? '' : 's'}`
                    : 'Add teachers'}
              </button>
            </>
          }
        >
          <div className="teacher-picker">
            <SearchField
              label="Search teachers"
              value={pickerQuery}
              onChange={(value) => {
                setPickerQuery(value);
                setPickerPage(0);
              }}
              placeholder="Name, staff ID or email"
              autoFocus
            />

            {filteredAvailableTeachers.length === 0 ? (
              <div className="teacher-picker__empty">
                {availableTeachers.length === 0
                  ? 'Every active teacher is already assigned.'
                  : 'No teachers match your search.'}
              </div>
            ) : (
              <div className="teacher-picker__list" aria-label="Available teachers">
                {pagedAvailableTeachers.rows.map((member, index) => (
                  <label key={member.id} className="teacher-picker__option">
                    <input
                      type="checkbox"
                      checked={selectedTeacherIds.includes(member.id)}
                      onChange={() => toggleTeacher(member.id)}
                    />
                    <PersonAvatar
                      name={member.name}
                      tone={teacherTone(member.id, index)}
                      alt=""
                    />
                    <span className="person__details">
                      <span className="cell-strong">{member.name}</span>
                      <span className="cell-sub teacher-picker__meta">
                        {member.staffNumber} · {member.email}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}

            {filteredAvailableTeachers.length > 6 && (
              <Pager
                label={pagedAvailableTeachers.label}
                page={pagedAvailableTeachers.page}
                pageCount={pagedAvailableTeachers.pageCount}
                canPrev={pagedAvailableTeachers.canPrev}
                canNext={pagedAvailableTeachers.canNext}
                onPrev={pagedAvailableTeachers.prev}
                onNext={pagedAvailableTeachers.next}
                onGoToPage={pagedAvailableTeachers.goToPage}
              />
            )}
          </div>
        </Modal>
      )}

      {removingTeacher && (
        <Modal
          onClose={() => {
            if (!busy) setRemovingTeacherId(null);
          }}
          size="confirm"
          role="alertdialog"
          titleId="remove-class-teacher-title"
          title="Remove teacher from class?"
          compactTitle
          subtitle={`${removingTeacher.name} will lose access to ${klass.courseCode} and its future sessions. Their staff account will remain active.`}
          footer={
            <>
              <button type="button" className="btn" disabled={busy} onClick={() => setRemovingTeacherId(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn--danger" disabled={busy} onClick={confirmRemoval}>
                {busy ? 'Removing…' : 'Remove from class'}
              </button>
            </>
          }
        />
      )}
    </>
  );
}
