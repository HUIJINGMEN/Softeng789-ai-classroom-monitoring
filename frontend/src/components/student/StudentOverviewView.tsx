import { useMemo } from 'react';
import type { StudentAttendanceBenchmark } from '../../lib/studentPortalApi';
import type { Accomplishment, AuthUser, ProgressReport, Student, StudentAttendanceHistoryEntry } from '../../types';
import {
  IconArrowRight,
  IconAward,
  IconGraduationCap,
  IconMessageSquare,
  IconStudentCourse,
  IconStudentFeedback,
  IconStudentReport
} from '../icons';
import { accomplishmentCategoryLabel, formatAccomplishmentPoints } from '../../lib/accomplishments';
import ParticipationComparisonCard from './ParticipationComparisonCard';
import { attendanceCounts, reportCourse } from './studentPortalMetrics';
import type { StudentView } from './studentPortalTypes';

interface Props {
  readonly user: AuthUser;
  readonly profile: Student | null;
  readonly history: StudentAttendanceHistoryEntry[];
  readonly benchmark: StudentAttendanceBenchmark | null;
  readonly reports: ProgressReport[];
  readonly accomplishments: Accomplishment[];
  readonly publishedReportCount: number;
  readonly courses: string[];
  readonly loading: boolean;
  readonly onOpenView: (view: StudentView, course?: string) => void;
}

export default function StudentOverviewView({
  user,
  profile,
  history,
  benchmark,
  reports,
  accomplishments,
  publishedReportCount,
  courses,
  loading,
  onOpenView
}: Props) {
  const overall = useMemo(() => attendanceCounts(history), [history]);
  const latestFeedback = useMemo(
    () => [...reports].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 2),
    [reports]
  );
  const displayName = profile?.name ?? user.name;
  const latestAccomplishment = accomplishments[0] ?? null;
  const firstName = displayName.split(' ')[0] || displayName;

  return (
    <div className="student-view student-view--overview">
      <section className="student-welcome">
        <div>
          <h1>Good to see you, {firstName}.</h1>
          <p>Start with your attendance momentum, then pick up the latest updates from your classes.</p>
        </div>
      </section>

      <ParticipationComparisonCard
        studentRate={overall.rate}
        studentMarks={overall.recorded}
        averageRate={benchmark?.overallAverageRate}
        benchmarkMarks={benchmark?.totalMarks ?? 0}
        benchmarkStudents={benchmark?.studentCount ?? 0}
        scopeLabel="Across your enrolled classes"
        featured
        onOpenAttendance={() => onOpenView('attendance')}
      />

      <section className="student-summary" aria-label="Student summary">
        <div className="student-summary__head">
          <div>
            <h2>Jump back in</h2>
            <p>Your most useful spaces, one click away.</p>
          </div>
        </div>
        <button className="student-summary__item" type="button" onClick={() => onOpenView('attendance')}>
          <span className="student-summary__icon" aria-hidden="true"><IconStudentCourse /></span>
          <span className="student-summary__body">
            <span>Classes</span>
            <small><b>{loading ? '—' : courses.length}</b> active enrolment{courses.length === 1 ? '' : 's'}</small>
          </span>
          <span className="student-summary__meta" aria-hidden="true"><IconArrowRight /></span>
        </button>
        <button className="student-summary__item" type="button" onClick={() => onOpenView('feedback')}>
          <span className="student-summary__icon" aria-hidden="true"><IconStudentFeedback /></span>
          <span className="student-summary__body">
            <span>Feedback</span>
            <small><b>{loading ? '—' : reports.length}</b> teacher note{reports.length === 1 ? '' : 's'} shared</small>
          </span>
          <span className="student-summary__meta" aria-hidden="true"><IconArrowRight /></span>
        </button>
        <button className="student-summary__item" type="button" onClick={() => onOpenView('reports')}>
          <span className="student-summary__icon" aria-hidden="true"><IconStudentReport /></span>
          <span className="student-summary__body">
            <span>Reports</span>
            <small><b>{loading ? '—' : publishedReportCount}</b> published summar{publishedReportCount === 1 ? 'y' : 'ies'}</small>
          </span>
          <span className="student-summary__meta" aria-hidden="true"><IconArrowRight /></span>
        </button>
      </section>

      {latestAccomplishment && (
        <button
          type="button"
          className="student-achievement-highlight"
          onClick={() => onOpenView('accomplishments')}
        >
          <span className="student-achievement-highlight__icon"><IconAward /></span>
          <span className="student-achievement-highlight__copy">
            <small>Latest achievement · {accomplishmentCategoryLabel(latestAccomplishment.category)}</small>
            <strong>{latestAccomplishment.title}</strong>
            <span>{latestAccomplishment.classLabel.split(' · ')[0]} · Recognised by {latestAccomplishment.confirmedByTeacherName ?? latestAccomplishment.createdByTeacherName}</span>
          </span>
          {formatAccomplishmentPoints(latestAccomplishment.points) && (
            <span className="student-achievement-highlight__points">{formatAccomplishmentPoints(latestAccomplishment.points)}</span>
          )}
          <IconArrowRight />
        </button>
      )}

      <div className="student-overview-grid">
        <section className="student-panel">
          <div className="student-panel__head">
            <div>
              <h2>My classes</h2>
              <p>Select a class to review its attendance.</p>
            </div>
            <IconGraduationCap />
          </div>
          <div className="student-course-list">
            {courses.slice(0, 4).map((course) => {
              const courseCounts = attendanceCounts(history.filter((row) => row.course === course));
              return (
                <button
                  type="button"
                  className="student-course-row"
                  key={course}
                  onClick={() => onOpenView('attendance', course)}
                >
                  <span className="student-course-row__code">{course}</span>
                  <span className="student-course-row__meta">
                    {courseCounts.total} session{courseCounts.total === 1 ? '' : 's'}
                  </span>
                  <span className="student-course-row__rate">
                    {courseCounts.recorded > 0 ? `${courseCounts.rate}%` : 'No records'}
                  </span>
                  <IconArrowRight />
                </button>
              );
            })}
            {!loading && courses.length === 0 && (
              <div className="student-empty-inline">No active classes yet.</div>
            )}
            {loading && <div className="student-loading-line" aria-label="Loading classes" />}
          </div>
          {courses.length > 4 && (
            <button type="button" className="student-text-action" onClick={() => onOpenView('attendance')}>
              View all classes <IconArrowRight />
            </button>
          )}
        </section>

        <section className="student-panel">
          <div className="student-panel__head">
            <div>
              <h2>Latest feedback</h2>
              <p>Notes shared by your teachers.</p>
            </div>
            <IconMessageSquare />
          </div>
          <div className="student-feedback-preview">
            {latestFeedback.map((report) => (
              <article className="student-feedback-preview__item" key={report.id}>
                <p>{report.comment}</p>
                <span>{reportCourse(report)} · {report.teacherName}</span>
              </article>
            ))}
            {!loading && reports.length === 0 && (
              <div className="student-empty-inline">No teacher feedback has been shared yet.</div>
            )}
            {loading && <div className="student-loading-line" aria-label="Loading feedback" />}
          </div>
          {reports.length > 0 && (
            <button type="button" className="student-text-action" onClick={() => onOpenView('feedback')}>
              View all feedback <IconArrowRight />
            </button>
          )}
        </section>
      </div>

      <section className="student-profile-strip" aria-label="Account details">
        <div className="student-profile-strip__heading">
          <span>Student profile</span>
          <strong>Your university record</strong>
        </div>
        <div>
          <span>Student number</span>
          <strong>{profile?.studentNumber ?? '—'}</strong>
        </div>
        <div>
          <span>Programme</span>
          <strong>{profile?.program ?? '—'}</strong>
        </div>
        <div>
          <span>University email</span>
          <strong>{profile?.email ?? user.email}</strong>
        </div>
      </section>
    </div>
  );
}
