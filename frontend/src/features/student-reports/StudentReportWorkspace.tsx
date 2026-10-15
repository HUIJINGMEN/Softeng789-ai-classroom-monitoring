import Pager from "../../components/Pager";
import SearchField from "../../components/SearchField";
import SelectMenu from "../../components/SelectMenu";
import { formatReportDateRange } from "../../lib/sessionTime";
import type { Student } from "../../types";
import { StudentReportFlow } from "./StudentReportFlow";
import { StudentReportDelivery } from "./StudentReportDelivery";
import { StudentReportTaskRow } from "./StudentReportTaskRow";
import { useStudentReportWorkspace } from "./useStudentReportWorkspace";
import { useStudentReportEntry } from "./useStudentReportEntry";
import { REPORT_TASK_STATES, reportTaskStatus } from "./workspaceModel";
import "./student-report-workspace.css";

interface Props {
  readonly students: Student[];
  readonly courses: { readonly id: string; readonly label: string }[];
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly loading: boolean;
  readonly error: string;
  readonly onDateFrom: (value: string) => void;
  readonly onDateTo: (value: string) => void;
  readonly onRetry: () => void;
  readonly onOpenRecords: (studentId: string) => void;
  readonly showToast: (message: string) => void;
}

export function StudentReportWorkspace(props: Props) {
  const state = useStudentReportWorkspace(
    props.students,
    props.courses,
    props.dateFrom,
    props.dateTo,
  );
  const entry = useStudentReportEntry(state.refresh);
  const { active, opening, close, openSaved } = entry;
  const loading = props.loading || state.loading;
  const error = props.error || state.error || entry.error;
  return (
    <section
      className="student-report-queue"
      aria-labelledby="student-report-queue-title"
    >
      <header className="student-report-queue__heading">
        <div>
          <h2 id="student-report-queue-title">Student reports</h2>
          <p>
            See what needs work. Continue a saved draft or start with a check of
            the student’s records.
          </p>
        </div>
        <button
          className="btn btn--sm"
          type="button"
          disabled={loading}
          onClick={() => {
            props.onRetry();
            state.refresh();
          }}
        >
          Refresh progress
        </button>
      </header>
      <div className="student-report-queue__filters">
        <div className="student-report-queue__dates">
          <label className="field">
            <span>From</span>
            <input
              type="date"
              value={props.dateFrom}
              onChange={(e) => props.onDateFrom(e.target.value)}
            />
          </label>
          <label className="field">
            <span>To</span>
            <input
              type="date"
              value={props.dateTo}
              onChange={(e) => props.onDateTo(e.target.value)}
            />
          </label>
        </div>
        <SearchField
          value={state.query}
          onChange={state.setQuery}
          label="Search student reports"
          placeholder="Name or student number"
        />
        <div className="field">
          <span>Course scope</span>
          <SelectMenu
            value={state.course}
            onChange={state.setCourse}
            ariaLabel="Report course"
            options={[
              { value: "", label: "All available enrolled courses" },
              ...props.courses.map((c) => ({ value: c.id, label: c.label })),
            ]}
          />
        </div>
      </div>
      {!state.valid && (
        <p className="form-error" role="alert">
          Choose a start date on or before the end date.
        </p>
      )}
      <div className="student-report-queue__register" aria-busy={loading}>
        <nav
          className="student-report-queue__states"
          aria-label="Filter report progress"
        >
          {(["", ...REPORT_TASK_STATES] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={state.status === value}
              onClick={() => state.setStatus(value)}
            >
              {value || "All students"}{" "}
              <span>
                {loading || error
                  ? "—"
                  : state.searched.filter(
                      (row) =>
                        !value || reportTaskStatus(row.progress) === value,
                    ).length}
              </span>
            </button>
          ))}
        </nav>
        {error && (
          <div className="form-error" role="alert">
            {error}{" "}
            <button
              className="btn btn--sm"
              type="button"
              onClick={() => {
                entry.clearError();
                props.onRetry();
                state.refresh();
              }}
            >
              Try again
            </button>
          </div>
        )}
        {loading ? (
          <output className="empty">Loading saved report progress…</output>
        ) : (
          !error &&
          state.valid && (
            <>
              <table className="student-report-queue__table">
                <caption className="sr-only">
                  Student report progress for{" "}
                  {formatReportDateRange(props.dateFrom, props.dateTo)}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Student & courses</th>
                    <th scope="col">Report progress</th>
                    <th scope="col">Next action</th>
                  </tr>
                </thead>
                <tbody>
                  {state.pagination.rows.map((task) => (
                    <StudentReportTaskRow
                      key={task.studentId}
                      task={task}
                      opening={Boolean(opening)}
                      onContinue={entry.start}
                      onOpenSaved={(task, saved) => void openSaved(task, saved)}
                      onOpenRecords={props.onOpenRecords}
                    />
                  ))}
                </tbody>
              </table>
              {!state.pagination.rows.length && (
                <p className="empty">
                  No students match these filters. Choose another course or
                  clear the progress filter.
                </p>
              )}
              <Pager
                {...state.pagination}
                onPrev={state.pagination.prev}
                onNext={state.pagination.next}
                onGoToPage={state.pagination.goToPage}
              />
            </>
          )
        )}
        <p className="student-report-queue__scope-note">
          Progress is for the selected dates and courses. Private drafts are
          yours; published reports are visible to the student. Opening a draft
          rechecks its source records.
        </p>
      </div>
      {opening && (
        <output className="student-report-queue__scope-note">
          Opening saved report…
        </output>
      )}
      {active?.report?.publishedAt ? (
        <StudentReportDelivery
          report={active.report}
          onClose={close}
          onBack={close}
          showToast={props.showToast}
        />
      ) : (
        active && (
          <StudentReportFlow
            studentId={active.task.studentId}
            studentName={active.task.name}
            dateFrom={props.dateFrom}
            dateTo={props.dateTo}
            availableCourses={active.task.courses}
            initialReport={active.report}
            onClose={close}
            onOpenRecords={() => {
              const id = active.task.studentId;
              close();
              props.onOpenRecords(id);
            }}
            showToast={props.showToast}
          />
        )
      )}
    </section>
  );
}
