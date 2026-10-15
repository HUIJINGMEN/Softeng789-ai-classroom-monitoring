import type { ReportEdits } from "./reportModel";
import type { ReportReviewApi, ReportTopic, ReviewableReport } from "./types";
import { runSequential } from "./runSequential";

export class ReportDraftSaveError extends Error {
  constructor(
    readonly completed: number,
    readonly total: number,
    readonly topic: ReportTopic,
    readonly original: unknown,
  ) {
    super("Some edits could not be saved.");
    this.name = "ReportDraftSaveError";
  }
}

/** Save changed wording only; carry each new version forward, never implicitly approve. */
export async function saveReportDrafts<R extends ReviewableReport>(
  report: R,
  edits: ReportEdits,
  save: ReportReviewApi<R, unknown>["save"],
  onSaved: (report: R, topic: ReportTopic) => void,
) {
  const pending = report.document.sections.filter(
    (s) => edits[s.topic] !== undefined && edits[s.topic] !== s.text,
  );
  if (pending.some((s) => !edits[s.topic]?.trim()))
    throw new Error(
      "A summary is empty. Add wording or restore it before saving all drafts.",
    );
  return runSequential(pending, report, async (current, section, index) => {
    let latest: R;
    try {
      latest = await save(current, section.topic, edits[section.topic]!, false);
    } catch (cause) {
      throw new ReportDraftSaveError(
        index,
        pending.length,
        section.topic,
        cause,
      );
    }
    onSaved(latest, section.topic);
    return latest;
  });
}
