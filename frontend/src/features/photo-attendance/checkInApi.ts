import { request } from '../../lib/apiClient';

export type CheckInState = 'PENDING' | 'PRESENT' | 'LATE' | 'REJECTED' | 'EXPIRED';
export interface CheckInRequest {
  id: string; studentId: string; studentName: string; state: CheckInState;
  createdAt: string; expiresAt: string; reviewedAt: string | null;
}
export interface CheckInSession {
  sessionId: string; course: string; startTime: string; endTime: string; canSubmit: boolean;
  attendanceStatus: string; request: CheckInRequest | null;
}
export interface CheckInWorkspace { enabled: boolean; ready: boolean; sessions: CheckInSession[] }
export const getCheckIns = (studentId: string) => request<CheckInWorkspace>(`/api/vision/students/${studentId}/check-ins`);
export function submitCheckIn(studentId: string, sessionId: string, image: Blob, key: string) {
  const body = new FormData(); body.append('image', image, 'check-in.jpg'); body.append('captureConsentConfirmed', 'true');
  return request<CheckInRequest>(`/api/vision/students/${studentId}/sessions/${sessionId}/check-ins`, {
    method: 'POST', headers: { 'Idempotency-Key': key }, body,
  });
}
export const getCheckInQueue = (sessionId: string) => request<CheckInRequest[]>(`/api/vision/sessions/${sessionId}/check-ins`);
export const decideCheckIn = (id: string, status: 'PRESENT' | 'LATE' | 'REJECTED') => request<CheckInRequest>(`/api/vision/check-ins/${id}/decision`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherConfirmed: true, status }),
});
export function checkInLabel(state: CheckInState): string {
  return { PENDING: 'Awaiting teacher approval — attendance not saved', PRESENT: 'Approved as present', LATE: 'Approved as late',
    REJECTED: 'Rejected — ask your teacher or capture again', EXPIRED: 'Expired — capture again or ask for manual attendance' }[state];
}
