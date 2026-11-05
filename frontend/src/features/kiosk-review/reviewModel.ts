import { ApiError, apiMessage } from '../../lib/apiClient';
import { CLASSROOM_TIME_ZONE } from '../../lib/sessionTime';
import type {
  KioskAttemptResult,
  KioskReviewItem,
  KioskReviewKind,
  KioskReviewResolution
} from './types';

export const NOTE_MAX = 500;

export const RESOLUTIONS: readonly { value: KioskReviewResolution; label: string; hint: string }[] = [
  { value: 'VERIFIED_CORRECT', label: 'Verified correct', hint: 'The evidence shows the right student. No change needed.' },
  { value: 'ATTENDANCE_CORRECTED', label: 'Attendance corrected', hint: 'I fixed the mark in the session register.' },
  { value: 'NO_ACTION', label: 'No action', hint: 'Close the review without a finding.' }
];

export function kindLabel(kind: KioskReviewKind): string {
  return kind === 'NOT_ENROLLED_ATTEMPT' ? 'Not-enrolled attempt' : 'Candidate selection mismatch';
}

/** Neutral wording: a mismatch is a prompt to check the evidence, not a finding of misconduct. */
export function kindExplanation(item: KioskReviewItem): string {
  if (item.kind === 'NOT_ENROLLED_ATTEMPT') {
    return 'The student chose a name that was not actively enrolled when they confirmed. No attendance was recorded.';
  }
  const rank = item.selectedRank === 3 ? 'third' : 'second';
  return `The student chose the ${rank} match instead of the top match. Attendance was recorded under the chosen name; check the evidence before changing anything.`;
}

export function resultLabel(result: KioskAttemptResult, status: 'PRESENT' | 'LATE' | null): string {
  const mark = status === 'LATE' ? 'Late' : status === 'PRESENT' ? 'Present' : '';
  switch (result) {
    case 'CONFIRMED': return mark ? `Recorded as ${mark}` : 'Recorded';
    case 'ALREADY_RECORDED': return mark ? `Already ${mark}; no change` : 'Already recorded; no change';
    case 'BLOCKED_NOT_ENROLLED': return 'Blocked; nothing recorded';
    default: return result;
  }
}

export function resolutionLabel(resolution: KioskReviewResolution | null): string {
  return RESOLUTIONS.find(option => option.value === resolution)?.label ?? 'Open';
}

export function studentLabel(student: { name: string; studentNumber: string | null } | null): string {
  if (!student) return '—';
  return student.studentNumber ? `${student.name} (${student.studentNumber})` : student.name;
}

/** School-timezone date and time, independent of the admin's device timezone. */
export function formatReviewTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: CLASSROOM_TIME_ZONE
  }).format(date);
}

export function noteError(note: string): string | null {
  return note.trim().length > NOTE_MAX ? `Keep the note to ${NOTE_MAX} characters or fewer.` : null;
}

export function resolveErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'REVIEW_ALREADY_RESOLVED') {
    return 'Another admin already resolved this review differently. Refresh to see the current result.';
  }
  return apiMessage(error);
}

export function evidenceErrorMessage(error: unknown): string {
  if (error instanceof ApiError && (error.code === 'EVIDENCE_EXPIRED' || error.status === 410)) {
    return 'The evidence photo was deleted after 30 days. The log entry remains.';
  }
  return `The evidence photo could not be loaded: ${apiMessage(error)}`;
}
