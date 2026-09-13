import { classRateLabel, classRateLabelClass, formatRate, studentRateLabel, studentRateLabelClass } from '../lib/format';

const RADIUS = 15;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Mirrors classRateLabel/studentRateLabel's own thresholds (lib/format.ts) — duplicated here only
// because an SVG stroke needs an actual color value, not a class name, the same reason
// AttendanceDonutChart.tsx inlines its segment colors rather than deriving them from a mapper.
function classRingColor(rate: number): string {
  if (rate < 50) return 'var(--danger)';
  if (rate < 65) return 'var(--warn)';
  return 'var(--ok)';
}

function studentRingColor(rate: number): string {
  if (rate < 60) return 'var(--danger)';
  if (rate < 80) return 'var(--warn)';
  return 'var(--ok)';
}

interface Props {
  readonly rate: number | null;
  /** 'class' (default) uses the more forgiving class-level thresholds (Classes list rows);
   *  'student' uses the stricter individual thresholds (roster rows) — see lib/format.ts's own
   *  classRateLabel vs studentRateLabel for why these stay two different scales. */
  readonly tier?: 'class' | 'student';
}

/** Compact single-arc attendance indicator — a smaller, single-value cousin of
 *  AttendanceDonutChart's 4-segment ring + legend, used where a whole donut would be too heavy
 *  (a table cell or roster row), not a replacement for it. Used for both class-level rates
 *  (Classes list) and individual student rates (roster rows), so every attendance number in the
 *  app reads as the same "wheel" visual language, all the way up to the Student Profile's own
 *  big donut. */
export default function MiniAttendanceRing({ rate, tier = 'class' }: Props) {
  if (rate === null) {
    return (
      <div className="mini-ring mini-ring--empty">
        <span className="cell-sub">{tier === 'student' ? 'Not available' : 'No data'}</span>
      </div>
    );
  }

  const length = (Math.min(Math.max(rate, 0), 100) / 100) * CIRCUMFERENCE;
  const color = tier === 'student' ? studentRingColor(rate) : classRingColor(rate);
  const label = tier === 'student' ? studentRateLabel(rate) : classRateLabel(rate);
  const labelClass = tier === 'student' ? studentRateLabelClass(rate) : classRateLabelClass(rate);

  return (
    <div className="mini-ring">
      <svg viewBox="0 0 36 36" width="36" height="36" role="img" aria-label={`${rate}% attendance`}>
        <circle cx="18" cy="18" r={RADIUS} fill="none" stroke="var(--line-2)" strokeWidth="4" />
        <circle
          cx="18"
          cy="18"
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
          transform="rotate(-90 18 18)"
        />
      </svg>
      <div className="mini-ring__text">
        <div className="cell-strong mono">{formatRate(rate)}</div>
        <div className={labelClass}>{label}</div>
      </div>
    </div>
  );
}
