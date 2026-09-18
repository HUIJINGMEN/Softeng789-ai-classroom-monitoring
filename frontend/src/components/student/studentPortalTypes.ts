export type StudentView = 'overview' | 'attendance' | 'feedback' | 'accomplishments' | 'reports';

export const STUDENT_VIEW_LABELS: Record<StudentView, string> = {
  overview: 'Overview',
  attendance: 'Attendance',
  feedback: 'Feedback',
  accomplishments: 'Achievements',
  reports: 'Reports'
};
