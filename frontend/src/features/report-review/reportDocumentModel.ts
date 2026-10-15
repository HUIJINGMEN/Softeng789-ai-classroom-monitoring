import type { ReportTopic, ReviewableReport } from "./types";

interface NarrativeBlock {
  heading: string | null;
  paragraphs: string[];
}

/** Presentation only: retain approved wording; recognise only our standalone learning labels. */
export function narrativeBlocks(
  topic: ReportTopic,
  text: string,
): NarrativeBlock[] {
  const blocks: NarrativeBlock[] = [];
  let current: NarrativeBlock = { heading: null, paragraphs: [] };
  let lines: string[] = [];
  const flush = () => {
    if (lines.length) current.paragraphs.push(lines.join("\n"));
    lines = [];
  };
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (topic === "LEARNING" && /^(Strengths|Next steps)$/.test(line.trim())) {
      flush();
      if (current.paragraphs.length || current.heading) blocks.push(current);
      current = { heading: line.trim(), paragraphs: [] };
    } else if (!line.trim()) {
      flush();
    } else {
      lines.push(line);
    }
  }
  flush();
  if (current.paragraphs.length || current.heading) blocks.push(current);
  return blocks;
}

export function reportReviewers(report: ReviewableReport): string[] {
  return [
    ...new Set(
      report.document.sections
        .filter(
          (section) => section.reviewed && !section.stale && section.reviewedBy,
        )
        .map((section) => section.reviewedBy!),
    ),
  ];
}
