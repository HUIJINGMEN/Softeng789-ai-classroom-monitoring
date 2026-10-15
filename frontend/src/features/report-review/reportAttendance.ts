import type { ReportAttendance } from "./types";

/** Shared presentation math over server-owned frozen marks. Never recalculate the stored attendance rate. */
export const recordedMarks = (attendance: ReportAttendance) =>
  attendance.present + attendance.late + attendance.absent;

export const recordingCompleteness = (attendance: ReportAttendance) =>
  attendance.completed
    ? Math.round((100 * recordedMarks(attendance)) / attendance.completed)
    : null;

export const reportRate = (value: number | null, unavailable = "—") =>
  value === null ? unavailable : `${value}%`;
