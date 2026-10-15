import type { OverallReportSnapshot } from "./types";
import {
  recordingCompleteness,
  reportRate as rate,
} from "../report-review/reportAttendance";

export function OverallReportMetrics({
  snapshot,
}: {
  readonly snapshot: OverallReportSnapshot;
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
          rate(recordingCompleteness(snapshot.attendance)),
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
