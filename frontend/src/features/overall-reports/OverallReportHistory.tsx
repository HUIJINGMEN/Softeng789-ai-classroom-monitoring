import { useEffect, useState } from "react";
import Modal from "../../components/Modal";
import { apiMessage } from "../../lib/apiClient";
import { formatReportDateRange } from "../../lib/sessionTime";
import { listOverallReports } from "./api";
import { overallAudienceLabel, overallDateTime } from "./OverallReportDocument";
import { OverallReportPreview } from "./OverallReportPreview";
import type { OverallReport } from "./types";

export function OverallReportHistory({ onClose }: { onClose: () => void }) {
  const [reports, setReports] = useState<OverallReport[]>([]);
  const [selected, setSelected] = useState<OverallReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    listOverallReports()
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
  }, [attempt]);
  if (selected)
    return (
      <OverallReportPreview
        report={selected}
        onClose={() => setSelected(null)}
      />
    );
  return (
    <Modal
      size="wide"
      title="Saved overall reports"
      subtitle="Latest 10 saved versions · Internal and partner reports remain separate."
      onClose={onClose}
      closeButton
    >
      <div className="overall-report-history">
        {loading && <output>Loading saved reports…</output>}
        {error && (
          <div role="alert">
            <p className="form-error">{error}</p>
            <button
              type="button"
              className="btn"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !error && !reports.length && (
          <p>No saved reports yet. Review and export your first report.</p>
        )}
        {reports.map((report) => (
          <button
            type="button"
            className="btn"
            key={report.id}
            onClick={() => setSelected(report)}
          >
            <strong>{overallAudienceLabel(report.document.audience)}</strong>
            <span>
              {formatReportDateRange(
                report.document.dateFrom,
                report.document.dateTo,
              )}
            </span>
            <small>
              Saved {overallDateTime(report.finalizedAt!)} · Version{" "}
              {report.version}
            </small>
          </button>
        ))}
      </div>
    </Modal>
  );
}
