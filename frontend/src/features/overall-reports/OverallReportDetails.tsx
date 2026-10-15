import { formatSessionDateLabel } from "../../lib/sessionTime";
import { overallCoverage } from "./overallReportContent";
import {
  recordingCompleteness,
  recordedMarks,
  reportRate,
} from "../report-review/reportAttendance";
import type { OverallReportSnapshot } from "./types";

interface Props {
  readonly snapshot: OverallReportSnapshot;
}

export function OverallRecordCoverage({ snapshot }: Props) {
  const coverage = overallCoverage(snapshot);
  return (
    <section className="overall-report-narrative">
      <h2>Record coverage & limitations</h2>
      <dl className="overall-report-coverage">
        <div>
          <dt>Courses with completed sessions</dt>
          <dd>
            {coverage.teaching} of {coverage.courses}
          </dd>
        </div>
        <div>
          <dt>Courses with teacher feedback</dt>
          <dd>
            {coverage.feedback} of {coverage.courses}
          </dd>
        </div>
        <div>
          <dt>Courses with missing attendance</dt>
          <dd>{coverage.missing}</dd>
        </div>
        <div>
          <dt>Courses with recorded absences</dt>
          <dd>{coverage.absent}</dd>
        </div>
      </dl>
      <p>
        {recordedMarks(snapshot.attendance)} of {snapshot.attendance.completed}{" "}
        expected student-session attendance marks have a recorded status;{" "}
        {snapshot.attendance.unrecorded} are missing. A mark belongs to one
        student in one lesson, not one distinct student. Course student counts
        may overlap; the overall student total is deduplicated.
      </p>
      <p className="overall-report-note">
        Courses without past completed sessions in this period:{" "}
        {coverage.courses - coverage.teaching}. This does not establish that
        they were inactive. Missing feedback does not establish poor teaching.
        Counts do not measure learning outcomes, wellbeing or classroom
        engagement.
      </p>
    </section>
  );
}

export function OverallWeeklyDetail({ snapshot }: Props) {
  return (
    <div className="overall-course-table overall-report-detail-table">
      <table>
        <caption>Weekly attendance detail</caption>
        <thead>
          <tr>
            {[
              "Week starting",
              "Present",
              "Late",
              "Absent",
              "Missing",
              "Attendance",
              "Recorded",
            ].map((heading) => (
              <th scope="col" key={heading}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {snapshot.attendanceTrend.map(({ weekOf, attendance }) => (
            <tr key={weekOf}>
              <th scope="row">{formatSessionDateLabel(weekOf)}</th>
              <td data-label="Present">{attendance.present}</td>
              <td data-label="Late">{attendance.late}</td>
              <td data-label="Absent">{attendance.absent}</td>
              <td data-label="Missing">{attendance.unrecorded}</td>
              <td data-label="Attendance">{reportRate(attendance.rate)}</td>
              <td data-label="Recorded">
                {recordedMarks(attendance)} / {attendance.completed}
                <small>{reportRate(recordingCompleteness(attendance))}</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!snapshot.attendanceTrend.length && (
        <p>
          No completed-session weeks are available for this reporting period.
        </p>
      )}
      <p className="overall-report-note">
        Weeks start on Monday; only applicable completed lessons within the
        selected dates are counted, including partial first and last weeks.
        Attendance uses recorded marks only. Changes in course mix, enrolments
        or completeness can change the rate; a higher rate alone does not prove
        improvement.
      </p>
    </div>
  );
}

export function OverallFeedbackCoverage({ snapshot }: Props) {
  const coverage = overallCoverage(snapshot);
  return (
    <section className="overall-report-narrative">
      <h2>Teacher feedback coverage</h2>
      <p>
        Class-wide teacher notes: {snapshot.feedbackCount}. Courses represented:{" "}
        {coverage.feedback} of {coverage.courses}. The summary below reflects
        these notes, not an assessment of every course or student.
      </p>
      <div className="overall-course-table">
        <table>
          <caption>Class-wide teacher notes by course</caption>
          <thead>
            <tr>
              <th scope="col">Course</th>
              <th scope="col">Notes</th>
              <th scope="col">Evidence available</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.courses.map((course) => (
              <tr key={course.id}>
                <th scope="row">
                  {course.code}
                  <small>{course.term}</small>
                </th>
                <td data-label="Notes">{course.feedbackCount}</td>
                <td data-label="Evidence available">
                  {course.feedbackCount > 0
                    ? "Recorded class-wide teacher feedback"
                    : "No class-wide feedback recorded"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="overall-report-note">
        Notes are not a coverage percentage of lessons and do not represent
        distinct teachers. Individual student feedback is excluded from this
        class-wide summary. No feedback means there is insufficient evidence for
        a teaching assessment.
      </p>
    </section>
  );
}
