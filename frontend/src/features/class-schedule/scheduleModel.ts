import { clockFromInstant } from '../../lib/sessionTime';

/** Session instants store the school's wall-clock digits; do not convert them to browser time. */
export function sortScheduleByTime<T extends { startTime: string }>(sessions: readonly T[]): T[] {
  const ordered = [...sessions];
  ordered.sort((left, right) => clockFromInstant(left.startTime).localeCompare(clockFromInstant(right.startTime)));
  return ordered;
}

export interface ScheduleDateInput {
  startDate: string;
  endDate: string;
  weekdays: readonly number[];
  limit: number | null;
  excludedDates?: ReadonlySet<string>;
}

export interface WeeklyScheduleRuleInput {
  key: string;
  weekday: number;
}

export interface ScheduleOccurrence {
  date: string;
  ruleKey: string;
}

export interface WeeklyScheduleInput {
  startDate: string;
  endDate: string;
  rules: readonly WeeklyScheduleRuleInput[];
  limit: number | null;
  excludedDates?: ReadonlySet<string>;
}

export interface ScheduleAssignment {
  teacherEmail: string;
  campusId: string;
  roomId: string;
}

export interface EditableWeeklyRule {
  seriesId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  override: ScheduleAssignment | null;
}

export interface GeneratedScheduleSession {
  date: string;
  scheduleSeriesId: string;
  roomId: string;
  teacherEmail: string;
  startTime: string;
  endTime: string;
}

export interface ScheduleAvailabilityPayloadModel {
  courseOfferingId: string;
  groups: Array<{
    key: string;
    slots: Array<{ date: string; startTime: string; endTime: string }>;
  }>;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseIsoDate(value: string): Date | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function generateScheduleOccurrences(input: WeeklyScheduleInput): ScheduleOccurrence[] {
  const start = parseIsoDate(input.startDate);
  const end = parseIsoDate(input.endDate);
  if (!start || !end || start > end || input.rules.length === 0) return [];

  const excluded = input.excludedDates ?? new Set<string>();
  const result: ScheduleOccurrence[] = [];
  const cursor = new Date(start);
  const safeLimit = input.limit && input.limit > 0 ? Math.min(input.limit, 200) : 200;

  while (cursor <= end && result.length < safeLimit) {
    const date = isoDate(cursor);
    if (!excluded.has(date)) {
      const rulesForDay = input.rules.filter((rule) => rule.weekday === cursor.getUTCDay());
      for (const rule of rulesForDay) {
        if (result.length >= safeLimit) break;
        result.push({ date, ruleKey: rule.key });
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

export function generateScheduleDates(input: ScheduleDateInput): string[] {
  const weekdays = [...new Set(input.weekdays)];
  return generateScheduleOccurrences({
    startDate: input.startDate,
    endDate: input.endDate,
    rules: weekdays.map((weekday) => ({ key: String(weekday), weekday })),
    limit: input.limit,
    excludedDates: input.excludedDates
  }).map((occurrence) => occurrence.date);
}

export function formatScheduleDate(value: string): string {
  const date = parseIsoDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat('en-NZ', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date);
}

export function scheduleDateRangeLabel(dates: readonly string[]): string {
  if (dates.length === 0) return 'No dates generated';
  if (dates.length === 1) return formatScheduleDate(dates[0]);
  return `${formatScheduleDate(dates[0])} – ${formatScheduleDate(dates[dates.length - 1])}`;
}

export function addScheduleDays(value: string, days: number): string {
  const date = parseIsoDate(value);
  if (!date) return value;
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

export function scheduleWeekStart(value: string): string {
  const date = parseIsoDate(value);
  if (!date) return value;
  const weekday = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
  return isoDate(date);
}

export function scheduleWeekDates(weekStart: string): string[] {
  const start = parseIsoDate(weekStart);
  if (!start) return [];
  return Array.from({ length: 7 }, (_, index) => addScheduleDays(weekStart, index));
}

export function initialScheduleWeekStart(sessionDates: readonly string[], today: string): string {
  const validDates = sessionDates.filter((value) => parseIsoDate(value));
  validDates.sort((left, right) => left.localeCompare(right));
  const currentWeek = scheduleWeekStart(today);
  const currentWeekEnd = addScheduleDays(currentWeek, 6);
  if (validDates.some((value) => value >= currentWeek && value <= currentWeekEnd)) return currentWeek;
  const nextDate = validDates.find((value) => value >= today);
  return scheduleWeekStart(nextDate ?? validDates[validDates.length - 1] ?? today);
}

export function scheduleWeekRangeLabel(weekStart: string): string {
  const dates = scheduleWeekDates(weekStart);
  if (dates.length === 0) return weekStart;
  const start = parseIsoDate(dates[0]);
  const end = parseIsoDate(dates[6]);
  if (!start || !end) return weekStart;
  const formatter = new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

export function defaultScheduleEndDate(startDate: string): string {
  const date = parseIsoDate(startDate);
  if (!date) return startDate;
  date.setUTCMonth(date.getUTCMonth() + 3);
  date.setUTCDate(date.getUTCDate() - 1);
  return isoDate(date);
}

export function scheduleWeekdayRank(weekday: number): number {
  return weekday === 0 ? 7 : weekday;
}

export function availabilityDatesLabel(dates: readonly string[]): string {
  const visible = dates.slice(0, 2).map(formatScheduleDate).join(', ');
  const remaining = dates.length - 2;
  return remaining > 0 ? `${visible} +${remaining} more` : visible;
}

export function buildScheduleSessions(
  occurrences: readonly ScheduleOccurrence[],
  rules: readonly EditableWeeklyRule[],
  defaults: ScheduleAssignment
): GeneratedScheduleSession[] {
  const ruleByWeekday = new Map(rules.map((rule) => [String(rule.weekday), rule]));
  return occurrences.flatMap((occurrence) => {
    const rule = ruleByWeekday.get(occurrence.ruleKey);
    if (!rule) return [];
    const assignment = rule.override ?? defaults;
    return [{
      date: occurrence.date,
      scheduleSeriesId: rule.seriesId,
      roomId: assignment.roomId,
      teacherEmail: assignment.teacherEmail,
      startTime: rule.startTime,
      endTime: rule.endTime
    }];
  });
}

export function buildScheduleAvailabilityPayload(
  courseOfferingId: string,
  occurrences: readonly ScheduleOccurrence[],
  rules: readonly EditableWeeklyRule[]
): ScheduleAvailabilityPayloadModel {
  const ruleByWeekday = new Map(rules.map((rule) => [String(rule.weekday), rule]));
  const groups = new Map<string, ScheduleAvailabilityPayloadModel['groups'][number]>();
  occurrences.forEach((occurrence) => {
    const rule = ruleByWeekday.get(occurrence.ruleKey);
    if (!rule || rule.endTime <= rule.startTime) return;
    const key = rule.override ? `day-${rule.weekday}` : 'default';
    const group = groups.get(key) ?? { key, slots: [] };
    group.slots.push({ date: occurrence.date, startTime: rule.startTime, endTime: rule.endTime });
    groups.set(key, group);
  });
  return { courseOfferingId, groups: [...groups.values()] };
}
