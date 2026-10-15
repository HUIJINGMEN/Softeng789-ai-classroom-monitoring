import type { StudentReport } from './types';
import { StudentReportDocument } from './StudentReportDocument';

export function PublishedStudentReports({
  reports,
  courseFilter
}: {
  reports: StudentReport[];
  courseFilter: string;
}) {
  const visible = reports.filter(
    (report) =>
      courseFilter === 'all' ||
      report.document.courseLabels.some(
        (label) => label.split(' · ')[0] === courseFilter
      )
  );
  if (visible.length === 0) return null;
  return (
    <section className="published-student-reports" aria-label="Student reports">
      {visible.map((report) => (
        <details key={report.id} className="published-student-report">
          <summary>
            <strong>
              Student report · {report.document.dateFrom} –{' '}
              {report.document.dateTo}
            </strong>
            <span>
              {report.document.sections.length} reviewed sections ·{' '}
              {report.document.courseLabels.join(', ')}
            </span>
          </summary>
          <StudentReportDocument report={report} />
        </details>
      ))}
    </section>
  );
}
