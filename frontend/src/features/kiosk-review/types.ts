/** Admin review wire types (codex/entrance-kiosk-api brief, routes A1-A4). */

export type KioskReviewKind = 'CANDIDATE_SELECTION_MISMATCH' | 'NOT_ENROLLED_ATTEMPT';
export type KioskReviewState = 'OPEN' | 'RESOLVED';
export type KioskReviewFilter = KioskReviewState | 'ALL';
export type KioskReviewResolution = 'VERIFIED_CORRECT' | 'ATTENDANCE_CORRECTED' | 'NO_ACTION';
export type KioskAttemptResult = 'CONFIRMED' | 'ALREADY_RECORDED' | 'BLOCKED_NOT_ENROLLED';

export interface KioskReviewStudent {
  id: string;
  name: string;
  studentNumber: string | null;
}

export interface KioskReviewItem {
  id: string;
  kind: KioskReviewKind;
  state: KioskReviewState;
  createdAt: string;
  attemptId: string;
  selectedRank: number | null;
  selectedStudent: KioskReviewStudent;
  topCandidate: KioskReviewStudent | null;
  session: { id: string; classLabel: string; startTime: string };
  campusName: string | null;
  locationLabel: string;
  capturedAt: string;
  processedAt: string | null;
  attemptResult: KioskAttemptResult;
  attendanceStatus: 'PRESENT' | 'LATE' | null;
  evidenceAvailable: boolean;
  evidenceDeleteAfter: string | null;
  resolution: KioskReviewResolution | null;
  note: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
}

export interface KioskReviewSummary {
  open: number;
}
