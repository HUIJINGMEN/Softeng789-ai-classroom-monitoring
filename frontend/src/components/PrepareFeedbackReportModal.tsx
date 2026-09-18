import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import FeedbackSummaryCard from './FeedbackSummaryCard';
import MultiSelectPickerModal, { MultiSelectSummary } from './MultiSelectPickerModal';
import { apiMessage } from '../lib/apiClient';
import { generateFeedbackSummary, reviewFeedbackSummary } from '../lib/feedbackSummaryApi';
import { formatReportDateRange } from '../lib/sessionTime';
import type { FeedbackSummary, ProgressReport } from '../types';

interface Props {
  readonly reports: readonly ProgressReport[];
  readonly summaries: readonly FeedbackSummary[];
  readonly availableCourses: readonly { id: string; label: string }[];
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly onClose: () => void;
  readonly onUpdated: () => Promise<void>;
  readonly onContinue: (selection: StudentReportSelection) => void;
  readonly showToast: (message: string) => void;
}

export interface StudentReportSelection {
  dateFrom: string;
  dateTo: string;
  courseOfferingIds: string[];
  courseLabels: string[];
  summaries: FeedbackSummary[];
}

function continueLabel(scopeReady: boolean, summariesReady: boolean, reviewedCount: number) {
  if (!scopeReady) return 'Choose report scope';
  if (!summariesReady) return 'Review summaries first';
  return reviewedCount === 0 ? 'Continue to export' : 'Continue to delivery';
}

export default function PrepareFeedbackReportModal({
  reports,
  summaries,
  availableCourses,
  dateFrom,
  dateTo,
  onClose,
  onUpdated,
  onContinue,
  showToast
}: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rangeFrom, setRangeFrom] = useState(dateFrom);
  const [rangeTo, setRangeTo] = useState(dateTo);
  const courseOptions = useMemo(
    () => availableCourses.map((course) => [course.id, course.label] as const),
    [availableCourses]
  );
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(
    () => new Set(courseOptions.map(([id]) => id))
  );
  const [coursePickerOpen, setCoursePickerOpen] = useState(false);
  useEffect(() => {
    setSelectedCourses((current) => current.size > 0
      ? current
      : new Set(courseOptions.map(([id]) => id)));
  }, [courseOptions]);
  const rangeValid = rangeFrom <= rangeTo;

  const reportsInRange = useMemo(
    () => reports.filter((report) => {
      const createdDate = report.createdAt.slice(0, 10);
      return selectedCourses.has(report.courseOfferingId) &&
        createdDate >= rangeFrom && createdDate <= rangeTo;
    }),
    [rangeFrom, rangeTo, reports, selectedCourses]
  );
  const reportGroups = useMemo(
    () => Array.from(
      new Map(
        reportsInRange.map((report) => [
          `${report.studentId}:${report.courseOfferingId}`,
          report
        ])
      ).values()
    ),
    [reportsInRange]
  );
  const sourceKeys = new Set(
    reportGroups.map((report) => `${report.studentId}:${report.courseOfferingId}`)
  );
  const summariesInRange = summaries.filter((item) =>
    item.status !== 'SUPERSEDED' &&
    item.dateFrom === rangeFrom &&
    item.dateTo === rangeTo &&
    sourceKeys.has(`${item.studentId}:${item.courseOfferingId}`)
  );
  const currentSummaries = summariesInRange.filter((item) => {
    const sourceCount = reportsInRange.filter((report) =>
      report.studentId === item.studentId && report.courseOfferingId === item.courseOfferingId
    ).length;
    return item.sourceFeedbackCount === sourceCount;
  });
  const reviewed = currentSummaries.filter((item) => item.status === 'REVIEWED');
  const reviewedKeys = new Set(
    reviewed.map((item) => `${item.studentId}:${item.courseOfferingId}`)
  );
  const reviewedForDelivery = reportGroups.flatMap((report) => {
    const key = `${report.studentId}:${report.courseOfferingId}`;
    const summary = reviewed.find((item) => `${item.studentId}:${item.courseOfferingId}` === key);
    return summary ? [summary] : [];
  });
  const missingGroups = reportGroups.filter((report) =>
    !currentSummaries.some((item) =>
      item.studentId === report.studentId && item.courseOfferingId === report.courseOfferingId
    )
  );
  const scopeReady = selectedCourses.size > 0 && rangeValid;
  const summariesReady = reportGroups.length === 0 || reviewedKeys.size === reportGroups.length;
  const allReady = scopeReady && summariesReady;
  const selectedCourseLabels = courseOptions
    .filter(([id]) => selectedCourses.has(id))
    .map(([, label]) => label);

  const generateMissing = async () => {
    setBusyId('generate');
    try {
      for (const report of missingGroups) {
        await generateFeedbackSummary({
          studentId: report.studentId,
          courseOfferingId: report.courseOfferingId,
          dateFrom: rangeFrom,
          dateTo: rangeTo
        });
      }
      await onUpdated();
      showToast(`${missingGroups.length} AI summary draft${missingGroups.length === 1 ? '' : 's'} generated. Review before export.`);
    } catch (error) {
      showToast(apiMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const review = async (
    item: FeedbackSummary,
    payload: Pick<FeedbackSummary, 'summary' | 'strengths' | 'nextSteps'>
  ) => {
    setBusyId(item.id);
    try {
      await reviewFeedbackSummary(item.id, payload);
      await onUpdated();
      showToast('Summary approved and ready to export.');
    } catch (error) {
      showToast(apiMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  if (coursePickerOpen) {
    return (
      <MultiSelectPickerModal
        title="Choose report courses"
        subtitle="Search this student's classes and select the courses to include in the report."
        searchLabel="Search courses"
        searchPlaceholder="Course code or teaching term"
        options={courseOptions.map(([id, label]) => ({ id, label }))}
        selectedIds={[...selectedCourses]}
        onApply={(ids) => setSelectedCourses(new Set(ids))}
        onClose={() => setCoursePickerOpen(false)}
      />
    );
  }

  return (
    <Modal
      size="wide"
      className="report-preparation-modal"
      onClose={busyId ? () => undefined : onClose}
      closeButton
      titleId="prepare-feedback-report-title"
      title={(
        <span className="modal-task-title">
          <span>Review student report</span>
          {reportGroups.length > 0 && (
            <span className={`badge ${allReady ? 'badge--success' : 'badge--warn'}`}>
              {reviewedKeys.size}/{reportGroups.length} reviewed
            </span>
          )}
        </span>
      )}
      subtitle="Set the report scope, review the AI summary, then choose how to deliver it."
      footer={
        <>
          <button type="button" className="btn" disabled={Boolean(busyId)} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!allReady || Boolean(busyId)}
            onClick={() => onContinue({
              dateFrom: rangeFrom,
              dateTo: rangeTo,
              courseOfferingIds: [...selectedCourses],
              courseLabels: courseOptions
                .filter(([id]) => selectedCourses.has(id))
                .map(([, label]) => label),
              summaries: reviewedForDelivery
            })}
          >
            {continueLabel(scopeReady, summariesReady, reviewedForDelivery.length)}
          </button>
        </>
      }
    >
      <div className="report-preparation">
        <div className="report-preparation__progress" aria-label="Report preparation progress">
          <span className={scopeReady ? 'is-complete' : 'is-active'}><b>1</b><small>Scope</small></span>
          <i aria-hidden="true" />
          <span className={allReady ? 'is-complete' : scopeReady ? 'is-active' : ''}><b>2</b><small>AI review</small></span>
          <i aria-hidden="true" />
          <span className={allReady ? 'is-active' : ''}><b>3</b><small>Delivery</small></span>
        </div>

        <section className="report-preparation__scope" aria-labelledby="report-scope-title">
          <header className="report-preparation__section-head">
            <div><strong id="report-scope-title">Report scope</strong><span>Choose the period and courses to include.</span></div>
          </header>
          <div className="report-preparation__dates">
            <label className="field"><span>From</span><input type="date" value={rangeFrom} onChange={(event) => setRangeFrom(event.target.value)} /></label>
            <label className="field"><span>To</span><input type="date" value={rangeTo} onChange={(event) => setRangeTo(event.target.value)} /></label>
          </div>

          <MultiSelectSummary
            label="Courses in this report"
            actionNoun="courses"
            selectedLabels={selectedCourseLabels}
            emptyLabel="No courses selected"
            disabled={courseOptions.length === 0}
            onOpen={() => setCoursePickerOpen(true)}
          />
          {!rangeValid && <div className="form-error" role="alert">The end date must be on or after the start date.</div>}
        </section>

        <section className="report-preparation__review" aria-labelledby="report-review-title">
          <header className="report-preparation__section-head">
            <div><strong id="report-review-title">AI summary</strong><span>Review and approve the wording before delivery.</span></div>
            {reportGroups.length > 0 && <span className={`badge ${summariesReady ? 'badge--success' : 'badge--warn'}`}>{reviewedKeys.size}/{reportGroups.length}</span>}
          </header>
          {rangeValid && selectedCourses.size > 0 && (
            <div className="report-preparation__context" aria-label="Report source details">
              <span>{reportsInRange.length} teacher note{reportsInRange.length === 1 ? '' : 's'}</span>
              <span>{selectedCourses.size} course{selectedCourses.size === 1 ? '' : 's'}</span>
              <span>{formatReportDateRange(rangeFrom, rangeTo)}</span>
            </div>
          )}
          {!rangeValid ? null : selectedCourses.size === 0 ? (
            <div className="empty empty--compact">Select at least one course for this student report.</div>
          ) : reportsInRange.length === 0 ? (
            <div className="empty empty--compact">
              No teacher feedback falls within this range. You can still export the attendance and confirmed-event report.
            </div>
          ) : (
            <>
              {missingGroups.length > 0 && (
                <div className="report-preparation__generate">
                  <div>
                    <strong>{missingGroups.length} AI summar{missingGroups.length === 1 ? 'y' : 'ies'} to generate</strong>
                    <span>Create a draft from the teacher feedback in this report range.</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    disabled={Boolean(busyId) || !rangeValid}
                    onClick={() => void generateMissing()}
                  >
                    {busyId === 'generate'
                      ? 'Generating…'
                      : `Generate ${missingGroups.length === 1 ? 'summary' : 'summaries'}`}
                  </button>
                </div>
              )}
              {currentSummaries.length > 0 && (
                <div className="feedback-summary-list">
                  {currentSummaries.map((item) => (
                    <FeedbackSummaryCard
                      key={item.id}
                      item={item}
                      busy={busyId === item.id}
                      onReview={(payload) => void review(item, payload)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </Modal>
  );
}
