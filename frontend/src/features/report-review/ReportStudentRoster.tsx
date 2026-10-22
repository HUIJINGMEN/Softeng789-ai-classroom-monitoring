import type { ReportRosterStudent } from "./sourceTypes";
import "./report-sources.css";
import { recordedMarks } from "./reportAttendance";

export function ReportStudentRoster({
  students,
  showCourses = false,
}: {
  readonly students: readonly ReportRosterStudent[] | null | undefined;
  readonly showCourses?: boolean;
}) {
  return (
    <section className="report-facts report-facts__section report-source-section report-student-roster">
      <h2>Students in this report</h2>
      <RosterRecords students={students} showCourses={showCourses} />
    </section>
  );
}

function RosterRecords({
  students,
  showCourses,
}: {
  readonly students: readonly ReportRosterStudent[] | null | undefined;
  readonly showCourses: boolean;
}) {
  if (students == null)
    return (
      <p className="report-facts__empty">
        This saved version has no stored student roster. Prepare a new draft to
        include it; saved exports are not updated from live records.
      </p>
    );
  if (!students.length)
    return (
      <p className="report-facts__empty">
        No students in the historical enrolment scope for this report.
      </p>
    );
  return (
    <>
      <p className="report-facts__note">
        {students.length} distinct students in the selected courses and dates.
        Attendance uses recorded marks only; missing marks are not absences.
        This is not a ranking.
      </p>
      <table className="report-source-table">
        <caption>Student identity and attendance at preparation</caption>
        <thead>
          <tr>
            <th scope="col">Student</th>
            {showCourses && <th scope="col">Courses</th>}
            <th scope="col">Attendance</th>
            <th scope="col">Records</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => {
            const attendance = student.attendance;
            const recorded = recordedMarks(attendance);
            return (
              <tr key={student.id}>
                <th scope="row">
                  {student.name}
                  <small>
                    {student.number || "Student number not recorded"}
                  </small>
                </th>
                {showCourses && (
                  <td data-label="Courses">
                    {student.courses?.map((course) => (
                      <span className="report-roster-course" key={course.id}>{course.label}</span>
                    ))}
                  </td>
                )}
                <td data-label="Attendance">
                  {attendance.rate == null
                    ? "No recorded marks"
                    : `${attendance.rate}%`}
                  <small>
                    {attendance.present} present · {attendance.late} late ·{" "}
                    {attendance.absent} absent
                  </small>
                </td>
                <td data-label="Records">
                  {recorded} / {attendance.completed} recorded
                  <small>{attendance.unrecorded} not recorded</small>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
