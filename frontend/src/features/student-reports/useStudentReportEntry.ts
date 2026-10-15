import { useEffect, useRef, useState } from "react";
import { apiMessage } from "../../lib/apiClient";
import { getStudentReport } from "./api";
import type { StudentReport } from "./types";
import type { SavedStudentReport, StudentReportTask } from "./workspaceTypes";

/** Owns report opening, not queue filtering or report editing. Ignore superseded/unmounted reads. */
export function useStudentReportEntry(onClose: () => void) {
  const [active, setActive] = useState<{
    task: StudentReportTask;
    report?: StudentReport;
  } | null>(null);
  const [opening, setOpening] = useState("");
  const [error, setError] = useState("");
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current += 1;
    },
    [],
  );

  const start = (task: StudentReportTask) => {
    request.current += 1;
    setOpening("");
    setError("");
    setActive({ task });
  };
  const close = () => {
    request.current += 1;
    setOpening("");
    setActive(null);
    onClose();
  };
  const openSaved = async (
    task: StudentReportTask,
    saved: SavedStudentReport,
  ) => {
    const ticket = ++request.current;
    setOpening(saved.id);
    setError("");
    try {
      const report = await getStudentReport(saved.id);
      if (request.current === ticket) setActive({ task, report });
    } catch (cause) {
      if (request.current === ticket) setError(apiMessage(cause));
    } finally {
      if (request.current === ticket) setOpening("");
    }
  };
  return {
    active,
    opening,
    error,
    start,
    close,
    openSaved,
    clearError: () => setError(""),
  };
}
