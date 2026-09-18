import { useMemo, useState } from 'react';
import { avatarTone, initials } from '../../lib/format';
import { usePagination } from '../../lib/table';
import type { ProgressReport } from '../../types';
import Pager from '../Pager';
import StudentCourseFilter from './StudentCourseFilter';
import { reportCourse, studentDateLabel } from './studentPortalMetrics';

interface Props {
  readonly reports: ProgressReport[];
  readonly courses: string[];
  readonly courseFilter: string;
  readonly loading: boolean;
  readonly onCourseChange: (course: string) => void;
}

export default function StudentFeedbackView({
  reports,
  courses,
  courseFilter,
  loading,
  onCourseChange
}: Props) {
  const [page, setPage] = useState(0);
  const rows = useMemo(
    () => reports
      .filter((report) => courseFilter === 'all' || reportCourse(report) === courseFilter)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [courseFilter, reports]
  );
  const paged = usePagination(rows, page, setPage, 6);

  const changeCourse = (course: string) => {
    setPage(0);
    onCourseChange(course);
  };

  return (
    <div className="student-view student-view--feedback">
      <div className="student-page-head">
        <div>
          <h1>Teacher feedback</h1>
          <p>Read-only progress notes shared with you.</p>
        </div>
        <StudentCourseFilter courses={courses} value={courseFilter} onChange={changeCourse} />
      </div>

      <div className="student-list-summary" aria-live="polite">
        <span>{courseFilter === 'all' ? 'All classes' : courseFilter}</span>
        <strong>{rows.length} feedback note{rows.length === 1 ? '' : 's'}</strong>
      </div>

      <section className="student-feedback-list student-feedback-list--grid" aria-live="polite">
        {paged.rows.map((report) => (
          <article className="student-feedback-card" key={report.id}>
            <div className="student-feedback-card__meta">
              <span>{reportCourse(report)}</span>
              <span>{studentDateLabel(report.createdAt)}</span>
            </div>
            <p>{report.comment}</p>
            <div className="student-feedback-card__teacher">
              <div className={`person__avatar ${avatarTone(report.teacherId, 1)}`} aria-hidden="true">
                {initials(report.teacherName)}
              </div>
              <span>Shared by <strong>{report.teacherName}</strong></span>
            </div>
            {report.photoUrl && (
              <a className="student-feedback-card__photo" href={report.photoUrl} target="_blank" rel="noreferrer">
                <img src={report.photoUrl} alt={`Evidence attached to feedback from ${report.teacherName}`} />
                <span>Open attachment</span>
              </a>
            )}
          </article>
        ))}
        {!loading && rows.length === 0 && (
          <div className="student-empty-state student-empty-state--panel">
            <strong>No feedback yet</strong>
            <span>Your teacher's progress notes will appear here when they are shared.</span>
          </div>
        )}
        {loading && <div className="student-loading-block" aria-label="Loading feedback" />}
      </section>

      {!loading && rows.length > 0 && (
        <div className="student-list-pager">
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
        </div>
      )}
    </div>
  );
}
