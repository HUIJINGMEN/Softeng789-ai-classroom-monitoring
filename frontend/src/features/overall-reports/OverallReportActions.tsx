import type { OverallReportSnapshot } from "./types";
import { groupedOverallActions } from './overallReportContent';

export function OverallReportActions({
  snapshot,
  onOpenCourse,
  compact = false,
}: {
  readonly snapshot: OverallReportSnapshot;
  readonly onOpenCourse?: (id: string) => void;
  readonly compact?: boolean;
}) {
  return (
    <section className="overall-report-actions">
      <h2>Operational follow-up</h2>
      <p className="overall-report-note">
        Record checks, not a ranking of students or courses. Counts describe
        different issues and should not be added together.
      </p>
      <p className="overall-report-note">
        Courses with follow-up flags:{" "}
        {
          new Set(snapshot.actions.map((action) => action.courseOfferingId))
            .size
        }
        . Missing marks need verification; recorded absences need a separate
        follow-up decision. These are suggested checks, not assigned or
        completed tasks.
      </p>
      {!snapshot.actions.length && (
        <p>
          No follow-up flags from the included records. This is not proof that
          all operational work is complete.
        </p>
      )}
      {compact && snapshot.actions.length > 0 ? (
        <table className="report-source-table overall-report-action-table">
          <caption>Suggested checks by issue and course</caption>
          <thead><tr><th scope="col">Check</th><th scope="col">Courses & counts</th><th scope="col">Suggested next step</th></tr></thead>
          <tbody>{groupedOverallActions(snapshot.actions).map(group => (
            <tr key={group.key}>
              <th scope="row">{group.issue}</th>
              <td data-label="Courses & counts">{group.courses.map(action => (
                <div key={action.courseOfferingId}>{action.courseLabel} · {action.count}</div>
              ))}</td>
              <td data-label="Suggested next step">{group.nextStep}</td>
            </tr>
          ))}</tbody>
        </table>
      ) : snapshot.actions.map((action) => (
        <div
          className="overall-report-action"
          key={action.courseOfferingId + action.issue}
        >
          <div>
            <strong>
              {action.issue} · {action.count}
            </strong>
            <span>{action.courseLabel}</span>
            <p>{action.nextStep}</p>
          </div>
          {onOpenCourse && (
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => onOpenCourse(action.courseOfferingId)}
            >
              Open class
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
