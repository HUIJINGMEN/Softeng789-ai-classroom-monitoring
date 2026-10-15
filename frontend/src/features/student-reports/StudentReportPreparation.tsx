import { useState } from 'react';
import Modal from '../../components/Modal';
import MultiSelectPickerModal, {
  MultiSelectSummary
} from '../../components/MultiSelectPickerModal';
import { formatReportDateRange } from '../../lib/sessionTime';
import { useReportPreparation } from './useReportPreparation';
import { ReportSectionEditor } from '../report-review/ReportSectionEditor';
import { ReportGenerationDialog } from '../report-review/ReportGenerationDialog';
import { reportEvidenceReviewed } from '../report-review/reportModel';
import { StudentReportChecks } from './StudentReportChecks';
import type { ReportScope, StudentReport } from './types';
import '../report-review/report-review.css';

interface Props {
  studentId: string;
  studentName: string;
  dateFrom: string;
  dateTo: string;
  availableCourses: { id: string; label: string }[];
  resumeReport?: StudentReport | null;
  onClose: () => void;
  onContinue: (report: StudentReport) => void;
  onOpenRecords?: () => void;
}
export function StudentReportPreparation({
  studentId,
  studentName,
  dateFrom,
  dateTo,
  availableCourses,
  resumeReport,
  onClose,
  onContinue,
  onOpenRecords
}: Props) {
  const initialScope: ReportScope = {
    studentId,
    dateFrom: resumeReport?.document.dateFrom ?? dateFrom,
    dateTo: resumeReport?.document.dateTo ?? dateTo,
    courseOfferingIds:
      resumeReport?.document.courseOfferingIds ??
      availableCourses.map((course) => course.id)
  };
  const state = useReportPreparation(initialScope);
  const [picker, setPicker] = useState(false);
  if (state.generation) return <ReportGenerationDialog progress={state.generation} onDismiss={state.dismissGeneration} />;
  const requestClose = () => {
    if (
      !state.dirty ||
      window.confirm(
        'Close without saving your latest text edits? Saved drafts will remain available.'
      )
    )
      onClose();
  };
  if (picker)
    return (
      <MultiSelectPickerModal
        title="Report courses"
        subtitle="All sections use this same course selection."
        options={availableCourses}
        selectedIds={state.scope.courseOfferingIds}
        searchLabel="Search courses"
        searchPlaceholder="Course code or term"
        onApply={(ids) =>
          state.setScope((current) => ({ ...current, courseOfferingIds: ids }))
        }
        onClose={() => setPicker(false)}
      />
    );
  const count = state.report?.document.sections.length ?? 0;
  let generateLabel = 'Generate missing drafts';
  if (state.report?.document.sections.some((section) => section.stale)) generateLabel = 'Update outdated & missing drafts';
  if (state.busy === 'all') generateLabel = 'Generating drafts…';
  const saveNote = state.dirty
    ? 'Unsaved text changes'
    : 'Drafts saved. Approve only after reviewing the wording below.';
  return (
    <Modal
      size="wide"
      className="student-report-preparation"
      title={`Student report · ${studentName}`}
      subtitle="Read and edit all summaries below, then approve them together or individually."
      onClose={requestClose}
      closeButton
      closeDisabled={Boolean(state.busy)}
      footer={
        <>
          {state.error && (
            <div className="form-error report-preparation-error" role="alert">
              {state.error}
            </div>
          )}
          <span className="report-preparation-save-note" aria-live="polite">
            {state.ready
              ? 'All sections reviewed — ready to deliver.'
              : saveNote}
            {state.report && (
              <span className="report-preparation-review-count">
                {state.reviewed}/{count} reviewed
              </span>
            )}
          </span>
          <button
            type="button"
            className="btn"
            disabled={Boolean(state.busy)}
            onClick={requestClose}
          >
            Close
          </button>
          {!state.ready && (
            <button
              type="button" className="btn" disabled={Boolean(state.busy) || state.scopeChanged || !state.dirty}
              onClick={() => void state.saveAll()}
            >{state.busy === 'save-all' ? 'Saving drafts…' : 'Save all drafts'}</button>
          )}
          {!state.ready && (
            <button
              type="button"
              className="btn btn--primary"
              disabled={
                Boolean(state.busy) ||
                state.scopeChanged ||
                Boolean(state.approvalBlocker)
              }
              onClick={() => void state.approveAll()}
            >
              {state.busy === 'approve-all'
                ? 'Saving approvals…'
                : 'Save & approve all'}
            </button>
          )}
          <button
            type="button"
            className={state.ready ? 'btn btn--primary' : 'btn'}
            disabled={!state.ready || state.scopeChanged || Boolean(state.busy)}
            onClick={() => {
              if (state.report) onContinue(state.report);
            }}
          >
            Preview & deliver
          </button>
        </>
      }
    >
      <div className="student-report-preparation__body">
        <section className="report-draft-scope" aria-label="Report scope">
          <div className="report-draft-scope__dates">
            <label className="field">
              <span>From</span>
              <input
                type="date"
                value={state.scope.dateFrom}
                disabled={Boolean(state.busy)}
                onChange={(event) =>
                  state.setScope((scope) => ({
                    ...scope,
                    dateFrom: event.target.value
                  }))
                }
              />
            </label>
            <label className="field">
              <span>To</span>
              <input
                type="date"
                value={state.scope.dateTo}
                disabled={Boolean(state.busy)}
                onChange={(event) =>
                  state.setScope((scope) => ({
                    ...scope,
                    dateTo: event.target.value
                  }))
                }
              />
            </label>
          </div>
          <MultiSelectSummary
            label="Included courses"
            actionNoun="courses"
            emptyLabel="Select at least one course"
            selectedLabels={availableCourses
              .filter((course) =>
                state.scope.courseOfferingIds.includes(course.id)
              )
              .map((course) => course.label)}
            disabled={Boolean(state.busy)}
            onOpen={() => setPicker(true)}
          />
          {!state.scopeValid && (
            <p className="form-error" role="alert">
              Select at least one course and a valid date range.
            </p>
          )}
          <button
            type="button"
            className="btn btn--sm"
            disabled={!state.scopeValid || Boolean(state.busy)}
            onClick={() => void state.prepare()}
          >
            {state.scopeChanged || !state.report
              ? 'Apply scope & load draft'
              : 'Refresh source records'}
          </button>
        </section>
        {state.report && (
          <>
            <StudentReportChecks report={state.report} disabled={Boolean(state.busy) || state.scopeChanged}
              onOpenRecords={onOpenRecords ? () => {
                if (!state.dirty || window.confirm('Open student records without saving your latest text edits? Saved drafts will remain available.')) onOpenRecords();
              } : undefined} />
            <div className="report-draft-review-head">
              <div>
                <h3>Report sections</h3>
                <p>
                  {formatReportDateRange(
                    state.report.document.dateFrom,
                    state.report.document.dateTo
                  )}{' '}
                  · {count} sections
                </p>
              </div>
              <output
                className={
                  state.ready ? 'badge badge--success' : 'badge badge--warn'
                }
              >
                {state.reviewed}/{count} reviewed
              </output>
              <button
                type="button"
                className="btn btn--sm"
                disabled={
                  Boolean(state.busy) ||
                  state.scopeChanged ||
                  !state.report.document.sections.some(
                    (section) =>
                      (!section.text || section.stale) && state.edits[section.topic] === undefined
                  )
                }
                onClick={() => void state.generate()}
              >
                {generateLabel}
              </button>
            </div>
            {state.scopeChanged && (
              <p className="report-topic__warning">
                Apply the new scope before editing or delivering this report.
              </p>
            )}
            {!state.scopeChanged && state.approvalBlocker && (
              <p className="report-topic__warning">{state.approvalBlocker}</p>
            )}
            <div className="report-topic-list">
              {state.report.document.sections.map((section) => (
                <ReportSectionEditor
                  key={section.topic}
                  section={section}
                  text={state.edits[section.topic] ?? section.text}
                  disabled={Boolean(state.busy) || state.scopeChanged}
                  working={state.busy === section.topic}
                  error={state.sectionErrors[section.topic]}
                  evidenceReviewed={reportEvidenceReviewed(section, state.acknowledgements)}
                  onEvidenceReviewed={(checked) => state.setAcknowledgements((current) => ({
                    ...current,
                    [section.topic]: checked ? section.fingerprint : undefined
                  }))}
                  onChange={(text) =>
                    state.setEdits((edits) => ({
                      ...edits,
                      [section.topic]: text
                    }))
                  }
                  onGenerate={(topic) => void state.generate(topic)}
                  onSave={(topic, approve) => void state.save(topic, approve)}
                />
              ))}
            </div>
          </>
        )}
        {state.busy === 'prepare' && (
          <output className="empty">
            Loading report evidence and saved drafts…
          </output>
        )}
      </div>
    </Modal>
  );
}
