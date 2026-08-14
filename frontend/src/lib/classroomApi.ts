import type { AttendanceRow, AttendanceStatus, Session, SessionStatusCode } from '../types';
import { request } from './apiClient';
import { formatSessionDateLabel, formatSessionTimeRange } from './sessionTime';

export type ApiSessionStatus = SessionStatusCode;
export type ApiAttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'UNKNOWN';
export type ApiAttendanceSource = 'MANUAL' | 'AI';

export interface ClassroomSessionApiResponse {
  id: string;
  course: string;
  room: string;
  courseOfferingId: string | null;
  courseOfferingCode: string | null;
  roomId: string | null;
  teacherId: string | null;
  teacherName: string | null;
  teacherEmail: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status: ApiSessionStatus;
}

export interface CreateClassroomSessionPayload {
  course: string;
  room: string;
  teacherName?: string;
  teacherEmail?: string;
  teacherStaffNumber?: string;
  date: string;
  startTime: string;
  endTime: string;
  status?: ApiSessionStatus;
}

export interface AttendanceRecordApiResponse {
  id: string | null;
  studentId: string;
  studentNumber: string;
  studentName: string;
  sessionId: string;
  status: ApiAttendanceStatus;
  checkInTime: string | null;
  checkOutTime: string | null;
  source: ApiAttendanceSource | null;
}

export async function listClassroomSessions(): Promise<ClassroomSessionApiResponse[]> {
  return request<ClassroomSessionApiResponse[]>('/api/sessions');
}

export async function createClassroomSession(
  payload: CreateClassroomSessionPayload
): Promise<ClassroomSessionApiResponse> {
  return request<ClassroomSessionApiResponse>('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function startClassroomSession(id: string): Promise<ClassroomSessionApiResponse> {
  return request<ClassroomSessionApiResponse>(`/api/sessions/${id}/start`, { method: 'POST' });
}

export async function endClassroomSession(id: string): Promise<ClassroomSessionApiResponse> {
  return request<ClassroomSessionApiResponse>(`/api/sessions/${id}/end`, { method: 'POST' });
}

export async function listSessionAttendance(sessionId: string): Promise<AttendanceRecordApiResponse[]> {
  return request<AttendanceRecordApiResponse[]>(`/api/sessions/${sessionId}/attendance`);
}

export async function updateSessionAttendance(
  sessionId: string,
  studentId: string,
  status: AttendanceStatus
): Promise<AttendanceRecordApiResponse> {
  return request<AttendanceRecordApiResponse>(`/api/sessions/${sessionId}/attendance/${studentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: uiAttendanceStatusToApi(status) })
  });
}

export function mapClassroomSessionApiToUi(
  session: ClassroomSessionApiResponse,
  enrolled: number
): Session {
  return {
    id: session.id,
    recordId: session.id,
    courseOfferingId: session.courseOfferingId,
    courseOfferingCode: session.courseOfferingCode,
    course: session.course,
    title: `${session.course} · ${session.room}`,
    room: session.room,
    roomId: session.roomId,
    teacherId: session.teacherId,
    teacherName: session.teacherName,
    teacherEmail: session.teacherEmail,
    date: session.date,
    dateLabel: formatSessionDateLabel(session.date),
    time: formatSessionTimeRange(session.startTime, session.endTime, session.date),
    enrolled,
    status:
      session.status === 'ACTIVE'
        ? 'Live'
        : session.status === 'COMPLETED'
          ? 'Completed'
          : 'Scheduled',
    statusCode: session.status
  };
}

export function mapAttendanceApiToUi(record: AttendanceRecordApiResponse): AttendanceRow {
  return {
    id: record.id,
    studentRecordId: record.studentId,
    studentNumber: record.studentNumber,
    studentName: record.studentName,
    sessionId: record.sessionId,
    status: apiAttendanceStatusToUi(record.status),
    checkInTime: record.checkInTime,
    checkOutTime: record.checkOutTime,
    source: record.source
  };
}

export function apiAttendanceStatusToUi(status: ApiAttendanceStatus): AttendanceStatus {
  switch (status) {
    case 'PRESENT':
      return 'Present';
    case 'LATE':
      return 'Late';
    case 'ABSENT':
      return 'Absent';
    case 'UNKNOWN':
    default:
      return 'Unknown';
  }
}

function uiAttendanceStatusToApi(status: AttendanceStatus): ApiAttendanceStatus {
  switch (status) {
    case 'Present':
      return 'PRESENT';
    case 'Late':
      return 'LATE';
    case 'Absent':
      return 'ABSENT';
    case 'Unknown':
    default:
      return 'UNKNOWN';
  }
}
