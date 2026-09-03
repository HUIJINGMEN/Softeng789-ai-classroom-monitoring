import { useMemo, useState } from 'react';
import { IconUsers } from '../components/icons';
import Pager from '../components/Pager';
import PersonAvatar from '../components/PersonAvatar';
import SelectMenu from '../components/SelectMenu';
import SortableHeader from '../components/SortableHeader';
import { avatarTone, formatRate } from '../lib/format';
import { studentCourseLabel, studentCourses } from '../lib/studentCourses';
import { sortRows, usePagination, useSort } from '../lib/table';
import StudentProfile from './StudentProfile';
import type { Console } from '../hooks/useConsole';

type Key = 'name' | 'program' | 'course' | 'rate' | 'latest';

// A per-student read on their own attendance, distinct from the class-level "needs attention"
// thresholds used elsewhere (Lowest Attendance) — that one only flags classes doing genuinely
// badly; this one describes an individual's attendance across the ordinary range.
function rateLabel(rate: number): string {
  if (rate >= 80) return 'Good';
  if (rate >= 60) return 'Fair';
  return 'Needs attention';
}

function rateLabelClass(rate: number): string {
  if (rate >= 80) return 'rate-quality rate-quality--ok';
  if (rate >= 60) return 'rate-quality rate-quality--warn';
  return 'rate-quality rate-quality--danger';
}

export default function Students({ console: c }: { readonly console: Console }) {
  const [page, setPage] = useState(0);
  const { sort, toggle } = useSort<Key>('name');

  const rows = useMemo(() => {
    const built = c.filteredStudents.map((student, index) => {
      const courses = studentCourses(student);
      const session = c.sessions.find((candidate) => courses.includes(candidate.course));
      return {
        ...student,
        tone: avatarTone(student.id, index),
        courseLabel: studentCourseLabel(student),
        primaryCourse: courses[0],
        extraCourseCount: courses.length - 1,
        latestDateLabel: session?.dateLabel ?? null,
        latestRoom: session?.room ?? null
      };
    });
    return sortRows(built, sort, (row, key) => {
      if (key === 'course') return row.courseLabel;
      if (key === 'rate') return row.rate ?? -1;
      if (key === 'latest') return row.latestDateLabel ?? '';
      return row[key];
    });
  }, [c.filteredStudents, c.sessions, sort]);

  const paged = usePagination(rows, page, setPage);
  const profile = c.profileId ? c.students.find((s) => s.id === c.profileId) : null;

  if (profile) {
    // key={profile.id} forces a full remount (and a fresh set of internal state) whenever the
    // admin looks at a different student, instead of StudentProfile having to reset itself.
    return <StudentProfile key={profile.id} profile={profile} console={c} />;
  }

  return (
    <div className="page__inner">
      <div className="toolbar">
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

        <label className="field">
          Search
          <input
            value={c.query}
            placeholder="Student name or ID"
            onChange={(e) => {
              c.setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>

        <span className="spacer" />
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

      {c.studentsLoading && (
        <div className="notice notice--info">
          <span className="notice__mark">i</span>
          <span>Loading students from the Education Server...</span>
        </div>
      )}

      <section className="card dashboard-enter stagger-1">
        <div className="card__head">
          <div className="card__title-row">
            <span className="icon-inline icon-inline--title" aria-hidden="true">
              <IconUsers />
            </span>
            <div>
              <div className="card__title">Students</div>
              <div className="card__sub">{rows.length} student{rows.length === 1 ? '' : 's'}</div>
            </div>
          </div>
        </div>
        <table className="table table--fixed-cols">
          <SortableHeader
            columns={[
              { key: 'name', label: 'Student', width: '26%' },
              { key: 'program', label: 'Programme', width: '16%' },
              { key: 'course', label: 'Classes', width: '15%' },
              { key: 'rate', label: 'Attendance rate', width: '12%' },
              { key: 'latest', label: 'Latest session', width: '16%' }
            ]}
            sort={sort}
            onSort={toggle}
          />
          <tbody>
            {paged.rows.map((student) => (
              <tr
                key={student.id}
                className="table__row--clickable"
                tabIndex={0}
                onClick={() => c.setProfileId(student.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') c.setProfileId(student.id);
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
                  {student.rate === null ? (
                    <span className="cell-sub">Not available</span>
                  ) : (
                    <>
                      <div className="cell-strong mono">{formatRate(student.rate)}</div>
                      <div className={rateLabelClass(student.rate)}>{rateLabel(student.rate)}</div>
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
                    View profile →
                  </button>
                </td>
              </tr>
            ))}
            {paged.rows.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <div className="empty empty--inline">
                    No students found for the current filters.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <Pager
          label={paged.label}
          pageLabel={paged.pageLabel}
          canPrev={paged.canPrev}
          canNext={paged.canNext}
          onPrev={paged.prev}
          onNext={paged.next}
        />
      </section>
    </div>
  );
}
