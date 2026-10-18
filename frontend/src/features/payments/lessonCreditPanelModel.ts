import { formatSessionTimeRange } from '../../lib/sessionTime';
import { formatPaymentDate } from './format';
import type { AbsenceReason, MakeupOption, ReconciliationCell } from './types';

export const ABSENCE_REASONS: ReadonlyArray<{ value: AbsenceReason; label: string }> = [
  { value: 'ILLNESS', label: 'Sick / medical' },
  { value: 'ADVANCE_NOTICE', label: 'Approved leave / advance notice' },
  { value: 'NO_NOTICE', label: 'No notice / no-show' },
  { value: 'SCHOOL_CANCELLED', label: 'Class cancelled by school' },
  { value: 'OTHER', label: 'Other' }
];

export const ATTENDANCE_OPTIONS: ReadonlyArray<{
  value: ReconciliationCell['attendanceStatus'];
  label: string;
}> = [
  { value: 'PRESENT', label: 'Present' },
  { value: 'LATE', label: 'Late' },
  { value: 'ABSENT', label: 'Absent' },
  { value: 'UNKNOWN', label: 'Not recorded' }
];

export function makeupOptionLabel(option: MakeupOption) {
  const time = formatSessionTimeRange(option.startTime, option.endTime, option.date);
  return `${formatPaymentDate(option.date)} · ${time} · ${option.room}`;
}
