import {
  overallAudienceLabel,
  overallCompleteness,
  overallDateTime,
} from "./OverallReportDocument";
import type { OverallReportScope, OverallReportSnapshot } from "./types";

/** Workspace hierarchy only; the frozen/printed report keeps its own document layout. */
export function OverallReportSnapshotPanel({
  snapshot,
  audience,
}: {
  snapshot: OverallReportSnapshot;
  audience: OverallReportScope["audience"];
}) {
  const attendance = snapshot.attendance;
  const recorded = attendance.present + attendance.late + attendance.absent;
  const completeness = overallCompleteness(attendance);
  return (
    <section
      className="overall-report-snapshot"
      aria-labelledby="overall-evidence-title"
    >
      <header className="overall-report-snapshot-head">
        <div>
          <h3 id="overall-evidence-title">Evidence overview</h3>
          <span className="badge badge--neutral">
            {overallAudienceLabel(audience)}
          </span>
        </div>
        <span>Data as of {overallDateTime(snapshot.preparedAt)}</span>
      </header>
      <div className="overall-report-snapshot-body">
        <dl className="overall-report-outcomes">
          <div>
            <dt>Attendance</dt>
            <dd>
              {attendance.rate === null ? "—" : `${attendance.rate}%`}
              <p>
                {attendance.present + attendance.late} of {recorded} recorded
                marks were present or late
              </p>
            </dd>
          </div>
          <div>
            <dt>Recording completeness</dt>
            <dd>
              {completeness === null ? "—" : `${completeness}%`}
              <p>
                {recorded} of {attendance.completed} expected marks recorded
              </p>
            </dd>
          </div>
        </dl>
        <dl className="overall-report-context-totals">
          <div>
            <dt>Courses</dt>
            <dd>{snapshot.courses.length}</dd>
          </div>
          <div>
            <dt>Distinct students</dt>
            <dd>{snapshot.studentCount}</dd>
          </div>
          <div>
            <dt>Completed sessions</dt>
            <dd>{snapshot.completedSessions}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
