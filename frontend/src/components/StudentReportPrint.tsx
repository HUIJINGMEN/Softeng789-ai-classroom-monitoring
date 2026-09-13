import { createPortal } from 'react-dom';
import { percentageOf } from '../lib/attendanceAnalytics';
import { eventMatchesStudent, eventSessionLabel } from '../lib/eventDisplay';
import { completedSessionsInRange } from '../lib/reportMetrics';
import { formatReportDateRange } from '../lib/sessionTime';
import type { Console } from '../hooks/useConsole';
import type { StudentReportSelection } from './PrepareFeedbackReportModal';
import type { CandidateEvent, Student } from '../types';

interface Props {
  readonly student: Student;
  readonly report: StudentReportSelection | null;
  readonly console: Console;
}

export default function StudentReportPrint({ student, report, console: c }: Props) {
  if (!report || typeof document === 'undefined') return null;
  const { dateFrom, dateTo, summaries } = report;
  const sessions = completedSessionsInRange(c.sessions, dateFrom, dateTo).filter((session) =>
    Boolean(session.courseOfferingId && report.courseOfferingIds.includes(session.courseOfferingId))
  );
  const attendance = sessions.reduce(
    (totals, session) => {
      const status = c.attendanceStatusFor(student.id, session.id);
      if (status === 'Present') totals.present += 1;
      else if (status === 'Late') totals.late += 1;
      else if (status === 'Absent') totals.absent += 1;
      else totals.unknown += 1;
      return totals;
    },
    { present: 0, late: 0, absent: 0, unknown: 0 }
  );
  const recorded = attendance.present + attendance.late + attendance.absent;
  const rate = percentageOf(attendance.present + attendance.late, recorded);
  const completeness = percentageOf(recorded, sessions.length);
  const sessionIds = new Set(sessions.map((session) => session.id));
  const events = c.events.filter((event): event is CandidateEvent =>
    sessionIds.has(event.sessionId) && eventMatchesStudent(event, student) &&
    (event.status === 'Confirmed' || event.status === 'Corrected')
  );

  return createPortal(
    <article className="student-report-print">
      <header className="student-report-print__header">
        <div>
          <span>Student report</span>
          <h1>{student.name}</h1>
          <p>{student.id}</p>
        </div>
        <div>
          <span>Reporting period</span>
          <strong>{formatReportDateRange(dateFrom, dateTo)}</strong>
          <p>{report.courseLabels.join(' · ')}</p>
        </div>
      </header>

      <section className="student-report-print__metrics">
        <div><span>Attendance rate</span><strong>{rate === null ? '—' : `${rate}%`}</strong></div>
        <div><span>Data completeness</span><strong>{completeness === null ? '—' : `${completeness}%`}</strong></div>
        <div><span>Completed sessions</span><strong>{sessions.length}</strong></div>
        <div><span>Confirmed observations</span><strong>{events.length}</strong></div>
      </section>
      <p className="student-report-print__breakdown">
        {attendance.present} present <span aria-hidden="true">·</span> {attendance.late} late <span aria-hidden="true">·</span> {attendance.absent} absent <span aria-hidden="true">·</span> {attendance.unknown} not recorded
      </p>

      <section className="student-report-print__summaries">
        <h2>Learning progress</h2>
        {summaries.length === 0 ? (
          <div className="student-report-print__empty">
            No teacher feedback was recorded in this reporting period. Attendance and confirmed observations are shown above and below.
          </div>
        ) : summaries.map((item) => (
          <section key={item.id} className="student-report-print__course">
            <div className="student-report-print__course-title">
              <h3>{item.classLabel}</h3>
              <span>
                Reviewed by {item.reviewedByTeacherName ?? item.createdByTeacherName} · Based on {item.sourceFeedbackCount} feedback note{item.sourceFeedbackCount === 1 ? '' : 's'}
              </span>
            </div>
            <div className="student-report-print__lead"><span>Summary</span><p>{item.summary}</p></div>
            <div className="student-report-print__columns">
              <div><span>Strengths</span><p>{item.strengths}</p></div>
              <div><span>Next steps</span><p>{item.nextSteps}</p></div>
            </div>
          </section>
        ))}
      </section>

      {events.length > 0 && (
        <section className="student-report-print__events">
          <h2>Confirmed observations</h2>
          {events.map((event) => (
            <div key={event.id}>
              <span>{event.type}</span>
              <p>{eventSessionLabel(event, sessions)} · {event.start} · {event.duration}</p>
            </div>
          ))}
        </section>
      )}
    </article>,
    document.body
  );
}
