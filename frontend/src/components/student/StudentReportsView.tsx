import { useMemo, useState } from 'react';
import { avatarTone, initials } from '../../lib/format';
import { usePagination } from '../../lib/table';
import type { FeedbackSummary } from '../../types';
import Pager from '../Pager';
import StudentCourseFilter from './StudentCourseFilter';
import { studentDateLabel } from './studentPortalMetrics';

interface Props {
  readonly reports: FeedbackSummary[];
  readonly courses: string[];
  readonly courseFilter: string;
  readonly loading: boolean;
  readonly loadError: string;
  readonly onCourseChange: (course: string) => void;
  readonly onRetry: () => void;
}

function reportCourse(report: FeedbackSummary) {
  return report.classLabel.split(' · ')[0]?.trim() || report.classLabel;
}

export default function StudentReportsView({
  reports,
  courses,
  courseFilter,
  loading,
  loadError,
  onCourseChange,
  onRetry
}: Props) {
  const [page, setPage] = useState(0);
  const rows = useMemo(
    () => reports
      .filter((report) => courseFilter === 'all' || reportCourse(report) === courseFilter)
      .sort((left, right) => (right.publishedAt ?? right.createdAt).localeCompare(left.publishedAt ?? left.createdAt)),
    [courseFilter, reports]
  );
  const paged = usePagination(rows, page, setPage, 4);

  const changeCourse = (course: string) => {
    setPage(0);
    onCourseChange(course);
  };

  return (
    <div className="student-view student-view--reports">
      <div className="student-page-head">
        <div>
          <h1>Progress reports</h1>
          <p>Formal summaries reviewed and published by your teachers.</p>
        </div>
        <StudentCourseFilter courses={courses} value={courseFilter} onChange={changeCourse} />
      </div>

      {loadError ? (
        <output className="notice notice--warn student-report-notice">
          <span className="notice__mark" aria-hidden="true" />
          <span>Progress reports are temporarily unavailable. Try again in a moment.</span>
          <button type="button" className="btn btn--sm" onClick={onRetry}>Try again</button>
        </output>
      ) : (
        <>
          <div className="student-list-summary" aria-live="polite">
            <span>{courseFilter === 'all' ? 'All classes' : courseFilter}</span>
            <strong>{rows.length} published report{rows.length === 1 ? '' : 's'}</strong>
          </div>
          <section className="student-feedback-list" aria-live="polite">
            {paged.rows.map((report) => (
              <article className="student-feedback-card student-report-card" key={report.id}>
                <div className="student-feedback-card__meta">
                  <span>{reportCourse(report)}</span>
                  <span>{studentDateLabel(report.dateFrom)}–{studentDateLabel(report.dateTo)}</span>
                </div>
                <div className="student-feedback-summary__section student-feedback-summary__section--lead">
                  <span>Progress summary</span>
                  <p>{report.summary}</p>
                </div>
                <div className="student-report-card__columns">
                  <div className="student-feedback-summary__section">
                    <span>Strengths</span>
                    <p>{report.strengths}</p>
                  </div>
                  <div className="student-feedback-summary__section">
                    <span>Next steps</span>
                    <p>{report.nextSteps}</p>
                  </div>
                </div>
                <div className="student-feedback-card__teacher">
                  <div className={`person__avatar ${avatarTone(report.createdByTeacherId, 1)}`} aria-hidden="true">
                    {initials(report.reviewedByTeacherName ?? report.createdByTeacherName)}
                  </div>
                  <span>Reviewed by <strong>{report.reviewedByTeacherName ?? report.createdByTeacherName}</strong></span>
                </div>
              </article>
            ))}
            {!loading && rows.length === 0 && (
              <div className="student-empty-state student-empty-state--panel">
                <strong>No published reports yet</strong>
                <span>Your feedback remains available in Feedback. Formal summaries appear here only when a teacher publishes them.</span>
              </div>
            )}
            {loading && <div className="student-loading-block" aria-label="Loading reports" />}
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
        </>
      )}
    </div>
  );
}
