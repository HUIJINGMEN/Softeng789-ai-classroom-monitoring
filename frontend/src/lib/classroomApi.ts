import type { AttendanceRow, AttendanceStatus, Session, SessionStatusCode } from '../types';
import { request } from './apiClient';
import { formatSessionDateLabel, formatSessionTimeRange } from './sessionTime';
import { pageQuery, type PageResponse } from './pagination';

export { sessionRoomLabel } from './sessionLabels';

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
  campusId: string | null;
  campusName: string | null;
  teacherId: string | null;
  teacherName: string | null;
  teacherEmail: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status: ApiSessionStatus;
}

export interface CreateClassroomSessionPayload {
  courseOfferingId: string;
  roomId: string;
  teacherEmail?: string;
  teacherStaffNumber?: string;
  date: string;
  startTime: string;
  endTime: string;
  status?: ApiSessionStatus;
}

export interface UpdateClassroomSessionPayload {
  courseOfferingId: string;
  roomId: string;
  teacherEmail?: string;
  teacherStaffNumber?: string;
  date: string;
  startTime: string;
  endTime: string;
  /** The session's current lifecycle status, carried through unchanged — editing room/time/teacher
   *  never itself changes SCHEDULED/ACTIVE/COMPLETED/CANCELLED; that's start/end/cancel's job. */
  status: ApiSessionStatus;
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

export interface BatchAttendanceApiResponse {
  attendanceBySessionId: Record<string, AttendanceRecordApiResponse[]>;
}

export async function listClassroomSessions(): Promise<ClassroomSessionApiResponse[]> {
  return request<ClassroomSessionApiResponse[]>('/api/sessions');
}

export async function listClassroomSessionsPage(
  page: number,
  size: number,
  query = ''
): Promise<PageResponse<ClassroomSessionApiResponse>> {
  const params = new URLSearchParams(pageQuery(page, size));
  if (query.trim()) params.set('query', query.trim());
  return request<PageResponse<ClassroomSessionApiResponse>>(`/api/sessions/page?${params}`);
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

export async function updateClassroomSession(
  id: string,
  payload: UpdateClassroomSessionPayload
): Promise<ClassroomSessionApiResponse> {
  return request<ClassroomSessionApiResponse>(`/api/sessions/${id}`, {
    method: 'PUT',
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

export async function cancelClassroomSession(id: string): Promise<ClassroomSessionApiResponse> {
  return request<ClassroomSessionApiResponse>(`/api/sessions/${id}/cancel`, { method: 'POST' });
}

export async function listSessionAttendance(sessionId: string): Promise<AttendanceRecordApiResponse[]> {
  return request<AttendanceRecordApiResponse[]>(`/api/sessions/${sessionId}/attendance`);
}

export async function listSessionAttendanceBatch(
  sessionIds: readonly string[]
): Promise<BatchAttendanceApiResponse> {
  return request<BatchAttendanceApiResponse>('/api/attendance/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionIds })
  });
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
    campusId: session.campusId,
    campusName: session.campusName,
    teacherId: session.teacherId,
    teacherName: session.teacherName,
    teacherEmail: session.teacherEmail,
    date: session.date,
    dateLabel: formatSessionDateLabel(session.date),
    time: formatSessionTimeRange(session.startTime, session.endTime, session.date),
    startTime: session.startTime,
    endTime: session.endTime,
    enrolled,
    status:
      session.status === 'ACTIVE'
        ? 'Live'
        : session.status === 'COMPLETED'
          ? 'Completed'
          : session.status === 'CANCELLED'
            ? 'Cancelled'
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
