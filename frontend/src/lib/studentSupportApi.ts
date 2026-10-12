import { request } from './apiClient';

export type StudentRequestType = 'LEAVE' | 'SCHEDULE_CHANGE' | 'PAYMENT_QUESTION' | 'MAKEUP' | 'GENERAL';
export type StudentRequestStatus = 'SUBMITTED' | 'APPROVED' | 'DECLINED' | 'RESOLVED' | 'CANCELLED';
export type LeaveReason = 'ILLNESS' | 'FAMILY' | 'SCHOOL_COMMITMENT' | 'EMERGENCY' | 'OTHER';
export type LeaveLessonTreatment = 'KEEP_CHARGED' | 'ALLOW_MAKEUP';
export type StudentRequestReviewDecision = 'APPROVE' | 'DECLINE' | 'RESOLVE';
export type StudentRequesterRole = 'STUDENT' | 'PARENT_GUARDIAN';

export interface StudentSupportRequest {
  id: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  studentEmail: string;
  requesterRole: StudentRequesterRole;
  contactName: string;
  relationshipToStudent: string | null;
  contactEmail: string;
  contactPhone: string | null;
  type: StudentRequestType;
  status: StudentRequestStatus;
  courseOfferingId: string | null;
  courseCode: string | null;
  courseName: string | null;
  sessionId: string | null;
  sessionDate: string | null;
  sessionStartTime: string | null;
  sessionEndTime: string | null;
  leaveReason: LeaveReason | null;
  lessonTreatmentRequired: boolean;
  lessonTreatment: LeaveLessonTreatment | null;
  subject: string;
  message: string;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

export interface AdminStudentSupportRequestsResponse {
  submittedCount: number;
  page: {
    items: StudentSupportRequest[];
    page: number;
    size: number;
    totalItems: number;
    totalPages: number;
    hasPrevious: boolean;
    hasNext: boolean;
  };
}

export interface CreateStudentSupportRequest {
  type: StudentRequestType;
  requesterRole: StudentRequesterRole;
  contactName?: string;
  relationshipToStudent?: string;
  contactEmail?: string;
  contactPhone?: string;
  courseOfferingId?: string;
  sessionId?: string;
  leaveReason?: LeaveReason;
  subject: string;
  message: string;
}

export function submitStudentSupportRequest(studentId: string, payload: CreateStudentSupportRequest) {
  return request<StudentSupportRequest>(`/api/students/${studentId}/support-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export function listStudentSupportRequests(studentId: string) {
  return request<StudentSupportRequest[]>(`/api/students/${studentId}/support-requests`);
}

export function cancelStudentSupportRequest(studentId: string, requestId: string) {
  return request<StudentSupportRequest>(`/api/students/${studentId}/support-requests/${requestId}`, {
    method: 'DELETE'
  });
}

export function listAdminStudentSupportRequests(page = 0, size = 20) {
  return request<AdminStudentSupportRequestsResponse>(
    `/api/admin/support-requests?status=SUBMITTED&page=${page}&size=${size}`
  );
}

export function reviewStudentSupportRequest(
  requestId: string,
  decision: StudentRequestReviewDecision,
  note: string,
  lessonTreatment?: LeaveLessonTreatment
) {
  return request<StudentSupportRequest>(`/api/admin/support-requests/${requestId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, note, lessonTreatment })
  });
}
