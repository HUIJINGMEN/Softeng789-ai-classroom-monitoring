import type { PageResponse } from '../../../lib/pagination';
import type { CoursePurchaseMode, InvoiceStatus, LessonCreditStatus } from './payment';

export type LessonMakeupRequestStatus = 'SUBMITTED' | 'APPROVED' | 'DECLINED' | 'CANCELLED';
export type AbsenceReason = 'ILLNESS' | 'ADVANCE_NOTICE' | 'NO_NOTICE' | 'SCHOOL_CANCELLED' | 'OTHER';
export type ReconciliationView = 'WEEK' | 'COURSE';

export interface ReconciliationSession {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  room: string;
  campus: string | null;
}

export interface ReconciliationCell {
  sessionId: string;
  attendanceRecordId: string | null;
  attendanceStatus: 'PRESENT' | 'LATE' | 'ABSENT' | 'UNKNOWN';
  lessonCreditId: string | null;
  creditStatus: LessonCreditStatus | null;
  absenceReason: AbsenceReason | null;
  absenceNote: string | null;
  decisionNote: string | null;
  originalSessionId: string | null;
  originalSessionDate: string | null;
  makeupSessionId: string | null;
  makeupSessionDate: string | null;
  uncoveredAttendance: boolean;
}

export interface ReconciliationRow {
  studentId: string;
  studentName: string;
  studentNumber: string;
  packageId: string | null;
  invoiceId: string | null;
  paymentStatus: InvoiceStatus | null;
  balance: number | null;
  currency: string;
  purchaseMode: CoursePurchaseMode | null;
  purchasedSessions: number;
  activeSessions: number;
  pendingSessions: number;
  usedSessions: number;
  remainingSessions: number;
  makeupDue: number;
  expiringSessions: number;
  uncoveredAttendance: number;
  needsAttention: boolean;
  cells: ReconciliationCell[];
}

export interface LessonReconciliationResponse {
  courseOfferingId: string;
  courseCode: string;
  academicTerm: string;
  view: ReconciliationView;
  weekStart: string;
  weekEnd: string;
  sessions: ReconciliationSession[];
  summary: {
    totalStudents: number;
    fullyReconciled: number;
    paymentIssues: number;
    makeupDue: number;
    expiringCredits: number;
    attendanceNotRecorded: number;
    uncoveredAttendance: number;
  };
  rows: ReconciliationRow[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface MakeupOption {
  sessionId: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  campus: string | null;
  capacity: number;
  reservedSeats: number;
}

export interface LessonMakeupRequest {
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
  status: LessonMakeupRequestStatus;
  studentNote: string | null;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

export interface AdminMakeupRequestsResponse {
  submittedCount: number;
  page: PageResponse<LessonMakeupRequest>;
}

export interface LessonCreditEvent {
  id: string;
  eventType: string;
  fromStatus: LessonCreditStatus | null;
  toStatus: LessonCreditStatus;
  sourceSessionId: string | null;
  sourceSessionDate: string | null;
  targetSessionId: string | null;
  targetSessionDate: string | null;
  note: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface LessonCreditDetail {
  id: string;
  status: LessonCreditStatus;
  absenceReason: AbsenceReason | null;
  decisionNote: string | null;
  originalSessionId: string | null;
  originalSessionDate: string | null;
  currentSessionId: string | null;
  currentSessionDate: string | null;
  events: LessonCreditEvent[];
}
