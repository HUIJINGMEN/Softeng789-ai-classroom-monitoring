import type { OverallReportSnapshot } from "./types";

/** Group repeated guidance without summing unrelated issues or dropping any course counts. */
export function groupedOverallActions(actions: OverallReportSnapshot['actions']) {
  const groups = new Map<string, { key: string; issue: string; nextStep: string; courses: typeof actions }>();
  for (const action of actions) {
    const key = JSON.stringify([action.issue, action.nextStep]);
    const group = groups.get(key) ?? { key, issue: action.issue, nextStep: action.nextStep, courses: [] };
    group.courses.push(action);
    groups.set(key, group);
  }
  return [...groups.values()];
}

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
