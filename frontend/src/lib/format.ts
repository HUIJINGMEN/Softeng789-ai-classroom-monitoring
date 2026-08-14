import type { AttendanceStatus, EventStatus, FaceEnrollmentStatus, StudentRecordStatus } from '../types';

export function statusClass(
  status: AttendanceStatus | EventStatus | StudentRecordStatus | FaceEnrollmentStatus | 'Scheduled' | 'Live' | 'Completed'
): string {
  switch (status) {
    case 'Live':
      return 'badge badge--live';
    case 'Pending Review':
      return 'badge badge--pending-review';
    case 'Confirmed':
      return 'badge badge--confirmed';
    case 'Rejected':
      return 'badge badge--rejected';
    case 'Corrected':
      return 'badge badge--corrected';
    case 'PHOTO_CAPTURED':
      return 'badge badge--corrected';
    case 'Present':
    case 'Active':
      return 'badge badge--present';
    case 'Late':
    case 'Enrolment pending':
      return 'badge badge--late';
    case 'Absent':
    case 'At risk':
    case 'FAILED':
      return 'badge badge--absent';
    case 'NOT_ENROLLED':
    case 'Scheduled':
    case 'Unknown':
      return 'badge badge--neutral';
    default:
      return 'badge badge--neutral';
  }
}

export function faceEnrollmentLabel(status: FaceEnrollmentStatus | undefined): string {
  switch (status) {
    case 'PHOTO_CAPTURED':
      return 'Photo captured';
    case 'FAILED':
      return 'Failed';
    case 'NOT_ENROLLED':
    default:
      return 'Not enrolled';
  }
}

export const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const AVATAR_TONES = [
  'person__avatar--blue',
  'person__avatar--green',
  'person__avatar--yellow',
  'person__avatar--neutral'
];

export const avatarTone = (studentId: string, index: number) =>
  AVATAR_TONES[(studentId.charCodeAt(8) + index) % AVATAR_TONES.length];

export const confidenceColor = (confidence: number) =>
  confidence >= 0.85 ? 'var(--ok)' : confidence >= 0.7 ? 'var(--accent)' : 'var(--warn)';

export const rateColor = (rate: number) =>
  rate >= 90 ? 'var(--ok)' : rate >= 80 ? 'var(--accent)' : 'var(--warn)';

export const confidenceClass = (confidence: number) =>
  confidence >= 0.85
    ? 'conf-fill conf-fill--high'
    : confidence >= 0.7
      ? 'conf-fill conf-fill--medium'
      : 'conf-fill conf-fill--low';

export const confidenceWidthClass = (confidence: number) =>
  `conf-fill--w-${Math.round(confidence * 20) * 5}`;

export const rateClass = (rate: number) =>
  rate >= 90 ? 'meter__fill meter__fill--high' : rate >= 80 ? 'meter__fill meter__fill--medium' : 'meter__fill meter__fill--low';

export const rateWidthClass = (rate: number) => `meter__fill--w-${rate}`;
