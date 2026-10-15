import type {
  ReportAttendance,
  ReportChartSnapshot,
  ReportSection,
} from "../report-review/types";

export type OverallAudience = "INTERNAL" | "PARTNER";
export interface OverallReportScope {
  dateFrom: string;
  dateTo: string;
  audience: OverallAudience;
  courseOfferingIds: string[];
}
export interface OverallReportSnapshot extends ReportChartSnapshot {
  preparedAt: string;
  preparedBy: string;
  allCourses: boolean;
  studentCount: number;
  completedSessions: number;
  feedbackCount: number;
  achievements: number;
  courses: {
    id: string;
    code: string;
    term: string;
    students: number;
    completedSessions: number;
    attendance: ReportAttendance;
    feedbackCount: number;
  }[];
  creditDecisions: { status: string; count: number }[];
  actions: {
    courseOfferingId: string;
    courseLabel: string;
    issue: string;
    count: number;
    nextStep: string;
  }[];
}
export interface OverallReport {
  id: string;
  version: number;
  createdAt: string;
  finalizedAt: string | null;
  privacyReviewedBy: string | null;
  privacyReviewedAt: string | null;
  document: OverallReportScope & {
    sections: ReportSection[];
    snapshot: OverallReportSnapshot;
  };
}
export interface OverallCourseOption {
  id: string;
  label: string;
}
