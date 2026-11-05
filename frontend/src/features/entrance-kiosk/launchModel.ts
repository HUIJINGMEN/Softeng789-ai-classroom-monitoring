import { ApiError, apiMessage } from '../../lib/apiClient';
import { formatTimestampClock } from '../../lib/sessionTime';
import type {
  AttemptState,
  KioskEndReason,
  KioskReviewKind,
  KioskSessionSummary,
  LaunchBlockedReason,
  LaunchRequest,
  LaunchSession
} from './types';

export const LOCATION_MIN = 2;
export const LOCATION_MAX = 80;
export const DEFAULT_LATE_MINUTES = 10;

export interface ClassOption {
  offeringId: string;
  classLabel: string;
  course: string;
  sessionCount: number;
  launchableCount: number;
}

/** One option per class, keeping the server's scope: a teacher only receives their own classes. */
export function classOptions(sessions: readonly LaunchSession[]): ClassOption[] {
  const byOffering = new Map<string, ClassOption>();
  for (const session of sessions) {
    const current = byOffering.get(session.offeringId) ?? {
      offeringId: session.offeringId,
      classLabel: session.classLabel,
      course: session.course,
      sessionCount: 0,
      launchableCount: 0
    };
    current.sessionCount += 1;
    if (session.launchable) current.launchableCount += 1;
    byOffering.set(session.offeringId, current);
  }
  return [...byOffering.values()].sort((a, b) => a.classLabel.localeCompare(b.classLabel));
}

export function sessionsForClass(sessions: readonly LaunchSession[], offeringId: string): LaunchSession[] {
  return sessions
    .filter(session => session.offeringId === offeringId)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function sessionOptionLabel(session: LaunchSession): string {
  const time = `${formatTimestampClock(session.startTime)}–${formatTimestampClock(session.endTime)}`;
  const room = session.roomName ? ` · ${session.roomName}` : '';
  const blocked = session.launchable || !session.blockedReason ? '' : ` — ${blockedReasonLabel(session.blockedReason)}`;
  return `${time}${room}${blocked}`;
}

export function blockedReasonLabel(reason: LaunchBlockedReason | string): string {
  switch (reason) {
    case 'CANCELLED': return 'Session cancelled';
    case 'WINDOW_CLOSED': return 'Session has ended';
    case 'TOO_EARLY': return 'Opens 2 hours before class';
    case 'NO_CLASS': return 'No class assigned';
    case 'ROSTER_TOO_LARGE': return 'More than 30 students';
    case 'NO_FACE_READY_STUDENTS': return 'No students with face check-in set up';
    case 'RECOGNITION_DISABLED': return 'Face recognition is not configured';
    default: return 'Not available';
  }
}

export function normalizeLocation(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function locationError(value: string): string | null {
  const label = normalizeLocation(value);
  if (/[\u0000-\u001f\u007f]/.test(value)) return 'Use letters, numbers and spaces only.';
  if (label.length < LOCATION_MIN) return 'Enter where the kiosk is, for example “Main entrance”.';
  if (label.length > LOCATION_MAX) return `Keep the location to ${LOCATION_MAX} characters or fewer.`;
  return null;
}

export function lateMinutesError(enabled: boolean, value: string): string | null {
  if (!enabled) return null;
  if (!/^\d{1,2}$/.test(value.trim())) return 'Enter whole minutes from 0 to 60.';
  const minutes = Number(value);
  return minutes >= 0 && minutes <= 60 ? null : 'Enter whole minutes from 0 to 60.';
}

export interface LaunchForm {
  campusId: string;
  session: LaunchSession | null;
  location: string;
  lateEnabled: boolean;
  lateMinutes: string;
  deviceConfirmed: boolean;
}

export type LaunchDraft = { ok: true; request: LaunchRequest } | { ok: false; error: string };

export function buildLaunchRequest(form: LaunchForm): LaunchDraft {
  if (!form.campusId) return { ok: false, error: 'Choose a campus.' };
  if (!form.session) return { ok: false, error: 'Choose a class session.' };
  if (!form.session.launchable) {
    return { ok: false, error: form.session.blockedReason ? blockedReasonLabel(form.session.blockedReason) : 'This session cannot use a kiosk.' };
  }
  if (form.session.campusId && form.session.campusId !== form.campusId) {
    return { ok: false, error: 'This session is held at a different campus.' };
  }
  const location = locationError(form.location);
  if (location) return { ok: false, error: location };
  const late = lateMinutesError(form.lateEnabled, form.lateMinutes);
  if (late) return { ok: false, error: late };
  if (!form.deviceConfirmed) return { ok: false, error: 'Confirm that this browser will become the kiosk.' };
  return {
    ok: true,
    request: {
      sessionId: form.session.sessionId,
      campusId: form.campusId,
      locationLabel: normalizeLocation(form.location),
      lateAfterMinutes: form.lateEnabled ? Number(form.lateMinutes) : null,
      deviceConfirmed: true
    }
  };
}

export function launchErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'SESSION_NOT_LAUNCHABLE') {
      return error.reason ? `${blockedReasonLabel(error.reason)}. Choose another session.` : 'This session cannot use a kiosk now.';
    }
    if (error.code === 'RECOGNITION_UNAVAILABLE' || error.status === 503) {
      return 'Face recognition is not configured on this server. Use manual attendance.';
    }
    if (error.code === 'KIOSK_SCOPE') return 'This browser is already in kiosk mode. Refresh the page.';
    if (error.status === 403) return 'You can only start a kiosk for classes you teach.';
  }
  return apiMessage(error);
}

export function endReasonLabel(reason: KioskEndReason | null): string {
  switch (reason) {
    case 'DEVICE_EXIT': return 'Exited on the device';
    case 'STAFF_ENDED': return 'Ended by staff';
    case 'EXPIRED': return 'Expired';
    case 'ACCESS_LOST': return 'Stopped: staff access changed';
    default: return 'Ended';
  }
}

export function kioskStatusLabel(kiosk: KioskSessionSummary): string {
  return kiosk.endedAt ? endReasonLabel(kiosk.endReason) : 'Active';
}

export function activeKiosks(kiosks: readonly KioskSessionSummary[]): KioskSessionSummary[] {
  return kiosks.filter(kiosk => !kiosk.endedAt);
}

export function attemptStateLabel(state: AttemptState): string {
  switch (state) {
    case 'CONFIRMED': return 'Checked in';
    case 'ALREADY_RECORDED': return 'Already recorded';
    case 'BLOCKED_NOT_ENROLLED': return 'Blocked: not enrolled';
    case 'ATTENDANCE_LOCKED': return 'Blocked: attendance already set';
    case 'NO_FACE': return 'No face seen';
    case 'MULTIPLE_FACES': return 'More than one face';
    case 'LOW_QUALITY': return 'Photo unclear';
    case 'NO_CANDIDATE': return 'No match in class list';
    case 'AWAITING_SELECTION': return 'Choosing';
    case 'STALE': return 'Retake needed';
    case 'SESSION_CLOSED': return 'Check-in closed';
    case 'CANCELLED_NOT_LISTED': return 'Not in the list';
    case 'CANCELLED_TIMEOUT': return 'Timed out';
    case 'SUPERSEDED': return 'Replaced by a new scan';
    case 'EXPIRED': return 'Expired';
    default: return state;
  }
}

export function reviewKindLabel(kind: KioskReviewKind): string {
  return kind === 'NOT_ENROLLED_ATTEMPT' ? 'Not-enrolled attempt' : 'Candidate selection mismatch';
}
