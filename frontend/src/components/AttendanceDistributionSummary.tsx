import { useId, useMemo } from 'react';
import { formatRate } from '../lib/format';
import type { AttendanceBreakdown } from './AttendanceDonutChart';

interface Props {
  readonly attendance: AttendanceBreakdown;
  readonly emptyTitle: string;
  readonly emptyHint: string;
  readonly rateDescription: string;
}

const SEGMENTS = [
  { key: 'present', label: 'Present', className: 'class-attendance-distribution__segment--present' },
  { key: 'late', label: 'Late', className: 'class-attendance-distribution__segment--late' },
  { key: 'absent', label: 'Absent', className: 'class-attendance-distribution__segment--absent' },
  { key: 'unknown', label: 'Not recorded', className: 'class-attendance-distribution__segment--unknown' }
] as const;

/** Compact status distribution shared by class attendance and report overview cards. */
export default function AttendanceDistributionSummary({
  attendance,
  emptyTitle,
  emptyHint,
  rateDescription
}: Props) {
  const clipId = useId();
  const segments = useMemo(() => {
    let offset = 0;
    return SEGMENTS.map((segment) => {
      const value = attendance[segment.key];
      const width = attendance.total > 0 ? (value / attendance.total) * 100 : 0;
      const result = {
        ...segment,
        value,
        percent: attendance.total > 0 ? Math.round((value / attendance.total) * 100) : 0,
        offset,
        width
      };
      offset += width;
      return result;
    });
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
    <div className="class-attendance-overview">
      <div className="class-attendance-overview__lead">
        <strong>{formatRate(attendance.rate)}</strong>
        <span>Attendance rate</span>
        <p>{rateDescription}</p>
      </div>

      <div className="class-attendance-overview__detail">
        <div className="class-attendance-overview__detail-head">
          <span>Status distribution</span>
          <span>{attendance.total} total marks</span>
        </div>
        <svg
          className="class-attendance-distribution"
          viewBox="0 0 100 8"
          preserveAspectRatio="none"
          role="img"
          aria-label={`${attendance.present} present, ${attendance.late} late, ${attendance.absent} absent, ${attendance.unknown} not recorded.`}
        >
          <defs>
            <clipPath id={clipId}>
              <rect width="100" height="8" rx="4" />
            </clipPath>
          </defs>
          <rect width="100" height="8" rx="4" className="class-attendance-distribution__track" />
          <g clipPath={`url(#${clipId})`}>
            {segments.map((segment) => (
              <rect
                key={segment.key}
                x={segment.offset}
                width={segment.width}
                height="8"
                className={segment.className}
              />
            ))}
          </g>
        </svg>

        <dl className="class-attendance-metrics">
          {segments.map((segment) => (
            <div
              key={segment.key}
              className={`class-attendance-metric class-attendance-metric--${segment.key}`}
            >
              <dt>
                <span className={`class-attendance-metric__dot ${segment.className}`} aria-hidden="true" />
                {segment.label}
              </dt>
              <dd>
                <strong>{segment.value}</strong>
                <span>{segment.percent}%</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
