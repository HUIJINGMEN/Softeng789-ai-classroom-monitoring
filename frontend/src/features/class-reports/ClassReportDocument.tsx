import { createPortal } from "react-dom";
import { formatReportDateRange } from "../../lib/sessionTime";
import { ReportFactCharts } from "../report-review/ReportFactCharts";
import {
  narrativeBlocks,
  reportReviewers,
} from "../report-review/reportDocumentModel";
import type { ClassReport } from "./types";
import "../report-review/report-review.css";
import "../report-review/report-facts.css";
import "../report-review/report-print.css";
import "../../styles/report-print-isolation.css";
import "./class-report-document.css";

export function classReportFilename(report: ClassReport) {
  const label = report.classLabel
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .trim();
  return `Class report - ${label || "Class"} - ${report.document.dateFrom} to ${report.document.dateTo}`;
}
const dateTime = (value: string) =>
  new Date(value).toLocaleString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: "Pacific/Auckland",
  });
const rate = (value: number | null) => (value === null ? "—" : `${value}%`);
const money = (value: number, currency: string) =>
  `${currency} ${Number(value).toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ClassReportDocument({
  report,
  print = false,
}: {
  report: ClassReport;
  print?: boolean;
}) {
  const snapshot = report.document.snapshot;
  const attendance = snapshot.attendance;
  const recorded = attendance.present + attendance.late + attendance.absent;
  const sections = report.document.sections.filter((section) => section.topic !== "ACHIEVEMENTS");
  const reviewers = reportReviewers({ ...report, document: { ...report.document, sections } });
  const content = (
    <article className={print ? "class-report-print" : "class-report-preview"}>
      <header className="report-document__header">
        <div className="report-document__masthead">
          <span className="report-document__brand">ClassLens</span>
          <span>Class report · Staff only</span>
        </div>
        <h1>
          {snapshot.course.code}
          {snapshot.course.name !== snapshot.course.code &&
            ` · ${snapshot.course.name}`}
        </h1>
        <dl className="report-document__scope">
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
            <dd>{dateTime(snapshot.preparedAt)}</dd>
          </div>
          <div>
            <dt>Teaching term</dt>
            <dd>{snapshot.course.term || "Not recorded"}</dd>
          </div>
          <div>
            <dt>Teachers</dt>
            <dd>{snapshot.course.teachers.join(", ") || "Not assigned"}</dd>
          </div>
        </dl>
      </header>
      <div className="report-facts">
        <section className="report-facts__section">
          <h2>Class attendance & observations</h2>
          <dl className="report-facts__totals">
            <div>
              <dt>Students in scope</dt>
              <dd>{snapshot.students.length}</dd>
            </div>
            <div>
              <dt>Completed class sessions</dt>
              <dd>{snapshot.completedSessions}</dd>
            </div>
            <div>
              <dt>Recorded-mark attendance</dt>
              <dd>{rate(attendance.rate)}</dd>
            </div>
            <div>
              <dt>Recording completeness</dt>
              <dd>
                {attendance.completed
                  ? `${Math.round((100 * recorded) / attendance.completed)}%`
                  : "—"}
              </dd>
            </div>
          </dl>
          <p className="report-facts__note">
            {recorded} of {attendance.completed} expected student marks
            recorded. Attendance = (present + late) ÷ (present + late + absent).
            Enrolment dates are respected; future and cancelled sessions are
            excluded. Unrecorded is not absent.
          </p>
          <ReportFactCharts snapshot={snapshot} audience="class" />
        </section>
      </div>
      <div className="report-document__summaries has-facts">
        {sections.map((section) => (
          <section
            className={`class-report-narrative class-report-narrative--${section.topic.toLowerCase()}`}
            key={section.topic}
          >
            <h2>{section.title}</h2>
            {section.topic === "LEARNING" && (
              <p className="report-facts__note">
                Based on {snapshot.feedbackCount} class-wide teacher feedback
                note(s). Individual student notes are not substituted.
              </p>
            )}
            {section.topic === "PAYMENTS" && (
              <ClassPaymentFacts payments={snapshot.payments} />
            )}
            {narrativeBlocks(section.topic, section.text).map(
              (block, index) => (
                <div className="report-document__block" key={index}>
                  {block.heading && <h3>{block.heading}</h3>}
                  {block.paragraphs.map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </div>
              ),
            )}
          </section>
        ))}
      </div>
      <ClassReportRegisters snapshot={snapshot} />
      <footer className="report-document__footer">
        {reviewers.length > 0 && <p>Reviewed by {reviewers.join(", ")}</p>}
        <p>
          Staff-only class report. Contains student and financial information;
          share only with authorised staff.
        </p>
      </footer>
    </article>
  );
  return print ? createPortal(content, document.body) : content;
}

function ClassPaymentFacts({
  payments,
}: {
  payments: ClassReport["document"]["snapshot"]["payments"];
}) {
  return (
    <div className="report-facts">
      {payments.totals.map((total) => (
        <div className="report-facts__invoice" key={total.currency}>
          <h3>
            {total.currency} · {total.invoices} issued invoice(s)
          </h3>
          <dl>
            {(
              [
                ["Charges", total.charges],
                ["Credits", total.credits],
                ["Confirmed net receipts", total.received],
                ["Outstanding", total.balance],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{money(value, total.currency)}</dd>
              </div>
            ))}
          </dl>
          <p>
            Awaiting verification:{" "}
            {money(total.awaitingVerification, total.currency)} — not confirmed
            receipts.
          </p>
        </div>
      ))}
      <p className="report-facts__note">
        Balances at preparation, not period-only activity or whole student
        accounts. {payments.excludedInvoices} mixed or unlinked invoice(s)
        excluded. {payments.studentsWithoutInvoice} student(s) have no
        attributable class-only invoice; this does not mean no fees are due.
        Currencies are not combined.
      </p>
    </div>
  );
}

function ClassReportRegisters({
  snapshot,
}: {
  snapshot: ClassReport["document"]["snapshot"];
}) {
  return (
    <div className="report-facts class-report-registers">
      <section className="report-facts__section">
        <h2>Student attendance register</h2>
        <p className="report-facts__note">
          Historical roster for this period, including applicable withdrawn
          enrolments. Rates use each student's recorded marks, not a ranking.
        </p>
        <AttendanceTable
          rows={snapshot.students.map((student) => ({
            id: student.id,
            label: student.name,
            detail: student.number,
            attendance: student.attendance,
          }))}
          label="Student"
        />
      </section>
      <section className="report-facts__section">
        <h2>Completed session register</h2>
        <AttendanceTable
          rows={snapshot.sessions.map((session) => ({
            id: session.id,
            label: dateTime(session.startTime),
            detail: session.room,
            attendance: session.attendance,
          }))}
          label="Lesson (NZ time)"
        />
      </section>
    </div>
  );
}
function AttendanceTable({
  rows,
  label,
}: {
  rows: {
    id: string;
    label: string;
    detail: string;
    attendance: ClassReport["document"]["snapshot"]["attendance"];
  }[];
  label: string;
}) {
  if (!rows.length)
    return <p className="report-facts__empty">No records in this scope.</p>;
  return (
    <table className="class-report-register">
      <thead>
        <tr>
          <th scope="col">{label}</th>
          <th scope="col">Present</th>
          <th scope="col">Late</th>
          <th scope="col">Absent</th>
          <th scope="col">Missing</th>
          <th scope="col">Rate</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <th scope="row">
              {row.label}
              <span>{row.detail}</span>
            </th>
            <td>{row.attendance.present}</td>
            <td>{row.attendance.late}</td>
            <td>{row.attendance.absent}</td>
            <td>{row.attendance.unrecorded}</td>
            <td>{rate(row.attendance.rate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
