export type StudentView = 'overview' | 'schedule' | 'attendance' | 'payments' | 'feedback' | 'accomplishments' | 'reports' | 'profile' | 'camera';

export const STUDENT_VIEW_LABELS: Record<StudentView, string> = {
  overview: 'Home',
  profile: 'Profile',
  camera: 'Camera & activity',
  schedule: 'Schedule',
  attendance: 'Attendance',
  payments: 'Payments',
  feedback: 'Feedback',
  accomplishments: 'Achievements',
  reports: 'Reports'
};
