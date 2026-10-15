import { apiMessage } from "../../lib/apiClient";
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
  let latest = report;
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
  for (const target of targets) {
    if (!active()) return latest;
    update(target.topic, "generating");
    try {
      latest = await generate(latest, target.topic);
      if (active()) onSaved(latest, target.topic);
      update(target.topic, "saved");
    } catch (cause) {
      const message = apiMessage(cause);
      if (active()) onFailed(target.topic, message);
      update(target.topic, "failed", message);
    }
  }
  if (active()) onProgress({ ...progress, finishedAt: Date.now() });
  return latest;
}
