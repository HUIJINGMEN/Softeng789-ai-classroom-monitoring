import { sparkline, type ChartPoint } from '../lib/chart';
import { useCountUp } from '../hooks/useCountUp';

interface Props {
  readonly totalStudents: number;
  readonly enrolledCourseCount: number;
  readonly presentToday: number;
  readonly lateToday: number;
  readonly attendanceRate: number;
  readonly activeSessionLabel: string;
  readonly pendingCount: number;
  /** Shared with the attendance trend chart above — see Dashboard.tsx for why this state is
   *  lifted rather than each card computing its own copy. */
  readonly points: readonly ChartPoint[];
  readonly onReviewPending: () => void;
}

export default function TeacherStatsRow({
  totalStudents,
  enrolledCourseCount,
  presentToday,
  lateToday,
  attendanceRate,
  activeSessionLabel,
  pendingCount,
  points,
  onReviewPending
}: Props) {
  const studentSpark = sparkline(Array(5).fill(totalStudents));
  const totalStudentsCount = useCountUp(totalStudents);
  const presentTodayCount = useCountUp(presentToday);
  const attendanceRateCount = useCountUp(attendanceRate);
  const pendingEventsCount = useCountUp(pendingCount);

  const stats = [
    {
      label: 'Total students',
      value: String(totalStudentsCount),
      delta: `Across ${enrolledCourseCount} enrolled courses`,
      deltaTone: 'muted',
      spark: studentSpark,
      sparkColor: 'var(--muted-2)'
    },
    {
      label: 'Present today',
      value: String(presentTodayCount),
      delta: `${lateToday} marked late`,
      deltaTone: 'warn',
      spark: sparkline(points.map((p) => p.present)),
      sparkColor: 'var(--muted-2)'
    },
    {
      label: 'Attendance rate',
      value: `${attendanceRateCount}%`,
      delta: activeSessionLabel,
      deltaTone: 'muted',
      spark: sparkline(points.map((p) => p.rate)),
      sparkColor: 'var(--muted-2)'
    },
    {
      label: 'Pending AI events',
      value: String(pendingEventsCount),
      delta: pendingCount > 0 ? 'Awaiting teacher review →' : 'All caught up',
      deltaTone: pendingCount > 0 ? 'warn' : 'ok',
      spark: sparkline(points.map((p) => p.pending)),
      sparkColor: pendingCount > 0 ? 'var(--warn)' : 'var(--muted-2)',
      alert: pendingCount > 0,
      onClick: onReviewPending
    }
  ];

  return (
    <div className="stat-grid">
      {stats.map((stat, index) => {
        const body = (
          <>
            <div className="stat__label">{stat.label}</div>
            <div className="stat__value">{stat.value}</div>
            <svg className="stat__spark" viewBox="0 0 100 26" preserveAspectRatio="none">
              <polyline
                points={stat.spark}
                fill="none"
                stroke={stat.sparkColor}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className={`stat__delta stat__delta--${stat.deltaTone}`}>{stat.delta}</div>
          </>
        );
        const className = `stat dashboard-enter stagger-${index}${stat.alert ? ' stat--alert' : ''}`;

        return stat.onClick ? (
          <button key={stat.label} type="button" className={className} onClick={stat.onClick}>
            {body}
          </button>
        ) : (
          <div key={stat.label} className={className}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
