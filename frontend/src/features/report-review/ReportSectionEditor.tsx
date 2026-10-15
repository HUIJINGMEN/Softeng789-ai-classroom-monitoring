import { useId } from "react";
import {
  IconCalendar,
  IconWallet,
  IconAlertTriangle,
  IconMessageSquare,
  IconAward,
} from "../../components/icons";
import { sectionStatus } from "./reportModel";
import { ReportNarrativeInput } from "./ReportNarrativeInput";
import type { ReportSection, ReportTopic } from "./types";

const icons = {
  ATTENDANCE: IconCalendar,
  PAYMENTS: IconWallet,
  ABSENCES: IconAlertTriangle,
  LEARNING: IconMessageSquare,
  ACHIEVEMENTS: IconAward,
  OVERVIEW: IconMessageSquare,
};
interface Props {
  section: ReportSection;
  text: string;
  disabled: boolean;
  working: boolean;
  error?: string;
  evidenceReviewed?: boolean;
  onEvidenceReviewed?: (checked: boolean) => void;
  onChange: (text: string) => void;
  onGenerate: (topic: ReportTopic) => void;
  onSave: (topic: ReportTopic, approve: boolean) => void;
}
export function ReportSectionEditor({
  section,
  text,
  disabled,
  working,
  error,
  evidenceReviewed = false,
  onEvidenceReviewed,
  onChange,
  onGenerate,
  onSave,
}: Props) {
  const id = useId();
  const Icon = icons[section.topic];
  const dirty = text !== section.text;
  const reviewed = section.reviewed && !dirty && !section.stale;
  const generateLabel = section.text ? "Regenerate draft" : "Generate draft";
  let sourceLabel = "Not generated yet · or write your own summary";
  if (section.provider) sourceLabel = `Draft source: ${section.provider}`;
  if (section.provider === "RECORDS")
    sourceLabel = "Draft from saved records · not AI-generated";
  return (
    <section
      className={`report-topic${reviewed ? " is-reviewed" : ""}`}
      aria-labelledby={id}
    >
      <div className="report-topic__heading">
        <span className="report-topic__icon" aria-hidden="true">
          <Icon />
        </span>
        <div className="report-topic__identity">
          <h3 id={id}>{section.title}</h3>
        </div>
        <span
          className={`badge ${reviewed ? "badge--success" : "badge--warn"}`}
        >
          {sectionStatus(section, dirty)}
        </span>
      </div>
      <div className="report-topic__body">
        <div className="field">
          <ReportNarrativeInput
            label={`${section.title} summary`}
            value={text}
            disabled={disabled}
            onChange={onChange}
          />
        </div>
        <div className="report-topic__draft-meta">
          <span>{sourceLabel}</span>
          {section.reviewedBy && (
            <span>Last reviewed by {section.reviewedBy}</span>
          )}
        </div>
        <details className="report-topic__evidence">
          <summary>View source records · {section.evidence.length}</summary>
          <ul>
            {section.evidence.map((fact, index) => (
              <li key={`${index}-${fact}`}>{fact}</li>
            ))}
          </ul>
        </details>
        {section.stale && (
          <div className="report-topic__warning">
            <p>
              Source records changed. Your wording is preserved. Check the
              records above and edit as needed; regeneration is optional.
            </p>
            <label className="report-topic__acknowledgement">
              <input
                type="checkbox"
                checked={evidenceReviewed}
                disabled={disabled}
                onChange={(event) => onEvidenceReviewed?.(event.target.checked)}
              />
              <span>
                I checked this wording against the updated source records.
              </span>
            </label>
          </div>
        )}
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="report-topic__actions">
          <button
            type="button"
            className="btn btn--sm"
            disabled={disabled}
            onClick={() => onGenerate(section.topic)}
          >
            {working ? "Working…" : generateLabel}
          </button>
          <span className="spacer" />
          <button
            type="button"
            className="btn btn--sm"
            disabled={disabled || !text.trim() || !dirty}
            onClick={() => onSave(section.topic, false)}
          >
            Save draft
          </button>
          <button
            type="button"
            className="btn btn--sm"
            disabled={
              disabled ||
              !text.trim() ||
              reviewed ||
              (section.stale && !evidenceReviewed)
            }
            onClick={() => onSave(section.topic, true)}
          >
            {reviewed ? "Reviewed" : "Save & approve"}
          </button>
        </div>
      </div>
    </section>
  );
}
