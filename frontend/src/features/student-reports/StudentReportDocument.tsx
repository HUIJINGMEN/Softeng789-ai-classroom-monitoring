import { createPortal } from 'react-dom';
import { formatReportDateRange } from '../../lib/sessionTime';
import type { StudentReport } from './types';
import { narrativeBlocks, reportReviewers } from './reportDocumentModel';
import '../../styles/report-print-isolation.css';
import '../report-review/report-print.css';
import {
  ReportFacts,
  ReportStudentInfo,
  ReportPaymentFacts
} from './ReportFacts';

export function StudentReportDocument({
  report,
  print = false
}: {
  report: StudentReport;
  print?: boolean;
}) {
  const reviewers = reportReviewers(report);
  const snapshot = report.document.snapshot;
  const content = (
    <article
      className={print ? 'student-report-print' : 'student-report-preview'}
    >
      <header className="report-document__header">
        <div className="report-document__masthead">
          <span className="report-document__brand">ClassLens</span>
          <span>Student report</span>
        </div>
        <h1>{report.studentName}</h1>
        <dl className="report-document__scope">
          <div>
            <dt>Reporting period</dt>
            <dd>
              {formatReportDateRange(
                report.document.dateFrom,
                report.document.dateTo
              )}
            </dd>
          </div>
          <div>
            <dt>{snapshot?.preparedAt ? 'Data as of' : 'Draft created'}</dt>
            <dd>
              {new Date(snapshot?.preparedAt ?? report.createdAt).toLocaleString('en-NZ', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                ...(snapshot?.preparedAt ? { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' } as const : {}),
                timeZone: 'Pacific/Auckland'
              })}
            </dd>
          </div>
          {!snapshot && (
            <div className="report-document__courses">
              <dt>Courses included</dt>
              <dd>
                {report.document.courseLabels.map((label, index) => (
                  <span key={`${index}-${label}`}>{label}</span>
                ))}
              </dd>
            </div>
          )}
        </dl>
        {snapshot && <ReportStudentInfo snapshot={snapshot} />}
      </header>
      {snapshot ? (
        <ReportFacts snapshot={snapshot} />
      ) : (
        <p className="report-facts__note">
          This older report has no saved chart or profile snapshot. Prepare a
          new draft to include these details; published reports remain
          unchanged.
        </p>
      )}
      <div
        className={`report-document__summaries${snapshot ? ' has-facts' : ''}`}
      >
        {report.document.sections.map((section) => (
          <section className={`student-report-narrative student-report-narrative--${section.topic.toLowerCase()}`} key={section.topic}>
            <h2>
              {section.topic === 'LEARNING'
                ? 'Teacher feedback summary'
                : section.title}
            </h2>
            {section.topic === 'PAYMENTS' && snapshot && (
              <ReportPaymentFacts payments={snapshot.payments} />
            )}
            {section.topic === 'LEARNING' &&
              snapshot &&
              snapshot.feedbackCount > 0 && (
                <p className="report-facts__note">
                  {`Based on ${snapshot.feedbackCount} teacher feedback note(s) in this scope.`}
                </p>
              )}
            {narrativeBlocks(section.topic, section.text).map(
              (block, index) => (
                <div className="report-document__block" key={index}>
                  {block.heading && <h3>{block.heading}</h3>}
                  {block.paragraphs.map((paragraph, paragraphIndex) => (
                    <p key={paragraphIndex}>{paragraph}</p>
                  ))}
                </div>
              )
            )}
          </section>
        ))}
      </div>
      <footer className="report-document__footer">
        {reviewers.length > 0 && <p>Reviewed by {reviewers.join(', ')}</p>}
        <p>This report covers the courses and reporting period listed above.</p>
      </footer>
    </article>
  );
  return print ? createPortal(content, document.body) : content;
}
