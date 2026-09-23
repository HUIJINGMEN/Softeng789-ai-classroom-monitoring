import { sessionRoomLabel } from './sessionLabels';
import { ALL_ROOMS } from './attendanceAnalytics';
import type { Session } from '../types';

export interface ChartPoint {
  label: string;
  sub: string;
  rate: number;
  present: number;
  pending: number;
}

/** Shared by every "attendance trend" chart (teacher Dashboard, Admin Dashboard) so the course/room
 * filtering and axis labeling behave identically wherever the chart appears. */
export function chartSessionLabel(session: Pick<Session, 'room' | 'campusName' | 'course'>): string {
  return sessionRoomLabel(session) || session.course;
}

export function formatChartRange(sessions: readonly Session[]): string {
  if (sessions.length === 0) return 'No sessions';
  if (sessions.length === 1) return sessions[0].dateLabel;
  return `${sessions[0].dateLabel} – ${sessions[sessions.length - 1].dateLabel}`;
}

export function buildRoomOptions(sessions: readonly Session[]) {
  return [
    { value: ALL_ROOMS, label: ALL_ROOMS },
    ...Array.from(new Set(sessions.map((session) => sessionRoomLabel(session))))
      .sort((left, right) => left.localeCompare(right))
      .map((room) => ({ value: room, label: room }))
  ];
}

const LEFT = 40;
const TOP = 18;
const BOTTOM = 134;

export function buildChart(points: ChartPoint[], width = 340) {
  const count = points.length;
  const right = Math.max(LEFT + 96, width - 8);
  const x = (i: number) => LEFT + 16 + i * ((right - LEFT - 32) / Math.max(1, count - 1));
  const y = (value: number) => BOTTOM - (value / 100) * (BOTTOM - TOP);

  return {
    axisLeft: LEFT,
    axisRight: right,
    axisY: BOTTOM,
    grid: [100, 75, 50, 25, 0].map((value) => ({ y: y(value), label: `${value}%` })),
    bars: points.map((p, i) => ({
      x: x(i) - 15,
      y: y(p.rate),
      height: BOTTOM - y(p.rate),
      isLatest: i === count - 1
    })),
    line: points.map((p, i) => `${x(i)},${y(p.rate)}`).join(' '),
    dots: points.map((p, i) => ({ cx: x(i), cy: y(p.rate) })),
    ticks: points.map((p, i) => ({ x: x(i), label: p.label, sub: p.sub })),
    hotspots: points.map((_, i) => ({ x: x(i) - 24, index: i })),
    tooltipFor: (index: number) => ({
      x: Math.min(x(index) - 62, right - 132),
      y: Math.max(y(points[index].rate) - 62, 4),
      dotX: x(index),
      dotY: y(points[index].rate),
      line1: `${points[index].sub} · ${points[index].rate}% attendance`,
      line2: `${points[index].present} present · ${points[index].pending} candidate events`
    })
  };
}

/** Normalised polyline points for a 100×26 sparkline viewBox. */
export function sparkline(values: number[]): string {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(1, max - min);
  return values
    .map((value, i) => {
      const x = (i * (94 / Math.max(1, values.length - 1)) + 3).toFixed(1);
      const y = (23 - ((value - min) / span) * 18).toFixed(1);
      return `${x},${y}`;
    })
    .join(' ');
}
