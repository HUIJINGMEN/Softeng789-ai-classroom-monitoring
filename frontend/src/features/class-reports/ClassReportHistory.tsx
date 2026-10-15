import { useEffect, useState } from "react";
import Modal from "../../components/Modal";
import { apiMessage } from "../../lib/apiClient";
import { formatReportDateRange } from "../../lib/sessionTime";
import { listClassReports } from "./api";
import { ClassReportPreview } from "./ClassReportPreview";
import type { ClassReport } from "./types";

export function ClassReportHistory({
  courseId,
  onClose,
}: {
  readonly courseId: string;
  readonly onClose: () => void;
}) {
  const [reports, setReports] = useState<ClassReport[]>([]);
  const [selected, setSelected] = useState<ClassReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    listClassReports(courseId)
      .then((values) => {
        if (!cancelled) setReports(values);
      })
      .catch((cause) => {
        if (!cancelled) setError(apiMessage(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, attempt]);
  if (selected)
    return (
      <ClassReportPreview report={selected} onClose={() => setSelected(null)} />
    );
  return (
    <Modal
      size="wide"
      title="Saved class reports"
      subtitle="Latest 10 finalized versions. Facts and wording remain unchanged."
      onClose={onClose}
      closeButton
    >
      <div className="class-report-body class-report-history">
        {loading && <output>Loading saved reports…</output>}
        {error && (
          <>
            <p className="form-error" role="alert">
              {error}
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Retry
            </button>
          </>
        )}
        {!loading && !error && !reports.length && (
          <p>No saved reports yet. Review and export a class report first.</p>
        )}
        {reports.map((report) => (
          <button
            type="button"
            className="btn"
            key={report.id}
            onClick={() => setSelected(report)}
          >
            <strong>
              {formatReportDateRange(
                report.document.dateFrom,
                report.document.dateTo,
              )}
            </strong>
            <span className="cell-sub">
              Saved{" "}
              {new Date(report.finalizedAt!).toLocaleString("en-NZ", {
                timeZone: "Pacific/Auckland",
              })}{" "}
              · Version {report.version}
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
