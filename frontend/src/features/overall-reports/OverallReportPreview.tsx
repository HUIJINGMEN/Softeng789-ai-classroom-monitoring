import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import Modal from "../../components/Modal";
import { apiMessage } from "../../lib/apiClient";
import { finalizeOverallReport } from "./api";
import {
  OverallReportDocument,
  overallReportFilename,
} from "./OverallReportDocument";
import type { OverallReport } from "./types";

export function OverallReportPreview({
  report,
  onClose,
  onSaved,
}: {
  report: OverallReport;
  onClose: () => void;
  onSaved?: (report: OverallReport) => void;
}) {
  const [current, setCurrent] = useState(report);
  const [privacyReviewed, setPrivacyReviewed] = useState(
    Boolean(report.privacyReviewedAt),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const operation = useRef(false);
  const partner = current.document.audience === "PARTNER";
  const exportReport = async () => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      const finalized = current.finalizedAt
        ? current
        : await finalizeOverallReport(current, privacyReviewed);
      flushSync(() => setCurrent(finalized));
      onSaved?.(finalized);
      const previous = document.title;
      document.title = overallReportFilename(finalized);
      try {
        window.print();
      } finally {
        document.title = previous;
      }
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <Modal
        size="wide"
        className="overall-report-preview-modal"
        title="Report preview"
        subtitle={
          current.finalizedAt
            ? "Saved report · Reprint this frozen version."
            : "Preview the exact document before saving a frozen export."
        }
        onClose={onClose}
        closeButton
        closeDisabled={busy}
        footCompact={false}
        footer={
          <>
            {error && (
              <p className="form-error report-preparation-error" role="alert">
                {error}
              </p>
            )}
            <div className="overall-report-export-status" role="status">
              <strong>
                {current.finalizedAt ? "Saved version" : "Ready to export"}
              </strong>
              <span>
                {current.finalizedAt
                  ? "Facts and wording are frozen."
                  : "Export saves this version even if printing is cancelled."}
              </span>
            </div>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={onClose}
            >
              {current.finalizedAt ? "Done" : "Back to editing"}
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy || (partner && !privacyReviewed)}
              onClick={() => void exportReport()}
            >
              {busy ? "Preparing export…" : "Print / save PDF"}
            </button>
          </>
        }
      >
        <div className="overall-report-preview-body">
          <div className="overall-report-preview-tools">
            <span>A4 portrait</span>
            <details>
              <summary>Print settings & sharing</summary>
              <p>
                Turn off browser “Headers and footers”. No email is sent and
                nothing is published to students.
              </p>
            </details>
          </div>
          {partner && !current.finalizedAt && (
            <label className="overall-report-privacy">
              <input
                type="checkbox"
                checked={privacyReviewed}
                disabled={busy}
                onChange={(event) => setPrivacyReviewed(event.target.checked)}
              />
              <span>
                I checked this partner document: no student identities, private
                circumstances or confidential wording remain in the summaries.
              </span>
            </label>
          )}
          <OverallReportDocument report={current} />
        </div>
      </Modal>
      <OverallReportDocument report={current} print />
    </>
  );
}
