export interface ChartPoint {
  label: string;
  sub: string;
  rate: number;
  present: number;
  pending: number;
}

const LEFT = 40;
const RIGHT = 332;
const TOP = 18;
const BOTTOM = 134;

export function buildChart(points: ChartPoint[]) {
  const count = points.length;
  const x = (i: number) => LEFT + 16 + i * ((RIGHT - LEFT - 32) / Math.max(1, count - 1));
  const y = (value: number) => BOTTOM - (value / 100) * (BOTTOM - TOP);

  return {
    axisLeft: LEFT,
    axisRight: RIGHT,
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
      x: Math.min(x(index) - 62, RIGHT - 132),
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
