import type {
  LessonReconciliationResponse,
  ReconciliationCell,
  ReconciliationRow,
  ReconciliationSession,
  StudentPaymentAccountRow
} from '../payments/model';

export const ALL_CLASSES = 'ALL_CLASSES';

export interface StudentOverviewSession extends ReconciliationSession {
  courseOfferingId: string;
  courseCode: string;
  academicTerm: string;
}

export interface LessonSelection {
  readonly row: ReconciliationRow;
  readonly cell: ReconciliationCell;
  readonly session: StudentOverviewSession;
  readonly paymentAccount: StudentPaymentAccountRow;
}

export type StudentOverviewCell =
  | {
      kind: 'LESSON';
      session: StudentOverviewSession;
      reconciliationRow: ReconciliationRow;
      reconciliationCell: ReconciliationCell;
    }
  | {
      kind: 'NO_CLASS';
      session: StudentOverviewSession;
    };

export interface StudentOverviewRow {
  account: StudentPaymentAccountRow;
  cells: StudentOverviewCell[];
  needsAttention: boolean;
  attended: number;
  absent: number;
  notRecorded: number;
}

export interface StudentOverviewSummary {
  totalStudents: number;
  needsAttention: number;
  paymentIssues: number;
  attendanceNotRecorded: number;
}

export interface StudentOverviewData {
  sessions: StudentOverviewSession[];
  rows: StudentOverviewRow[];
  summary: StudentOverviewSummary;
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

export interface StudentOverviewSource {
  accounts: StudentPaymentAccountRow[];
  reconciliations: LessonReconciliationResponse[];
}

export interface StudentOverviewScope {
  courseOfferingId: string;
  weekStart: string;
  view: 'WEEK' | 'COURSE';
  query: string;
  exceptionsOnly: boolean;
  page: number;
}

export interface StudentOverviewPage extends StudentOverviewSource {
  summary: StudentOverviewSummary;
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

export interface LessonSelectionId {
  studentId: string;
  courseOfferingId: string;
  sessionId: string;
  scopeKey: string;
}
