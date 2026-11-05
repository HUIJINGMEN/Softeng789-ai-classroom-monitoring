/** Wire types for the Entrance Attendance Kiosk contract (codex/entrance-kiosk-api brief, section 5). */

export type SessionStatus = 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export type LaunchBlockedReason =
  | 'CANCELLED'
  | 'WINDOW_CLOSED'
  | 'TOO_EARLY'
  | 'NO_CLASS'
  | 'ROSTER_TOO_LARGE'
  | 'NO_FACE_READY_STUDENTS'
  | 'RECOGNITION_DISABLED';

export interface LaunchCampus {
  id: string;
  name: string;
}

export interface LaunchSession {
  sessionId: string;
  offeringId: string;
  classLabel: string;
  course: string;
  campusId: string | null;
  roomName: string | null;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  launchable: boolean;
  blockedReason: LaunchBlockedReason | null;
  rosterSize: number;
  faceReadyCount: number;
}

export interface LaunchOptions {
  date: string;
  timeZone: string;
  campuses: LaunchCampus[];
  sessions: LaunchSession[];
  recentLocations: string[];
}

export interface LaunchRequest {
  sessionId: string;
  campusId: string;
  locationLabel: string;
  lateAfterMinutes: number | null;
  deviceConfirmed: true;
}

export interface LaunchedKiosk {
  kioskSessionId: string;
  sessionId: string;
  classLabel: string;
  campusName: string;
  locationLabel: string;
  lateAfterMinutes: number | null;
  opensAt: string;
  closesAt: string;
  expiresAt: string;
}

export type KioskEndReason = 'DEVICE_EXIT' | 'STAFF_ENDED' | 'EXPIRED' | 'ACCESS_LOST';

export interface KioskSessionSummary {
  kioskSessionId: string;
  locationLabel: string;
  campusName: string;
  launchedByName: string | null;
  launchedAt: string;
  expiresAt: string;
  endedAt: string | null;
  endReason: KioskEndReason | null;
  confirmedCount: number;
}

export type AttemptState =
  | 'NO_FACE'
  | 'MULTIPLE_FACES'
  | 'LOW_QUALITY'
  | 'NO_CANDIDATE'
  | 'AWAITING_SELECTION'
  | 'CONFIRMED'
  | 'ALREADY_RECORDED'
  | 'BLOCKED_NOT_ENROLLED'
  | 'ATTENDANCE_LOCKED'
  | 'STALE'
  | 'SESSION_CLOSED'
  | 'CANCELLED_NOT_LISTED'
  | 'CANCELLED_TIMEOUT'
  | 'SUPERSEDED'
  | 'EXPIRED';

export type KioskReviewKind = 'CANDIDATE_SELECTION_MISMATCH' | 'NOT_ENROLLED_ATTEMPT';
export type KioskAttendanceStatus = 'PRESENT' | 'LATE';

export interface KioskAttemptLogRow {
  attemptId: string;
  capturedAt: string;
  processedAt: string | null;
  state: AttemptState;
  locationLabel: string;
  campusName: string | null;
  student: { id: string; name: string } | null;
  selectedRank: number | null;
  attendanceStatus: KioskAttendanceStatus | null;
  reviewKind: KioskReviewKind | null;
}

export type WindowState = 'WAITING' | 'OPEN' | 'CLOSED';

export interface KioskDevice {
  kioskSessionId: string;
  classLabel: string;
  course: string;
  campusName: string;
  locationLabel: string;
  startTime: string;
  endTime: string;
  opensAt: string;
  closesAt: string;
  windowState: WindowState;
  serverTime: string;
  captureCooldownMs: number;
  attemptTtlSeconds: number;
  maxImageBytes: number;
}

export type CaptureOutcome = 'CANDIDATES' | 'NO_FACE' | 'MULTIPLE_FACES' | 'LOW_QUALITY' | 'NO_CANDIDATE';
export type QualityReason = 'FACE_TOO_SMALL' | 'BLUR' | 'LIGHTING' | 'DUPLICATE_IDENTITY' | 'OTHER';

export interface KioskCandidate {
  candidateId: string;
  rank: number;
  displayName: string;
  /** Representative photo policy is undecided (D4); the server sends null for now. */
  photo: string | null;
}

export interface CaptureResult {
  attemptId: string;
  outcome: CaptureOutcome;
  state: AttemptState;
  qualityReasons: QualityReason[];
  candidates: KioskCandidate[];
  capturedAt: string;
  expiresAt: string;
}

export interface ConfirmResult {
  attemptId: string;
  result: 'CONFIRMED' | 'ALREADY_RECORDED';
  attendanceStatus: KioskAttendanceStatus;
  displayName: string;
  processedAt: string;
  replayed: boolean;
}

export type CancelReason = 'NOT_LISTED' | 'TIMEOUT';
