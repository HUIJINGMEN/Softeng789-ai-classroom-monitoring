import type { RefObject } from "react";
import { IconChevronRight } from "../../components/icons";
import {
  groupedOverallActions,
  INCOMPLETE_ATTENDANCE_ISSUE,
} from "./overallReportContent";
import type { OverallReportSnapshot } from "./types";

/** Screen-only disclosure; every original course count and navigation target is retained. */
export function OverallReportFollowUp({
  snapshot,
  onOpenCourse,
  missingAttendanceRef,
}: {
  readonly snapshot: OverallReportSnapshot;
  readonly onOpenCourse: (id: string) => void;
  readonly missingAttendanceRef?: RefObject<HTMLDetailsElement>;
}) {
  const groups = groupedOverallActions(snapshot.actions);
  const courseCount = new Set(
    snapshot.actions.map(action => action.courseOfferingId),
  ).size;
  return (
    <section
      className="overall-report-follow-up"
      aria-labelledby="overall-follow-up-title"
    >
      <h2 id="overall-follow-up-title">Operational follow-up</h2>
      {groups.length > 0 && (
        <p className="overall-report-note">
          {courseCount} {courseCount === 1 ? "course" : "courses"} with follow-up flags.
          {" "}Expand a check to see its courses.
        </p>
      )}
      {!groups.length && (
        <p className="overall-report-note">
          No follow-up flags from the included records. This is not proof that all operational work is complete.
        </p>
      )}
      {groups.map(group => (
        <details
          className="overall-follow-up-group"
          key={group.key}
          ref={
            group.issue === INCOMPLETE_ATTENDANCE_ISSUE
              ? missingAttendanceRef
              : undefined
          }
        >
          <summary>
            <strong>{group.issue}</strong>
            <span className="overall-follow-up-count">
              {group.courses.length} {group.courses.length === 1 ? "course" : "courses"}
            </span>
            <span className="overall-follow-up-chevron" aria-hidden="true">
              <IconChevronRight />
            </span>
          </summary>
          <p>{group.nextStep}</p>
          <ul>
            {group.courses.map(action => (
              <li key={action.courseOfferingId}>
                <div>
                  <span>{action.courseLabel}</span>
                  <span className="overall-follow-up-record-count">
                    <strong>{action.count}</strong>
                    <small>
                      {group.issue === INCOMPLETE_ATTENDANCE_ISSUE
                        ? "unrecorded marks"
                        : "records"}
                    </small>
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn--sm"
                  aria-label={`Open class: ${action.courseLabel}`}
                  onClick={() => onOpenCourse(action.courseOfferingId)}
                >
                  Open class
                </button>
              </li>
            ))}
          </ul>
        </details>
      ))}
      <p className="overall-report-note">
        Record checks, not a ranking. Counts describe different issues and must not be added together.
        Missing marks need verification; absences need a separate follow-up decision.
        These are suggested checks, not assigned or completed tasks.
      </p>
    </section>
  );
}
