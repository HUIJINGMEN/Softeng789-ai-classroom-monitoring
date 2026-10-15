import { formatSessionDateLabel } from "../../lib/sessionTime";
import type { ReportFeedbackSource, ReportLessonSource } from "./sourceTypes";
import "./report-sources.css";

export const lessonStatusLabel = (status: ReportLessonSource["status"]) =>
  ({
    PRESENT: "Present",
    LATE: "Late",
    ABSENT: "Absent",
    UNKNOWN: "Not recorded",
  })[status];

export function ReportSourceTime({ value }: { readonly value: string }) {
  return (
    <>
      {new Date(value).toLocaleString("en-NZ", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Pacific/Auckland",
        timeZoneName: "short",
      })}
    </>
  );
}

export function ReportLegacySources() {
  return (
    <p className="report-facts__note">
      This saved version has no detailed source snapshot. Prepare a new draft to
      include these records; saved exports are not filled with current data.
    </p>
  );
}

export function ReportFeedbackSources({
  notes,
  total,
  classroom = false,
}: {
  readonly notes: readonly ReportFeedbackSource[];
  readonly total: number;
  readonly classroom?: boolean;
}) {
  return (
    <section className="report-facts__section report-source-section">
      <h2>
        {classroom ? "Class feedback sources" : "Teacher feedback sources"}
      </h2>
      <p className="report-facts__note">
        Showing {notes.length} of {total} recorded notes. Up to the latest three
        source excerpts, 360 characters each; these are not AI-generated text.
        {classroom
          ? " Only class-wide feedback is included, not personal student notes."
          : " Only this student's feedback is included."}
      </p>
      {notes.map((note) => (
        <article className="report-source-note" key={note.id}>
          <h3>{note.courseLabel}</h3>
          <p className="report-facts__note">
            {note.teacherName} · <ReportSourceTime value={note.recordedAt} />
          </p>
          <blockquote>{note.excerpt}</blockquote>
        </article>
      ))}
      {!total && (
        <p className="report-facts__empty">
          No feedback source notes in this reporting scope. No learning
          assessment can be inferred.
        </p>
      )}
    </section>
  );
}

export function ReportLessonSources({
  lessons,
}: {
  readonly lessons: readonly ReportLessonSource[];
}) {
  return (
    <section className="report-facts__section report-source-section">
      <h2>Lesson-by-lesson attendance</h2>
      <p className="report-facts__note">
        {lessons.length} applicable past completed lessons. Missing marks need
        checking, not an absence assumption. A recorded absence does not
        automatically require a make-up.
      </p>
      {!lessons.length ? (
        <p className="report-facts__empty">
          No applicable past completed lessons in this scope.
        </p>
      ) : (
        <table className="report-source-table">
          <caption>
            Personal lesson dates, courses and recorded attendance
          </caption>
          <thead>
            <tr>
              {["Lesson (NZ time)", "Course", "Attendance", "Follow-up"].map(
                (label) => (
                  <th scope="col" key={label}>
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {lessons.map((lesson) => (
              <tr key={lesson.sessionId}>
                <th scope="row">
                  <ReportSourceTime value={lesson.startsAt} />
                </th>
                <td data-label="Course">{lesson.courseLabel}</td>
                <td data-label="Attendance">
                  {lessonStatusLabel(lesson.status)}
                </td>
                <td data-label="Follow-up">
                  <LessonNextStep status={lesson.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function LessonNextStep({
  status,
}: {
  readonly status: ReportLessonSource["status"];
}) {
  if (status === "UNKNOWN")
    return <>Ask the teaching team to check this attendance mark.</>;
  if (status === "ABSENT")
    return (
      <>Check the recorded absence and any agreed support or linked make-up.</>
    );
  return <>Attendance recorded.</>;
}

export function ReportSourceDate({ value }: { readonly value: string }) {
  return <>{formatSessionDateLabel(value)}</>;
}
