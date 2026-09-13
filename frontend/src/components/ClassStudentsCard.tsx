import { useMemo, useState } from 'react';
import MiniAttendanceRing from './MiniAttendanceRing';
import Modal from './Modal';
import PersonAvatar from './PersonAvatar';
import Pager from './Pager';
import SearchField from './SearchField';
import SelectMenu from './SelectMenu';
import { lastRecordedSessionForStudent, withClassAttendanceRates } from '../lib/classRows';
import {
  addClassStudents,
  removeClassStudent,
  removeClassStudents,
  transferClassStudent,
  type ClassApiResponse
} from '../lib/classAdminApi';
import { avatarTone } from '../lib/format';
import { studentLevelLabel } from '../lib/studentLevels';
import { usePagination } from '../lib/table';
import type { Console } from '../hooks/useConsole';
import type { Session, Student } from '../types';

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
  /** This class's own sessions, sorted most-current-first — used for each student's class-specific
   *  attendance rate and most recent recorded mark. */
  readonly classSessions: readonly Session[];
  readonly attendanceStatusFor: Console['attendanceStatusFor'];
  /** MyClassDetail.tsx's read-only roster makes the whole row a button to open the student's
   *  Profile — this card can't do that (a row already contains Move/Withdraw buttons, and a
   *  button can't nest inside a button), so only the name/avatar block is the link instead. */
  readonly onOpenStudent: (studentId: string) => void;
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
  refreshStudents,
  classSessions,
  attendanceStatusFor,
  onOpenStudent
}: Props) {
  const [studentSearch, setStudentSearch] = useState('');
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterPage, setRosterPage] = useState(0);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedRosterIds, setSelectedRosterIds] = useState<string[]>([]);
  const [confirmingBatchWithdraw, setConfirmingBatchWithdraw] = useState(false);
  const [movingStudentId, setMovingStudentId] = useState<string | null>(null);
  const [moveTargetId, setMoveTargetId] = useState('');

  const toggleAddStudent = (id: string) => {
    setSelectedStudentIds((current) =>
      current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]
    );
  };

  const toggleRosterStudent = (id: string) => {
    setSelectedRosterIds((current) =>
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

  // Lowest class-specific attendance first; unrecorded students stay at the end.
  const rosterByAttention = useMemo(
    () =>
      withClassAttendanceRates(students, classSessions, attendanceStatusFor)
        .filter((student) => {
          const query = rosterSearch.trim().toLowerCase();
          return (
            !query ||
            student.name.toLowerCase().includes(query) ||
            student.id.toLowerCase().includes(query)
          );
        })
        .sort((a, b) => {
          if (a.rate === null && b.rate === null) return 0;
          if (a.rate === null) return 1;
          if (b.rate === null) return -1;
          return a.rate - b.rate;
        }),
    [students, classSessions, attendanceStatusFor, rosterSearch]
  );

  const pagedRoster = usePagination(rosterByAttention, rosterPage, setRosterPage, 8);

  return (
    <section className="card dashboard-enter stagger-2">
      <div className="card__body">
        <div className="card__title card__title--spaced">Roster</div>

        {studentsError && (
          <div className="notice notice--warn">
            <span className="notice__mark" aria-hidden="true" />
            <span>{studentsError}</span>
            <span className="spacer" />
            <button type="button" className="btn btn--sm" onClick={refreshStudents}>
              Retry
            </button>
          </div>
        )}

        {availableStudents.length > 0 && (
          <div className="add-panel add-panel--top">
            <SearchField
              label="Search students"
              value={studentSearch}
              onChange={setStudentSearch}
              placeholder="Name or student number"
            />
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

        <div className="class-roster-heading">
          <div>
            <div className="card__sub students-panel__roster-label">Enrolled</div>
            <div className="cell-sub">{students.length} student{students.length === 1 ? '' : 's'} in this class</div>
          </div>
          <SearchField
            className="class-roster-heading__search"
            value={rosterSearch}
            onChange={(value) => {
              setRosterSearch(value);
              setRosterPage(0);
            }}
            label="Search roster"
            placeholder="Name or student number"
          />
        </div>

        {students.length > 0 && (
          <div className="roster-bulk-bar">
            <label className="course-checklist__item">
              <input
                type="checkbox"
                checked={selectedRosterIds.length === students.length}
                onChange={() =>
                  setSelectedRosterIds(
                    selectedRosterIds.length === students.length
                      ? []
                      : students.flatMap((student) => student.recordId ? [student.recordId] : [])
                  )
                }
              />
              <span>{selectedRosterIds.length > 0 ? `${selectedRosterIds.length} selected` : 'Select roster'}</span>
            </label>
            {selectedRosterIds.length > 0 && (
              <button
                type="button"
                className="btn btn--sm"
                disabled={busy}
                onClick={() => setConfirmingBatchWithdraw(true)}
              >
                Withdraw selected
              </button>
            )}
          </div>
        )}

        {pagedRoster.rows.map((student) => {
          const lastSession = lastRecordedSessionForStudent(student.id, classSessions, attendanceStatusFor);
          return (
            <div key={student.recordId} className="kv class-roster-row">
              <input
                type="checkbox"
                aria-label={`Select ${student.name}`}
                checked={selectedRosterIds.includes(student.recordId as string)}
                onChange={() => toggleRosterStudent(student.recordId as string)}
              />
              <button
                type="button"
                className="person person--link"
                onClick={() => onOpenStudent(student.id)}
              >
                <PersonAvatar
                  photoUrl={student.registrationPhoto}
                  name={student.name}
                  tone={avatarTone(student.id, 0)}
                  alt={`${student.name} registration`}
                />
                <div className="person__details">
                  <div className="cell-strong cell-strong--compact">{student.name}</div>
                  <div className="cell-sub">{student.studentNumber ?? student.id}</div>
                </div>
              </button>
              <div className="roster-row__meta">
                <span className="tag">{studentLevelLabel(student.level)}</span>
                <MiniAttendanceRing rate={student.rate} tier="student" />
                <div className="cell-sub">
                  {lastSession ? `Last recorded ${lastSession.dateLabel}` : 'No attendance yet'}
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
            </div>
          );
        })}

        {!studentsLoading && rosterByAttention.length === 0 && !studentsError && (
          <div className="empty empty--compact">
            {students.length === 0 ? 'No students enrolled in this class yet.' : 'No students match your search.'}
          </div>
        )}

        {rosterByAttention.length > 0 && (
          <Pager
            label={pagedRoster.label}
            page={pagedRoster.page}
            pageCount={pagedRoster.pageCount}
            canPrev={pagedRoster.canPrev}
            canNext={pagedRoster.canNext}
            onPrev={pagedRoster.prev}
            onNext={pagedRoster.next}
            onGoToPage={pagedRoster.goToPage}
          />
        )}

        {studentsLoading && students.length === 0 && (
          <div className="empty empty--inline" role="status">Loading roster…</div>
        )}
      </div>
      {confirmingBatchWithdraw && (
        <Modal
          size="confirm"
          role="alertdialog"
          titleId="batch-withdraw-title"
          title="Withdraw selected students?"
          subtitle={`${selectedRosterIds.length} student${selectedRosterIds.length === 1 ? '' : 's'} will leave ${klass.offeringCode}. Their historical records will be kept.`}
          onClose={() => setConfirmingBatchWithdraw(false)}
          footer={
            <>
              <button type="button" className="btn" disabled={busy} onClick={() => setConfirmingBatchWithdraw(false)}>Cancel</button>
              <button type="button" className="btn btn--danger" disabled={busy} onClick={() => void runAction(() => removeClassStudents(klass.id, selectedRosterIds).then(() => { setSelectedRosterIds([]); setConfirmingBatchWithdraw(false); refreshStudents(); }))}>{busy ? 'Withdrawing…' : 'Withdraw from class'}</button>
            </>
          }
        />
      )}
    </section>
  );
}
