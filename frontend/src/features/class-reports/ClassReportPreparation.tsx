import Modal from "../../components/Modal";
import { useReportReview } from "../report-review/useReportReview";
import { ReportSectionEditor } from "../report-review/ReportSectionEditor";
import { ReportGenerationDialog } from "../report-review/ReportGenerationDialog";
import {
  reportEvidenceReviewed,
  reportDraftTargets,
} from "../report-review/reportModel";
import { classReportReviewApi } from "./api";
import type { ClassReport, ClassReportScope } from "./types";
import { ClassReportSourceRecords } from "./ClassReportSources";
import "../report-review/report-review.css";
import "./class-report-document.css";
import "./class-report-editor.css";

export function ClassReportPreparation({
  scope,
  classLabel,
  onClose,
  onContinue,
}: {
  readonly scope: ClassReportScope;
  readonly classLabel: string;
  readonly onClose: () => void;
  readonly onContinue: (report: ClassReport) => void;
}) {
  const state = useReportReview(scope, classReportReviewApi);
  if (state.generation)
    return (
      <ReportGenerationDialog
        progress={state.generation}
        onDismiss={state.dismissGeneration}
      />
    );
  const report = state.report;
  const count = report?.document.sections.length ?? 0;
  const disabled = Boolean(state.busy) || state.scopeChanged;
  const draftCount = report
    ? reportDraftTargets(report, state.edits).length
    : 0;
  let saveNote = "Review the wording below, then approve all to preview.";
  if (state.dirty)
    saveNote = "Unsaved edits · Approving also saves your changes.";
  if (state.ready) saveNote = "All summaries approved · Ready to preview.";
  if (state.scopeChanged) saveNote = "Prepare / refresh records to continue.";
  let refreshLabel = "Refresh records";
  if (state.scopeChanged || !report) refreshLabel = "Prepare / refresh report";
  if (state.busy === "prepare" || state.busy === "load") refreshLabel = "Loading records…";
  const requestClose = () => {
    if (
      !state.dirty ||
      window.confirm(
        "Close without saving your latest edits? Saved drafts remain available.",
      )
    )
      onClose();
  };
  return (
    <Modal
      size="wide"
      className="class-report-editor"
      title="Class report"
      subtitle={classLabel}
      onClose={requestClose}
      closeButton
      closeDisabled={Boolean(state.busy)}
      footCompact={false}
      footer={
        <>
          {state.error && (
            <div className="form-error report-preparation-error" role="alert">
              {state.error}
            </div>
          )}
          <div className="class-report-editor__progress" aria-live="polite">
            <strong>
              {state.reviewed} of {count} reviewed
            </strong>
            <span>{saveNote}</span>
          </div>
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
              type="button"
              className="btn btn--primary"
              disabled={disabled || Boolean(state.approvalBlocker)}
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
              disabled={disabled}
              onClick={() => {
                if (report) onContinue(report);
              }}
            >
              Preview & export
            </button>
          )}
        </>
      }
    >
      <div className="class-report-body">
        <section className="report-draft-scope" aria-label="Class report scope">
          <div className="class-report-editor__period">
            {(["dateFrom", "dateTo"] as const).map((key) => (
              <label className="field" key={key}>
                <span>{key === "dateFrom" ? "From" : "To"}</span>
                <input
                  type="date"
                  value={state.scope[key]}
                  disabled={Boolean(state.busy)}
                  onChange={(event) =>
                    state.setScope((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
            <button
              type="button"
              className="btn btn--sm"
              disabled={!state.scopeValid || Boolean(state.busy)}
              onClick={() => void state.prepare()}
            >
              {refreshLabel}
            </button>
          </div>
          <div className="class-report-editor__scope-note">
            <span>Staff only · Not published to students</span>
            <details>
              <summary>What’s included</summary>
              <p>
                Class-wide feedback, not individual student notes. Financial
                figures include only invoices attributable to this class.
              </p>
            </details>
          </div>
          {!state.scopeValid && (
            <p className="form-error" role="alert">
              Choose a valid reporting period.
            </p>
          )}
        </section>
        {report && (
          <>
            <div className="report-draft-review-head">
              <div>
                <h3>Review summaries</h3>
                <p>
                  Edit each summary below. Source records stay available for
                  checking.
                </p>
              </div>
              {(draftCount > 0 || state.busy === "all") && (
                <button
                  type="button"
                  className="btn btn--sm"
                  disabled={disabled || !draftCount}
                  onClick={() => void state.generate()}
                >
                  {state.busy === "all"
                    ? "Generating drafts…"
                    : `Generate drafts (${draftCount})`}
                </button>
              )}
            </div>
            {state.scopeChanged && (
              <p className="report-topic__warning">
                Prepare / refresh records before editing or exporting this saved draft.
              </p>
            )}
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
            <details className="report-source-review">
              <summary>
                Check students, lesson follow-up & class feedback before
                approval
              </summary>
              <ClassReportSourceRecords
                snapshot={report.document.snapshot}
                includeRoster
              />
            </details>
          </>
        )}
        {!report && !state.busy && !state.error && <output className="field__hint">No saved draft for this scope. Choose Prepare / refresh report to build one from current records.</output>}
        {(state.busy === "prepare" || state.busy === "load") && (
          <output className="empty">
            Loading class evidence and saved drafts…
          </output>
        )}
      </div>
    </Modal>
  );
}
