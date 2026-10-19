import { useEffect, useState } from "react";
import { useReportReview } from "../report-review/useReportReview";
import { ReportSectionEditor } from "../report-review/ReportSectionEditor";
import { ReportGenerationDialog } from "../report-review/ReportGenerationDialog";
import { ReportStudentRoster } from "../report-review/ReportStudentRoster";
import {
  reportDraftTargets,
  reportEvidenceReviewed,
} from "../report-review/reportModel";
import { overallReportReviewApi } from "./api";
import { OverallReportScopeFields } from "./OverallReportScopeFields";
import { OverallCourseTable } from "./OverallCourseTable";
import { OverallReportActions } from "./OverallReportActions";
import { OverallReportSnapshotPanel } from "./OverallReportSnapshotPanel";
import { OverallReportPreview } from "./OverallReportPreview";
import { OverallReportHistory } from "./OverallReportHistory";
import type {
  OverallCourseOption,
  OverallReport,
  OverallReportScope,
} from "./types";

export function OverallReportWorkspace({
  dateFrom,
  dateTo,
  courses,
  coursesLoading,
  coursesError,
  onRetryCourses,
  onOpenCourse,
}: {
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly courses: OverallCourseOption[];
  readonly coursesLoading: boolean;
  readonly coursesError: string;
  readonly onRetryCourses: () => void;
  readonly onOpenCourse: (id: string) => void;
}) {
  const state = useReportReview<OverallReport, OverallReportScope>(
    { dateFrom, dateTo, audience: "INTERNAL", courseOfferingIds: [] },
    overallReportReviewApi,
  );
  const [preview, setPreview] = useState<OverallReport | null>(null);
  const [history, setHistory] = useState(false);
  const [saved, setSaved] = useState<OverallReport | null>(null);
  const report = state.report;
  const frozen = Boolean(saved && saved.id === report?.id);
  const disabled = Boolean(state.busy) || state.scopeChanged || frozen;
  const targets = report ? reportDraftTargets(report, state.edits).length : 0;
  useEffect(() => {
    if (!state.dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.dirty]);
  if (state.generation)
    return (
      <ReportGenerationDialog
        progress={state.generation}
        onDismiss={state.dismissGeneration}
      />
    );
  const openCourse = (id: string) => {
    if (
      !state.dirty ||
      window.confirm(
        "Leave with unsaved summary edits? Saved drafts remain available.",
      )
    )
      onOpenCourse(id);
  };
  let status = "Review the wording, then approve all to preview.";
  if (state.dirty)
    status = "Unsaved edits · Approving also saves your wording.";
  if (state.ready) status = "All summaries reviewed. Preview before exporting.";
  if (state.scopeChanged)
    status = "Prepare / refresh records before editing or exporting this saved draft.";
  if (frozen)
    status = "This version is frozen. Refresh records to prepare a new draft.";
  const reviewActions = (
    <div className="overall-report-workspace-footer">
      <div aria-live="polite">
        <strong>
          {state.reviewed} of {report?.document.sections.length ?? 0} reviewed
        </strong>
        <span>{status}</span>
      </div>
      {!state.ready && (
        <button
          type="button"
          className="btn btn--primary"
          disabled={!report || disabled || Boolean(state.approvalBlocker)}
          onClick={() => void state.approveAll()}
        >
          {state.busy === "approve-all"
            ? "Saving approvals…"
            : "Save & approve all"}
        </button>
      )}
      {state.ready && (
        <button
          type="button"
          className="btn btn--primary"
          disabled={Boolean(state.busy) || state.scopeChanged}
          onClick={() => {
            if (report) setPreview(frozen ? saved : report);
          }}
        >
          Preview & export
        </button>
      )}
    </div>
  );
  return (
    <div className="page__inner overall-report-workspace">
      <header className="overall-report-workspace-head">
        <div>
          <h2>Overall report</h2>
          <p>Set the scope, review the evidence, then prepare your report.</p>
        </div>
        <button
          type="button"
          className="btn"
          disabled={Boolean(state.busy)}
          onClick={() => setHistory(true)}
        >
          Saved reports
        </button>
      </header>
      <OverallReportScopeFields
        scope={state.scope}
        onChange={state.setScope}
        disabled={Boolean(state.busy)}
        valid={state.scopeValid}
        changed={state.scopeChanged}
        courses={courses}
        loading={coursesLoading}
        onApply={() => void state.prepare()}
      />
      {coursesError && (
        <div role="alert" className="overall-report-notice">
          <p>{coursesError}</p>
          <button type="button" className="btn" onClick={onRetryCourses}>
            Retry courses
          </button>
        </div>
      )}
      {state.error && (
        <div className="form-error" role="alert">
          {state.error}
          <button
            type="button"
            className="btn btn--sm"
            disabled={Boolean(state.busy)}
            onClick={() => void state.reload()}
          >
            Retry loading report
          </button>
        </div>
      )}
      {(state.busy === "prepare" || state.busy === "load") && (
        <output className="empty">
          Loading overall evidence and saved wording…
        </output>
      )}
      {!report && !state.busy && !state.error && <output className="field__hint">No saved draft for this scope. Choose Prepare report to build one from current records.</output>}
      {report && (
        <>
          <OverallReportSnapshotPanel
            snapshot={report.document.snapshot}
            audience={report.document.audience}
          />
          {state.scopeChanged && (
            <output className="overall-report-notice">
              This is saved wording, not refreshed evidence. Prepare / refresh records
              to load the correct version.
            </output>
          )}
          {report.document.audience === "PARTNER" && (
            <p className="overall-report-notice">
              Partner edition: no student-detail records, operational issue
              list, credit-decision counts or financial data. Check free-text
              summaries for confidential details before export.
            </p>
          )}
          <div className="overall-report-review-layout">
            <section
              className="overall-report-editor"
              aria-labelledby="overall-draft-title"
            >
              <div className="overall-report-review-head">
                <div>
                  <h2 id="overall-draft-title">Report draft</h2>
                  <p>
                    Edit the summaries, then approve the wording for export.
                  </p>
                </div>
                {targets > 0 && (
                  <button
                    type="button"
                    className="btn"
                    disabled={disabled}
                    onClick={() => void state.generate()}
                  >
                    {state.busy === "all"
                      ? "Generating…"
                      : `Generate missing drafts (${targets})`}
                  </button>
                )}
              </div>
              {reviewActions}
              {!state.scopeChanged && state.approvalBlocker && (
                <p className="report-topic__warning">{state.approvalBlocker}</p>
              )}
              <div className="report-topic-list">
                {report.document.sections.map((section) => (
                  <ReportSectionEditor
                    key={section.topic}
                    section={section}
                    text={state.edits[section.topic] ?? section.text}
                    disabled={disabled}
                    working={state.busy === section.topic}
                    error={state.sectionErrors[section.topic]}
                    evidenceReviewed={reportEvidenceReviewed(
                      section,
                      state.acknowledgements,
                    )}
                    onEvidenceReviewed={(checked) =>
                      state.setAcknowledgements((current) => ({
                        ...current,
                        [section.topic]: checked
                          ? section.fingerprint
                          : undefined,
                      }))
                    }
                    onChange={(text) =>
                      state.setEdits((current) => ({
                        ...current,
                        [section.topic]: text,
                      }))
                    }
                    onGenerate={(topic) => void state.generate(topic)}
                    onSave={(topic, approve) => void state.save(topic, approve)}
                  />
                ))}
              </div>
            </section>
            <aside
              className="overall-report-evidence"
              aria-label="Report evidence"
            >
              <h2>Reference records</h2>
              <p className="overall-report-note">
                Check these facts while reviewing the draft. AI is used only for
                class-wide teacher feedback.
              </p>
              <OverallCourseTable snapshot={report.document.snapshot} compact />
              {report.document.audience === "INTERNAL" && (
                <OverallReportActions
                  snapshot={report.document.snapshot}
                  onOpenCourse={openCourse}
                />
              )}
              {report.document.snapshot.achievements > 0 && (
                <p className="overall-report-note">
                  {report.document.snapshot.achievements} confirmed student
                  achievement records marked for report inclusion.
                  {report.document.audience === "PARTNER" &&
                    " No individual identities are exported."}
                </p>
              )}
            </aside>
          </div>
          {report.document.audience === "INTERNAL" && (
            <details className="report-source-review">
              <summary>Check students & attendance before approval</summary>
              <ReportStudentRoster
                students={report.document.snapshot.students}
                showCourses
              />
            </details>
          )}
        </>
      )}
      {preview && (
        <OverallReportPreview
          report={preview}
          onClose={() => setPreview(null)}
          onSaved={(value) => {
            setSaved(value);
            setPreview(value);
          }}
        />
      )}
      {history && <OverallReportHistory onClose={() => setHistory(false)} />}
    </div>
  );
}
