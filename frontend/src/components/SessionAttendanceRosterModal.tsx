import { useMemo, useState } from 'react';
import { IconChevronRight } from './icons';
import Modal from './Modal';
import Pager from './Pager';
import PersonAvatar from './PersonAvatar';
import SearchField from './SearchField';
import SelectMenu, { type SelectMenuOption } from './SelectMenu';
import {
  ATTENDANCE_COUNT_COLUMNS,
  buildAttendanceRoster,
  filterAttendanceRoster,
  type AttendanceRosterFilter
} from '../features/class-attendance/classAttendanceModel';
import { attendanceStatusLabel, avatarTone, statusClass } from '../lib/format';
import { sessionRoomLabel } from '../lib/classroomApi';
import { usePagination } from '../lib/table';
import type { AttendanceCounts } from '../lib/attendanceAnalytics';
import type { AttendanceRow, Session, Student } from '../types';

interface Props {
  readonly session: Session;
  readonly attendanceRows: readonly AttendanceRow[];
  readonly students: readonly Student[];
  readonly counts: AttendanceCounts;
  readonly onOpenStudent: (studentId: string) => void;
  readonly onClose: () => void;
}

/** Read-only roster for one completed session. The modal owns its search, status filter and
 * pagination so the class summary table remains a compact comparison surface. */
export default function SessionAttendanceRosterModal({
  session,
  attendanceRows,
  students,
  counts,
  onOpenStudent,
  onClose
}: Props) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AttendanceRosterFilter>('All');
  const [page, setPage] = useState(0);
  const roster = useMemo(
    () => buildAttendanceRoster(attendanceRows, students),
    [attendanceRows, students]
  );
  const matchingRows = useMemo(
    () => filterAttendanceRoster(roster, query, statusFilter),
    [query, roster, statusFilter]
  );
  const paged = usePagination(matchingRows, page, setPage, 6);
  const statusOptions = useMemo<readonly SelectMenuOption<AttendanceRosterFilter>[]>(() => [
    { value: 'All', label: `All students (${counts.total})` },
    ...ATTENDANCE_COUNT_COLUMNS.map((column) => ({
      value: column.status,
      label: `${column.label} (${counts[column.countKey]})`
    }))
  ], [counts]);

  return (
    <Modal
      size="wide"
      className="session-roster-modal"
      title="Session roster"
      compactTitle
      subtitle={`${counts.total} students · ${session.dateLabel} · ${session.time} · ${sessionRoomLabel(session)}`}
      closeButton
      onClose={onClose}
      footer={<button type="button" className="btn btn--quiet" onClick={onClose}>Close</button>}
    >
      <div className="session-roster-modal__body">
        <div className="session-roster-modal__toolbar">
          <SearchField
            autoFocus
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(0);
            }}
            label="Search students"
            placeholder="Student name or ID"
          />
          <div className="field session-roster-modal__filter">
            <label>Status</label>
            <SelectMenu
              value={statusFilter}
              options={statusOptions}
              ariaLabel="Filter students by attendance status"
              onChange={(status) => {
                setStatusFilter(status);
                setPage(0);
              }}
            />
          </div>
        </div>

        <div className="session-roster-modal__result" aria-live="polite">
          <strong>{matchingRows.length}</strong> student{matchingRows.length === 1 ? '' : 's'} shown
        </div>

        {matchingRows.length === 0 && (
          <div className="empty empty--compact">
            {roster.length === 0
              ? 'No students were enrolled for this session.'
              : 'No students match these filters.'}
          </div>
        )}
        {matchingRows.length > 0 && (
          <>
            <div className="session-roster-modal__columns" aria-hidden="true">
              <span>Student</span>
              <span>Attendance status</span>
            </div>
            <ul className="session-roster-modal__students">
              {paged.rows.map((student) => {
                return (
                  <li key={student.studentId}>
                    <button
                      type="button"
                      className="session-roster-modal__student"
                      disabled={!student.profileAvailable}
                      title={student.profileAvailable ? 'Open student profile' : 'Historical attendance record'}
                      onClick={() => onOpenStudent(student.studentId)}
                    >
                      <PersonAvatar
                        photoUrl={student.photoUrl}
                        name={student.studentName}
                        tone={avatarTone(student.studentId, 0)}
                        alt=""
                      />
                      <span className="session-roster-modal__identity">
                        <strong>{student.studentName}</strong>
                        <span>{student.studentNumber}</span>
                      </span>
                      <span className="session-roster-modal__student-action">
                        <span className={statusClass(student.status)}>{attendanceStatusLabel(student.status)}</span>
                        {student.profileAvailable && <IconChevronRight />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <Pager
              label={paged.label}
              page={paged.page}
              pageCount={paged.pageCount}
              canPrev={paged.canPrev}
              canNext={paged.canNext}
              onPrev={paged.prev}
              onNext={paged.next}
              onGoToPage={paged.goToPage}
            />
          </>
        )}
      </div>
    </Modal>
  );
}
