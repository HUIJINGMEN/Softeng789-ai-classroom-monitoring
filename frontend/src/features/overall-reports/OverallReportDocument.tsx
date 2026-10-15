import { createPortal } from "react-dom";
import { formatReportDateRange } from "../../lib/sessionTime";
import { ReportFactCharts } from "../report-review/ReportFactCharts";
import {
  narrativeBlocks,
  reportReviewers,
} from "../report-review/reportDocumentModel";
import type { ReportAttendance, ReportTopic } from "../report-review/types";
import type { OverallReport, OverallReportSnapshot } from "./types";
import "../report-review/report-review.css";
import "../report-review/report-facts.css";
import "../../styles/report-print-isolation.css";
import "./overall-report.css";

export const overallAudienceLabel = (audience: string) =>
  audience === "PARTNER" ? "Partner report" : "Internal operations report";
export const overallDateTime = (value: string) =>
  new Date(value).toLocaleString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Pacific/Auckland",
    timeZoneName: "short",
  });
export const overallCompleteness = (a: ReportAttendance) =>
  a.completed
    ? Math.round((100 * (a.present + a.late + a.absent)) / a.completed)
    : null;
const rate = (value: number | null) => (value === null ? "—" : `${value}%`);
export const overallReportFilename = (report: OverallReport) =>
  `${overallAudienceLabel(report.document.audience)} - ${report.document.dateFrom} to ${report.document.dateTo}`;

export function OverallReportMetrics({
  snapshot,
}: {
  snapshot: OverallReportSnapshot;
}) {
  return (
    <dl className="overall-report-metrics">
      {[
        ["Courses", snapshot.courses.length],
        ["Distinct students", snapshot.studentCount],
        ["Completed sessions", snapshot.completedSessions],
        ["Attendance", rate(snapshot.attendance.rate)],
        [
          "Recording completeness",
          rate(overallCompleteness(snapshot.attendance)),
        ],
      ].map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function OverallCourseTable({
  snapshot,
  compact = false,
}: {
  snapshot: OverallReportSnapshot;
  compact?: boolean;
}) {
  return (
    <div className="overall-course-table">
      <table>
        <caption>Course comparison</caption>
        <thead>
          <tr>
            <th scope="col">Course</th>
            {!compact && <th scope="col">Students</th>}
            {!compact && <th scope="col">Sessions</th>}
            <th scope="col">Attendance</th>
            <th scope="col">Recorded</th>
          </tr>
        </thead>
        <tbody>
          {snapshot.courses.map((course) => (
            <tr key={course.id}>
              <th scope="row">
                {course.code}
                <small>{course.term}</small>
                {compact && (
                  <small>
                    {course.students} students · {course.completedSessions}{" "}
                    sessions
                  </small>
                )}
              </th>
              {!compact && <td data-label="Students">{course.students}</td>}
              {!compact && (
                <td data-label="Sessions">{course.completedSessions}</td>
              )}
              <td data-label="Attendance">{rate(course.attendance.rate)}</td>
              <td data-label="Recorded">
                {rate(overallCompleteness(course.attendance))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!snapshot.courses.length && <p>No courses in this reporting scope.</p>}
      <p className="overall-report-note">
        Students are distinct within each course and may appear in multiple
        rows. Overall student count is deduplicated. Attendance is weighted by
        recorded marks, not an average of course percentages.
      </p>
    </div>
  );
}
export function OverallReportActions({
  snapshot,
  onOpenCourse,
}: {
  snapshot: OverallReportSnapshot;
  onOpenCourse?: (id: string) => void;
}) {
  return (
    <section className="overall-report-actions">
      <h2>Operational follow-up</h2>
      <p className="overall-report-note">
        Record checks, not a ranking of students or courses. Counts describe
        different issues and should not be added together.
      </p>
      {!snapshot.actions.length && (
        <p>
          No follow-up flags from the included records. This is not proof that
          all operational work is complete.
        </p>
      )}
      {snapshot.actions.map((action) => (
        <div
          className="overall-report-action"
          key={action.courseOfferingId + action.issue}
        >
          <div>
            <strong>
              {action.issue} · {action.count}
            </strong>
            <span>{action.courseLabel}</span>
            <p>{action.nextStep}</p>
          </div>
          {onOpenCourse && (
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => onOpenCourse(action.courseOfferingId)}
            >
              Open class
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
function Narrative({
  report,
  topic,
}: {
  report: OverallReport;
  topic: ReportTopic;
}) {
  const section = report.document.sections.find((row) => row.topic === topic);
  if (!section) return null;
  return (
    <section className="overall-report-narrative">
      <h2>{section.title}</h2>
      {narrativeBlocks(section.topic, section.text).map((block, index) => (
        <div key={index}>
          {block.heading && <h3>{block.heading}</h3>}
          {block.paragraphs.map((paragraph, p) => (
            <p key={p}>{paragraph}</p>
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
  report: OverallReport;
  print?: boolean;
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
      </section>
      <Narrative report={report} topic="ATTENDANCE" />
      <Narrative report={report} topic="LEARNING" />
      {snapshot.achievements > 0 && (
        <section className="overall-report-narrative">
          <h2>Recorded achievements</h2>
          <p>
            {snapshot.achievements} confirmed student achievements marked for
            report inclusion in the selected courses and period. This is a count
            of records, not distinct students or a measure of attainment.
            Individual identities and achievement details are not included.
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
          No financial information, individual student records or private
          absence reasons are included.
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
