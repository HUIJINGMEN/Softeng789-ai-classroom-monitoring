import { useRef } from "react";
import { INCOMPLETE_ATTENDANCE_ISSUE } from "./overallReportContent";
import type { OverallReport } from "./types";

/** Screen navigation only: never fetches evidence, saves wording or changes attendance. */
export function revealMissingAttendance(details: HTMLDetailsElement | null) {
  if (!details) return;
  details.open = true;
  const summary = details.querySelector("summary");
  summary?.focus({ preventScroll: true });
  summary?.scrollIntoView({ block: "center", behavior: "instant" });
}

export function useOverallAttendanceShortcut(
  document: OverallReport["document"] | undefined,
) {
  const missingAttendanceRef = useRef<HTMLDetailsElement>(null);
  const available = document?.audience === "INTERNAL" &&
    document.snapshot.attendance.unrecorded > 0 &&
    document.snapshot.actions.some(
      action => action.issue === INCOMPLETE_ATTENDANCE_ISSUE,
    );

  return {
    missingAttendanceRef,
    viewMissingAttendance: available
      ? () => revealMissingAttendance(missingAttendanceRef.current)
      : undefined,
  };
}
