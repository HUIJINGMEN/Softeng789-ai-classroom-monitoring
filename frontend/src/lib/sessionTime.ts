export const CLASSROOM_TIME_ZONE = 'Pacific/Auckland';

export function formatSessionDateLabel(date: string): string {
  return new Intl.DateTimeFormat('en-NZ', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(`${date}T00:00:00`));
}

export function formatReportDateRange(dateFrom: string, dateTo: string): string {
  const fromLabel = formatSessionDateLabel(dateFrom);
  return dateFrom === dateTo ? fromLabel : `${fromLabel} – ${formatSessionDateLabel(dateTo)}`;
}

export function formatSessionTimeRange(
  startTime: string,
  endTime: string,
  sessionDate: string
): string {
  const fields = sessionTimeFields(startTime, endTime, sessionDate);
  return `${fields.startTime}–${fields.endTime}`;
}

/** Convert a school-local clock to a real instant, independent of the browser's timezone. */
export function toSessionInstant(date: string, time: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error('Choose a valid lesson date and time.');
  }
  const target = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(target) || new Date(target).toISOString().slice(0, 10) !== date) {
    throw new Error('Choose a valid lesson date.');
  }
  // Discover offsets around the date from the timezone database, not hard-coded NZDT/NZST values.
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const probe = new Date(target + hours * 3_600_000);
    const local = `${formatIsoDateInAuckland(probe)}T${formatTimestampClock(probe.toISOString())}:00Z`;
    offsets.add(Date.parse(local) - probe.getTime());
  }
  const matches = [...offsets].map((offset) => new Date(target - offset)).filter((candidate) =>
    formatIsoDateInAuckland(candidate) === date && formatTimestampClock(candidate.toISOString()) === time);
  if (matches.length !== 1) {
    throw new Error('This Auckland time is missing or occurs twice during a daylight-saving change. Choose another time.');
  }
  return matches[0].toISOString();
}

/** Live session timestamps are canonical UTC. Never infer their encoding from the date. */
export function sessionTimeFields(startTime: string, endTime: string, _sessionDate: string) {
  return { startTime: formatTimestampClock(startTime), endTime: formatTimestampClock(endTime) };
}

export function sessionStartClock(startTime: string, _sessionDate?: string): string {
  return formatTimestampClock(startTime);
}

export function formatTimestampClock(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-NZ', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: CLASSROOM_TIME_ZONE
  }).format(date);
}

/** Event and classroom timestamps use the same school timezone. */
export function formatTimestampTimeRange(startTime: string, endTime: string): string {
  return `${formatTimestampClock(startTime)}–${formatTimestampClock(endTime)}`;
}

export function formatIsoDateInAuckland(date: Date): string {
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: CLASSROOM_TIME_ZONE
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : '';
}

/** Inclusive school-calendar range for timestamped records, not UTC string prefixes. */
export function timestampInSchoolDateRange(value: string, from: string, to: string): boolean {
  const date = formatIsoDateInAuckland(new Date(value));
  return date !== '' && (!from || date >= from) && (!to || date <= to);
}

/** Calendar-month subtraction, clamped at month end and independent of the host timezone. */
export function schoolDateMonthsAgo(months: number, now = new Date()): string {
  const today = formatIsoDateInAuckland(now);
  if (!today || !Number.isInteger(months) || months < 0) throw new Error('Choose a valid month range.');
  const [year, month, day] = today.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 - months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}
