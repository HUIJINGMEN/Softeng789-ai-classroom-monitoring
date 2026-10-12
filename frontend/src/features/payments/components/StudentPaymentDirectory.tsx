import { useEffect } from 'react';
import Pager from '../../../components/Pager';
import SearchField from '../../../components/SearchField';
import { IconArrowRight, IconPlus, IconWallet } from '../../../components/icons';
import {
  paymentPageRangeLabel,
  STUDENT_ACCOUNT_STATE_LABELS,
  studentAccountAction,
  studentAccountDetail,
  studentAccountStateClass
} from '../adminPaymentViewModel';
import { formatMoney, formatPaymentDate } from '../format';
import type {
  StudentPaymentAccountRow,
  StudentPaymentDirectoryFilter,
  StudentPaymentDirectoryResponse
} from '../types';

interface Props {
  readonly data: StudentPaymentDirectoryResponse | null;
  readonly query: string;
  readonly filter: StudentPaymentDirectoryFilter | '';
  readonly loading: boolean;
  readonly error: string;
  readonly onQueryChange: (value: string) => void;
  readonly onFilterChange: (value: StudentPaymentDirectoryFilter | '') => void;
  readonly onPageChange: (page: number) => void;
  readonly onRetry: () => void;
  readonly onCreate: () => void;
  readonly onAction: (row: StudentPaymentAccountRow) => void;
  readonly focusStudentId?: string;
}

function CourseSummary({ row }: { readonly row: StudentPaymentAccountRow }) {
  if (row.courses.length === 0) return <span className="student-account-courses is-empty">No active class</span>;
  return (
    <span className="student-account-courses">
      <span>{row.courses[0]}</span>
      {row.courses.length > 1 && <small>+{row.courses.length - 1} more</small>}
    </span>
  );
}

function StatusSummary({ row }: { readonly row: StudentPaymentAccountRow }) {
  return (
    <span className="student-account-status-copy">
      <span className={studentAccountStateClass(row.state)}>{STUDENT_ACCOUNT_STATE_LABELS[row.state]}</span>
      <small>{studentAccountDetail(row)}</small>
    </span>
  );
}

function AccountAction({ row, onAction }: {
  readonly row: StudentPaymentAccountRow;
  readonly onAction: (row: StudentPaymentAccountRow) => void;
}) {
  const label = studentAccountAction(row);
  if (!label) return <span className="student-account-no-action">Clear</span>;
  return (
    <button type="button" className="btn btn--sm student-account-action" onClick={() => onAction(row)}>
      <span>{label}</span><IconArrowRight />
    </button>
  );
}

const FILTERS: ReadonlyArray<{ value: StudentPaymentDirectoryFilter | ''; label: string }> = [
  { value: '', label: 'All students' },
  { value: 'NEEDS_ACTION', label: 'Needs action' },
  { value: 'AWAITING_PAYMENT', label: 'Awaiting payment' },
  { value: 'PAID', label: 'Paid' }
];

export default function StudentPaymentDirectory({
  data,
  query,
  filter,
  loading,
  error,
  onQueryChange,
  onFilterChange,
  onPageChange,
  onRetry,
  onCreate,
  onAction,
  focusStudentId = ''
}: Props) {
  const summary = data?.summary;
  const resultPage = data?.page;
  const counts: Record<StudentPaymentDirectoryFilter | 'ALL', number> = {
    ALL: summary?.studentCount ?? 0,
    NEEDS_ACTION: summary?.needsActionCount ?? 0,
    AWAITING_PAYMENT: summary?.awaitingPaymentCount ?? 0,
    PAID: summary?.paidCount ?? 0
  };

  useEffect(() => {
    if (!focusStudentId || !resultPage?.items.some((row) => row.studentId === focusStudentId)) return;
    const selector = window.matchMedia('(max-width: 760px)').matches
      ? `.student-account-card[data-student-id="${focusStudentId}"]`
      : `.student-account-table tr[data-student-id="${focusStudentId}"]`;
    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(selector);
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      target?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusStudentId, resultPage?.items]);

  return (
    <section className="student-account-directory dashboard-enter" aria-labelledby="student-account-directory-title" aria-busy={loading}>
      <header className="student-account-directory__head">
        <div>
          <h2 id="student-account-directory-title">Payment accounts</h2>
          <p>Manage what each student owes and has paid. Invoice documents stay inside the account as supporting records.</p>
        </div>
        <button type="button" className="btn btn--primary btn--with-icon" onClick={onCreate}>
          <IconPlus /><span>Prepare student invoice</span>
        </button>
      </header>

      <div className="student-account-overview-strip" aria-label="Student payment groups">
        {FILTERS.map((option) => {
          const count = counts[option.value || 'ALL'];
          return (
            <button
              type="button"
              key={option.value || 'all'}
              className={filter === option.value ? 'is-active' : ''}
              aria-pressed={filter === option.value}
              onClick={() => onFilterChange(option.value)}
            >
              <span>{option.label}</span><strong>{count}</strong>
            </button>
          );
        })}
        <div className="student-account-overview-strip__balance">
          <span>Outstanding</span>
          <strong>{summary ? formatMoney(summary.outstanding, summary.currency) : '—'}</strong>
          {summary && summary.paymentReported > 0 && (
            <small>{formatMoney(summary.paymentReported, summary.currency)} reported, awaiting verification</small>
          )}
        </div>
      </div>

      <div className="student-account-toolbar">
        <SearchField
          value={query}
          onChange={onQueryChange}
          label="Search student accounts"
          placeholder="Student name, number, email or programme"
        />
        {loading && data && <output className="payment-directory-state">Updating accounts…</output>}
      </div>

      {error && (
        <div className="notice notice--warn" role="alert">
          {error}<span className="spacer" />
          <button type="button" className="btn btn--sm" onClick={onRetry}>Retry</button>
        </div>
      )}
      {loading && !data && <div className="payment-page-state">Loading student accounts…</div>}

      {resultPage && resultPage.items.length > 0 && (
        <>
          <div className="student-account-table-wrap">
            <table className="student-account-table">
              <thead><tr><th>Student</th><th>Classes</th><th>Issued</th><th>Received</th><th>Balance</th><th>Current position</th><th><span className="sr-only">Next action</span></th></tr></thead>
              <tbody>
                {resultPage.items.map((row) => (
                  <tr
                    key={row.studentId}
                    data-student-id={row.studentId}
                    className={row.studentId === focusStudentId ? 'is-focused' : ''}
                    tabIndex={row.studentId === focusStudentId ? -1 : undefined}
                  >
                    <td><strong>{row.studentName}</strong><small>{row.studentNumber} · {`${row.invoiceCount} invoice${row.invoiceCount === 1 ? '' : 's'}`}</small></td>
                    <td><CourseSummary row={row} /></td>
                    <td>{formatMoney(row.issued, row.currency)}</td>
                    <td>{formatMoney(row.received, row.currency)}</td>
                    <td className={row.balance > 0 ? 'has-balance' : ''}><strong>{formatMoney(row.balance, row.currency)}</strong>{row.nextDueDate && <small>Due {formatPaymentDate(row.nextDueDate)}</small>}</td>
                    <td><StatusSummary row={row} /></td>
                    <td><AccountAction row={row} onAction={onAction} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="student-account-mobile-list">
            {resultPage.items.map((row) => (
              <article
                key={row.studentId}
                data-student-id={row.studentId}
                tabIndex={row.studentId === focusStudentId ? -1 : undefined}
                className={`student-account-card is-${row.state.toLowerCase().replace(/_/g, '-')}${row.studentId === focusStudentId ? ' is-focused' : ''}`}
              >
                <header><div><strong>{row.studentName}</strong><small>{row.studentNumber}</small></div><span className={studentAccountStateClass(row.state)}>{STUDENT_ACCOUNT_STATE_LABELS[row.state]}</span></header>
                <CourseSummary row={row} />
                <dl>
                  <div><dt>Issued</dt><dd>{formatMoney(row.issued, row.currency)}</dd></div>
                  <div><dt>Received</dt><dd>{formatMoney(row.received, row.currency)}</dd></div>
                  <div className={row.balance > 0 ? 'has-balance' : ''}><dt>Balance</dt><dd>{formatMoney(row.balance, row.currency)}</dd></div>
                </dl>
                <p>{studentAccountDetail(row)}</p>
                <AccountAction row={row} onAction={onAction} />
              </article>
            ))}
          </div>
        </>
      )}

      {!loading && resultPage?.items.length === 0 && (
        <div className="payment-empty student-account-empty">
          <IconWallet />
          <strong>No student accounts match this view</strong>
          <span>Try another group or search, or prepare a new student invoice.</span>
        </div>
      )}

      {resultPage && (
        <Pager
          label={`Showing ${paymentPageRangeLabel(resultPage, loading)}`}
          page={resultPage.page}
          pageCount={resultPage.totalPages}
          canPrev={resultPage.hasPrevious}
          canNext={resultPage.hasNext}
          onPrev={() => onPageChange(Math.max(0, resultPage.page - 1))}
          onNext={() => onPageChange(resultPage.page + 1)}
          onGoToPage={onPageChange}
        />
      )}
    </section>
  );
}
