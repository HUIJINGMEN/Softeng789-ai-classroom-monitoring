import type { AttendanceSource, StudentAttendanceHistoryEntry } from '../types';
import type { LessonCreditStatus } from '../features/payments/model';
import { apiAttendanceStatusToUi, type ApiAttendanceStatus } from './classroomApi';
import { request } from './apiClient';

interface AttendanceHistoryApiResponse {
  sessionId: string;
  course: string;
  room: string;
  campusId: string | null;
  campusName: string | null;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: ApiAttendanceStatus;
  checkInTime: string | null;
  checkOutTime: string | null;
  source: AttendanceSource | null;
}

export interface CourseAttendanceBenchmark {
  course: string;
  averageRate: number | null;
  participatingMarks: number;
  totalMarks: number;
  studentCount: number;
}

export interface StudentAttendanceBenchmark {
  overallAverageRate: number | null;
  participatingMarks: number;
  totalMarks: number;
  studentCount: number;
  courses: CourseAttendanceBenchmark[];
}

export type StudentScheduleCoverageStatus =
  | 'COVERED'
  | 'USED'
  | 'COUNTED_ABSENCE'
  | 'MAKEUP_DUE'
  | 'MAKEUP_SCHEDULED'
  | 'UNPAID_ATTENDANCE'
  | 'UNCOVERED'
  | 'NOT_REQUIRED';

export interface StudentScheduleSession {
  id: string;
  courseOfferingId: string;
  courseCode: string;
  courseName: string;
  offeringCode: string;
  academicTerm: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  room: string;
  campus: string | null;
  teacher: string | null;
  attendanceStatus: ApiAttendanceStatus;
  lessonCreditId: string | null;
  lessonCreditStatus: LessonCreditStatus | null;
  coverageStatus: StudentScheduleCoverageStatus;
  relatedSessionId: string | null;
  relatedSessionDate: string | null;
  creditExpiresOn: string | null;
  makeupRequestId: string | null;
  makeupRequestStatus: 'SUBMITTED' | 'APPROVED' | 'DECLINED' | 'CANCELLED' | null;
  makeupRequestedSessionDate: string | null;
  leaveRequestId: string | null;
  leaveRequestStatus: import('./studentSupportApi').StudentRequestStatus | null;
  leaveReason: import('./studentSupportApi').LeaveReason | null;
}

export interface StudentMakeupOption {
  sessionId: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  campus: string | null;
  capacity: number;
  reservedSeats: number;
}

export interface StudentMakeupRequest {
  id: string;
  lessonCreditId: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  courseOfferingId: string;
  courseCode: string;
  missedSessionDate: string | null;
  creditExpiresOn: string;
  preferredSessionId: string;
  preferredSessionDate: string;
  preferredStartTime: string;
  preferredEndTime: string;
  room: string;
  campus: string | null;
  status: 'SUBMITTED' | 'APPROVED' | 'DECLINED' | 'CANCELLED';
  studentNote: string | null;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

export interface StudentSchedule {
  studentId: string;
  summary: {
    plannedSessions: number;
    upcomingSessions: number;
    coveredUpcomingSessions: number;
    uncoveredUpcomingSessions: number;
    purchasedLessons: number;
    activeLessons: number;
    usedLessons: number;
    remainingLessons: number;
    pendingPaymentLessons: number;
    makeupDue: number;
    expiringLessons: number;
    nextExpiryDate: string | null;
  };
  sessions: StudentScheduleSession[];
}

export async function getMyAttendanceHistory(
  studentRecordId: string
): Promise<StudentAttendanceHistoryEntry[]> {
  const rows = await request<AttendanceHistoryApiResponse[]>(
    `/api/students/${studentRecordId}/attendance-history`
  );
  return rows.map((row) => ({ ...row, status: apiAttendanceStatusToUi(row.status) }));
}

export async function getMyAttendanceBenchmark(
  studentRecordId: string
): Promise<StudentAttendanceBenchmark> {
  return request<StudentAttendanceBenchmark>(
    `/api/students/${studentRecordId}/attendance-benchmark`
  );
}

export async function getMySchedule(studentRecordId: string): Promise<StudentSchedule> {
  return request<StudentSchedule>(`/api/students/${studentRecordId}/schedule`);
}

export function listStudentMakeupOptions(studentId: string, lessonCreditId: string) {
  return request<StudentMakeupOption[]>(
    `/api/students/${studentId}/lesson-credits/${lessonCreditId}/makeup-options`
  );
}

export function submitStudentMakeupRequest(
  studentId: string,
  payload: { lessonCreditId: string; preferredSessionId: string; note?: string }
) {
  return request<StudentMakeupRequest>(`/api/students/${studentId}/makeup-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export function cancelStudentMakeupRequest(studentId: string, requestId: string) {
  return request<StudentMakeupRequest>(`/api/students/${studentId}/makeup-requests/${requestId}`, {
    method: 'DELETE'
  });
}
