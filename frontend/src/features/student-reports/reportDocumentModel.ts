import type { StudentReport } from "./types";
export {
  narrativeBlocks,
  keyedNarrativeBlocks,
  reportReviewers,
} from "../report-review/reportDocumentModel";

export function studentReportFilename(report: StudentReport): string {
  const name = report.studentName
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .trim();
  return `Student report - ${name || "Student"} - ${report.document.dateFrom} to ${report.document.dateTo}`;
}
