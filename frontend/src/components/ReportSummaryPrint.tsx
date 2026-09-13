import { createPortal } from 'react-dom';
import type { AttendanceBreakdown } from './AttendanceDonutChart';
import { percentageOf } from '../lib/attendanceAnalytics';
import { formatReportDateRange } from '../lib/sessionTime';
import type { ReportInsight } from '../types';

export interface PrintableClassRow {
  id: string;
  label: string;
  detail: string;
  completedSessions: number;
  attendanceRate: number | null;
  confirmedEvents: number;
}

export interface PrintableSessionRow {
  id: string;
  label: string;
  detail: string;
  present: number;
  late: number;
  absent: number;
  notRecorded: number;
  attendanceRate: number | null;
}

interface Props {
  readonly title: string;
  readonly scopeLabel: string;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly attendance: AttendanceBreakdown;
  readonly completedSessionCount: number;
  readonly confirmedEventCount: number;
  readonly eventCounts: Readonly<Record<string, number>>;
  readonly insight: ReportInsight | null;
  readonly classRows?: readonly PrintableClassRow[];
  readonly sessionRows?: readonly PrintableSessionRow[];
}

export default function ReportSummaryPrint({
  title,
  scopeLabel,
  dateFrom,
  dateTo,
  attendance,
  completedSessionCount,
  confirmedEventCount,
  eventCounts,
  insight,
  classRows = [],
  sessionRows = []
}: Props) {
  if (typeof document === 'undefined') return null;
  const recorded = attendance.present + attendance.late + attendance.absent;
  const completeness = percentageOf(recorded, attendance.total);

  return createPortal(
    <article className="report-summary-print">
      <header className="report-summary-print__header">
        <div>
          <span>{scopeLabel}</span>
          <h1>{title}</h1>
        </div>
        <div>
          <span>Reporting period</span>
          <strong>{formatReportDateRange(dateFrom, dateTo)}</strong>
          <p>Generated from completed sessions and reviewed classroom observations.</p>
        </div>
      </header>

      <section className="report-summary-print__metrics">
        <div><span>Attendance rate</span><strong>{attendance.rate === null ? '—' : `${attendance.rate}%`}</strong></div>
        <div><span>Data completeness</span><strong>{completeness === null ? '—' : `${completeness}%`}</strong></div>
        <div><span>Completed sessions</span><strong>{completedSessionCount}</strong></div>
        <div><span>Confirmed observations</span><strong>{confirmedEventCount}</strong></div>
      </section>
      <p className="report-summary-print__breakdown">
        {attendance.present} present <span aria-hidden="true">·</span> {attendance.late} late <span aria-hidden="true">·</span> {attendance.absent} absent <span aria-hidden="true">·</span> {attendance.unknown} not recorded
      </p>

      <section className="report-summary-print__section">
        <h2>AI feedback summary</h2>
        {insight ? (
          <>
            <div className="report-summary-print__lead"><span>Summary</span><p>{insight.summary}</p></div>
            <div className="report-summary-print__columns">
              <div><span>Strengths</span><p>{insight.strengths}</p></div>
              <div><span>Next steps</span><p>{insight.nextSteps}</p></div>
            </div>
            <p className="report-summary-print__source">
              Based on {insight.sourceFeedbackCount} teacher feedback note{insight.sourceFeedbackCount === 1 ? '' : 's'}.
            </p>
          </>
        ) : (
          <div className="report-summary-print__empty">
            No AI feedback summary was generated for this report. Attendance and confirmed observations remain included.
          </div>
        )}
      </section>

      <section className="report-summary-print__section">
        <h2>Confirmed observation summary</h2>
        {Object.keys(eventCounts).length === 0 ? (
          <div className="report-summary-print__empty">No confirmed or corrected observations in this period.</div>
        ) : (
          <div className="report-summary-print__event-list">
            {Object.entries(eventCounts).map(([type, count]) => (
              <div key={type}><span>{type}</span><strong>{count}</strong></div>
            ))}
          </div>
        )}
      </section>

      {classRows.length > 0 && (
        <section className="report-summary-print__section">
          <h2>Class breakdown</h2>
          <table>
            <thead><tr><th>Class</th><th>Completed sessions</th><th>Attendance</th><th>Confirmed events</th></tr></thead>
            <tbody>
              {classRows.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.label}</strong><small>{row.detail}</small></td>
                  <td>{row.completedSessions}</td>
                  <td>{row.attendanceRate === null ? '—' : `${row.attendanceRate}%`}</td>
                  <td>{row.confirmedEvents}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {sessionRows.length > 0 && (
        <section className="report-summary-print__section">
          <h2>Session breakdown</h2>
          <table>
            <thead><tr><th>Session</th><th>Present</th><th>Late</th><th>Absent</th><th>Not recorded</th><th>Attendance</th></tr></thead>
            <tbody>
              {sessionRows.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.label}</strong><small>{row.detail}</small></td>
                  <td>{row.present}</td>
                  <td>{row.late}</td>
                  <td>{row.absent}</td>
                  <td>{row.notRecorded}</td>
                  <td>{row.attendanceRate === null ? '—' : `${row.attendanceRate}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </article>,
    document.body
  );
}
