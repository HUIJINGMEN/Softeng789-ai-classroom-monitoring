import type { ReportScope } from "./types";

export interface SavedStudentReport {
  id: string;
  dateFrom: string;
  dateTo: string;
  courseOfferingIds: string[];
  courseLabels: string[];
  sections: number;
  drafted: number;
  reviewed: number;
  stale: boolean;
  createdAt: string;
  publishedAt: string | null;
}
export interface StudentReportProgress {
  studentId: string;
  draft: SavedStudentReport | null;
  published: SavedStudentReport | null;
  otherDraft: SavedStudentReport | null;
}
export interface StudentReportTask {
  studentId: string;
  number: string;
  name: string;
  photoUrl?: string;
  scope: ReportScope;
  courses: { id: string; label: string }[];
}
export type ReportTaskStatus =
  "Not started" | "Drafting" | "Needs review" | "Reviewed" | "Published";
