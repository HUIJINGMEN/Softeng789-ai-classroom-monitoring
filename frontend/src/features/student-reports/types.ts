import type { ReportSection, ReportAttendance } from "../report-review/types";
import type { StudentReportSources } from "../report-review/sourceTypes";
export type {
  ReportTopic,
  ReportSection,
  ReportAttendance,
} from "../report-review/types";
export interface ReportEmailResult {
  status: "SENT" | "DEMO" | "UNKNOWN";
  message: string;
}
export interface StudentReport {
  id: string;
  studentId: string;
  studentName: string;
  version: number;
  createdAt: string;
  publishedAt: string | null;
  document: {
    dateFrom: string;
    dateTo: string;
    courseOfferingIds: string[];
    courseLabels: string[];
    sections: ReportSection[];
    snapshot?: ReportSnapshot | null;
  };
}
export interface ReportSnapshot {
  sources?: StudentReportSources | null;
  preparedAt?: string | null;
  student: {
    fullName: string;
    studentNumber: string;
    email: string;
    programme: string;
    level: string;
  };
  courses: {
    id: string;
    code: string;
    name: string;
    term: string;
    teachers: string[];
    enrolmentStatus: string;
    attendance: ReportAttendance;
  }[];
  attendance: ReportAttendance;
  attendanceTrend: { weekOf: string; attendance: ReportAttendance }[];
  confirmedEvents: { type: string; count: number }[];
  feedbackCount: number;
  payments: {
    invoices: {
      number: string;
      currency: string;
      issued: string;
      due: string | null;
      charges: number;
      credits: number;
      received: number;
      balance: number;
      awaitingVerification: number;
      status: string;
    }[];
    excludedInvoices: number;
  };
}
export interface ReportScope {
  studentId: string;
  dateFrom: string;
  dateTo: string;
  courseOfferingIds: string[];
}
