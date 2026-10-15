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

/** Content-based identity survives reordering; repeated identical prose gets a unique occurrence. */
export function keyedNarrativeBlocks(topic: ReportTopic, text: string) {
  const occurrences = new Map<string, number>();
  const keyFor = (content: string) => {
    const occurrence = (occurrences.get(content) ?? 0) + 1;
    occurrences.set(content, occurrence);
    return JSON.stringify([content, occurrence]);
  };
  return narrativeBlocks(topic, text).map((block) => ({
    key: keyFor(JSON.stringify([block.heading, block.paragraphs])),
    heading: block.heading,
    paragraphs: block.paragraphs.map((paragraph) => ({
      key: keyFor(paragraph),
      text: paragraph,
    })),
  }));
}
