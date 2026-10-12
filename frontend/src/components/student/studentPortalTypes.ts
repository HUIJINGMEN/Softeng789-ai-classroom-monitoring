export type StudentView = 'overview' | 'schedule' | 'attendance' | 'payments' | 'feedback' | 'accomplishments' | 'reports';

export const STUDENT_VIEW_LABELS: Record<StudentView, string> = {
  overview: 'Overview',
  schedule: 'Schedule',
  attendance: 'Attendance',
  payments: 'Payments',
  feedback: 'Feedback',
  accomplishments: 'Achievements',
  reports: 'Reports'
};
