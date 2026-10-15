import type { OverallReportSnapshot } from "./types";
import {
  recordedMarks,
  recordingCompleteness,
  reportRate as rate,
} from "../report-review/reportAttendance";

export function OverallCourseTable({
  snapshot,
  compact = false,
}: {
  readonly snapshot: OverallReportSnapshot;
  readonly compact?: boolean;
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
            {!compact && <th scope="col">Absences</th>}
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
              <td data-label="Attendance">
                {rate(course.attendance.rate)}
                {!compact && (
                  <small>
                    {course.attendance.present} present ·{" "}
                    {course.attendance.late} late
                    <br />
                    {course.attendance.present + course.attendance.late} /{" "}
                    {recordedMarks(course.attendance)} recorded marks attended
                  </small>
                )}
              </td>
              <td data-label="Recorded">
                {rate(recordingCompleteness(course.attendance))}
                {!compact && (
                  <small>
                    {recordedMarks(course.attendance)} /{" "}
                    {course.attendance.completed} marks
                    <br />
                    {course.attendance.unrecorded} missing
                  </small>
                )}
              </td>
              {!compact && (
                <td data-label="Absences">{course.attendance.absent}</td>
              )}
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
