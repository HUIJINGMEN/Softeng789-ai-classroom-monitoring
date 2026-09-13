import type { AttendanceBreakdown } from './AttendanceDonutChart';
import { percentageOf } from '../lib/attendanceAnalytics';

interface Props {
  readonly attendance: AttendanceBreakdown;
}

/** Explains the denominator behind an attendance rate without repeating the category values
 * already visible in AttendanceDonutChart. This is shared by overall and class reports so both
 * scopes describe incomplete attendance data in exactly the same way. */
export default function AttendanceCoveragePanel({ attendance }: Props) {
  const recorded = attendance.present + attendance.late + attendance.absent;
  if (attendance.total === 0) return null;

  const completeness = percentageOf(recorded, attendance.total, 0);

  return (
    <section className="attendance-coverage" aria-label="Attendance data completeness">
      <div className="attendance-coverage__heading">
        <div>
          <h3>Data completeness</h3>
          <p>{recorded} of {attendance.total} attendance marks have a recorded status.</p>
        </div>
        <strong className="mono">{completeness}%</strong>
      </div>

      <div
        className="attendance-coverage__track"
        role="progressbar"
        aria-label="Attendance marks recorded"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={completeness}
        aria-valuetext={`${completeness}% complete`}
      >
        <span style={{ transform: `scaleX(${completeness / 100})` }} />
      </div>

      <dl className="attendance-coverage__values">
        <div>
          <dt>Recorded</dt>
          <dd className="mono">{recorded}</dd>
        </div>
        <div>
          <dt>Not recorded</dt>
          <dd className="mono">{attendance.unknown}</dd>
        </div>
      </dl>

      <p className="attendance-coverage__note">
        Attendance rate uses recorded marks only. Unrecorded marks are shown for completeness but do not lower the rate.
      </p>
    </section>
  );
}
