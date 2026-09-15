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
  const [studentPage, setStudentPage] = useState(0);
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
  const availableStudents = useMemo(
    () =>
      allStudents.filter(
        (student) =>
          student.accountStatus === 'active' &&
          !students.some((existing) => existing.recordId === student.recordId)
      ),
    [allStudents, students]
  );
  const studentQuery = studentSearch.trim().toLowerCase();
  const studentSearchReady = studentQuery.length >= 2;
  const filteredAvailableStudents = useMemo(() => {
    if (!studentSearchReady) return [];
    return availableStudents
      .filter(
        (student) =>
          student.name.toLowerCase().includes(studentQuery) ||
          (student.studentNumber ?? '').toLowerCase().includes(studentQuery) ||
          student.id.toLowerCase().includes(studentQuery)
      )
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [availableStudents, studentQuery, studentSearchReady]);
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

  const pagedAvailableStudents = usePagination(filteredAvailableStudents, studentPage, setStudentPage, 6);
  const pagedRoster = usePagination(rosterByAttention, rosterPage, setRosterPage, 8);

  return (
    <section className="card class-roster-card dashboard-enter stagger-2">
      <div className="card__body class-roster-card__body">
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
              onChange={(value) => {
                setStudentSearch(value);
                setStudentPage(0);
              }}
              placeholder="Name or student number"
            />
            <div className="course-checklist course-checklist--scroll" aria-label="Choose students to add">
              {pagedAvailableStudents.rows.map((student) => (
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
              {!studentSearchReady && (
                <div className="student-picker-state">
                  {studentQuery.length === 0
                    ? 'Search by name or student number to find students.'
                    : 'Enter at least 2 characters to search.'}
                </div>
              )}
              {studentSearchReady && filteredAvailableStudents.length === 0 && (
                <div className="student-picker-state">No matching students.</div>
              )}
            </div>
            {studentSearchReady && filteredAvailableStudents.length > 0 && (
              <div className="student-picker-pager">
                <Pager
                  label={pagedAvailableStudents.label}
                  page={pagedAvailableStudents.page}
                  pageCount={pagedAvailableStudents.pageCount}
                  canPrev={pagedAvailableStudents.canPrev}
                  canNext={pagedAvailableStudents.canNext}
                  onPrev={pagedAvailableStudents.prev}
                  onNext={pagedAvailableStudents.next}
                  onGoToPage={pagedAvailableStudents.goToPage}
                />
              </div>
            )}
            <div className="student-picker-footer">
              <div className="student-picker-selection" aria-live="polite">
                <span>
                  {selectedStudentIds.length === 0
                    ? 'No students selected'
                    : `${selectedStudentIds.length} student${selectedStudentIds.length === 1 ? '' : 's'} selected`}
                </span>
                {selectedStudentIds.length > 0 && (
                  <button type="button" className="btn btn--quiet btn--sm" onClick={() => setSelectedStudentIds([])}>
                    Clear selection
                  </button>
                )}
              </div>
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy || selectedStudentIds.length === 0}
                onClick={() =>
                  runAction(() =>
                    addClassStudents(klass.id, selectedStudentIds).then(() => {
                      setSelectedStudentIds([]);
                      setStudentSearch('');
                      setStudentPage(0);
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
          </div>
        )}

        <div className="class-roster-heading">
          <div>
            <div className="card__sub students-panel__roster-label">Enrolled</div>
            <div className="cell-sub">{students.length} student{students.length === 1 ? '' : 's'} in this class</div>
          </div>
        </div>
        <div className="class-roster-toolbar">
          <SearchField
            value={rosterSearch}
            onChange={(value) => {
              setRosterSearch(value);
              setRosterPage(0);
            }}
            label="Search roster"
            placeholder="Name or student number"
          />
          <span className="cell-sub">Sorted by attendance requiring attention</span>
        </div>

        {students.length > 0 && (
          <div className="roster-bulk-bar class-roster-list-head">
            <label className="class-roster-select-all">
              <input
                type="checkbox"
                aria-label="Select all students in this class"
                checked={selectedRosterIds.length === students.length}
                onChange={() =>
                  setSelectedRosterIds(
                    selectedRosterIds.length === students.length
                      ? []
                      : students.flatMap((student) => student.recordId ? [student.recordId] : [])
                  )
                }
              />
            </label>
            <span>Student</span>
            <div className="class-roster-list-head__meta">
              <span>Level</span>
              <span>Attendance</span>
              <span>Last recorded</span>
              <div className="class-roster-list-head__actions">
                {selectedRosterIds.length > 0 ? (
                  <>
                    <span>{selectedRosterIds.length} selected</span>
                    <button
                      type="button"
                      className="btn btn--sm"
                      disabled={busy}
                      onClick={() => setConfirmingBatchWithdraw(true)}
                    >
                      Withdraw selected
                    </button>
                  </>
                ) : (
                  <span>Actions</span>
                )}
              </div>
            </div>
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
                <span className="tag roster-row__level">{studentLevelLabel(student.level)}</span>
                <div className="roster-row__attendance">
                  <MiniAttendanceRing rate={student.rate} tier="student" />
                </div>
                <div className="cell-sub roster-row__last">
                  {lastSession ? `Last recorded ${lastSession.dateLabel}` : 'No attendance yet'}
                </div>
                {movingStudentId === student.recordId ? (
                  <div className="row-inline roster-row__actions roster-row__actions--editing">
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
                  <div className="row-inline roster-row__actions">
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
                      className="btn btn--quiet btn--sm"
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
          <output className="empty empty--inline">Loading roster…</output>
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
