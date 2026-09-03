import { useMemo } from 'react';
import { IconDonutChart } from './icons';

const DONUT_RADIUS = 50;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

interface Attendance {
  present: number;
  late: number;
  absent: number;
  unknown: number;
  total: number;
  rate: number | null;
}

interface Props {
  readonly attendance: Attendance;
  readonly totalStudents: number;
  readonly sessionsToday: number;
  readonly onViewAllAttendance: () => void;
}

export default function AdminAttendanceOverviewCard({
  attendance,
  totalStudents,
  sessionsToday,
  onViewAllAttendance
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

  return (
    <section className="card dashboard-enter stagger-5">
      <div className="card__body card__body--center">
        <div className="card__title-row">
          <span className="icon-inline icon-inline--title" aria-hidden="true">
            <IconDonutChart />
          </span>
          <div>
            <div className="card__title card__title--spaced">Attendance Overview</div>
            <div className="card__sub card__sub--chart">Today's attendance breakdown across all sessions</div>
          </div>
        </div>
        {attendance.total === 0 ? (
          <div className="empty empty--inline">
            <div className="empty__title">No attendance recorded today.</div>
            <div className="empty__hint">
              Today's attendance summary will appear once a session begins recording attendance.
            </div>
          </div>
        ) : (
          <div className="donut-overview donut-overview--lg">
            <div className="donut-chart">
              <svg viewBox="0 0 120 120" role="img" aria-label="Attendance breakdown">
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
                <div className="donut-chart__rate">{attendance.rate}%</div>
                <div className="donut-chart__label">attendance</div>
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
            </div>
          </div>
        )}

        <div className="donut-footer">
          <div className="kv">
            <span className="kv__k">Total students</span>
            <span className="kv__v">{totalStudents}</span>
          </div>
          <div className="kv">
            <span className="kv__k">Sessions today</span>
            <span className="kv__v">{sessionsToday}</span>
          </div>
          <button type="button" className="btn btn--sm donut-footer__cta" onClick={onViewAllAttendance}>
            View all attendance →
          </button>
        </div>
      </div>
    </section>
  );
}
