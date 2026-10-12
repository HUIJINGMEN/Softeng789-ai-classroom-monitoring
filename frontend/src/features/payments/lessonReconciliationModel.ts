import type {
  LessonCreditStatus,
  ReconciliationCell,
  ReconciliationSession
} from './types';

export function startOfIsoWeek(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

export function shiftIsoWeek(weekStart: string, amount: number) {
  const date = new Date(`${weekStart}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount * 7);
  return date.toISOString().slice(0, 10);
}

export function endOfIsoWeek(weekStart: string) {
  const date = new Date(`${startOfIsoWeek(weekStart)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 6);
  return date.toISOString().slice(0, 10);
}

export function nearestTeachingWeek(sessionDates: readonly string[], todayIso: string) {
  const dates = [...new Set(sessionDates.filter(Boolean))].sort();
  const currentWeek = startOfIsoWeek(todayIso);
  const currentWeekEnd = endOfIsoWeek(currentWeek);

  if (dates.some((date) => date >= currentWeek && date <= currentWeekEnd)) return currentWeek;

  const nextLesson = dates.find((date) => date > currentWeekEnd);
  if (nextLesson) return startOfIsoWeek(nextLesson);

  const mostRecentLesson = dates[dates.length - 1];
  return mostRecentLesson ? startOfIsoWeek(mostRecentLesson) : currentWeek;
}

export function lessonCreditLabel(status: LessonCreditStatus | null, makeupDate?: string | null) {
  switch (status) {
    case 'PENDING_PAYMENT': return 'Awaiting payment';
    case 'AVAILABLE': return 'Not scheduled';
    case 'BOOKED': return 'Booked';
    case 'USED': return 'Completed';
    case 'COUNTED_ABSENCE': return 'Lesson charged';
    case 'MAKEUP_DUE': return 'Choose make-up';
    case 'MAKEUP_SCHEDULED': return makeupDate ? `Make-up ${shortDate(makeupDate)}` : 'Make-up booked';
    case 'EXPIRED': return 'Expired';
    case 'VOID': return 'Void';
    default: return 'Not covered';
  }
}

function absenceLabel(reason: ReconciliationCell['absenceReason']) {
  if (reason === 'ILLNESS') return { label: 'Sick', symbol: 'S', tone: 'sick' };
  if (reason === 'ADVANCE_NOTICE') return { label: 'Approved leave', symbol: 'L', tone: 'leave' };
  if (reason === 'NO_NOTICE') return { label: 'No-show', symbol: '×', tone: 'absent' };
  if (reason === 'SCHOOL_CANCELLED') return { label: 'Class cancelled', symbol: '–', tone: 'cancelled' };
  return { label: 'Absent', symbol: '×', tone: 'absent' };
}

function creditOutcome(cell: ReconciliationCell) {
  if (cell.uncoveredAttendance) return { label: 'Not covered', tone: 'uncovered' };
  switch (cell.creditStatus) {
    case 'PENDING_PAYMENT': return { label: 'Payment due', tone: 'due' };
    case 'AVAILABLE':
    case 'BOOKED': return { label: 'Covered', tone: 'covered' };
    case 'USED': return { label: 'Used', tone: 'used' };
    case 'COUNTED_ABSENCE': return { label: 'Lesson charged', tone: 'charged' };
    case 'MAKEUP_DUE': return { label: 'Make-up due', tone: 'makeup-due' };
    case 'MAKEUP_SCHEDULED': return {
      label: cell.makeupSessionDate ? `Make-up ${shortDate(cell.makeupSessionDate)}` : 'Make-up booked',
      tone: 'makeup'
    };
    case 'EXPIRED': return { label: 'Expired', tone: 'expired' };
    case 'VOID': return { label: 'No charge', tone: 'neutral' };
    default: return { label: 'No coverage', tone: 'uncovered' };
  }
}

export function lessonCellView(session: ReconciliationSession, cell: ReconciliationCell) {
  if (session.status === 'CANCELLED') {
    const outcome = cell.creditStatus === 'MAKEUP_DUE'
      ? { label: 'Make-up due', tone: 'makeup-due' }
      : { label: 'No charge', tone: 'neutral' };
    return { attendance: 'Cancelled', symbol: '–', outcome: outcome.label, outcomeTone: outcome.tone, tone: 'cancelled', attention: cell.creditStatus === 'MAKEUP_DUE' };
  }
  if (session.status === 'SCHEDULED' && cell.attendanceStatus === 'UNKNOWN') {
    const outcome = creditOutcome(cell);
    return {
      attendance: 'Upcoming', symbol: '·', outcome: outcome.label, outcomeTone: outcome.tone,
      tone: 'upcoming', attention: outcome.tone === 'due' || outcome.tone === 'uncovered'
    };
  }
  if (session.status === 'ACTIVE' && cell.attendanceStatus === 'UNKNOWN') {
    return { attendance: 'In progress', symbol: '·', outcome: '', outcomeTone: 'neutral', tone: 'upcoming', attention: false };
  }
  const attendanceView = cell.attendanceStatus === 'ABSENT'
    ? absenceLabel(cell.absenceReason)
    : {
        PRESENT: { label: 'Present', symbol: '✓', tone: 'present' },
        LATE: { label: 'Late', symbol: '◷', tone: 'late' },
        UNKNOWN: { label: 'Not recorded', symbol: '?', tone: 'unknown' }
      }[cell.attendanceStatus];
  const outcome = cell.attendanceStatus === 'UNKNOWN'
    ? { label: 'Record attendance', tone: 'missing' }
    : creditOutcome(cell);
  return {
    attendance: attendanceView.label,
    symbol: attendanceView.symbol,
    outcome: outcome.label,
    outcomeTone: outcome.tone,
    tone: attendanceView.tone,
    attention: cell.attendanceStatus === 'UNKNOWN'
      || cell.uncoveredAttendance
      || cell.creditStatus === 'PENDING_PAYMENT'
      || cell.creditStatus === 'MAKEUP_DUE'
  };
}

export function shortDate(isoDate: string) {
  return new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short' })
    .format(new Date(`${isoDate}T12:00:00`));
}

export function weekRangeLabel(start: string, end: string) {
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  const startLabel = new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short' }).format(startDate);
  const endLabel = new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric', month: 'short', year: 'numeric'
  }).format(endDate);
  return `${startLabel} – ${endLabel}`;
}

export function lessonEventLabel(eventType: string) {
  const labels: Record<string, string> = {
    CREATED: 'Lesson credit created',
    PAYMENT_ACTIVATED: 'Payment confirmed',
    LESSON_BOOKED: 'Lesson booked',
    ATTENDANCE_RECORDED: 'Lesson attended',
    ABSENCE_COUNTED: 'Absence counted',
    MAKEUP_APPROVED: 'Make-up approved',
    MAKEUP_SCHEDULED: 'Make-up scheduled',
    MAKEUP_RESCHEDULED: 'Make-up date changed',
    MAKEUP_CANCELLED: 'Make-up booking cancelled',
    MAKEUP_COMPLETED: 'Make-up completed',
    SESSION_CANCELLED: 'Class cancelled',
    MANUAL_ADJUSTMENT: 'Credit adjusted'
  };
  return labels[eventType] ?? eventType;
}
