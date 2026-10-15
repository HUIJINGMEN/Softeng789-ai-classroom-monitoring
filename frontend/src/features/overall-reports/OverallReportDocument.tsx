import { createPortal } from "react-dom";
import { formatReportDateRange } from "../../lib/sessionTime";
import { ReportFactCharts } from "../report-review/ReportFactCharts";
import { ReportStudentRoster } from "../report-review/ReportStudentRoster";
import {
  keyedNarrativeBlocks,
  reportReviewers,
} from "../report-review/reportDocumentModel";
import type { ReportTopic } from "../report-review/types";
import type { OverallReport } from "./types";
import {
  OverallFeedbackCoverage,
  OverallRecordCoverage,
  OverallWeeklyDetail,
} from "./OverallReportDetails";
import { overallAudienceLabel, overallDateTime } from "./overallReportFormat";
import { OverallReportMetrics } from "./OverallReportMetrics";
import { OverallCourseTable } from "./OverallCourseTable";
import { OverallReportActions } from "./OverallReportActions";
import "../report-review/report-review.css";
import "../report-review/report-facts.css";
import "../../styles/report-print-isolation.css";
import "./overall-report.css";

function Narrative({
  report,
  topic,
}: {
  readonly report: OverallReport;
  readonly topic: ReportTopic;
}) {
  const section = report.document.sections.find((row) => row.topic === topic);
  if (!section) return null;
  return (
    <section className="overall-report-narrative">
      <h2>{section.title}</h2>
      {keyedNarrativeBlocks(section.topic, section.text).map((block) => (
        <div key={block.key}>
          {block.heading && <h3>{block.heading}</h3>}
          {block.paragraphs.map((paragraph) => (
            <p key={paragraph.key}>{paragraph.text}</p>
          ))}
        </div>
      ))}
    </section>
  );
}
export function OverallReportDocument({
  report,
  print = false,
}: {
  readonly report: OverallReport;
  readonly print?: boolean;
}) {
  const snapshot = report.document.snapshot;
  const internal = report.document.audience === "INTERNAL";
  const content = (
    <article
      className={print ? "overall-report-print" : "overall-report-document"}
    >
      <header className="overall-report-masthead">
        <div className="overall-report-brand">
          <strong>ClassLens</strong>
          <span>
            {internal
              ? "Confidential · Staff only"
              : "For designated partners & project reviewers"}
          </span>
        </div>
        <h1>{overallAudienceLabel(report.document.audience)}</h1>
        <dl className="overall-report-meta">
          <div>
            <dt>Reporting period</dt>
            <dd>
              {formatReportDateRange(
                report.document.dateFrom,
                report.document.dateTo,
              )}
            </dd>
          </div>
          <div>
            <dt>Data as of</dt>
            <dd>{overallDateTime(snapshot.preparedAt)}</dd>
          </div>
          <div>
            <dt>Scope</dt>
            <dd>
              {snapshot.allCourses ? "Institution-wide" : "Selected courses"} ·{" "}
              {snapshot.courses.length} courses
            </dd>
          </div>
          <div>
            <dt>Prepared by</dt>
            <dd>{snapshot.preparedBy}</dd>
          </div>
        </dl>
      </header>
      <OverallReportMetrics snapshot={snapshot} />
      <Narrative report={report} topic="OVERVIEW" />
      <OverallRecordCoverage snapshot={snapshot} />
      {internal && (
        <ReportStudentRoster students={snapshot.students} showCourses />
      )}
      {internal && <OverallReportActions snapshot={snapshot} />}
      <section className="overall-report-teaching report-facts">
        <h2>Teaching & attendance</h2>
        <p className="overall-report-note">
          Attendance = (present + late) ÷ recorded marks. Recording completeness
          = recorded ÷ expected marks. Unrecorded marks are not absences; future
          and cancelled sessions are excluded. Attendance is not a measure of
          engagement or attainment.
        </p>
        <ReportFactCharts snapshot={snapshot} audience="overall" />
        <OverallCourseTable snapshot={snapshot} />
        <OverallWeeklyDetail snapshot={snapshot} />
      </section>
      <Narrative report={report} topic="ATTENDANCE" />
      <OverallFeedbackCoverage snapshot={snapshot} />
      <Narrative report={report} topic="LEARNING" />
      {snapshot.achievements > 0 && (
        <section className="overall-report-narrative">
          <h2>Recorded achievements</h2>
          <p>
            Confirmed student achievement records: {snapshot.achievements},
            marked for report inclusion in the selected courses and period. This
            is a count of records, not distinct students or a measure of
            attainment. Individual achievement details are not included.
          </p>
        </section>
      )}
      <Narrative report={report} topic="ABSENCES" />
      <footer className="overall-report-document-footer">
        <p>
          Based on {snapshot.feedbackCount} class-wide teacher feedback notes.
          Reviewed by {reportReviewers(report).join(", ") || "Not yet reviewed"}
          .
        </p>
        <p>
          {internal
            ? "Staff only: includes student names, courses and attendance. No financial information, personal progress notes or private absence reasons."
            : "No financial information, individual student records or private absence reasons are included."}
        </p>
        <p>
          {report.finalizedAt
            ? `Saved ${overallDateTime(report.finalizedAt)} · Version ${report.version}`
            : "Draft preview · Not yet saved for export."}
        </p>
        {report.privacyReviewedAt && (
          <p>
            External wording checked by {report.privacyReviewedBy} ·{" "}
            {overallDateTime(report.privacyReviewedAt)}
          </p>
        )}
      </footer>
    </article>
  );
  return print && typeof document !== "undefined"
    ? createPortal(content, document.body)
    : content;
}
