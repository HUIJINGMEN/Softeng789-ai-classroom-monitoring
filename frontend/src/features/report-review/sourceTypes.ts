import type { ReportAttendance } from "./types";

export interface ReportRosterStudent {
  id: string;
  name: string;
  number: string;
  attendance: ReportAttendance;
  courses?: { id: string; label: string }[];
}

export interface ReportLessonSource {
  sessionId: string;
  courseOfferingId: string;
  courseLabel: string;
  date: string;
  startsAt: string;
  status: "PRESENT" | "LATE" | "ABSENT" | "UNKNOWN";
}
export interface ReportFeedbackSource {
  id: string;
  courseLabel: string;
  teacherName: string;
  recordedAt: string;
  excerpt: string;
}
export interface ReportAchievementSource {
  id: string;
  courseLabel: string;
  date: string;
  title: string;
  category: string;
  points: number | null;
}
export interface StudentReportSources {
  lessons: ReportLessonSource[];
  feedback: ReportFeedbackSource[];
  achievements: ReportAchievementSource[];
  pendingCorrections: number;
}
export interface ClassReportSources {
  feedback: ReportFeedbackSource[];
}
