import { useEffect, useMemo, useState } from 'react';
import { IconArrowRight, IconChevronLeft, IconChevronRight, IconPlus, IconUsers } from '../../../components/icons';
import Pager from '../../../components/Pager';
import SearchField from '../../../components/SearchField';
import { apiMessage } from '../../../lib/apiClient';
import { formatIsoDateInAuckland } from '../../../lib/sessionTime';
import { downloadLessonReconciliation } from '../api';
import { formatMoney, PAYMENT_STATUS_LABELS, paymentStatusClass } from '../format';
import useLessonReconciliation from '../hooks/useLessonReconciliation';
import {
  endOfIsoWeek,
  lessonCellView,
  shiftIsoWeek,
  shortDate,
  startOfIsoWeek,
  weekRangeLabel
} from '../lessonReconciliationModel';
import { saveDownload } from '../../../lib/saveDownload';
import type { CoursePurchaseMode, ReconciliationCell, ReconciliationRow, ReconciliationSession } from '../types';
import LessonCreditPanel from './LessonCreditPanel';

type PaymentStudentField = 'studentId' | 'studentName' | 'studentNumber';

interface Props {
  readonly mobile: boolean;
  readonly title?: string;
  readonly description?: string;
  readonly onCreateInvoices?: (students: readonly { id: string; name: string }[]) => void;
  readonly courseOfferingId?: string;
  readonly initialWeekStart?: string;
  readonly refreshToken?: number;
  readonly showCreateAction?: boolean;
  readonly purchaseMode?: CoursePurchaseMode;
  readonly onOpenStudent?: (studentId: string) => void;
  readonly onOpenPayment?: (student: Pick<ReconciliationRow, PaymentStudentField>) => void;
}

interface Selection {
  row: ReconciliationRow;
  cell: ReconciliationCell;
  session: ReconciliationSession;
}

function SessionHead({ session, compact }: { readonly session: ReconciliationSession; readonly compact: boolean }) {
  const date = new Date(`${session.date}T12:00:00`);
  const locationLabel = [session.room, session.campus].filter(Boolean).join(' · ');
  return (
    <span className={`lesson-session-head${compact ? ' is-compact' : ''}`} title={locationLabel}>
      <strong>{new Intl.DateTimeFormat('en-NZ', { weekday: compact ? 'narrow' : 'short' }).format(date)}</strong>
      <span>{shortDate(session.date)}</span>
      {!compact && <small>{new Intl.DateTimeFormat('en-NZ', { hour: 'numeric', minute: '2-digit' }).format(new Date(session.startTime))}</small>}
    </span>
  );
}

function PaymentState({ row, compact = false, onOpen }: {
  readonly row: ReconciliationRow;
  readonly compact?: boolean;
  readonly onOpen?: () => void;
}) {
  const content = row.paymentStatus ? (
    <>
      <span className={paymentStatusClass(row.paymentStatus)}>{PAYMENT_STATUS_LABELS[row.paymentStatus]}</span>
      {row.balance !== null && row.balance > 0 && <small>{formatMoney(row.balance, row.currency)} due</small>}
      {!compact && row.purchaseMode === 'LESSON_PACKAGE' && <small>{row.purchasedSessions} bought · {row.usedSessions} used · {row.remainingSessions} left</small>}
      {!compact && row.purchaseMode === 'COURSE_ENROLMENT' && <small>Complete course · {row.purchasedSessions} lessons covered</small>}
      {!compact && row.purchaseMode === 'MEMBERSHIP' && <small>Membership · {row.purchasedSessions} lessons in period</small>}
      {!compact && row.purchaseMode === 'PAY_PER_LESSON' && <small>{row.purchasedSessions} lesson{row.purchasedSessions === 1 ? '' : 's'} purchased</small>}
    </>
  ) : <><strong>Needs invoice</strong><small>No payment request yet</small></>;
  const className = `lesson-account-state${row.paymentStatus ? '' : ' is-unbilled'}${onOpen ? ' is-link' : ''}`;
  if (!onOpen) return <span className={className}>{content}</span>;
  return (
    <button type="button" className={className} onClick={onOpen} aria-label={`Open payment account for ${row.studentName}`}>
      <span className="lesson-account-state__content">{content}</span>
      <IconArrowRight />
    </button>
  );
}

function StudentIdentity({ row, onOpen }: {
  readonly row: ReconciliationRow;
  readonly onOpen?: () => void;
}) {
  if (!onOpen) return <><strong>{row.studentName}</strong><small>{row.studentNumber}</small></>;
  return (
    <button type="button" className="lesson-student-link" onClick={onOpen} aria-label={`Open student profile for ${row.studentName}`}>
      <strong>{row.studentName}</strong><small>{row.studentNumber}</small>
    </button>
  );
}

function LessonCell({ session, cell, compact, onOpen }: {
  readonly session: ReconciliationSession;
  readonly cell: ReconciliationCell;
  readonly compact: boolean;
  readonly onOpen: () => void;
}) {
  const view = lessonCellView(session, cell);
  return (
    <button
      type="button"
      className={`lesson-cell lesson-cell--${view.tone} lesson-cell--outcome-${view.outcomeTone}${compact ? ' is-compact' : ''}`}
      onClick={onOpen}
      title={`${shortDate(session.date)} · ${view.attendance} · ${view.outcome || 'No lesson result'}`}
      aria-label={`${shortDate(session.date)}: ${view.attendance}, ${view.outcome || 'no lesson result'}`}
    >
      {view.attention && <span className="lesson-cell__attention" aria-hidden="true">!</span>}
      <span className="lesson-cell__attendance"><i aria-hidden="true">{view.symbol}</i><b>{view.attendance}</b></span>
      {view.outcome && <span className="lesson-cell__outcome">{view.outcome}</span>}
    </button>
  );
}

function StudentResult({ row }: { readonly row: ReconciliationRow }) {
  const attended = row.cells.filter((cell) => cell.attendanceStatus === 'PRESENT' || cell.attendanceStatus === 'LATE').length;
  const absent = row.cells.filter((cell) => cell.attendanceStatus === 'ABSENT').length;
  const missing = row.cells.filter((cell) => cell.attendanceStatus === 'UNKNOWN').length;
  let issue = 'Up to date';
  if (row.uncoveredAttendance > 0) issue = `${row.uncoveredAttendance} not covered`;
  else if (row.makeupDue > 0) issue = `${row.makeupDue} make-up due`;
  else if (missing > 0) issue = `${missing} not recorded`;
  else if (row.needsAttention) issue = 'Review account';
  return (
    <span className={`lesson-week-result${row.needsAttention ? ' needs-attention' : ''}`}>
      <strong>{attended} attended · {absent} absent</strong>
      <small>{issue}</small>
    </span>
  );
}

function ReconciliationLegend() {
  return (
    <details className="lesson-legend">
      <summary><span>How to read this register</span><small>Attendance, lesson treatment and invoice status</small></summary>
      <div>
        <section>
          <strong>Attendance</strong>
          <span><i className="is-present">✓</i> Present</span>
          <span><i className="is-late">◷</i> Late</span>
          <span><i className="is-sick">S</i> Sick</span>
          <span><i className="is-leave">L</i> Approved leave</span>
          <span><i className="is-absent">×</i> No-show / absent</span>
          <span><i className="is-missing">?</i> Not recorded</span>
          <span><i className="is-upcoming">·</i> Upcoming / in progress</span>
          <span><i className="is-cancelled">–</i> Class cancelled</span>
        </section>
        <section>
          <strong>Bottom bar · lesson treatment</strong>
          <span><i className="is-covered" /> Covered / used</span>
          <span><i className="is-due" /> Payment due / not covered</span>
          <span><i className="is-makeup" /> Make-up due / booked</span>
          <span><i className="is-charged" /> Absence charged</span>
          <span><i className="is-neutral" /> No charge / cancelled</span>
        </section>
        <section>
          <strong>Payment column · invoice</strong>
          <span>Needs invoice</span>
          <span>Needs review</span>
          <span>Payment due / overdue</span>
          <span>Part paid</span>
          <span>Paid</span>
          <span>Cancelled</span>
        </section>
        <p>The large symbol records what happened in class. The bottom bar records how that specific paid lesson was treated. The Payment column shows the student's invoice state. A red corner means an administrator needs to act.</p>
      </div>
    </details>
  );
}

function canCreateInvoice(row: ReconciliationRow, purchaseMode?: CoursePurchaseMode) {
  if (!row.paymentStatus || row.paymentStatus === 'CANCELLED') return true;
  if (purchaseMode === 'LESSON_PACKAGE') return row.paymentStatus === 'PAID';
  return false;
}

function ReconciliationTable({ rows, sessions, compact, selectable, purchaseMode, selected, onToggle, onToggleAll, onOpen, onOpenStudent, onOpenPayment }: {
  readonly rows: ReconciliationRow[];
  readonly sessions: ReconciliationSession[];
  readonly compact: boolean;
  readonly selectable: boolean;
  readonly purchaseMode?: CoursePurchaseMode;
  readonly selected: ReadonlySet<string>;
  readonly onToggle: (row: ReconciliationRow) => void;
  readonly onToggleAll: () => void;
  readonly onOpen: (selection: Selection) => void;
  readonly onOpenStudent?: (studentId: string) => void;
  readonly onOpenPayment?: (student: Pick<ReconciliationRow, 'studentId' | 'studentName' | 'studentNumber'>) => void;
}) {
  const eligible = rows.filter((row) => canCreateInvoice(row, purchaseMode));
  const allSelected = eligible.length > 0 && eligible.every((row) => selected.has(row.studentId));
  return (
    <div className={`lesson-table-wrap${compact ? ' is-course-view' : ''}${selectable ? '' : ' has-no-selection'}`}>
      <table className="lesson-table">
        <thead>
          <tr>
            {selectable && (
              <th className="lesson-table__select">
                <input type="checkbox" checked={allSelected} disabled={eligible.length === 0} onChange={onToggleAll} aria-label="Select all students without an invoice" />
              </th>
            )}
            <th className="lesson-table__student">Student</th>
            <th className="lesson-table__payment">Payment</th>
            {sessions.map((session) => <th key={session.id}><SessionHead session={session} compact={compact} /></th>)}
            <th className="lesson-table__result">Summary</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.studentId} className={row.needsAttention ? 'needs-attention' : ''}>
              {selectable && (
                <td className="lesson-table__select">
                  <input
                    type="checkbox"
                    checked={selected.has(row.studentId)}
                    disabled={!canCreateInvoice(row, purchaseMode)}
                    onChange={() => onToggle(row)}
                    aria-label={!canCreateInvoice(row, purchaseMode) ? `${row.studentName} has an open invoice` : `Select ${row.studentName} for billing`}
                  />
                </td>
              )}
              <td className="lesson-table__student"><StudentIdentity row={row} onOpen={onOpenStudent ? () => onOpenStudent(row.studentId) : undefined} /></td>
              <td className="lesson-table__payment"><PaymentState row={row} compact={compact} onOpen={onOpenPayment ? () => onOpenPayment(row) : undefined} /></td>
              {sessions.map((session, index) => {
                const cell = row.cells[index];
                return <td key={session.id}><LessonCell session={session} cell={cell} compact={compact} onOpen={() => onOpen({ row, cell, session })} /></td>;
              })}
              <td className="lesson-table__result"><StudentResult row={row} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MobileReconciliation({ rows, sessions, onOpen, onOpenStudent, onOpenPayment }: {
  readonly rows: ReconciliationRow[];
  readonly sessions: ReconciliationSession[];
  readonly onOpen: (selection: Selection) => void;
  readonly onOpenStudent?: (studentId: string) => void;
  readonly onOpenPayment?: (student: Pick<ReconciliationRow, 'studentId' | 'studentName' | 'studentNumber'>) => void;
}) {
  return (
    <div className="mobile-lesson-list">
      {rows.map((row) => (
        <article className="mobile-lesson-student" key={row.studentId}>
          <header><StudentIdentity row={row} onOpen={onOpenStudent ? () => onOpenStudent(row.studentId) : undefined} /><PaymentState row={row} onOpen={onOpenPayment ? () => onOpenPayment(row) : undefined} /></header>
          <div className="mobile-lesson-student__credits"><StudentResult row={row} /></div>
          <div className="mobile-lesson-student__sessions">
            {sessions.map((session, index) => (
              <div key={session.id}>
                <SessionHead session={session} compact={false} />
                <LessonCell session={session} cell={row.cells[index]} compact={false} onOpen={() => onOpen({ row, cell: row.cells[index], session })} />
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function useRegisterWorkspace({
  mobile,
  title = 'Class register',
  description = 'See attendance, payment coverage and make-ups by lesson date.',
  onCreateInvoices,
  courseOfferingId,
  initialWeekStart,
  refreshToken = 0,
  showCreateAction = true,
  purchaseMode,
  onOpenStudent,
  onOpenPayment
}: Props) {
  const reconciliation = useLessonReconciliation(courseOfferingId, refreshToken, initialWeekStart);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState<'' | 'xlsx' | 'pdf'>('');
  const [exportError, setExportError] = useState('');
  const data = reconciliation.data;
  const todayWeek = useMemo(() => startOfIsoWeek(formatIsoDateInAuckland(new Date())), []);
  const courseView = reconciliation.view === 'COURSE';
  const selectable = showCreateAction && Boolean(onCreateInvoices);
  const emptyWeek = Boolean(data && !courseView && data.sessions.length === 0);
  const eligibleStudents = useMemo(
    () => selectable ? data?.rows.filter((row) => canCreateInvoice(row, purchaseMode)) ?? [] : [],
    [data, purchaseMode, selectable]
  );

  useEffect(() => {
    if (!data) return;
    const valid = new Set(data.rows.filter((row) => canCreateInvoice(row, purchaseMode)).map((row) => row.studentId));
    setSelectedStudents((current) => new Set([...current].filter((id) => valid.has(id))));
  }, [data, purchaseMode]);

  const moveWeek = (amount: number) => reconciliation.setWeekStart(shiftIsoWeek(reconciliation.weekStart, amount));
  const toggleStudent = (row: ReconciliationRow) => {
    if (!canCreateInvoice(row, purchaseMode)) return;
    setSelectedStudents((current) => {
      const next = new Set(current);
      if (next.has(row.studentId)) next.delete(row.studentId); else next.add(row.studentId);
      return next;
    });
  };
  const toggleAll = () => {
    const allSelected = eligibleStudents.length > 0
      && eligibleStudents.every((row) => selectedStudents.has(row.studentId));
    setSelectedStudents(allSelected ? new Set() : new Set(eligibleStudents.map((row) => row.studentId)));
  };
  const selectBillableStudents = () => {
    setSelectedStudents(new Set(eligibleStudents.map((row) => row.studentId)));
  };
  const createSelectedInvoices = () => {
    if (!data || !onCreateInvoices) return;
    onCreateInvoices(data.rows
      .filter((row) => selectedStudents.has(row.studentId))
      .map((row) => ({ id: row.studentId, name: row.studentName })));
  };
  const exportReport = async (format: 'xlsx' | 'pdf') => {
    if (!reconciliation.courseOfferingId) return;
    setExporting(format);
    setExportError('');
    try {
      const file = await downloadLessonReconciliation(format, {
        courseOfferingId: reconciliation.courseOfferingId,
        weekStart: reconciliation.weekStart,
        view: reconciliation.view,
        query: reconciliation.query,
        exceptionsOnly: reconciliation.exceptionsOnly
      });
      saveDownload(file, `attendance-billing-register-${reconciliation.weekStart}.${format}`);
    } catch (cause) {
      setExportError(apiMessage(cause));
    } finally {
      setExporting('');
    }
  };

  let billingActionLabel = 'No students to bill';
  if (selectedStudents.size > 0) {
    const suffix = selectedStudents.size === 1 ? '' : 's';
    billingActionLabel = `Prepare ${selectedStudents.size} invoice${suffix}`;
  } else if (eligibleStudents.length > 0) {
    billingActionLabel = 'Select billable students';
  }

  return {
    reconciliation,
    title,
    description,
    courseView,
    selectable,
    onCreateInvoices,
    emptyWeek,
    eligibleStudents,
    selectedStudents,
    createSelectedInvoices,
    selectBillableStudents,
    billingActionLabel,
    exportError,
    courseOfferingId,
    moveWeek,
    todayWeek,
    data,
    exporting,
    exportReport,
    setSelectedStudents,
    mobile,
    setSelection,
    onOpenStudent,
    onOpenPayment,
    purchaseMode,
    toggleStudent,
    toggleAll,
    selection
  };
}

function RegisterSummary({ model }: { readonly model: ReturnType<typeof useRegisterWorkspace> }) {
  const { data } = model;
  if (!data) return null;
  return (
    <div className="lesson-summary" aria-label="Register summary">
      <div className={`lesson-summary__lead${data.summary.totalStudents - data.summary.fullyReconciled ? ' has-warning' : ''}`}><strong>{data.summary.totalStudents - data.summary.fullyReconciled}</strong><span>Need action</span></div>
      <div><strong>{data.summary.totalStudents}</strong><span>Students</span></div>
      <div className={data.summary.paymentIssues ? 'has-warning' : ''}><strong>{data.summary.paymentIssues}</strong><span>Payment issues</span></div>
      <div className={data.summary.makeupDue ? 'has-warning' : ''}><strong>{data.summary.makeupDue}</strong><span>Make-ups due</span></div>
      <div className={data.summary.attendanceNotRecorded ? 'has-warning' : ''}><strong>{data.summary.attendanceNotRecorded}</strong><span>Not recorded</span></div>
    </div>
  );
}

export default function LessonReconciliationWorkspace({
  mobile,
  title = 'Class register',
  description = 'See attendance, payment coverage and make-ups by lesson date.',
  onCreateInvoices,
  courseOfferingId,
  initialWeekStart,
  refreshToken = 0,
  showCreateAction = true,
  purchaseMode,
  onOpenStudent,
  onOpenPayment
}: Props) {
  const model = useRegisterWorkspace({
    mobile,
    title,
    description,
    onCreateInvoices,
    courseOfferingId,
    initialWeekStart,
    refreshToken,
    showCreateAction,
    purchaseMode,
    onOpenStudent,
    onOpenPayment
  });
  const {
    reconciliation,
    courseView,
    selectable,
    emptyWeek,
    eligibleStudents,
    selectedStudents,
    createSelectedInvoices,
    selectBillableStudents,
    billingActionLabel,
    exportError,
    moveWeek,
    todayWeek,
    data,
    exporting,
    exportReport,
    setSelectedStudents,
    setSelection,
    toggleStudent,
    toggleAll,
    selection
  } = model;

  return (
    <section className="lesson-reconciliation" aria-busy={reconciliation.loading}>
      <header className="lesson-reconciliation__head">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="lesson-reconciliation__actions">
          <fieldset className="lesson-view-switch" aria-label="Register period">
            <button type="button" className={!courseView ? 'is-active' : ''} onClick={() => reconciliation.setView('WEEK')}>This week</button>
            <button type="button" className={courseView ? 'is-active' : ''} onClick={() => reconciliation.setView('COURSE')}>Whole course</button>
          </fieldset>
          {selectable && onCreateInvoices && (
            <button
              type="button"
              className="btn btn--primary lesson-reconciliation__billing-action"
              disabled={reconciliation.loading || emptyWeek || eligibleStudents.length === 0}
              onClick={selectedStudents.size > 0 ? createSelectedInvoices : selectBillableStudents}
            >
              {selectedStudents.size > 0 ? <IconPlus /> : <IconUsers />}
              {billingActionLabel}
            </button>
          )}
        </div>
      </header>

      {exportError && <div className="notice notice--warn" role="alert">{exportError}</div>}

      <div className={`lesson-toolbar${courseOfferingId ? ' lesson-toolbar--class-fixed' : ''}${courseView ? ' is-course-view' : ''}`}>
        {!courseOfferingId && (
          <label className="field"><span>Class</span><select value={reconciliation.courseOfferingId} onChange={(event) => reconciliation.setCourseOfferingId(event.target.value)}>{reconciliation.classes.map((item) => <option value={item.id} key={item.id}>{item.courseCode} · {item.academicTerm}</option>)}</select></label>
        )}
        {!courseView && (
          <div className="lesson-week-control">
            <span>Week</span>
            <div>
              <button type="button" onClick={() => moveWeek(-1)} aria-label="Previous week"><IconChevronLeft /></button>
              <button type="button" className="lesson-week-control__label" onClick={() => reconciliation.setWeekStart(todayWeek)}>{data ? weekRangeLabel(data.weekStart, data.weekEnd) : weekRangeLabel(reconciliation.weekStart, endOfIsoWeek(reconciliation.weekStart))}</button>
              <button type="button" onClick={() => moveWeek(1)} aria-label="Next week"><IconChevronRight /></button>
            </div>
          </div>
        )}
        {courseView && data && <div className="lesson-course-range"><span>Course dates</span><strong>{weekRangeLabel(data.weekStart, data.weekEnd)}</strong></div>}
        <SearchField value={reconciliation.query} onChange={reconciliation.setQuery} label="Search students" placeholder="Name or student number" />
        <label className="lesson-exceptions-toggle"><input type="checkbox" checked={reconciliation.exceptionsOnly} onChange={(event) => reconciliation.setExceptionsOnly(event.target.checked)} /><span>Needs attention only</span></label>
        <div className="lesson-export-actions" aria-label="Export register">
          <button type="button" className="btn" disabled={Boolean(exporting) || !data} onClick={() => void exportReport('xlsx')}>{exporting === 'xlsx' ? 'Exporting…' : 'Excel'}</button>
          <button type="button" className="btn" disabled={Boolean(exporting) || !data} onClick={() => void exportReport('pdf')}>{exporting === 'pdf' ? 'Exporting…' : 'PDF'}</button>
        </div>
      </div>

      {data && !emptyWeek && (
        <RegisterSummary model={model} />
      )}

      {!emptyWeek && <ReconciliationLegend />}

      {!emptyWeek && selectedStudents.size > 0 && (
        <output className="lesson-batch-bar">
          <span><strong>{selectedStudents.size} student{selectedStudents.size === 1 ? '' : 's'} selected</strong><span>Students with an open invoice are excluded to prevent duplicate billing.</span></span>
          <button type="button" className="btn" onClick={() => setSelectedStudents(new Set())}>Clear</button>
          <button type="button" className="btn btn--primary" onClick={createSelectedInvoices}>Continue with {selectedStudents.size}</button>
        </output>
      )}

      {reconciliation.error && <div className="notice notice--warn" role="alert">{reconciliation.error}<button type="button" className="btn btn--sm" onClick={reconciliation.reload}>Retry</button></div>}
      {reconciliation.loading && !data && <div className="payment-page-state">Loading attendance and billing…</div>}
      {!reconciliation.loading && !reconciliation.error && !reconciliation.courseOfferingId && (
        <div className="lesson-reconciliation__empty">
          <strong>No active classes</strong>
          <p>Add or activate a class before opening the student status board.</p>
        </div>
      )}
      {data && emptyWeek && !reconciliation.loading && (
        <div className="lesson-reconciliation__empty lesson-reconciliation__empty--week">
          <div>
            <strong>No lessons scheduled for this week</strong>
            <p>{weekRangeLabel(data.weekStart, data.weekEnd)} has no class sessions. Choose another week or open the complete course register.</p>
          </div>
          <button type="button" className="btn btn--primary" onClick={() => reconciliation.setView('COURSE')}>View whole course</button>
        </div>
      )}
      {data && !emptyWeek && data.rows.length > 0 && (mobile
        ? <MobileReconciliation rows={data.rows} sessions={data.sessions} onOpen={setSelection} onOpenStudent={onOpenStudent} onOpenPayment={onOpenPayment} />
        : <ReconciliationTable rows={data.rows} sessions={data.sessions} compact={courseView} selectable={selectable} purchaseMode={purchaseMode} selected={selectedStudents} onToggle={toggleStudent} onToggleAll={toggleAll} onOpen={setSelection} onOpenStudent={onOpenStudent} onOpenPayment={onOpenPayment} />)}
      {data && !emptyWeek && !reconciliation.loading && data.rows.length === 0 && <div className="lesson-reconciliation__empty"><strong>No students match this view</strong><p>Try another week or turn off the attention filter.</p></div>}
      {data && !emptyWeek && <Pager label={`Showing ${data.rows.length} of ${data.totalItems} students`} page={data.page} pageCount={data.totalPages} canPrev={data.hasPrevious} canNext={data.hasNext} onPrev={() => reconciliation.setPage(Math.max(0, data.page - 1))} onNext={() => reconciliation.setPage(data.page + 1)} onGoToPage={reconciliation.setPage} />}

      {selection && <LessonCreditPanel
        {...selection}
        onClose={() => setSelection(null)}
        onUpdated={reconciliation.reload}
        onOpenPayment={onOpenPayment ? () => onOpenPayment(selection.row) : undefined}
      />}
    </section>
  );
}
