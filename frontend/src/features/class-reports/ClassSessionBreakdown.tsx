import Pager from '../../components/Pager';
import SearchField from '../../components/SearchField';
import type { ClassReportWorkspace } from './useClassReportWorkspace';

interface Props {
  readonly workspace: ClassReportWorkspace;
}

export default function ClassSessionBreakdown({ workspace }: Props) {
  return (
    <section className="card class-report-sessions dashboard-enter stagger-2">
      <div className="card__head">
        <div>
          <div className="card__title">Session breakdown</div>
          <div className="card__sub">
            Compare completed sessions. Attendance includes present and late marks.
          </div>
        </div>
        <span className="report-list-card__count">
          {workspace.filteredSessionRows.length} of {workspace.sessionRows.length} sessions
        </span>
      </div>
      <div className="class-report-sessions__toolbar" role="search" aria-label="Search report sessions">
        <SearchField
          value={workspace.sessionQuery}
          placeholder="Date, campus or room"
          onChange={workspace.setSessionQuery}
        />
      </div>
      <section
        className="report-list-table-wrap"
        aria-label="Session attendance breakdown"
      >
        <table className="table table--compact class-report-session-table">
          <thead>
            <tr>
              <th>Session</th>
              <th>
                <span>Status breakdown</span>
                <div className="class-report-session-legend" aria-hidden="true">
                  <span className="class-report-session-legend__present">Present</span>
                  <span className="class-report-session-legend__late">Late</span>
                  <span className="class-report-session-legend__absent">Absent</span>
                  <span className="class-report-session-legend__unknown">Not recorded</span>
                </div>
              </th>
              <th>Attendance</th>
            </tr>
          </thead>
          <tbody>
            {workspace.pagedSessionRows.rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="cell-strong">{row.label}</div>
                  <div className="cell-sub">{row.detail}</div>
                </td>
                <td>
                  <div
                    className="class-report-session-mix"
                    aria-label={`${row.present} present, ${row.late} late, ${row.absent} absent, ${row.notRecorded} not recorded`}
                  >
                    <span>{row.present}</span>
                    <span>{row.late}</span>
                    <span>{row.absent}</span>
                    <span>{row.notRecorded}</span>
                  </div>
                </td>
                <td className="class-report-session-rate">
                  <strong>{row.attendanceRate === null ? '—' : `${row.attendanceRate}%`}</strong>
                  {row.attendanceRate === null && <span>No recorded marks</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {workspace.sessions.length === 0 && (
        <div className="class-report-sessions__empty">
          No completed sessions match this date range.
        </div>
      )}
      {workspace.sessions.length > 0 && workspace.filteredSessionRows.length === 0 && (
        <div className="class-report-sessions__empty">
          No sessions match “{workspace.sessionQuery.trim()}”.
        </div>
      )}
      {workspace.filteredSessionRows.length > 0 && (
        <Pager
          label={workspace.pagedSessionRows.label}
          page={workspace.pagedSessionRows.page}
          pageCount={workspace.pagedSessionRows.pageCount}
          canPrev={workspace.pagedSessionRows.canPrev}
          canNext={workspace.pagedSessionRows.canNext}
          onPrev={workspace.pagedSessionRows.prev}
          onNext={workspace.pagedSessionRows.next}
          onGoToPage={workspace.pagedSessionRows.goToPage}
        />
      )}
    </section>
  );
}
