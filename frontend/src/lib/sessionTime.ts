const CLASSROOM_TIME_ZONE = 'Pacific/Auckland';

const CLOCK_FROM_ISO = /T(\d{2}):(\d{2})/;

export function formatSessionDateLabel(date: string): string {
  return new Intl.DateTimeFormat('en-NZ', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(`${date}T00:00:00`));
}

export function formatSessionTimeRange(
  startTime: string,
  endTime: string,
  sessionDate: string
): string {
  return `${formatSessionClock(startTime, sessionDate)}–${formatSessionClock(endTime, sessionDate)}`;
}

export function toSessionInstant(date: string, time: string): string {
  return `${date}T${time}:00Z`;
}

// The inverse of toSessionInstant — pulls the "HH:MM" digits straight back out of the instant
// rather than reformatting through a real timezone conversion, since that's how they went in.
export function clockFromInstant(value: string): string {
  const clock = value.match(CLOCK_FROM_ISO);
  return clock ? `${clock[1]}:${clock[2]}` : '';
}

export function formatTimestampClock(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-NZ', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: CLASSROOM_TIME_ZONE
  }).format(date);
}

function formatSessionClock(value: string, sessionDate: string): string {
  const date = new Date(value);
  const localDate = Number.isNaN(date.getTime()) ? '' : formatIsoDateInAuckland(date);
  const utcDate = Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);

  if (localDate === sessionDate && utcDate !== sessionDate) {
    return formatTimestampClock(value);
  }

  const clock = value.match(CLOCK_FROM_ISO);
  return clock ? `${clock[1]}:${clock[2]}` : formatTimestampClock(value);
}

function formatIsoDateInAuckland(date: Date): string {
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
