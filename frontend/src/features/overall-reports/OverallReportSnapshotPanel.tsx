import { overallAudienceLabel, overallDateTime } from "./overallReportFormat";
import { IconArrowRight } from "../../components/icons";
import {
  recordedMarks,
  recordingCompleteness,
} from "../report-review/reportAttendance";
import type { OverallReportScope, OverallReportSnapshot } from "./types";

/** Workspace hierarchy only; the frozen/printed report keeps its own document layout. */
export function OverallReportSnapshotPanel({
  snapshot,
  audience,
  onViewMissingAttendance,
}: {
  readonly snapshot: OverallReportSnapshot;
  readonly audience: OverallReportScope["audience"];
  readonly onViewMissingAttendance?: () => void;
}) {
  const attendance = snapshot.attendance;
  const recorded = recordedMarks(attendance);
  const completeness = recordingCompleteness(attendance);
  const canViewMissingAttendance =
    audience === "INTERNAL" && Boolean(onViewMissingAttendance);
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
          <div className="overall-report-outcome">
            <dt>Attendance</dt>
            <dd>
              {attendance.rate === null ? "—" : `${attendance.rate}%`}
              <p>
                {attendance.present + attendance.late} of {recorded} recorded
                marks were present or late
              </p>
            </dd>
          </div>
          <div className="overall-report-outcome">
            <dt>Recording completeness</dt>
            <dd>
              {completeness === null ? "—" : `${completeness}%`}
              <p>
                {recorded} of {attendance.completed} expected marks recorded
              </p>
              {attendance.unrecorded > 0 && canViewMissingAttendance && (
                <button
                  type="button"
                  className="overall-report-missing-marks overall-report-missing-marks--button"
                  onClick={onViewMissingAttendance}
                  aria-label={`View courses with ${attendance.unrecorded} unrecorded attendance marks`}
                >
                  <span>View missing marks</span>
                  <span className="overall-report-missing-count">
                    {attendance.unrecorded}
                  </span>
                  <span className="overall-report-missing-arrow" aria-hidden="true">
                    <IconArrowRight />
                  </span>
                </button>
              )}
              {attendance.unrecorded > 0 && !canViewMissingAttendance && (
                <span className="overall-report-missing-marks">
                  {attendance.unrecorded} unrecorded marks
                </span>
              )}
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
