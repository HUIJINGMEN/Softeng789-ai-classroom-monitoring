import type { ReportSection, ReportTopic, ReviewableReport } from "./types";

export type ReportEdits = Partial<Record<ReportTopic, string>>;
/** Bind the human acknowledgement to the exact source evidence shown, not merely the topic. */
export type ReportAcknowledgements = Partial<Record<ReportTopic, string>>;
export function reportEvidenceReviewed(
  section: ReportSection,
  acknowledgements: ReportAcknowledgements,
) {
  return Boolean(
    acknowledgements[section.topic] &&
    acknowledgements[section.topic] === section.fingerprint,
  );
}

/** Never overwrite an unsaved/manual draft through the batch action. */
export function reportDraftTargets(
  report: ReviewableReport,
  edits: ReportEdits,
) {
  return report.document.sections.filter(
    (section) =>
      (!section.text || section.stale) && edits[section.topic] === undefined,
  );
}

export function reportApprovalBlocker(
  report: ReviewableReport | null,
  edits: ReportEdits,
  acknowledgements: ReportAcknowledgements = {},
) {
  if (!report || report.document.sections.length === 0)
    return "Load a report before approval.";
  if (
    report.document.sections.some(
      (section) =>
        section.stale && !reportEvidenceReviewed(section, acknowledgements),
    )
  ) {
    return "For outdated drafts, check the updated source records and confirm the wording is still accurate, or regenerate them.";
  }
  if (
    report.document.sections.some(
      (section) => !(edits[section.topic] ?? section.text).trim(),
    )
  ) {
    return "Generate or write every summary before approving all.";
  }
  return "";
}

export function pendingReportSections(
  report: ReviewableReport,
  edits: ReportEdits,
) {
  return report.document.sections.filter(
    (section) =>
      !section.reviewed ||
      (edits[section.topic] !== undefined &&
        edits[section.topic] !== section.text),
  );
}

export function hasReportEdits(
  report: ReviewableReport | null,
  edits: Partial<Record<ReportTopic, string>>,
) {
  return (
    report?.document.sections.some(
      (section) =>
        edits[section.topic] !== undefined &&
        edits[section.topic] !== section.text,
    ) ?? false
  );
}
export function reviewedSectionCount(
  report: ReviewableReport | null,
  edits: Partial<Record<ReportTopic, string>>,
) {
  return (
    report?.document.sections.filter(
      (section) =>
        section.reviewed &&
        !section.stale &&
        (edits[section.topic] === undefined ||
          edits[section.topic] === section.text),
    ).length ?? 0
  );
}
export function sectionStatus(section: ReportSection, dirty: boolean) {
  if (section.stale) return "Update needed";
  if (dirty) return "Unsaved changes";
  if (section.reviewed) return "Reviewed";
  return section.text ? "Needs review" : "Not generated";
}
