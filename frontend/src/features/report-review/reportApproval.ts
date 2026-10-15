import {
  pendingReportSections,
  reportApprovalBlocker,
  reportEvidenceReviewed,
  type ReportEdits,
  type ReportAcknowledgements,
} from "./reportModel";
import type { ReportTopic, ReviewableReport } from "./types";

type SaveSection<R extends ReviewableReport> = (
  report: R,
  topic: ReportTopic,
  text: string,
  approve: boolean,
  evidenceReviewed?: boolean,
) => Promise<R>;

export class ReportApprovalError extends Error {
  constructor(
    readonly topic: ReportTopic,
    readonly completed: number,
    readonly total: number,
    readonly original: unknown,
  ) {
    super("Report approval stopped before every section was saved.");
    this.name = "ReportApprovalError";
  }
}

/** Sequential versioned writes preserve successful approvals and stop at the first failure. */
export async function approveReportSections<R extends ReviewableReport>(
  report: R,
  edits: ReportEdits,
  save: SaveSection<R>,
  onSaved: (report: R, topic: ReportTopic) => void,
  acknowledgements: ReportAcknowledgements = {},
) {
  const blocker = reportApprovalBlocker(report, edits, acknowledgements);
  if (blocker) throw new Error(blocker);
  const pending = pendingReportSections(report, edits);
  let latest = report;
  for (const [index, section] of pending.entries()) {
    try {
      latest = await save(
        latest,
        section.topic,
        edits[section.topic] ?? section.text,
        true,
        reportEvidenceReviewed(section, acknowledgements),
      );
    } catch (cause) {
      throw new ReportApprovalError(
        section.topic,
        index,
        pending.length,
        cause,
      );
    }
    onSaved(latest, section.topic);
  }
  return latest;
}
