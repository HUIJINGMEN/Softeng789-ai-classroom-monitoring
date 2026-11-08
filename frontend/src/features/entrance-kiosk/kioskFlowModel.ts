import { ApiError } from '../../lib/apiClient';
import { formatTimestampClock } from '../../lib/sessionTime';
import type {
  CancelReason,
  CaptureResult,
  ConfirmResult,
  KioskAttendanceStatus,
  KioskCandidate,
  QualityReason,
  WindowState
} from './types';

/**
 * Pure state for the kiosk device screen. Every path that leaves candidate selection clears the
 * attempt, candidates and selection, so the next student never sees the previous one's name.
 */
export type KioskView = 'scanning' | 'recognizing' | 'choosing' | 'confirming' | 'notice' | 'waiting' | 'closed';
export type NoticeTone = 'success' | 'info' | 'retry' | 'help';

export interface KioskNotice {
  tone: NoticeTone;
  title: string;
  message: string;
  displayName?: string;
  statusLabel?: string;
  timeLabel?: string;
  holdMs: number;
}

export interface KioskFlowState {
  view: KioskView;
  attemptId: string | null;
  candidates: KioskCandidate[];
  selectedId: string | null;
  selectionDeadline: number | null;
  notice: KioskNotice | null;
  noticeUntil: number | null;
  noCandidateStreak: number;
}

export type KioskFlowAction =
  | { type: 'WINDOW'; state: WindowState }
  | { type: 'CAPTURE_STARTED' }
  | { type: 'CAPTURE_RESULT'; result: CaptureResult; now: number }
  | { type: 'CAPTURE_FAILED'; error: unknown; now: number }
  | { type: 'SELECT'; candidateId: string }
  | { type: 'CONFIRM_STARTED' }
  | { type: 'CONFIRM_RESULT'; result: ConfirmResult; now: number }
  | { type: 'CONFIRM_FAILED'; error: unknown; now: number }
  | { type: 'CANCELLED'; reason: CancelReason; now: number }
  | { type: 'NOTICE_EXPIRED'; now: number }
  | { type: 'RESET' };

export const SELECTION_TIMEOUT_MS = 30_000;
const SUCCESS_HOLD_MS = 4000;
const RETRY_HOLD_MS = 3500;
const HELP_HOLD_MS = 7000;
const UNAVAILABLE_HOLD_MS = 10_000;

export const INITIAL_KIOSK_FLOW: KioskFlowState = {
  view: 'scanning',
  attemptId: null,
  candidates: [],
  selectedId: null,
  selectionDeadline: null,
  notice: null,
  noticeUntil: null,
  noCandidateStreak: 0
};

/** Clears everything tied to one person while keeping the no-candidate streak when asked. */
function cleared(view: KioskView, state: KioskFlowState, keepStreak: boolean): KioskFlowState {
  return { ...INITIAL_KIOSK_FLOW, view, noCandidateStreak: keepStreak ? state.noCandidateStreak : 0 };
}

function withNotice(state: KioskFlowState, notice: KioskNotice, now: number, keepStreak = false): KioskFlowState {
  return { ...cleared('notice', state, keepStreak), notice, noticeUntil: now + notice.holdMs };
}

const retry = (title: string, message: string): KioskNotice => ({ tone: 'retry', title, message, holdMs: RETRY_HOLD_MS });
const help = (title: string, message: string, holdMs = HELP_HOLD_MS): KioskNotice => ({ tone: 'help', title, message, holdMs });

export function attendanceStatusLabel(status: KioskAttendanceStatus): string {
  return status === 'LATE' ? 'Late' : 'Present';
}

export function qualityGuidance(reasons: readonly QualityReason[]): string {
  if (reasons.includes('FACE_TOO_SMALL')) return 'Step a little closer to the camera.';
  if (reasons.includes('BLUR')) return 'Hold still for a moment.';
  if (reasons.includes('LIGHTING')) return 'Face the light, or move out of strong backlight.';
  return 'Look straight at the camera and hold still.';
}

export function errorCode(error: unknown): string | undefined {
  return error instanceof ApiError ? error.code : undefined;
}

/** Network failures and 429s are worth retrying with the same request; nothing else is. */
export function isTransient(error: unknown): boolean {
  if (error instanceof ApiError) return error.status === 429;
  return error instanceof TypeError;
}

export function retryDelayMs(error: unknown, attempt: number): number {
  const seconds = error instanceof ApiError ? error.retryAfterSeconds : undefined;
  if (seconds !== undefined) return Math.min(10_000, Math.max(500, seconds * 1000));
  return Math.min(5000, 1000 * (attempt + 1));
}

function captureOutcome(state: KioskFlowState, result: CaptureResult, now: number): KioskFlowState {
  if (result.outcome === 'CANDIDATES' && result.state === 'AWAITING_SELECTION' && result.candidates.length > 0) {
    const candidates = [...result.candidates].sort((a, b) => a.rank - b.rank).slice(0, 3);
    return {
      ...cleared('choosing', state, false),
      attemptId: result.attemptId,
      candidates,
      selectionDeadline: now + SELECTION_TIMEOUT_MS
    };
  }
  switch (result.outcome) {
    case 'NO_FACE':
      return withNotice(state, retry('We couldn’t see your face', 'Look straight at the camera and hold still.'), now, true);
    case 'MULTIPLE_FACES':
      return withNotice(state, retry('One person at a time', 'Ask others to step out of the camera view.'), now, true);
    case 'LOW_QUALITY':
      return withNotice(state, retry('Let’s try that again', qualityGuidance(result.qualityReasons)), now, true);
    case 'NO_CANDIDATE': {
      const streak = state.noCandidateStreak + 1;
      if (streak >= 2) {
        return withNotice(state, help('Please ask your teacher',
          'We couldn’t match you to this class list. Your teacher can record your attendance.'), now);
      }
      return { ...withNotice(state, retry('We couldn’t find you yet', 'Look straight at the camera. We’ll try once more.'), now),
        noCandidateStreak: streak };
    }
    default:
      // An unexpected shape: start again. Finished or expired attempts arrive as
      // ATTEMPT_FINALIZED / ATTEMPT_EXPIRED errors and are handled in captureFailure.
      return withNotice(state, retry('Please scan again', 'Stand in front of the camera again.'), now, true);
  }
}

function captureFailure(state: KioskFlowState, error: unknown, now: number): KioskFlowState {
  switch (errorCode(error)) {
    case 'KIOSK_WINDOW_NOT_OPEN':
      return cleared('waiting', state, false);
    case 'KIOSK_SESSION_CLOSED':
      return cleared('closed', state, false);
    case 'NO_FACE_READY_STUDENTS':
    case 'SESSION_NOT_LAUNCHABLE':
      return withNotice(state, help('Face check-in isn’t ready for this class',
        'Please ask your teacher to record your attendance.', UNAVAILABLE_HOLD_MS), now);
    case 'RECOGNITION_UNAVAILABLE':
    case 'RECOGNIZER_INVALID_RESPONSE':
      return withNotice(state, help('Face check-in is unavailable right now',
        'Please ask your teacher to record your attendance.', UNAVAILABLE_HOLD_MS), now);
    case 'RECOGNIZER_BUSY':
    case 'CAPTURE_RATE_LIMITED':
      return withNotice(state, { ...retry('The kiosk is busy', 'Please stay in front of the camera.'), holdMs: 2500 }, now, true);
    case 'ATTEMPT_EXPIRED':
      // The scan ran out of time before a name was chosen. Ask for a new scan only.
      return withNotice(state, retry('That scan timed out', 'Stand in front of the camera to scan again.'), now, true);
    case 'ATTEMPT_FINALIZED':
      // This scan was already finished elsewhere, possibly with a check-in. Say neither
      // "recorded" nor "not recorded": a fresh scan reports the real attendance state.
      return withNotice(state, retry('Please scan again',
        'This scan has already finished. Stand in front of the camera again to check your attendance.'), now, true);
    default:
      if (error instanceof ApiError && (error.status === 502 || error.status === 503)) {
        return withNotice(state, help('Face check-in is unavailable right now',
          'Please ask your teacher to record your attendance.', UNAVAILABLE_HOLD_MS), now);
      }
      return withNotice(state, retry('Something went wrong', 'Nothing was recorded. Please try again.'), now, true);
  }
}

function confirmOutcome(state: KioskFlowState, result: ConfirmResult, now: number): KioskFlowState {
  const already = result.result === 'ALREADY_RECORDED';
  return withNotice(state, {
    tone: already ? 'info' : 'success',
    title: already ? 'You’re already checked in' : 'You’re checked in',
    message: already ? 'Nothing else is needed.' : 'Your attendance has been recorded.',
    displayName: result.displayName,
    statusLabel: attendanceStatusLabel(result.attendanceStatus),
    timeLabel: formatTimestampClock(result.processedAt),
    holdMs: SUCCESS_HOLD_MS
  }, now);
}

function confirmFailure(state: KioskFlowState, error: unknown, now: number): KioskFlowState {
  const code = errorCode(error);
  if (code === 'KIOSK_SESSION_CLOSED') return cleared('closed', state, false);
  if (code === 'NOT_ENROLLED') {
    return withNotice(state, help('You’re not on the list for this class',
      'Your attendance was not recorded. Please ask your teacher.'), now);
  }
  if (code === 'ATTENDANCE_LOCKED') {
    return withNotice(state, help('Your attendance is already set',
      'Please ask your teacher if it needs to change.'), now);
  }
  if (code === 'ATTEMPT_EXPIRED') {
    return withNotice(state, retry('That took too long', 'Nothing was recorded. Stand in front of the camera again.'), now);
  }
  if (code === 'CANDIDATES_STALE' || code === 'ATTEMPT_FINALIZED' || code === 'INVALID_CANDIDATE'
    || (error instanceof ApiError && error.status === 404)) {
    return withNotice(state, retry('Please scan again', 'Nothing was recorded. Stand in front of the camera again.'), now);
  }
  // The request may or may not have reached the server: say so instead of claiming either outcome.
  return withNotice(state, help('We couldn’t confirm your check-in',
    'Please ask your teacher to check your attendance.'), now);
}

export function kioskFlowReducer(state: KioskFlowState, action: KioskFlowAction): KioskFlowState {
  switch (action.type) {
    case 'WINDOW':
      if (action.state === 'WAITING') return state.view === 'waiting' ? state : cleared('waiting', state, false);
      if (action.state === 'CLOSED') return state.view === 'closed' ? state : cleared('closed', state, false);
      return state.view === 'waiting' || state.view === 'closed' ? cleared('scanning', state, false) : state;
    case 'CAPTURE_STARTED':
      return state.view === 'scanning' ? { ...cleared('recognizing', state, true) } : state;
    case 'CAPTURE_RESULT':
      return state.view === 'recognizing' ? captureOutcome(state, action.result, action.now) : state;
    case 'CAPTURE_FAILED':
      return state.view === 'recognizing' ? captureFailure(state, action.error, action.now) : state;
    case 'SELECT':
      if (state.view !== 'choosing' || !state.candidates.some(c => c.candidateId === action.candidateId)) return state;
      return { ...state, selectedId: action.candidateId };
    case 'CONFIRM_STARTED':
      return state.view === 'choosing' && state.selectedId ? { ...state, view: 'confirming' } : state;
    case 'CONFIRM_RESULT':
      return state.view === 'confirming' && action.result.attemptId === state.attemptId
        ? confirmOutcome(state, action.result, action.now) : state;
    case 'CONFIRM_FAILED':
      return state.view === 'confirming' ? confirmFailure(state, action.error, action.now) : state;
    case 'CANCELLED':
      if (state.view !== 'choosing') return state;
      if (action.reason === 'NOT_LISTED') {
        return withNotice(state, help('Please ask your teacher',
          'Your attendance was not recorded. Your teacher can record it for you.'), action.now);
      }
      return withNotice(state, { tone: 'info', title: 'Check-in timed out',
        message: 'Nothing was recorded. Stand in front of the camera to start again.', holdMs: 2500 }, action.now);
    case 'NOTICE_EXPIRED':
      return state.view === 'notice' && state.noticeUntil !== null && action.now >= state.noticeUntil
        ? cleared('scanning', state, true) : state;
    case 'RESET':
      return INITIAL_KIOSK_FLOW;
    default:
      return state;
  }
}

/** Server time minus local time, so the opening/closing countdown does not trust the tablet clock. */
export function clockOffsetMs(serverTime: string, localNow: number): number {
  const server = Date.parse(serverTime);
  return Number.isFinite(server) ? server - localNow : 0;
}

export function windowStateAt(opensAt: string, closesAt: string, serverNow: number): WindowState {
  const opens = Date.parse(opensAt);
  const closes = Date.parse(closesAt);
  if (!Number.isFinite(opens) || !Number.isFinite(closes)) return 'CLOSED';
  if (serverNow < opens) return 'WAITING';
  return serverNow < closes ? 'OPEN' : 'CLOSED';
}

export function candidateInitials(displayName: string): string {
  const letters = displayName
    .replace(/[·.]/g, ' ')
    .split(/\s+/)
    .filter(part => /^\p{L}/u.test(part))
    .map(part => part[0].toUpperCase());
  return letters.slice(0, 2).join('') || '?';
}
