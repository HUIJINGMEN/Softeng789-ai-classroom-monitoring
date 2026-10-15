import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import Modal from "../../components/Modal";
import { apiMessage } from "../../lib/apiClient";
import { finalizeClassReport } from "./api";
import {
  ClassReportDocument,
  classReportFilename,
} from "./ClassReportDocument";
import type { ClassReport } from "./types";

export function ClassReportPreview({
  report,
  onClose,
  onBack,
}: {
  report: ClassReport;
  onClose: () => void;
  onBack?: () => void;
}) {
  const [current, setCurrent] = useState(report);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const operation = useRef(false);
  const exportReport = async () => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      const finalized = current.finalizedAt
        ? current
        : await finalizeClassReport(current);
      flushSync(() => setCurrent(finalized));
      const previousTitle = document.title;
      document.title = classReportFilename(finalized);
      try {
        window.print();
      } finally {
        document.title = previousTitle;
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
        title="Preview & export class report"
        subtitle="Staff-only document · Reviewed summaries, frozen facts and attendance registers."
        onClose={onClose}
        closeButton
        closeDisabled={busy}
        footer={
          <>
            {error && (
              <div className="form-error report-preparation-error" role="alert">
                {error}
              </div>
            )}
            {onBack && (
              <button
                type="button"
                className="btn"
                disabled={busy || Boolean(current.finalizedAt)}
                onClick={onBack}
              >
                Back to editing
              </button>
            )}
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={onClose}
            >
              Done
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy}
              onClick={() => void exportReport()}
            >
              {busy ? "Preparing export…" : "Print / save PDF"}
            </button>
          </>
        }
      >
        <div className="class-report-body">
          <p className="class-report-confidential">
            {current.finalizedAt
              ? "Saved report — facts and wording are frozen. Reprint this version or prepare a new draft."
              : "Export saves a frozen, reviewed version, even if the print dialog is cancelled. It remains available under Saved reports."}{" "}
            A4 · Turn off browser “Headers and footers”. No emails are sent and
            nothing is published to students.
          </p>
          <ClassReportDocument report={current} />
        </div>
      </Modal>
      <ClassReportDocument report={current} print />
    </>
  );
}
