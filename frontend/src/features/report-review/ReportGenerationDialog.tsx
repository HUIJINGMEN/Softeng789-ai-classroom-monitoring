import { useEffect, useState } from "react";
import Modal from "../../components/Modal";
import { useGenerationAutoDismiss } from "./useGenerationAutoDismiss";
import type {
  GenerationState,
  ReportGenerationProgress,
} from "./reportGeneration";
import "./report-generation.css";

const labels: Record<GenerationState, string> = {
  queued: "Queued",
  generating: "Generating",
  saved: "Saved",
  failed: "Needs retry",
};
function GenerationMark({ state }: { state: GenerationState }) {
  if (state === "saved")
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  if (state === "failed")
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 5v9m0 4v1" />
      </svg>
    );
  return (
    <span
      aria-hidden="true"
      className={
        state === "generating"
          ? "report-generation__spinner"
          : "report-generation__queued"
      }
    />
  );
}

export function ReportGenerationDialog({
  progress,
  onDismiss,
}: {
  progress: ReportGenerationProgress;
  onDismiss: () => void;
}) {
  const [now, setNow] = useState(Date.now);
  const running = progress.finishedAt === null;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  const saved = progress.items.filter((item) => item.state === "saved").length;
  const failed = progress.items.filter(
    (item) => item.state === "failed",
  ).length;
  const total = progress.items.length;
  const complete = !running && total > 0 && saved === total;
  const percentage = total ? Math.floor((saved / total) * 100) : 0;
  useGenerationAutoDismiss(complete, onDismiss);
  const current = progress.items.find((item) => item.state === "generating");
  const seconds = Math.max(
    0,
    Math.floor(((progress.finishedAt ?? now) - progress.startedAt) / 1000),
  );
  const elapsed = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  let title = "Generating report drafts";
  if (!running) title = failed ? "Some drafts need attention" : "Drafts saved";
  let status = "Returning to your report…";
  if (failed) status = `${saved} saved · ${failed} could not be confirmed.`;
  if (running)
    status = current
      ? `Generating ${current.title}…`
      : "Preparing the next section…";
  return (
    <Modal
      size="confirm"
      className="report-generation"
      title={
        <span className="report-generation__title">
          <span>{title}</span>
          <span className="report-generation__percentage">{percentage}%</span>
        </span>
      }
      onClose={onDismiss}
      closeDisabled={running || complete}
      footer={
        !running && failed > 0 ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={onDismiss}
          >
            Back to editor
          </button>
        ) : undefined
      }
    >
      <div className="report-generation__body">
        <div
          className="report-generation__status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {status}
        </div>
        <div className="report-generation__counts">
          <span>
            {saved} of {total} saved
          </span>
          <span aria-live="off">Elapsed {elapsed}</span>
        </div>
        <progress
          className="report-generation__bar"
          max={Math.max(1, total)}
          value={saved}
          aria-label="Report drafts saved"
          aria-valuetext={`${percentage}%, ${saved} of ${total} saved, ${failed} failed`}
        />
        <ol className="report-generation__steps" aria-label="Report sections">
          {progress.items.map((item) => (
            <li
              key={item.topic}
              className={`report-generation__step report-generation__step--${item.state}`}
            >
              <span className="report-generation__mark">
                <GenerationMark state={item.state} />
              </span>
              <div>
                <strong>{item.title}</strong>
                {item.error && <p>{item.error}</p>}
              </div>
              <span className="report-generation__step-state">
                {labels[item.state]}
              </span>
            </li>
          ))}
        </ol>
        {running && seconds >= 20 && (
          <p className="report-generation__waiting">
            Still working. Longer summaries may take a moment.
          </p>
        )}
        {!running && failed > 0 && (
          <p className="report-generation__waiting">
            Saved drafts are kept. Refresh source records in the editor before
            retrying.
          </p>
        )}
      </div>
    </Modal>
  );
}
