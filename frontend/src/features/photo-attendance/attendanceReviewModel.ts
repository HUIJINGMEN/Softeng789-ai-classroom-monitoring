import type { CheckInRequest } from './checkInApi';

export interface ReviewAttendance { studentId: string; studentName: string; studentNumber: string; status: string }
export interface ReviewHistory { id: string; studentId: string; studentName: string; actorName: string; action: string;
  previousStatus: string | null; resultingStatus: string; occurredAt: string }
export interface AttendanceReviewWorkspace { attendance: ReviewAttendance[]; requests: CheckInRequest[]; history: ReviewHistory[] }
export type ReviewFilter = 'ALL' | 'PENDING' | 'UNKNOWN' | 'PRESENT' | 'LATE' | 'ABSENT';
export function reviewRows(workspace: AttendanceReviewWorkspace, filter: ReviewFilter, search: string, now = Date.now()) {
  const eligible = new Set(actionableRequests(workspace, now).map(row => row.id));
  const latest = new Map<string, CheckInRequest>();
  const pending = new Map<string, CheckInRequest>();
  for (const request of workspace.requests) {
    const previous = latest.get(request.studentId);
    if (!previous || Date.parse(request.createdAt) > Date.parse(previous.createdAt)) latest.set(request.studentId, request);
    const previousPending = pending.get(request.studentId);
    if (eligible.has(request.id) && (!previousPending || Date.parse(request.createdAt) > Date.parse(previousPending.createdAt)))
      pending.set(request.studentId, request);
  }
  const query = search.trim().toLowerCase();
  return workspace.attendance.map(student => {
    const request = pending.get(student.studentId);
    return { ...student, state: request ? 'PENDING' : student.status, pending: request, request: request ?? latest.get(student.studentId) };
  }).filter(row => (filter === 'ALL' || row.state === filter)
    && (!query || `${row.studentName} ${row.studentNumber}`.toLowerCase().includes(query)))
    .sort((a, b) => {
      const priority = (state: string) => state === 'PENDING' ? 0 : state === 'UNKNOWN' ? 1 : 2;
      return priority(a.state) - priority(b.state) || a.studentName.localeCompare(b.studentName) || a.studentId.localeCompare(b.studentId);
    });
}
export function actionableRequests(workspace: AttendanceReviewWorkspace, now = Date.now()) {
  const unmarked = new Set(workspace.attendance.filter(row => row.status === 'UNKNOWN').map(row => row.studentId));
  return workspace.requests.filter(row => row.state === 'PENDING' && new Date(row.expiresAt).getTime() > now && unmarked.has(row.studentId));
}
export function reviewSummary(workspace: AttendanceReviewWorkspace, now = Date.now()) {
  const pending = new Set(actionableRequests(workspace, now).map(row => row.studentId));
  const counts = { present: 0, late: 0, absent: 0, pending: pending.size, notRecorded: 0 };
  for (const row of workspace.attendance) {
    if (row.status === 'PRESENT') counts.present++;
    else if (row.status === 'LATE') counts.late++;
    else if (row.status === 'ABSENT') counts.absent++;
    else if (!pending.has(row.studentId)) counts.notRecorded++;
  }
  return counts;
}
