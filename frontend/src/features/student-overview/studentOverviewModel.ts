import { sessionStartClock } from '../../lib/sessionTime';
import {
  lessonCellView,
  type InvoiceStatus,
  type LessonReconciliationResponse,
  type ReconciliationRow,
  type StudentPaymentAccountRow,
  type StudentPaymentAccountState
} from '../payments/model';
import {
  ALL_CLASSES,
  type StudentOverviewCell,
  type StudentOverviewData,
  type StudentOverviewRow,
  type StudentOverviewSession,
  type StudentOverviewSource
} from './types';

const PAYMENT_CLEAR_STATES: ReadonlySet<StudentPaymentAccountState> = new Set([
  'PAID',
  'NO_PAYMENT_DUE'
]);

function accountStateFromInvoice(status: InvoiceStatus | null): StudentPaymentAccountState {
  if (!status) return 'NEEDS_INVOICE';
  if (status === 'DRAFT') return 'DRAFT';
  if (status === 'PAID') return 'PAID';
  if (status === 'PARTIALLY_PAID') return 'PARTIALLY_PAID';
  if (status === 'OVERDUE') return 'OVERDUE';
  if (status === 'CANCELLED') return 'NO_PAYMENT_DUE';
  return 'PAYMENT_DUE';
}

function fallbackAccount(row: ReconciliationRow, courseCode: string): StudentPaymentAccountRow {
  const balance = row.balance ?? 0;
  return {
    studentId: row.studentId,
    studentName: row.studentName,
    studentNumber: row.studentNumber,
    courses: [courseCode],
    issued: balance,
    received: 0,
    balance,
    // This fallback contains a course aggregate, not invoice-level due dates. Do not invent an overdue amount.
    overdueBalance: null,
    paymentReported: 0,
    invoiceCount: row.invoiceId ? 1 : 0,
    draftCount: row.paymentStatus === 'DRAFT' ? 1 : 0,
    pendingEvidenceCount: 0,
    unbilledCourseCount: row.paymentStatus ? 0 : 1,
    unbilledCourses: row.paymentStatus ? [] : [courseCode],
    nextDueDate: null,
    primaryInvoiceId: row.invoiceId,
    primaryInvoiceTitle: null,
    state: accountStateFromInvoice(row.paymentStatus),
    currency: row.currency
  };
}

function overviewSessions(reconciliations: readonly LessonReconciliationResponse[]) {
  return reconciliations
    .flatMap((reconciliation) => reconciliation.sessions.map((session): StudentOverviewSession => ({
      ...session,
      courseOfferingId: reconciliation.courseOfferingId,
      courseCode: reconciliation.courseCode,
      academicTerm: reconciliation.academicTerm
    })))
    .sort((left, right) => (
      left.date.localeCompare(right.date)
      || sessionStartClock(left.startTime, left.date).localeCompare(sessionStartClock(right.startTime, right.date))
      || left.courseCode.localeCompare(right.courseCode)
      || left.id.localeCompare(right.id)
    ));
}

function rowLookup(reconciliations: readonly LessonReconciliationResponse[]) {
  const result = new Map<string, ReconciliationRow>();
  reconciliations.forEach((reconciliation) => {
    reconciliation.rows.forEach((row) => {
      result.set(`${reconciliation.courseOfferingId}:${row.studentId}`, row);
    });
  });
  return result;
}

function toOverviewCell(
  studentId: string,
  session: StudentOverviewSession,
  rows: ReadonlyMap<string, ReconciliationRow>
): StudentOverviewCell {
  const reconciliationRow = rows.get(`${session.courseOfferingId}:${studentId}`);
  if (!reconciliationRow) return { kind: 'NO_CLASS', session };
  const reconciliationCell = reconciliationRow.cells.find((cell) => cell.sessionId === session.id);
  if (!reconciliationCell) return { kind: 'NO_CLASS', session };
  return { kind: 'LESSON', session, reconciliationRow, reconciliationCell };
}

function isAttendanceMissing(cell: StudentOverviewCell) {
  return cell.kind === 'LESSON'
    && cell.reconciliationCell.attendanceStatus === 'UNKNOWN'
    && cell.session.status !== 'SCHEDULED'
    && cell.session.status !== 'ACTIVE'
    && cell.session.status !== 'CANCELLED';
}

function matchesQuery(account: StudentPaymentAccountRow, query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;
  return [account.studentName, account.studentNumber, ...account.courses]
    .some((value) => value.toLocaleLowerCase().includes(normalized));
}

function hasCellAttention(cell: StudentOverviewCell) {
  return cell.kind === 'LESSON'
    && lessonCellView(cell.session, cell.reconciliationCell).attention;
}

function toOverviewRow(
  account: StudentPaymentAccountRow,
  sessions: readonly StudentOverviewSession[],
  rows: ReadonlyMap<string, ReconciliationRow>
): StudentOverviewRow {
  const cells = sessions.map((session) => toOverviewCell(account.studentId, session, rows));
  const lessonCells = cells.filter((cell) => cell.kind === 'LESSON');
  const attended = lessonCells.filter((cell) => (
    cell.reconciliationCell.attendanceStatus === 'PRESENT'
    || cell.reconciliationCell.attendanceStatus === 'LATE'
  )).length;
  const absent = lessonCells.filter((cell) => cell.reconciliationCell.attendanceStatus === 'ABSENT').length;
  const notRecorded = lessonCells.filter(isAttendanceMissing).length;
  return {
    account,
    cells,
    attended,
    absent,
    notRecorded,
    needsAttention: !PAYMENT_CLEAR_STATES.has(account.state) || cells.some(hasCellAttention)
  };
}

function accountsInScope(source: StudentOverviewSource, courseOfferingId: string) {
  if (courseOfferingId === ALL_CLASSES) return source.accounts;
  const selected = source.reconciliations.find((item) => item.courseOfferingId === courseOfferingId);
  if (!selected) return [];
  const accountByStudent = new Map(source.accounts.map((account) => [account.studentId, account]));
  return selected.rows.map((row) => accountByStudent.get(row.studentId) ?? fallbackAccount(row, selected.courseCode));
}

export function buildStudentOverview(
  source: StudentOverviewSource,
  filters: {
    courseOfferingId: string;
    query: string;
    exceptionsOnly: boolean;
    page: number;
    size: number;
  }
): StudentOverviewData {
  const reconciliations = filters.courseOfferingId === ALL_CLASSES
    ? source.reconciliations
    : source.reconciliations.filter((item) => item.courseOfferingId === filters.courseOfferingId);
  const sessions = overviewSessions(reconciliations);
  const rows = rowLookup(reconciliations);
  const matchedRows = accountsInScope(source, filters.courseOfferingId)
    .filter((account) => matchesQuery(account, filters.query))
    .map((account) => toOverviewRow(account, sessions, rows));
  const visibleRows = matchedRows.filter((row) => !filters.exceptionsOnly || row.needsAttention);
  const totalPages = visibleRows.length === 0 ? 0 : Math.ceil(visibleRows.length / filters.size);
  const safePage = Math.min(filters.page, Math.max(0, totalPages - 1));
  const start = safePage * filters.size;

  return {
    sessions,
    rows: visibleRows.slice(start, start + filters.size),
    summary: {
      totalStudents: matchedRows.length,
      needsAttention: matchedRows.filter((row) => row.needsAttention).length,
      paymentIssues: matchedRows.filter((row) => !PAYMENT_CLEAR_STATES.has(row.account.state)).length,
      attendanceNotRecorded: matchedRows.reduce((total, row) => total + row.notRecorded, 0)
    },
    page: safePage,
    size: filters.size,
    totalItems: visibleRows.length,
    totalPages
  };
}
