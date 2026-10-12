import type { PageResponse } from '../../../lib/pagination';

export type FeeRequestStatus = 'SUBMITTED' | 'INVOICED' | 'DECLINED';

export interface StudentFeeRequest {
  id: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  title: string;
  requestDetails: string;
  status: FeeRequestStatus;
  evidenceFileName: string | null;
  evidenceContentType: string | null;
  evidenceFileSize: number | null;
  invoiceId: string | null;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

export interface AdminFeeRequestsResponse {
  submittedCount: number;
  page: PageResponse<StudentFeeRequest>;
}
