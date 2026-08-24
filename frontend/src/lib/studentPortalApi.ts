import type { AttendanceSource, AttendanceStatus, StudentAttendanceHistoryEntry } from '../types';
import { request } from './apiClient';

interface AttendanceHistoryApiResponse {
  sessionId: string;
  course: string;
  room: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: AttendanceStatus;
  checkInTime: string | null;
  checkOutTime: string | null;
  source: AttendanceSource | null;
}

export async function getMyAttendanceHistory(
  studentRecordId: string
): Promise<StudentAttendanceHistoryEntry[]> {
  return request<AttendanceHistoryApiResponse[]>(
    `/api/students/${studentRecordId}/attendance-history`
  );
}
