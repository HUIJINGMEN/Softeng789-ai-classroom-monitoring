import { useMemo, useState } from 'react';
import AddStudentModal from '../components/AddStudentModal';
import DirectoryState from '../components/DirectoryState';
import { IconArrowRight, IconSearch, IconUserPlus, IconUsers } from '../components/icons';
import Pager from '../components/Pager';
import PersonAvatar from '../components/PersonAvatar';
import SearchField from '../components/SearchField';
import SelectMenu from '../components/SelectMenu';
import SortableHeader from '../components/SortableHeader';
import { lastRecordedSessionForStudent } from '../lib/classRows';
import { sessionRoomLabel } from '../lib/classroomApi';
import { avatarTone, formatRate, studentRateLabel, studentRateLabelClass } from '../lib/format';
import { studentCourseLabel, studentCourses } from '../lib/studentCourses';
import { formatIsoDateInAuckland } from '../lib/sessionTime';
import { STUDENT_LEVEL_OPTIONS, studentLevelLabel } from '../lib/studentLevels';
import { compareNullableValues, usePagination, useSort } from '../lib/table';
import StudentProfile from './StudentProfile';
import type { Console } from '../hooks/useConsole';
import type { StudentLevel } from '../types';

type Key = 'name' | 'program' | 'course' | 'level' | 'rate' | 'latest';
const LEVEL_FILTER_OPTIONS: { value: 'All' | StudentLevel; label: string }[] = [
  { value: 'All', label: 'All levels' },
  ...STUDENT_LEVEL_OPTIONS
];

export default function Students({ console: c, isAdmin }: { readonly console: Console; readonly isAdmin: boolean }) {
  const [page, setPage] = useState(0);
  const [addingStudent, setAddingStudent] = useState(false);
  const [levelFilter, setLevelFilter] = useState<'All' | StudentLevel>('All');
  const { sort, toggle } = useSort<Key>('rate');

  const rows = useMemo(() => {
    const todayIso = formatIsoDateInAuckland(new Date());
    const completedOrCurrentSessions = c.sessions
      .filter((session) => session.status !== 'Cancelled' && session.date <= todayIso)
      .slice()
      .sort((a, b) => b.startTime.localeCompare(a.startTime));
    const levelFiltered =
      levelFilter === 'All'
        ? c.filteredStudents
        : c.filteredStudents.filter((student) => student.level === levelFilter);
    const built = levelFiltered.map((student, index) => {
      const courses = studentCourses(student);
      const session = lastRecordedSessionForStudent(
        student.id,
        completedOrCurrentSessions.filter((candidate) => courses.includes(candidate.course)),
        c.attendanceStatusFor
      );
      return {
        ...student,
        tone: avatarTone(student.id, index),
        courseLabel: studentCourseLabel(student),
        primaryCourse: courses[0],
        extraCourseCount: courses.length - 1,
        latestDateLabel: session?.dateLabel ?? null,
        latestRoom: session ? sessionRoomLabel(session) : null,
        latestStartTime: session?.startTime ?? null
      };
    });
    return [...built].sort((left, right) => {
      const valueFor = (row: (typeof built)[number]) => {
        if (sort.key === 'course') return row.courseLabel;
        if (sort.key === 'rate') return row.rate;
        if (sort.key === 'latest') return row.latestStartTime;
        return row[sort.key];
      };
      return compareNullableValues(valueFor(left), valueFor(right), sort.dir);
    });
  }, [c.attendanceStatusFor, c.filteredStudents, c.sessions, levelFilter, sort]);

  const paged = usePagination(rows, page, setPage);
  // Links from reports carry the backend UUID, while table rows usually carry the display ID.
  // Accept every stable student identifier so both teacher and admin class reports open the
  // correct profile instead of falling back to the student list.
  const profile = c.profileId
    ? c.students.find(
        (student) =>
          student.id === c.profileId ||
          student.recordId === c.profileId ||
          student.studentNumber === c.profileId
      )
    : null;

  if (profile) {
    // key={profile.id} forces a full remount (and a fresh set of internal state) whenever the
    // admin looks at a different student, instead of StudentProfile having to reset itself.
    return <StudentProfile key={profile.id} profile={profile} console={c} isAdmin={isAdmin} />;
  }

  return (
    <div className="page__inner">
      <section className="card card--min-list dashboard-enter stagger-1">
        <div className="card__head">
          <div className="card__title-row">
            <span className="icon-inline icon-inline--title" aria-hidden="true">
              <IconUsers />
            </span>
            <div>
              <div className="card__title">Students</div>
              <div className="card__sub">
                {c.students.length} student{c.students.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>
          <div className="card__actions">
            <span className="directory-count" aria-live="polite">
              {rows.length} of {c.students.length} students
            </span>
            <button
              type="button"
              className="btn btn--primary btn--with-icon"
              aria-haspopup="dialog"
              onClick={() => setAddingStudent(true)}
            >
              <IconUserPlus />
              <span>Add student</span>
            </button>
          </div>
        </div>

        <div className="list-toolbar list-toolbar--students" role="search" aria-label="Filter students">
          <SearchField
            value={c.query}
            placeholder="Student name or ID"
            onChange={(value) => {
              c.setQuery(value);
              setPage(0);
            }}
          />

          <div className="field">
            <span>Course</span>
            <SelectMenu
              value={c.course}
              options={c.courseOptions.map((course) => ({ value: course, label: course }))}
              ariaLabel="Filter students by course"
              onChange={(course) => {
                c.setCourse(course);
                setPage(0);
              }}
            />
          </div>

          <div className="field">
            <span>Level</span>
            <SelectMenu
              value={levelFilter}
              options={LEVEL_FILTER_OPTIONS}
              ariaLabel="Filter students by level"
              onChange={(value) => {
                setLevelFilter(value);
                setPage(0);
              }}
            />
          </div>
        </div>

        {c.studentsError && (
          <div className="notice notice--warn">
            <span className="notice__mark">!</span>
            <span>{c.studentsError}</span>
            <span className="spacer" />
            <button type="button" className="btn btn--sm" onClick={() => void c.refreshStudents()}>
              Retry
            </button>
          </div>
        )}

        {(c.studentsLoading || paged.rows.length > 0) && <table className="table table--fixed-cols">
          <SortableHeader
            columns={[
              { key: 'name', label: 'Student', width: '22%' },
              { key: 'program', label: 'Programme', width: '14%', sortable: false },
              { key: 'course', label: 'Classes', width: '13%', sortable: false },
              { key: 'level', label: 'Level', width: '10%' },
              { key: 'rate', label: 'Attendance rate', width: '12%', priority: true },
              { key: 'latest', label: 'Latest session', width: '16%', sortable: false }
            ]}
            sort={sort}
            onSort={(key) => {
              toggle(key);
              setPage(0);
            }}
          />
          <tbody>
            {paged.rows.map((student) => (
              <tr
                key={student.id}
                className="table__row--clickable"
                tabIndex={0}
                onClick={() => c.setProfileId(student.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    c.setProfileId(student.id);
                  }
                }}
              >
                <td>
                  <div className="person">
                    <PersonAvatar
                      photoUrl={student.registrationPhoto}
                      name={student.name}
                      tone={student.tone}
                      alt={`${student.name} registration`}
                    />
                    <div className="person__details">
                      <div className="cell-strong row-inline">
                        {student.name}
                        {student.accountStatus === 'withdrawn' && (
                          <span className="badge badge--neutral">Withdrawn</span>
                        )}
                      </div>
                      <div className="cell-sub">{student.id}</div>
                    </div>
                  </div>
                </td>
                <td>{student.program || <span className="cell-sub">Not provided</span>}</td>
                <td title={student.extraCourseCount > 0 ? student.courseLabel : undefined}>
                  <div className="cell-strong">{student.primaryCourse}</div>
                  <div className="cell-sub">
                    {student.extraCourseCount > 0 ? `+${student.extraCourseCount} more` : '1 class'}
                  </div>
                </td>
                <td>
                  <span className="tag">{studentLevelLabel(student.level)}</span>
                </td>
                <td>
                  {student.rate === null ? (
                    <span className="cell-sub">Not available</span>
                  ) : (
                    <>
                      <div className="cell-strong mono">{formatRate(student.rate)}</div>
                      <div className={studentRateLabelClass(student.rate)}>{studentRateLabel(student.rate)}</div>
                    </>
                  )}
                </td>
                <td>
                  {student.latestDateLabel ? (
                    <>
                      <div className="cell-strong">{student.latestDateLabel}</div>
                      <div className="cell-sub">{student.latestRoom}</div>
                    </>
                  ) : (
                    <span className="cell-sub">No recent session</span>
                  )}
                </td>
                <td className="table__action-cell">
                  <button
                    type="button"
                    className="btn btn--quiet btn--sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      c.setProfileId(student.id);
                    }}
                  >
                    View profile <IconArrowRight />
                  </button>
                </td>
              </tr>
            ))}
            {c.studentsLoading && c.students.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <output className="empty empty--inline">Loading students…</output>
                </td>
              </tr>
            )}
          </tbody>
        </table>}

        {!c.studentsLoading && !c.studentsError && rows.length === 0 && (
          <DirectoryState
            icon={c.students.length === 0 ? <IconUsers /> : <IconSearch />}
            title={c.students.length === 0 ? 'No students yet' : 'No matching students'}
            description={
              c.students.length === 0
                ? 'Add a student to start building the institution roster.'
                : 'Adjust the name, course or level filters and try again.'
            }
            action={
              c.students.length === 0 ? (
                <button type="button" className="btn btn--primary btn--with-icon" onClick={() => setAddingStudent(true)}>
                  <IconUserPlus /> Add student
                </button>
              ) : (
                <button type="button" className="btn btn--sm" onClick={() => { c.setQuery(''); c.setCourse('All'); setLevelFilter('All'); }}>
                  Clear filters
                </button>
              )
            }
          />
        )}

        {rows.length > 0 && (
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
        )}
      </section>

      {addingStudent && (
        <AddStudentModal
          isAdmin={isAdmin}
          onClose={() => setAddingStudent(false)}
          onCreated={(message) => {
            setAddingStudent(false);
            c.showToast(message);
            if (isAdmin) void c.refreshStudents();
          }}
        />
      )}
    </div>
  );
}
