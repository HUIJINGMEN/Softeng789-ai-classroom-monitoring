import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import FeedbackSummaryCard from './FeedbackSummaryCard';
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

function continueLabel(ready: boolean, reviewedCount: number) {
  if (!ready) return 'Review all summaries to continue';
  return reviewedCount === 0 ? 'Continue to export' : 'Continue to delivery';
}

function sourceSummaryLabel(sourceCount: number, groupCount: number, reviewedCount: number) {
  if (groupCount === 0) {
    return `${sourceCount} teacher feedback note${sourceCount === 1 ? '' : 's'}`;
  }
  return `${reviewedCount} of ${groupCount} course summar${groupCount === 1 ? 'y' : 'ies'} reviewed`;
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
  const allReady = selectedCourses.size > 0 && rangeValid &&
    (reportGroups.length === 0 || reviewedKeys.size === reportGroups.length);

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

  return (
    <Modal
      size="wide"
      className="report-preparation-modal"
      onClose={busyId ? () => undefined : onClose}
      closeButton
      titleId="prepare-feedback-report-title"
      title="Review student report"
      subtitle="Choose the period and courses, then approve the AI-written summary before delivery."
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
            {continueLabel(allReady, reviewedForDelivery.length)}
          </button>
        </>
      }
    >
      <div className="report-preparation">
        <div className="report-preparation__dates">
          <label className="field"><span>From</span><input type="date" value={rangeFrom} onChange={(event) => setRangeFrom(event.target.value)} /></label>
          <label className="field"><span>To</span><input type="date" value={rangeTo} onChange={(event) => setRangeTo(event.target.value)} /></label>
        </div>

        <div className="field">
          <span>Courses in this report</span>
          <div className="course-checklist">
            {courseOptions.map(([id, label]) => (
              <label key={id} className="course-checklist__item">
                <input
                  type="checkbox"
                  checked={selectedCourses.has(id)}
                  onChange={() => setSelectedCourses((current) => {
                    const next = new Set(current);
                    if (next.has(id)) next.delete(id); else next.add(id);
                    return next;
                  })}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
        {!rangeValid && <div className="form-error" role="alert">The end date must be on or after the start date.</div>}

        <div className="report-preparation__source">
          <div>
            <strong>
              {sourceSummaryLabel(reportsInRange.length, reportGroups.length, reviewedKeys.size)}
            </strong>
            <span>
              {reportsInRange.length} source note{reportsInRange.length === 1 ? '' : 's'} · {selectedCourses.size} course{selectedCourses.size === 1 ? '' : 's'} · {formatReportDateRange(rangeFrom, rangeTo)}
            </span>
          </div>
          {missingGroups.length > 0 ? (
            <button
              type="button"
              className="btn btn--sm"
              disabled={Boolean(busyId) || !rangeValid}
              onClick={() => void generateMissing()}
            >
              {busyId === 'generate'
                ? 'Generating…'
                : `Generate ${missingGroups.length} summar${missingGroups.length === 1 ? 'y' : 'ies'}`}
            </button>
          ) : currentSummaries.some((item) => item.status === 'DRAFT') ? (
            <span className="badge badge--warn">Ready for review</span>
          ) : reportGroups.length > 0 ? (
            <span className="badge badge--success">Ready to export</span>
          ) : null}
        </div>

        {!rangeValid ? null : selectedCourses.size === 0 ? (
          <div className="empty empty--compact">Select at least one course for this student report.</div>
        ) : reportsInRange.length === 0 ? (
          <div className="empty empty--compact">
            No teacher feedback falls within this range. You can still export the attendance and confirmed-event report.
          </div>
        ) : currentSummaries.length === 0 ? (
          <div className="empty empty--compact">
            Generate a draft for each class you want to include, then review its wording before export.
          </div>
        ) : (
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
      </div>
    </Modal>
  );
}
