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
