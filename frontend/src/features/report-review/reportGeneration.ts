import { apiMessage } from "../../lib/apiClient";
import { runSequential } from "./runSequential";
import type {
  ReportReviewApi,
  ReportSection,
  ReportTopic,
  ReviewableReport,
} from "./types";

export type GenerationState = "queued" | "generating" | "saved" | "failed";
export interface ReportGenerationProgress {
  startedAt: number;
  finishedAt: number | null;
  items: {
    topic: ReportTopic;
    title: string;
    state: GenerationState;
    error?: string;
  }[];
}

/** Progress follows resolved, versioned requests, never estimated token generation. */
export async function generateReportDrafts<R extends ReviewableReport>(
  report: R,
  targets: ReportSection[],
  generate: ReportReviewApi<R, unknown>["generate"],
  onProgress: (progress: ReportGenerationProgress) => void,
  onSaved: (report: R, topic: ReportTopic) => void,
  onFailed: (topic: ReportTopic, message: string) => void,
  active = () => true,
) {
  let progress: ReportGenerationProgress = {
    startedAt: Date.now(),
    finishedAt: null,
    items: targets.map((section) => ({
      topic: section.topic,
      title: section.title,
      state: "queued",
    })),
  };
  const update = (
    topic: ReportTopic,
    state: GenerationState,
    error?: string,
  ) => {
    progress = {
      ...progress,
      items: progress.items.map((item) =>
        item.topic === topic ? { ...item, state, error } : item,
      ),
    };
    if (active()) onProgress(progress);
  };
  if (active()) onProgress(progress);
  const latest = await runSequential(targets, report, async (current, target) => {
    if (!active()) return current;
    update(target.topic, "generating");
    try {
      const saved = await generate(current, target.topic);
      if (active()) onSaved(saved, target.topic);
      update(target.topic, "saved");
      return saved;
    } catch (cause) {
      const message = apiMessage(cause);
      if (active()) onFailed(target.topic, message);
      update(target.topic, "failed", message);
      return current;
    }
  });
  if (active()) onProgress({ ...progress, finishedAt: Date.now() });
  return latest;
}
