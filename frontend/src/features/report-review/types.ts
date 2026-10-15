export type ReportTopic =
  "ATTENDANCE" | "PAYMENTS" | "ABSENCES" | "LEARNING" | "ACHIEVEMENTS" | "OVERVIEW";
export interface ReportAttendance {
  completed: number;
  present: number;
  late: number;
  absent: number;
  unrecorded: number;
  rate: number | null;
}
export interface ReportChartSnapshot {
  attendance: ReportAttendance;
  attendanceTrend: { weekOf: string; attendance: ReportAttendance }[];
  confirmedEvents: { type: string; count: number }[];
}
export interface ReportSection {
  topic: ReportTopic;
  title: string;
  evidence: string[];
  fingerprint: string;
  text: string;
  provider: string;
  reviewed: boolean;
  stale: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
}
export interface ReviewableReport {
  id: string;
  version: number;
  document: { dateFrom: string; dateTo: string; sections: ReportSection[] };
}
export interface ReportReviewApi<R extends ReviewableReport, S> {
  prepare: (scope: S) => Promise<R>;
  generate: (report: R, topic: ReportTopic) => Promise<R>;
  save: (
    report: R,
    topic: ReportTopic,
    text: string,
    approve: boolean,
    evidenceReviewed?: boolean,
  ) => Promise<R>;
  scopeValid: (scope: S) => boolean;
  scopeChanged: (scope: S, report: R) => boolean;
}
