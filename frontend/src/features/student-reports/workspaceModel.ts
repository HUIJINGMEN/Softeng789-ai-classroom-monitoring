import type { Student } from "../../types";
import type {
  StudentReportProgress,
  StudentReportTask,
  ReportTaskStatus,
} from "./workspaceTypes";

export const REPORT_TASK_STATES: ReportTaskStatus[] = [
  "Not started",
  "Drafting",
  "Needs review",
  "Reviewed",
  "Published",
];

export function reportTaskStatus(
  progress?: StudentReportProgress,
): ReportTaskStatus {
  if (!progress?.draft)
    return progress?.published ? "Published" : "Not started";
  const draft = progress.draft;
  if (draft.stale) return "Needs review";
  if (draft.drafted < draft.sections || !draft.sections) return "Drafting";
  return draft.reviewed === draft.sections ? "Reviewed" : "Needs review";
}

/** Exact offering IDs are required: course codes can span several terms. Never guess a scope. */
export function studentReportTasks(
  students: Student[],
  courses: { id: string; label: string }[],
  dateFrom: string,
  dateTo: string,
  courseId: string,
): StudentReportTask[] {
  return students.flatMap((student) => {
    if (!student.recordId) return [];
    const selected = courses.filter(
      (course) =>
        student.courseOfferingIds?.includes(course.id) &&
        (!courseId || course.id === courseId),
    );
    if (!selected.length) return [];
    return [
      {
        studentId: student.recordId,
        number: student.studentNumber ?? student.id,
        name: student.name,
        photoUrl: student.registrationPhoto,
        courses: selected,
        scope: {
          studentId: student.recordId,
          dateFrom,
          dateTo,
          courseOfferingIds: selected.map((course) => course.id),
        },
      },
    ];
  });
}
