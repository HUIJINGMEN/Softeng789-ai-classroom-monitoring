import AttendanceDonutChart, { type AttendanceBreakdown } from './AttendanceDonutChart';
import { IconDonutChart } from './icons';

interface Props {
  readonly attendance: AttendanceBreakdown;
  readonly sessionsInScope: number;
  readonly scopeLabel: string;
  readonly onViewAllAttendance: () => void;
}

export default function AdminAttendanceOverviewCard({
  attendance,
  sessionsInScope,
  scopeLabel,
  onViewAllAttendance
}: Props) {
  const recorded = attendance.present + attendance.late + attendance.absent;

  return (
    <section className="card dashboard-overview dashboard-enter stagger-5">
      <div className="card__body">
        <div className="card__title-row">
          <span className="icon-inline icon-inline--title" aria-hidden="true">
            <IconDonutChart />
          </span>
          <div>
            <div className="card__title">Participation Overview</div>
            <div className="card__sub card__sub--chart">
              Overall attendance status mix for the selected trend scope
            </div>
          </div>
        </div>

        <AttendanceDonutChart
          attendance={attendance}
          emptyTitle="No attendance records match this scope."
          emptyHint="Try a broader campus, level or time selection."
          rateLabel="participating"
        />

        <div className="dashboard-overview__scope">{scopeLabel}</div>

        <div className="donut-footer">
          <div className="kv">
            <span className="kv__k">Sessions in scope</span>
            <span className="kv__v">{sessionsInScope}</span>
          </div>
          <div className="kv">
            <span className="kv__k">Recorded marks</span>
            <span className="kv__v">{recorded}</span>
            <span className="donut-footer__detail">of {attendance.total} expected</span>
          </div>
          <button type="button" className="btn btn--sm donut-footer__cta" onClick={onViewAllAttendance}>
            View attendance →
          </button>
        </div>
      </div>
    </section>
  );
}
