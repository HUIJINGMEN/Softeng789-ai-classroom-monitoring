import type { AttendanceStatus, EventStatus, FaceEnrollmentStatus, StudentRecordStatus } from '../types';

// "Unknown" is the right internal value (it's what attendanceStatusFor returns and what the
// correction dropdown elsewhere in the app matches against) — it just reads like a system error
// rather than "no one marked this yet" when shown as a label. Shared by every place that renders
// an AttendanceStatus as visible text, so the wording stays the same everywhere.
export function attendanceStatusLabel(status: AttendanceStatus): string {
  return status === 'Unknown' ? 'Not recorded' : status;
}

export function statusClass(
  status:
    | AttendanceStatus
    | EventStatus
    | StudentRecordStatus
    | FaceEnrollmentStatus
    | 'Scheduled'
    | 'Live'
    | 'Completed'
    | 'Cancelled'
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
    case 'Completed':
      return 'badge badge--present';
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
    case 'Cancelled':
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
      return 'Retry needed';
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

// A dedicated palette, deliberately not AVATAR_TONES' status-adjacent tokens — see the
// .course-tile--* rules in theme.css for why.
const COURSE_TILE_TONES = ['course-tile--slate', 'course-tile--rust', 'course-tile--moss', 'course-tile--plum'];

// There's no real "department" or category data behind a course code (Course.name is always set
// equal to Course.code — see CourseLookupService), so this just spreads classes across a fixed
// palette deterministically rather than implying a fake taxonomy.
export const courseTone = (courseCode: string): string => {
  const hash = courseCode.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return COURSE_TILE_TONES[hash % COURSE_TILE_TONES.length];
};

// A per-student read on their own attendance, distinct from the class-level thresholds below
// (AdminLowestAttendanceCard's "is this class doing badly") — this one describes an individual's
// attendance across the ordinary range. Shared by Students.tsx, MyClassDetail.tsx,
// ClassStudentsCard.tsx and ClassOverviewTab.tsx — anywhere a single student's own rate is shown.
export function studentRateLabel(rate: number): string {
  if (rate >= 80) return 'Good';
  if (rate >= 60) return 'Fair';
  return 'Needs attention';
}

export function studentRateLabelClass(rate: number): string {
  if (rate >= 80) return 'rate-quality rate-quality--ok';
  if (rate >= 60) return 'rate-quality rate-quality--warn';
  return 'rate-quality rate-quality--danger';
}

// Class-level attendance quality — a more forgiving bar than an individual student's own
// attendance above (80/60), matching the thresholds AdminLowestAttendanceCard already
// established for "is this class doing badly" at a glance. Used for whole-class aggregates only
// (MiniAttendanceRing, the class detail hero's Attendance stat, the Attendance/Overview tabs'
// donut) — never for a single student's own rate.
export function classRateLabel(rate: number): string {
  if (rate < 50) return 'Needs attention';
  if (rate < 65) return 'Fair';
  return 'Good';
}

export function classRateLabelClass(rate: number): string {
  if (rate < 50) return 'rate-quality rate-quality--danger';
  if (rate < 65) return 'rate-quality rate-quality--warn';
  return 'rate-quality rate-quality--ok';
}

export const confidenceClass = (confidence: number) =>
  confidence >= 0.85
    ? 'conf-fill conf-fill--high'
    : confidence >= 0.7
      ? 'conf-fill conf-fill--medium'
      : 'conf-fill conf-fill--low';

export const confidenceWidthClass = (confidence: number) =>
  `conf-fill--w-${Math.round(confidence * 20) * 5}`;

export const formatRate = (rate: number | null): string =>
  rate === null ? 'Not calculated' : `${rate}%`;

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}
