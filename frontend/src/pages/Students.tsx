import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import AddStudentModal from '../components/AddStudentModal';
import DirectoryState from '../components/DirectoryState';
import { IconSearch, IconUserPlus, IconUsers } from '../components/icons';
import Pager from '../components/Pager';
import PersonAvatar from '../components/PersonAvatar';
import SearchField from '../components/SearchField';
import SelectMenu from '../components/SelectMenu';
import SortableHeader from '../components/SortableHeader';
import MobileStudentDirectory from '../components/mobile/MobileStudentDirectory';
import useMediaQuery from '../hooks/useMediaQuery';
import { useStudentDirectoryPage } from '../hooks/useStudentDirectoryPage';
import { lastRecordedSessionForStudent } from '../lib/classRows';
import { sessionRoomLabel } from '../lib/classroomApi';
import { avatarTone, formatRate, studentRateLabel, studentRateLabelClass } from '../lib/format';
import { studentCourseLabel, studentCourses } from '../lib/studentCourses';
import { formatIsoDateInAuckland } from '../lib/sessionTime';
import { STUDENT_LEVEL_OPTIONS, studentLevelLabel } from '../lib/studentLevels';
import { useSort } from '../lib/table';
import StudentProfile from './StudentProfile';
import type { Console } from '../hooks/useConsole';
import type { StudentLevel } from '../types';

type Key = 'name' | 'program' | 'course' | 'level' | 'rate' | 'latest';
const LEVEL_FILTER_OPTIONS: { value: 'All' | StudentLevel; label: string }[] = [
  { value: 'All', label: 'All levels' },
  ...STUDENT_LEVEL_OPTIONS
];

export default function Students({ console: c, isAdmin }: { readonly console: Console; readonly isAdmin: boolean }) {
  const isMobile = useMediaQuery('(max-width: 760px)');
  const [page, setPage] = useState(0);
  const [addingStudent, setAddingStudent] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [levelFilter, setLevelFilter] = useState<'All' | StudentLevel>('All');
  const { sort, toggle } = useSort<Key>('rate');
  const deferredQuery = useDeferredValue(c.query);
  const refreshKey = useMemo(
    () => `${reloadToken}:` + c.students
      .map((student) => `${student.recordId}:${student.accountStatus}:${student.courses?.join(',')}`)
      .join('|'),
    [c.students, reloadToken]
  );
  const serverSort = sort.key === 'rate' ? 'attendance' : sort.key === 'level' ? 'level' : 'name';
  const directory = useStudentDirectoryPage(page, 8, {
    query: deferredQuery || undefined,
    course: c.course === 'All courses' || c.course === 'All' ? undefined : c.course,
    level: levelFilter === 'All' ? undefined : levelFilter,
    sort: serverSort,
    direction: sort.dir === 1 ? 'asc' : 'desc'
  }, refreshKey);

  const rows = useMemo(() => {
    const todayIso = formatIsoDateInAuckland(new Date());
    const completedOrCurrentSessions = c.sessions
      .filter((session) => session.status !== 'Cancelled' && session.date <= todayIso)
      .slice()
      .sort((a, b) => b.startTime.localeCompare(a.startTime));
    return directory.rows.map((student, index) => {
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
  }, [c.attendanceStatusFor, c.sessions, directory.rows]);

  const pageCount = Math.max(1, directory.totalPages);
  const pageLabel = directory.totalItems === 0
    ? 'No records'
    : `Showing ${directory.page * directory.size + 1}–${directory.page * directory.size + rows.length} of ${directory.totalItems}`;

  useEffect(() => {
    if (!directory.loading && directory.totalPages > 0 && page >= directory.totalPages) {
      setPage(directory.totalPages - 1);
    }
  }, [directory.loading, directory.totalPages, page]);
  const openStudent = (studentId: string) => {
    c.setProfileId(studentId);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
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

  if (isMobile) {
    return (
      <div className="page__inner page__inner--mobile-directory">
        <MobileStudentDirectory
          scope={isAdmin ? 'institution' : 'assigned'}
          records={rows.map((student) => ({
            id: student.id,
            name: student.name,
            studentNumber: student.studentNumber ?? student.id,
            photoUrl: student.registrationPhoto,
            tone: student.tone,
            primaryCourse: student.primaryCourse,
            extraCourseCount: student.extraCourseCount,
            rate: student.rate,
            withdrawn: student.accountStatus === 'withdrawn'
          }))}
          totalCount={c.students.length}
          query={c.query}
          course={c.course}
          courseOptions={c.courseOptions}
          level={levelFilter}
          loading={directory.loading}
          error={directory.error}
          pageLabel={pageLabel}
          page={directory.page}
          pageCount={pageCount}
          canPrev={directory.hasPrevious}
          canNext={directory.hasNext}
          onQueryChange={(value) => { c.setQuery(value); setPage(0); }}
          onCourseChange={(value) => { c.setCourse(value); setPage(0); }}
          onLevelChange={(value) => { setLevelFilter(value); setPage(0); }}
          onAdd={() => setAddingStudent(true)}
          onOpen={openStudent}
          onRetry={() => setReloadToken((current) => current + 1)}
          onClear={() => { c.setQuery(''); c.setCourse('All courses'); setLevelFilter('All'); setPage(0); }}
          onPrev={() => setPage((current) => Math.max(0, current - 1))}
          onNext={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
          onGoToPage={(target) => setPage(Math.max(0, Math.min(pageCount - 1, target)))}
        />
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
                {c.students.length} student{c.students.length === 1 ? '' : 's'} in scope
              </div>
            </div>
          </div>
          <div className="card__actions">
            <span className="directory-count" aria-live="polite">
              {directory.totalItems} matching student{directory.totalItems === 1 ? '' : 's'}
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

        {directory.error && (
          <div className="notice notice--warn">
            <span className="notice__mark">!</span>
            <span>{directory.error}</span>
            <span className="spacer" />
            <button type="button" className="btn btn--sm" onClick={() => setReloadToken((current) => current + 1)}>
              Retry
            </button>
          </div>
        )}

        {(directory.loading || rows.length > 0) && <table className="table table--fixed-cols table--mobile-students">
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
            {rows.map((student) => (
              <tr
                key={student.id}
                className="table__row--clickable"
                tabIndex={0}
                onClick={() => openStudent(student.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openStudent(student.id);
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
              </tr>
            ))}
            {directory.loading && rows.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <output className="empty empty--inline">Loading students…</output>
                </td>
              </tr>
            )}
          </tbody>
        </table>}

        {!directory.loading && !directory.error && rows.length === 0 && (
          <DirectoryState
            icon={directory.totalItems === 0 && !c.query && c.course === 'All courses' && levelFilter === 'All' ? <IconUsers /> : <IconSearch />}
            title={directory.totalItems === 0 && !c.query && c.course === 'All courses' && levelFilter === 'All' ? 'No students yet' : 'No matching students'}
            description={
              directory.totalItems === 0 && !c.query && c.course === 'All courses' && levelFilter === 'All'
                ? 'Add a student to start building the institution roster.'
                : 'Adjust the name, course or level filters and try again.'
            }
            action={
              directory.totalItems === 0 && !c.query && c.course === 'All courses' && levelFilter === 'All' ? (
                <button type="button" className="btn btn--primary btn--with-icon" onClick={() => setAddingStudent(true)}>
                  <IconUserPlus /> Add student
                </button>
              ) : (
                <button type="button" className="btn btn--sm" onClick={() => { c.setQuery(''); c.setCourse('All courses'); setLevelFilter('All'); setPage(0); }}>
                  Clear filters
                </button>
              )
            }
          />
        )}

        {directory.totalItems > 0 && (
          <Pager
            label={pageLabel}
            page={directory.page}
            pageCount={pageCount}
            canPrev={directory.hasPrevious}
            canNext={directory.hasNext}
            onPrev={() => setPage((current) => Math.max(0, current - 1))}
            onNext={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
            onGoToPage={(target) => setPage(Math.max(0, Math.min(pageCount - 1, target)))}
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
