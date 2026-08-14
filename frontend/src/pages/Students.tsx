import { useMemo, useState } from 'react';
import AddStudentModal from '../components/AddStudentModal';
import Pager from '../components/Pager';
import SelectMenu from '../components/SelectMenu';
import SortableHeader from '../components/SortableHeader';
import { eventMatchesStudent, eventSessionLabel, sessionDisplayName } from '../lib/eventDisplay';
import {
  avatarTone,
  faceEnrollmentLabel,
  initials,
  rateClass,
  rateWidthClass,
  statusClass
} from '../lib/format';
import { studentCourseLabel, studentCourses } from '../lib/studentCourses';
import { sortRows, usePagination, useSort } from '../lib/table';
import type { Console } from '../hooks/useConsole';

type Key = 'name' | 'course' | 'rate' | 'latest';

export default function Students({ console: c }: { console: Console }) {
  const [page, setPage] = useState(0);
  const [addingStudent, setAddingStudent] = useState(false);
  const { sort, toggle } = useSort<Key>('name');

  const rows = useMemo(() => {
    const built = c.filteredStudents.map((student, index) => {
      const courses = studentCourses(student);
      const session = c.sessions.find((candidate) => courses.includes(candidate.course));
      return {
        ...student,
        tone: avatarTone(student.id, index),
        courseLabel: studentCourseLabel(student),
        latest: session ? `${sessionDisplayName(session)} · ${session.dateLabel}` : '—'
      };
    });
    return sortRows(built, sort, (row, key) => {
      if (key === 'course') return row.courseLabel;
      if (key === 'rate') return row.rate ?? -1;
      return row[key];
    });
  }, [c.filteredStudents, c.sessions, sort]);

  const paged = usePagination(rows, page, setPage);
  const profile = c.profileId ? c.students.find((s) => s.id === c.profileId) : null;
  const courseOptions = c.courseOptions.filter((course) => course !== 'All courses');

  if (profile) {
    const confirmed = c.events.filter(
      (event) =>
        eventMatchesStudent(event, profile) &&
        (event.status === 'Confirmed' || event.status === 'Corrected')
    );

    const info: [string, string][] = [
      ['Student ID', profile.id],
      ['Programme', profile.program],
      ['Enrolled courses', studentCourseLabel(profile)],
      ['University email', profile.email],
      ['Assigned seat', profile.seat],
      ['Record status', profile.status]
    ];
    const faceStatus = profile.faceEnrollmentStatus ?? 'NOT_ENROLLED';

    return (
      <div className="page__inner">
        <button
          type="button"
          className="btn page-action"
          onClick={() => c.setProfileId(null)}
        >
          ← Back to all students
        </button>

        <section className="card">
          <div className="card__body profile-hero">
            {profile.registrationPhoto ? (
              <img
                className="person__photo person__photo--large"
                src={profile.registrationPhoto}
                alt={`${profile.name} registration`}
              />
            ) : (
              <div
                className={`person__avatar person__avatar--large ${avatarTone(profile.id, 0)}`}
              >
                {initials(profile.name)}
              </div>
            )}
            <div className="profile-hero__main">
              <div className="profile-hero__name">
                {profile.name}
              </div>
              <div className="cell-sub profile-hero__sub">
                {profile.id} · {studentCourseLabel(profile)} · {profile.program}
              </div>
            </div>
            <div className="profile-hero__stats">
              <div>
                <div className="stat__label">Attendance</div>
                <div className="profile-hero__metric">
                  {formatRate(profile.rate)}
                </div>
              </div>
              <div>
                <div className="stat__label">Confirmed events</div>
                <div className="profile-hero__metric">{confirmed.length}</div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid-2">
          <section className="card">
            <div className="card__body">
              <div className="card__title card__title--spaced">
                Basic information
              </div>
              {info.map(([key, value]) => (
                <div key={key} className="kv">
                  <span className="kv__k">{key}</span>
                  <span className="kv__v">{value}</span>
                </div>
              ))}
              <div className="kv">
                <span className="kv__k">Face Enrollment</span>
                <span className={statusClass(faceStatus)}>{faceEnrollmentLabel(faceStatus)}</span>
              </div>
              {profile.faceEnrollmentMessage && (
                <div className="notice notice--info profile-note">
                  <span className="notice__mark">i</span>
                  <span>{profile.faceEnrollmentMessage}</span>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card__body">
              <div className="card__title card__title--spaced">
                Attendance history
              </div>
              {c.sessions.filter((session) => studentCourses(profile).includes(session.course)).map((session) => {
                const status = c.attendanceStatusFor(profile.id, session.id);
                return (
                  <div key={session.id} className="kv kv--history">
                    <div>
                      <div className="cell-strong cell-strong--compact">
                        {session.title}
                      </div>
                      <div className="cell-sub">
                        {sessionDisplayName(session)} · {session.dateLabel}
                      </div>
                    </div>
                    <span className={statusClass(status)}>{status}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card">
            <div className="card__body">
              <div className="card__title card__title--spaced">
                Teacher feedback
              </div>
              <div className="empty empty--inline">
                No teacher feedback has been recorded for this student.
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card__body">
              <div className="card__title">Recent confirmed events</div>
              <div className="card__sub card__sub--events">
                Teacher-confirmed or corrected observations only.
              </div>
              {confirmed.map((event) => (
                <div key={event.id} className="kv kv--event">
                  <div>
                    <div className="cell-strong cell-strong--compact">
                      {event.type}
                    </div>
                    <div className="cell-sub">
                      {eventSessionLabel(event, c.sessions)} · {event.start} · {event.duration}
                    </div>
                  </div>
                  <span className={statusClass(event.status)}>{event.status}</span>
                </div>
              ))}
              {confirmed.length === 0 && (
                <div className="empty empty--inline">
                  No confirmed events for this student.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    );
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

        <button
          type="button"
          className="btn btn--primary toolbar__action"
          onClick={() => setAddingStudent(true)}
        >
          Add Student
        </button>
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

      <section className="card">
        <table className="table">
          <SortableHeader
            columns={[
              { key: 'name', label: 'Student' },
              { key: 'course', label: 'Courses' },
              { key: 'rate', label: 'Attendance rate' },
              { key: 'latest', label: 'Latest session' }
            ]}
            sort={sort}
            onSort={toggle}
          />
          <tbody>
            {paged.rows.map((student) => (
              <tr key={student.id}>
                <td>
                  <div className="person">
                    {student.registrationPhoto ? (
                      <img
                        className="person__photo"
                        src={student.registrationPhoto}
                        alt={`${student.name} registration`}
                      />
                    ) : (
                      <div className={`person__avatar ${student.tone}`}>
                        {initials(student.name)}
                      </div>
                    )}
                    <div className="person__details">
                      <div className="cell-strong">{student.name}</div>
                      <div className="cell-sub">{student.id}</div>
                    </div>
                  </div>
                </td>
                <td>{student.courseLabel}</td>
                <td>
                  {student.rate === null ? (
                    <span className="mono cell-sub">Not calculated</span>
                  ) : (
                    <div className="meter">
                      <div className="meter__track">
                        <div
                          className={`${rateClass(student.rate)} ${rateWidthClass(student.rate)}`}
                        />
                      </div>
                      <span className="mono">{formatRate(student.rate)}</span>
                    </div>
                  )}
                </td>
                <td>{student.latest}</td>
                <td className="table__action-cell">
                  <button
                    type="button"
                    className="btn btn--quiet btn--sm"
                    onClick={() => c.setProfileId(student.id)}
                  >
                    View profile →
                  </button>
                </td>
              </tr>
            ))}
            {paged.rows.length === 0 && (
              <tr>
                <td colSpan={5}>
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

      {addingStudent && (
        <AddStudentModal
          courses={courseOptions}
          existingIds={c.students.map((student) => student.studentNumber ?? student.id)}
          onClose={() => setAddingStudent(false)}
          onSave={async (registration) => {
            await c.addStudent(registration);
            setAddingStudent(false);
          }}
        />
      )}
    </div>
  );
}

function formatRate(rate: number | null): string {
  return rate === null ? 'Not calculated' : `${rate}%`;
}
