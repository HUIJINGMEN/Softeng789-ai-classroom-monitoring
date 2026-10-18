import { buildStudentOverview } from './studentOverviewModel';
import { ALL_CLASSES, type LessonSelection, type LessonSelectionId, type StudentOverviewData,
  type StudentOverviewPage, type StudentOverviewScope, type StudentOverviewSource } from './types';

export function overviewScopeKey(scope: StudentOverviewScope): string {
  return JSON.stringify([scope.courseOfferingId, scope.weekStart, scope.view, scope.query.trim(), scope.exceptionsOnly, scope.page]);
}

export function overviewPageData(source: StudentOverviewPage | null): StudentOverviewData {
  const data = buildStudentOverview(source ?? { accounts: [], reconciliations: [] }, {
    courseOfferingId: ALL_CLASSES, query: '', exceptionsOnly: false, page: 0, size: source?.size ?? 6
  });
  return source ? { ...data, summary: source.summary, page: source.page, size: source.size,
    totalItems: source.totalItems, totalPages: source.totalPages } : data;
}

export function resolveLessonSelection(data: StudentOverviewData, id: LessonSelectionId | null, scopeKey: string): LessonSelection | null {
  if (!id || id.scopeKey !== scopeKey) return null;
  const row = data.rows.find(item => item.account.studentId === id.studentId);
  const cell = row?.cells.find(item => item.kind === 'LESSON' && item.session.id === id.sessionId
    && item.session.courseOfferingId === id.courseOfferingId);
  return row && cell?.kind === 'LESSON' ? { row: cell.reconciliationRow, cell: cell.reconciliationCell,
    session: cell.session, paymentAccount: row.account } : null;
}

/** A structural class change invalidates every student's cells and the scope-wide counters. */
export function canMergeStudentOverview(source: StudentOverviewPage, update: StudentOverviewSource, selection: LessonSelection): boolean {
  const studentId = selection.row.studentId;
  if (update.accounts.length !== 1 || update.accounts[0].studentId !== studentId || update.reconciliations.length !== 1) return false;
  const oldClass = source.reconciliations.find(item => item.courseOfferingId === selection.session.courseOfferingId);
  const freshClass = update.reconciliations.find(item => item.courseOfferingId === selection.session.courseOfferingId);
  if (!oldClass || !freshClass || !freshClass.rows.some(row => row.studentId === studentId)) return false;
  const sessionKey = (register: typeof oldClass) => JSON.stringify(register.sessions.map(session => [
    session.id, session.date, session.startTime, session.endTime, session.status, session.room, session.campus
  ]).sort((left, right) => String(left[0]).localeCompare(String(right[0]))));
  return oldClass.courseCode === freshClass.courseCode && oldClass.academicTerm === freshClass.academicTerm
    && oldClass.view === freshClass.view && oldClass.weekStart === freshClass.weekStart && oldClass.weekEnd === freshClass.weekEnd
    && sessionKey(oldClass) === sessionKey(freshClass);
}

/** Null means that a changed class, search membership or ordering requires a server page. */
export function refreshedStudentOverview(source: StudentOverviewPage, update: StudentOverviewSource,
  selection: LessonSelection, exceptionsOnly: boolean): StudentOverviewPage | null {
  if (!canMergeStudentOverview(source, update, selection)) return null;
  const studentId = selection.row.studentId;
  const before = source.accounts.find(account => account.studentId === studentId);
  const after = update.accounts[0];
  if (!before || before.state !== after.state || before.nextDueDate !== after.nextDueDate
    || before.studentName !== after.studentName || before.studentNumber !== after.studentNumber
    || JSON.stringify(before.courses) !== JSON.stringify(after.courses)) return null;
  const merged = mergeStudentOverview(source, update);
  if (exceptionsOnly) {
    const oldRow = overviewPageData(source).rows.find(row => row.account.studentId === studentId);
    const freshRow = overviewPageData(merged).rows.find(row => row.account.studentId === studentId);
    if (oldRow?.needsAttention !== freshRow?.needsAttention) return null;
  }
  return merged;
}

/** Patch a single student's source records and adjust full-scope counters by that student's delta. */
export function mergeStudentOverview(source: StudentOverviewPage, update: StudentOverviewSource): StudentOverviewPage {
  const ids = new Set(update.accounts.map(account => account.studentId));
  const accounts = source.accounts.map(account => update.accounts.find(item => item.studentId === account.studentId) ?? account);
  const reconciliations = source.reconciliations.map(register => {
    const fresh = update.reconciliations.find(item => item.courseOfferingId === register.courseOfferingId);
    return fresh ? { ...register, sessions: fresh.sessions, rows: register.rows.map(row => (
      ids.has(row.studentId) ? fresh.rows.find(item => item.studentId === row.studentId) ?? row : row
    )) } : register;
  });
  const before = overviewPageData(source).rows.filter(row => ids.has(row.account.studentId));
  const after = overviewPageData({ ...source, accounts, reconciliations }).rows.filter(row => ids.has(row.account.studentId));
  const paymentIssues = (rows: typeof before) => rows.filter(row => !['PAID', 'NO_PAYMENT_DUE'].includes(row.account.state)).length;
  return { ...source, accounts, reconciliations, summary: { ...source.summary,
    needsAttention: source.summary.needsAttention + after.filter(row => row.needsAttention).length - before.filter(row => row.needsAttention).length,
    paymentIssues: source.summary.paymentIssues + paymentIssues(after) - paymentIssues(before),
    attendanceNotRecorded: source.summary.attendanceNotRecorded + after.reduce((sum, row) => sum + row.notRecorded, 0)
      - before.reduce((sum, row) => sum + row.notRecorded, 0)
  } };
}
