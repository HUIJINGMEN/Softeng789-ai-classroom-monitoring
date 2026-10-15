import type { OverallReportSnapshot } from "./types";

/** Counts are derived only from this saved snapshot, never from live course records. */
export function overallCoverage(snapshot: OverallReportSnapshot) {
  return {
    courses: snapshot.courses.length,
    teaching: snapshot.courses.filter((course) => course.completedSessions > 0)
      .length,
    feedback: snapshot.courses.filter((course) => course.feedbackCount > 0)
      .length,
    missing: snapshot.courses.filter(
      (course) => course.attendance.unrecorded > 0,
    ).length,
    absent: snapshot.courses.filter((course) => course.attendance.absent > 0)
      .length,
  };
}
