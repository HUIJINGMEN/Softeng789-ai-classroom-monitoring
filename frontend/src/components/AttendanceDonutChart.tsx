import { useMemo } from 'react';

const DONUT_RADIUS = 50;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

export interface AttendanceBreakdown {
  present: number;
  late: number;
  absent: number;
  unknown: number;
  total: number;
  rate: number | null;
}

interface Props {
  readonly attendance: AttendanceBreakdown;
  readonly emptyTitle: string;
  readonly emptyHint: string;
  readonly rateLabel?: string;
  /** Full-width summary cards can use the available horizontal space for a four-column legend.
   *  Compact remains the default for dashboard sidebars and paired report sections. */
  readonly layout?: 'compact' | 'wide';
  /** Optional one-line caveat shown under the legend — e.g. "Based on 4 completed sessions",
   *  for callers whose `attendance` total is scoped to a subset of a larger picture (class-level
   *  aggregates only count Completed sessions — see lib/classRows.ts). Omitted by callers whose
   *  scope is already unambiguous (today's system-wide totals, one student's whole history). */
  readonly note?: string;
}

/** The present/late/absent/not-recorded ring + legend, shared by AdminAttendanceOverviewCard
 *  (today's attendance, system-wide) and StudentProfile's own Attendance Summary (one student,
 *  all-time) — same visual language, different scope of data. */
export default function AttendanceDonutChart({
  attendance,
  emptyTitle,
  emptyHint,
  rateLabel = 'attendance',
  layout = 'compact',
  note
}: Props) {
  const donutSegments = useMemo(() => {
    const lengthFor = (value: number) =>
      attendance.total === 0 ? 0 : (value / attendance.total) * DONUT_CIRCUMFERENCE;
    const percentFor = (value: number) =>
      attendance.total === 0 ? 0 : Math.round((value / attendance.total) * 100);
    const presentLength = lengthFor(attendance.present);
    const lateLength = lengthFor(attendance.late);
    const absentLength = lengthFor(attendance.absent);
    const unknownLength = lengthFor(attendance.unknown);
    return [
      {
        key: 'present',
        label: 'Present',
        value: attendance.present,
        percent: percentFor(attendance.present),
        color: 'var(--ok)',
        length: presentLength,
        offset: 0
      },
      {
        key: 'late',
        label: 'Late',
        value: attendance.late,
        percent: percentFor(attendance.late),
        color: 'var(--warn)',
        length: lateLength,
        offset: presentLength
      },
      {
        key: 'absent',
        label: 'Absent',
        value: attendance.absent,
        percent: percentFor(attendance.absent),
        color: 'var(--danger)',
        length: absentLength,
        offset: presentLength + lateLength
      },
      {
        key: 'unknown',
        label: 'Not recorded',
        value: attendance.unknown,
        percent: percentFor(attendance.unknown),
        color: 'var(--muted-2)',
        length: unknownLength,
        offset: presentLength + lateLength + absentLength
      }
    ];
  }, [attendance]);

  if (attendance.total === 0) {
    return (
      <div className="empty empty--inline attendance-summary-empty">
        <div className="empty__title">{emptyTitle}</div>
        <div className="empty__hint">{emptyHint}</div>
      </div>
    );
  }

  return (
    <div className={`donut-overview donut-overview--${layout}`}>
      <div className="donut-chart">
        <svg
          viewBox="0 0 120 120"
          role="img"
          aria-label={`${rateLabel} ${attendance.rate === null ? 'not calculated' : `${attendance.rate} percent`}. ${attendance.present} present, ${attendance.late} late, ${attendance.absent} absent, ${attendance.unknown} not recorded.`}
        >
          <circle cx="60" cy="60" r={DONUT_RADIUS} fill="none" stroke="var(--line-2)" strokeWidth="14" />
          {donutSegments.map((segment) => (
            <circle
              key={segment.key}
              cx="60"
              cy="60"
              r={DONUT_RADIUS}
              fill="none"
              stroke={segment.color}
              strokeWidth="14"
              strokeDasharray={`${segment.length} ${DONUT_CIRCUMFERENCE - segment.length}`}
              strokeDashoffset={-segment.offset}
              transform="rotate(-90 60 60)"
            />
          ))}
        </svg>
        <div className="donut-chart__center">
          <div className="donut-chart__rate">{attendance.rate === null ? '—' : `${attendance.rate}%`}</div>
          <div className="donut-chart__label">{attendance.rate === null ? 'not calculated' : rateLabel}</div>
        </div>
      </div>
      <div className="donut-legend">
        {donutSegments.map((segment) => (
          <div key={segment.key} className="donut-legend__item">
            <span className="donut-legend__dot" style={{ background: segment.color }} />
            <span className="donut-legend__label">{segment.label}</span>
            <span className="donut-legend__value">{segment.value}</span>
            <span className="donut-legend__percent">{segment.percent}%</span>
          </div>
        ))}
        {note && <div className="donut-legend__note">{note}</div>}
      </div>
    </div>
  );
}
