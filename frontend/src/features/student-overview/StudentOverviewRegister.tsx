import { IconArrowRight } from '../../components/icons';
import {
  formatMoney,
  lessonCellView,
  shortDate,
  STUDENT_ACCOUNT_STATE_LABELS,
  studentAccountStateClass,
  type ReconciliationCell,
  type ReconciliationRow,
  type ReconciliationSession,
  type StudentPaymentAccountRow
} from '../payments';
import type {
  StudentOverviewCell,
  StudentOverviewRow,
  StudentOverviewSession
} from './types';

export interface LessonSelection {
  readonly row: ReconciliationRow;
  readonly cell: ReconciliationCell;
  readonly session: ReconciliationSession;
  readonly paymentAccount: StudentPaymentAccountRow;
}

interface RegisterProps {
  readonly rows: StudentOverviewRow[];
  readonly sessions: StudentOverviewSession[];
  readonly showCourse: boolean;
  readonly onOpenStudent: (studentId: string) => void;
  readonly onOpenPayment: (student: StudentPaymentAccountRow) => void;
  readonly onOpenLesson: (selection: LessonSelection) => void;
}

function SessionHead({ session, showCourse }: {
  readonly session: StudentOverviewSession;
  readonly showCourse: boolean;
}) {
  const date = new Date(`${session.date}T12:00:00`);
  const time = new Intl.DateTimeFormat('en-NZ', { hour: 'numeric', minute: '2-digit' })
    .format(new Date(session.startTime));
  const accessibleLabel = [session.courseCode, shortDate(session.date), time, session.room, session.campus].filter(Boolean).join(', ');
  return (
    <span className="student-overview-session-head" aria-label={accessibleLabel}>
      <small>{showCourse ? session.courseCode : session.room}</small>
      <strong>{new Intl.DateTimeFormat('en-NZ', { weekday: 'short' }).format(date)} {shortDate(session.date)}</strong>
      <time>{time}</time>
    </span>
  );
}

function NoClassCell({ session }: { readonly session: StudentOverviewSession }) {
  const label = `${shortDate(session.date)} · ${session.courseCode}: no class for this student`;
  return (
    <span className="student-overview-no-class" title={label} aria-label={label}>
      <i aria-hidden="true" />
      <small>No class</small>
    </span>
  );
}

function LessonStatusCell({ cell, onOpen }: {
  readonly cell: Extract<StudentOverviewCell, { kind: 'LESSON' }>;
  readonly onOpen: () => void;
}) {
  const view = lessonCellView(cell.session, cell.reconciliationCell);
  return (
    <button
      type="button"
      className={`lesson-cell lesson-cell--${view.tone} lesson-cell--outcome-${view.outcomeTone}`}
      onClick={onOpen}
      title={`${cell.session.courseCode} · ${shortDate(cell.session.date)} · ${view.attendance} · ${view.outcome || 'No lesson result'}`}
      aria-label={`${cell.session.courseCode}, ${shortDate(cell.session.date)}: ${view.attendance}, ${view.outcome || 'no lesson result'}`}
    >
      {view.attention && <span className="lesson-cell__attention" aria-hidden="true">!</span>}
      <span className="lesson-cell__attendance"><i aria-hidden="true">{view.symbol}</i><b>{view.attendance}</b></span>
      {view.outcome && <span className="lesson-cell__outcome">{view.outcome}</span>}
    </button>
  );
}

function StudentIdentity({ row, onOpen }: {
  readonly row: StudentOverviewRow;
  readonly onOpen: () => void;
}) {
  const account = row.account;
  const extraCourses = account.courses.length > 1 ? ` +${account.courses.length - 1}` : '';
  const courseLabel = account.courses.length > 0 ? account.courses[0] + extraCourses : 'No active class';
  return (
    <button type="button" className="student-overview-identity" onClick={onOpen}>
      <strong>{account.studentName}</strong>
      <small>{account.studentNumber}</small>
      <span className="student-overview-identity__course" title={account.courses.join(' · ') || 'No active class'}>{courseLabel}</span>
      <span className="student-overview-identity__attendance" aria-label={`${row.attended} attended, ${row.absent} absent, ${row.notRecorded} not recorded`}>
        <b>{row.attended} attended</b>
        <i className={row.absent > 0 ? 'has-danger' : ''}>{row.absent} absent</i>
        <em className={row.notRecorded > 0 ? 'has-warning' : ''}>{row.notRecorded} missing</em>
      </span>
    </button>
  );
}

function PaymentAccount({ row, onOpen }: {
  readonly row: StudentOverviewRow;
  readonly onOpen: () => void;
}) {
  const account = row.account;
  let balanceLabel = 'Account balance clear';
  if (account.balance > 0) {
    balanceLabel = `${formatMoney(account.balance, account.currency)} due`;
  } else if (account.paymentReported > 0) {
    balanceLabel = `${formatMoney(account.paymentReported, account.currency)} reported`;
  }
  const ledgerLabel = account.invoiceCount > 0
    ? `Issued ${formatMoney(account.issued, account.currency)} · Received ${formatMoney(account.received, account.currency)}`
    : 'No invoice issued';
  return (
    <button
      type="button"
      className="student-overview-payment"
      onClick={onOpen}
      aria-label={`Open payment account for ${account.studentName}`}
    >
      <span>
        <b className={studentAccountStateClass(account.state)}>{STUDENT_ACCOUNT_STATE_LABELS[account.state]}</b>
        <small>{balanceLabel}</small>
        <span className="student-overview-payment__ledger">{ledgerLabel}</span>
      </span>
      <IconArrowRight />
    </button>
  );
}

function StudentResult({ row }: { readonly row: StudentOverviewRow }) {
  let issue = 'Up to date';
  if (row.notRecorded > 0) issue = `${row.notRecorded} not recorded`;
  else if (row.needsAttention) issue = 'Account needs attention';
  return (
    <span className={`student-overview-result${row.needsAttention ? ' needs-attention' : ''}`}>
      <strong>{row.attended} attended · {row.absent} absent</strong>
      <small>{issue}</small>
    </span>
  );
}

function lessonSelection(
  cell: Extract<StudentOverviewCell, { kind: 'LESSON' }>,
  paymentAccount: StudentPaymentAccountRow
): LessonSelection {
  return {
    row: cell.reconciliationRow,
    cell: cell.reconciliationCell,
    session: cell.session,
    paymentAccount
  };
}

export function StudentOverviewTable({
  rows,
  sessions,
  showCourse,
  onOpenStudent,
  onOpenPayment,
  onOpenLesson
}: RegisterProps) {
  return (
    <div className="student-overview-table-wrap">
      <table className="student-overview-table">
        <caption className="sr-only">Student payment and attendance by lesson date</caption>
        <thead>
          <tr>
            <th scope="col" className="student-overview-table__student">
              <span className="student-overview-column-head"><strong>Student</strong><small>Attendance summary</small></span>
            </th>
            <th scope="col" className="student-overview-table__payment">
              <span className="student-overview-column-head"><strong>Payment</strong><small>Balance and invoices</small></span>
            </th>
            {sessions.map((session) => (
              <th scope="col" key={`${session.courseOfferingId}:${session.id}`}>
                <SessionHead session={session} showCourse={showCourse} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.account.studentId} className={row.needsAttention ? 'needs-attention' : ''}>
              <td className="student-overview-table__student">
                <StudentIdentity row={row} onOpen={() => onOpenStudent(row.account.studentId)} />
              </td>
              <td className="student-overview-table__payment">
                <PaymentAccount row={row} onOpen={() => onOpenPayment(row.account)} />
              </td>
              {row.cells.map((cell) => (
                <td key={`${cell.session.courseOfferingId}:${cell.session.id}`}>
                  {cell.kind === 'NO_CLASS'
                    ? <NoClassCell session={cell.session} />
                    : <LessonStatusCell cell={cell} onOpen={() => onOpenLesson(lessonSelection(cell, row.account))} />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StudentOverviewMobileList({
  rows,
  sessions,
  showCourse,
  onOpenStudent,
  onOpenPayment,
  onOpenLesson
}: RegisterProps) {
  return (
    <div className="student-overview-mobile-list">
      {rows.map((row) => (
        <article className="student-overview-mobile-card" key={row.account.studentId}>
          <header>
            <StudentIdentity row={row} onOpen={() => onOpenStudent(row.account.studentId)} />
            <PaymentAccount row={row} onOpen={() => onOpenPayment(row.account)} />
          </header>
          <StudentResult row={row} />
          {sessions.length > 0 && (
            <div className="student-overview-mobile-sessions">
              {row.cells.map((cell) => (
                <div key={`${cell.session.courseOfferingId}:${cell.session.id}`}>
                  <SessionHead session={cell.session} showCourse={showCourse} />
                  {cell.kind === 'NO_CLASS'
                    ? <NoClassCell session={cell.session} />
                    : <LessonStatusCell cell={cell} onOpen={() => onOpenLesson(lessonSelection(cell, row.account))} />}
                </div>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

export function StudentOverviewLegend() {
  return (
    <details className="student-overview-legend">
      <summary><span>How to read the table</span><small>Attendance, payment and no-class dates</small></summary>
      <div>
        <span><i className="is-present">✓</i> Present</span>
        <span><i className="is-absent">×</i> Absent</span>
        <span><i className="is-missing">?</i> Not recorded</span>
        <span><i className="is-upcoming">·</i> Upcoming</span>
        <span><i className="is-no-class">—</i> No class for this student</span>
      </div>
    </details>
  );
}
