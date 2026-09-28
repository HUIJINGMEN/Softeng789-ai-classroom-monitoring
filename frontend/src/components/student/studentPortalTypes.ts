export type StudentView = 'overview' | 'attendance' | 'payments' | 'feedback' | 'accomplishments' | 'reports';

export const STUDENT_VIEW_LABELS: Record<StudentView, string> = {
  overview: 'Overview',
  attendance: 'Attendance',
  payments: 'Payments',
  feedback: 'Feedback',
  accomplishments: 'Achievements',
  reports: 'Reports'
};
