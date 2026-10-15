import type { StudentReport } from "./types";
import "./student-report-checks.css";

export function StudentReportChecks({
  report,
  disabled,
  onOpenRecords,
}: {
  report: StudentReport;
  disabled: boolean;
  onOpenRecords?: () => void;
}) {
  const snapshot = report.document.snapshot;
  if (!snapshot)
    return (
      <p className="report-topic__warning">
        Refresh source records to load the data checks.
      </p>
    );
  const attendance = snapshot.attendance;
  const gaps = snapshot.courses.filter(
    (course) => course.attendance.unrecorded > 0,
  );
  return (
    <details
      className="student-report-checks"
      open={attendance.unrecorded > 0 || !snapshot.feedbackCount}
    >
      <summary>
        <strong>Data check before drafting</strong>
        <span>
          {attendance.completed} past lessons · {snapshot.feedbackCount} teacher
          notes · {attendance.unrecorded} unrecorded marks
        </span>
      </summary>
      <ul>
        {attendance.unrecorded > 0 && (
          <li>
            <strong>Attendance needs checking:</strong>{" "}
            {gaps
              .map(
                (course) =>
                  `${course.code} (${course.term}): ${course.attendance.unrecorded} unrecorded`,
              )
              .join("; ")}
            . These are not absences. The report will disclose the gap; you can
            continue.
          </li>
        )}
        {attendance.completed === 0 && (
          <li>
            No past completed lessons apply to this student in this scope. No
            attendance rate will be inferred.
          </li>
        )}
        {snapshot.feedbackCount === 0 ? (
          <li>
            <strong>No teacher feedback in this scope.</strong> The feedback
            heading stays in the report, with a factual no-feedback note. Add a
            teacher note in student details if needed.
          </li>
        ) : (
          <li>
            Teacher feedback: {snapshot.feedbackCount} notes are available for
            summarising.
          </li>
        )}
        <li>
          {report.document.sections.some(
            (section) => section.topic === "ACHIEVEMENTS",
          )
            ? "Eligible achievements are included."
            : "No eligible achievements in this scope; that section is omitted."}
        </li>
      </ul>
      <p>
        Checks use the report’s loaded source snapshot. After correcting
        records, return and choose “Refresh source records”; saved wording is
        preserved but changed evidence needs review again.
      </p>
      {onOpenRecords && (
        <div className="student-report-checks__actions">
          <button
            type="button"
            className="btn btn--sm"
            disabled={disabled}
            onClick={onOpenRecords}
          >
            View student details
          </button>
        </div>
      )}
    </details>
  );
}
