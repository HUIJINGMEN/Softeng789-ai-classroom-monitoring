import type { AttendanceSource, StudentAttendanceHistoryEntry } from '../types';
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
