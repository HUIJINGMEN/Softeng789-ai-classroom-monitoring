import {
  ReportFeedbackSources,
  ReportLegacySources,
  ReportLessonSources,
  ReportSourceDate,
} from "../report-review/ReportSourceRecords";
import type { ReportSnapshot } from "./types";

export function StudentReportSourceRecords({
  snapshot,
}: {
  readonly snapshot: ReportSnapshot;
}) {
  const sources = snapshot.sources;
  if (!sources) return <ReportLegacySources />;
  return (
    <div className="report-facts">
      <ReportLessonSources lessons={sources.lessons} />
      <ReportFeedbackSources
        notes={sources.feedback}
        total={snapshot.feedbackCount}
      />
      {sources.pendingCorrections > 0 && (
        <p className="report-facts__note">
          Achievement records excluded while correction requests await review:{" "}
          {sources.pendingCorrections}. These are not presented as confirmed
          outcomes in this report.
        </p>
      )}
      {sources.achievements.length > 0 && (
        <section className="report-facts__section report-source-section">
          <h2>Recorded achievement details</h2>
          <p className="report-facts__note">
            Confirmed records marked for report inclusion. Records with pending
            corrections are excluded.
          </p>
          <table className="report-source-table">
            <caption>
              Personal confirmed achievements and their source dates
            </caption>
            <thead>
              <tr>
                {["Achievement", "Course", "Date", "Recorded points"].map(
                  (label) => (
                    <th scope="col" key={label}>
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {sources.achievements.map((award) => (
                <tr key={award.id}>
                  <th scope="row">
                    {award.title}
                    <small>
                      {award.category.toLowerCase().replace(/_/g, " ")}
                    </small>
                  </th>
                  <td data-label="Course">{award.courseLabel}</td>
                  <td data-label="Date">
                    <ReportSourceDate value={award.date} />
                  </td>
                  <td data-label="Recorded points">
                    {award.points ?? "Not recorded"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
