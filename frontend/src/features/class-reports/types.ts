import type {
  ReportAttendance,
  ReportChartSnapshot,
  ReportSection,
} from "../report-review/types";
import type {
  ClassReportSources,
  ReportRosterStudent,
} from "../report-review/sourceTypes";

export interface ClassReportScope {
  courseOfferingId: string;
  dateFrom: string;
  dateTo: string;
}
export interface ClassReportSnapshot extends ReportChartSnapshot {
  sources?: ClassReportSources | null;
  course: {
    id: string;
    code: string;
    name: string;
    term: string;
    teachers: string[];
  };
  preparedAt: string;
  completedSessions: number;
  studentCount?: number;
  students?: ReportRosterStudent[] | null;
  sessions: {
    id: string;
    date: string;
    startTime: string;
    room: string;
    attendance: ReportAttendance;
  }[];
  feedbackCount: number;
  payments: {
    totals: {
      currency: string;
      invoices: number;
      charges: number;
      credits: number;
      received: number;
      balance: number;
      awaitingVerification: number;
    }[];
    excludedInvoices: number;
    studentsWithoutInvoice: number;
  };
}
export interface ClassReport {
  id: string;
  courseOfferingId: string;
  classLabel: string;
  version: number;
  createdAt: string;
  finalizedAt: string | null;
  document: {
    dateFrom: string;
    dateTo: string;
    sections: ReportSection[];
    snapshot: ClassReportSnapshot;
  };
}
