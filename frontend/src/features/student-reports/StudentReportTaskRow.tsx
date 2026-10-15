import { formatReportDateRange } from "../../lib/sessionTime";
import { IconArrowRight } from "../../components/icons";
import PersonAvatar from "../../components/PersonAvatar";
import { reportTaskStatus } from "./workspaceModel";
import type {
  SavedStudentReport,
  StudentReportProgress,
  StudentReportTask,
  ReportTaskStatus,
} from "./workspaceTypes";

const STATUS_CLASS: Record<ReportTaskStatus, string> = {
  "Not started": "badge--neutral",
  Drafting: "badge--corrected",
  "Needs review": "badge--warn",
  Reviewed: "badge--success",
  Published: "badge--success",
};

interface Props {
  readonly task: StudentReportTask & { readonly progress?: StudentReportProgress };
  readonly opening: boolean;
  readonly onContinue: (task: StudentReportTask) => void;
  readonly onOpenSaved: (task: StudentReportTask, saved: SavedStudentReport) => void;
  readonly onOpenRecords: (studentId: string) => void;
}

export function StudentReportTaskRow({
  task,
  opening,
  onContinue,
  onOpenSaved,
  onOpenRecords,
}: Props) {
  const status = reportTaskStatus(task.progress);
  const { draft, published, otherDraft } = task.progress ?? {};
  return (
    <tr>
      <td>
        <div className="student-report-queue__student">
          <PersonAvatar
            key={task.photoUrl}
            photoUrl={task.photoUrl}
            name={task.name}
            tone="student-report-queue__avatar"
            alt=""
          />
          <div className="student-report-queue__student-info">
            <div className="student-report-queue__identity">
              <strong>{task.name}</strong>
              <span>{task.number}</span>
            </div>
            <ul
              className="student-report-queue__courses"
              aria-label={`${task.name} report courses`}
            >
              {task.courses.map((course) => (
                <li key={course.id}>{course.label}</li>
              ))}
            </ul>
          </div>
        </div>
      </td>
      <td>
        <span className={`badge ${STATUS_CLASS[status]}`}>
          {status === "Reviewed" ? "Reviewed draft" : status}
        </span>
        {draft ? (
          <div className="student-report-queue__counts">
            <span>
              <b>
                {draft.drafted}/{draft.sections}
              </b>{" "}
              written
            </span>
            <span>
              <b>
                {draft.reviewed}/{draft.sections}
              </b>{" "}
              reviewed
            </span>
            {draft.stale && (
              <span className="student-report-queue__stale">
                Sources changed
              </span>
            )}
          </div>
        ) : (
          !published && (
            <span className="student-report-queue__secondary">
              No draft for the selected dates and courses
            </span>
          )
        )}
        {published && (
          <button
            className="student-report-queue__text-action"
            type="button"
            disabled={opening}
            onClick={() => onOpenSaved(task, published)}
            aria-label={`View published report for ${task.name}`}
          >
            View published report
          </button>
        )}
        {otherDraft && (
          <div className="student-report-queue__saved-draft">
            <span className="student-report-queue__saved-label">
              Saved for a different selection
            </span>
            <span className="student-report-queue__saved-period">
              {formatReportDateRange(otherDraft.dateFrom, otherDraft.dateTo)}
            </span>
            <span className="student-report-queue__saved-courses">
              {otherDraft.courseLabels.join(", ")}
            </span>
            <button
              type="button"
              className="student-report-queue__saved-action"
              disabled={opening}
              aria-label={`Open saved draft for ${task.name}: ${formatReportDateRange(otherDraft.dateFrom, otherDraft.dateTo)}`}
              onClick={() => onOpenSaved(task, otherDraft)}
            >
              Open saved draft{" "}
              <span aria-hidden="true">
                <IconArrowRight />
              </span>
            </button>
          </div>
        )}
      </td>
      <td>
        <div className="student-report-queue__actions">
          <button
            type="button"
            className="btn btn--primary btn--sm student-report-queue__continue"
            disabled={opening}
            onClick={() => onContinue(task)}
            aria-label={`${draft ? "Continue draft" : "Start report"} for ${task.name}`}
          >
            {draft ? "Continue draft" : "Start report"}
            <span aria-hidden="true">
              <IconArrowRight />
            </span>
          </button>
          <button
            type="button"
            className="btn btn--sm btn--tinted student-report-queue__records"
            onClick={() => onOpenRecords(task.studentId)}
            aria-label={`View student details for ${task.name}`}
            title="View attendance, teacher feedback and achievements"
          >
            View student details
          </button>
        </div>
      </td>
    </tr>
  );
}
