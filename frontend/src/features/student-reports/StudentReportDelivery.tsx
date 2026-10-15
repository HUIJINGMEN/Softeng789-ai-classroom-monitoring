import { useRef, useState } from "react";
import Modal from "../../components/Modal";
import { apiMessage } from "../../lib/apiClient";
import { emailStudentReport, publishStudentReport } from "./api";
import { StudentReportDocument } from "./StudentReportDocument";
import type { StudentReport, ReportEmailResult } from "./types";
import { studentReportFilename } from "./reportDocumentModel";
import { deliverReportRevision } from "./reportDelivery";

interface Props {
  readonly report: StudentReport;
  readonly onClose: () => void;
  readonly onBack: () => void;
  readonly showToast: (message: string) => void;
}
export function StudentReportDelivery({
  report,
  onClose,
  onBack,
  showToast,
}: Props) {
  const [current, setCurrent] = useState(report);
  const [download, setDownload] = useState(true);
  const [email, setEmail] = useState(false);
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [emailDone, setEmailDone] = useState(false);
  const [emailUnconfirmed, setEmailUnconfirmed] = useState(false);
  const operation = useRef(false);
  let emailLabel = "Email student";
  if (emailDone) emailLabel = "Email processed";
  if (emailUnconfirmed) emailLabel = "Email unconfirmed — check delivery";
  const emailProcessed = (result: ReportEmailResult) => {
    setEmailDone(true);
    setEmailUnconfirmed(result.status === "UNKNOWN");
    if (result.status === "UNKNOWN") setError(result.message);
    showToast(result.status === "DEMO"
      ? "Email is in Demo mode. No external email was sent."
      : result.message);
  };
  const deliver = async () => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      const latest = await deliverReportRevision(current,
        { publish, email: email && !emailDone },
        { publish: publishStudentReport, email: emailStudentReport },
        { published: setCurrent, emailed: emailProcessed });
      if (download) {
        const previousTitle = document.title;
        document.title = studentReportFilename(latest);
        try {
          window.print();
        } finally {
          document.title = previousTitle;
        }
      }
      if (!email)
        showToast(
          publish
            ? "Student report published to the portal."
            : "Report is ready to print or save as PDF.",
        );
    } catch (cause) {
      setError(`${apiMessage(cause)} If the email response was interrupted, retrying checks this report version without sending it twice.`);
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <Modal
        size="wide"
        title="Preview & deliver student report"
        subtitle="The same reviewed sections are used for PDF, email and the student portal."
        onClose={onClose}
        closeButton
        closeDisabled={busy}
        className="student-report-delivery"
        footer={
          <>
            <button
              type="button"
              className="btn"
              disabled={busy || Boolean(current.publishedAt)}
              onClick={onBack}
            >
              Back to editing
            </button>
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
              disabled={busy || (!download && !email && !publish)}
              onClick={() => void deliver()}
            >
              {busy ? "Delivering…" : "Deliver report"}
            </button>
          </>
        }
      >
        <div className="student-report-delivery__body">
          <StudentReportDocument report={current} />
          <fieldset className="report-delivery-options">
            <legend>Delivery methods</legend>
            <label>
              <input
                type="checkbox"
                checked={download}
                disabled={busy}
                onChange={(event) => setDownload(event.target.checked)}
              />
              <span>Print / save PDF</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={email}
                disabled={busy || emailDone}
                onChange={(event) => setEmail(event.target.checked)}
              />
              {emailLabel}
            </label>
            <label>
              <input
                type="checkbox"
                checked={publish}
                disabled={busy || Boolean(current.publishedAt)}
                onChange={(event) => setPublish(event.target.checked)}
              />
              {current.publishedAt
                ? "Published to portal"
                : "Publish to student portal"}
            </label>
          </fieldset>
          <p className="cell-sub">
            Published reports are frozen. Email Demo mode does not send
            externally.
          </p>
          <p className="cell-sub">
            PDF settings: A4 · More settings → turn off “Headers and footers”.
            Otherwise Chrome adds the date, page title and URL. The report
            already has its own footer and page numbers. Source records stay
            in the review editor, not in the student-facing report.
          </p>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
        </div>
      </Modal>
      <StudentReportDocument report={current} print />
    </>
  );
}
