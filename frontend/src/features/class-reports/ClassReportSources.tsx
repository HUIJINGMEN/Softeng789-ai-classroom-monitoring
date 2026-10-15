import {
  ReportFeedbackSources,
  ReportLegacySources,
  ReportSourceTime,
} from "../report-review/ReportSourceRecords";
import type { ClassReportSnapshot } from "./types";
import { ReportStudentRoster } from "../report-review/ReportStudentRoster";

/** Staff roster plus lesson-level checks. Feedback remains class-wide only. */
export function ClassReportSourceRecords({
  snapshot,
  includeRoster = false,
}: {
  readonly snapshot: ClassReportSnapshot;
  readonly includeRoster?: boolean;
}) {
  const lessons = snapshot.sessions.filter(
    (session) =>
      session.attendance.unrecorded > 0 || session.attendance.absent > 0,
  );
  return (
    <div className="report-facts">
      {includeRoster && <ReportStudentRoster students={snapshot.students} />}
      <section className="report-facts__section report-source-section">
        <h2>Lesson attendance follow-up</h2>
        <p className="report-facts__note">
          {lessons.length} of {snapshot.completedSessions} completed lessons
          have missing or absent marks. Counts are student-lesson marks, not
          distinct students. Missing marks are not absences; a make-up is not
          automatic.
        </p>
        {lessons.length ? (
          <table className="report-source-table">
            <caption>
              Class lesson dates, record gaps and suggested checks
            </caption>
            <thead>
              <tr>
                {[
                  "Lesson (NZ time)",
                  "Not recorded",
                  "Recorded absences",
                  "Suggested next step",
                ].map((label) => (
                  <th scope="col" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lessons.map((lesson) => (
                <tr key={lesson.id}>
                  <th scope="row">
                    <ReportSourceTime value={lesson.startTime} />
                    <small>{lesson.room}</small>
                  </th>
                  <td data-label="Not recorded">
                    {lesson.attendance.unrecorded}
                  </td>
                  <td data-label="Recorded absences">
                    {lesson.attendance.absent}
                  </td>
                  <td data-label="Suggested next step">
                    {lesson.attendance.unrecorded > 0 && (
                      <p>
                        Check this lesson's records and complete missing
                        attendance.
                      </p>
                    )}
                    {lesson.attendance.absent > 0 && (
                      <p>
                        Review absence records and agreed support separately; do
                        not assume make-up completion.
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="report-facts__empty">
            No missing or absent marks in the included lessons. This does not
            assess every support need.
          </p>
        )}
      </section>
      {snapshot.sources ? (
        <ReportFeedbackSources
          notes={snapshot.sources.feedback}
          total={snapshot.feedbackCount}
          classroom
        />
      ) : (
        <ReportLegacySources />
      )}
    </div>
  );
}
