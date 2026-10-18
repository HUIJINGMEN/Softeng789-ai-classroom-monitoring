import { useMemo, useState } from 'react';
import SelectMenu from './SelectMenu';
import { IconBarChart } from './icons';
import {
  ATTENDANCE_RANGE_OPTIONS,
  attendanceRangeStart,
  completedSessionBy,
  type AttendanceRangeDays
} from '../lib/attendanceAnalytics';
import { formatIsoDateInAuckland } from '../lib/sessionTime';
import { buildAttendanceComparisonGroups, type ComparisonDimension } from '../features/dashboard-attendance/attendanceComparisonModel';
import type { AttendanceRow, Session } from '../types';

interface Props {
  readonly sessions: readonly Session[];
  readonly attendanceRowsForSession: (sessionId: string) => readonly AttendanceRow[];
}

export default function CampusParticipationComparison({
  sessions,
  attendanceRowsForSession
}: Props) {
  const [dimension, setDimension] = useState<ComparisonDimension>('campus');
  const [rangeDays, setRangeDays] = useState<AttendanceRangeDays>('30');
  const todayIso = formatIsoDateInAuckland(new Date());
  const rangeStartIso = attendanceRangeStart(todayIso, rangeDays);

  const eligibleSessions = useMemo(
    () =>
      sessions.filter(
        (session) =>
          completedSessionBy(session) &&
          session.date >= rangeStartIso &&
          session.date <= todayIso
      ),
    [rangeStartIso, sessions, todayIso]
  );

  const groups = useMemo(() => buildAttendanceComparisonGroups(eligibleSessions, dimension, attendanceRowsForSession),
    [attendanceRowsForSession, dimension, eligibleSessions]);

  const comparisonLabel = dimension === 'campus' ? 'campus' : 'student level';

  return (
    <section className="card campus-comparison dashboard-enter stagger-5">
      <div className="card__body">
        <div className="campus-comparison__head">
          <div className="card__title-row">
            <span className="icon-inline icon-inline--title" aria-hidden="true">
              <IconBarChart />
            </span>
            <div>
              <div className="card__title">Participation Comparison</div>
              <div className="card__sub card__sub--chart">
                Recorded marks only · Historical lesson roster · Students grouped by current level
              </div>
            </div>
          </div>

          <div className="campus-comparison__controls">
            <div className="comparison-toggle" role="group" aria-label="Compare participation by">
              <button
                type="button"
                className={dimension === 'campus' ? 'is-active' : ''}
                aria-pressed={dimension === 'campus'}
                onClick={() => setDimension('campus')}
              >
                By campus
              </button>
              <button
                type="button"
                className={dimension === 'level' ? 'is-active' : ''}
                aria-pressed={dimension === 'level'}
                onClick={() => setDimension('level')}
              >
                By level
              </button>
            </div>

            <div className="campus-comparison__time">
              <span>Time</span>
              <SelectMenu
                value={rangeDays}
                options={ATTENDANCE_RANGE_OPTIONS}
                ariaLabel="Select participation comparison time range"
                align="right"
                onChange={setRangeDays}
              />
            </div>
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="empty empty--inline campus-comparison__empty">
            <div className="empty__title">No {comparisonLabel} attendance is available for this period.</div>
            <div className="empty__hint">Choose a longer time range to include more completed sessions.</div>
          </div>
        ) : (
          <div
            className="campus-comparison__chart"
            role="group"
            aria-label={`Participation rate comparison by ${comparisonLabel}`}
          >
            <div className="campus-comparison__axis" aria-hidden="true">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </div>
            <div
              className="campus-comparison__viewport"
              role="region"
              tabIndex={0}
              aria-label={`Scrollable ${comparisonLabel} chart`}
            >
              <div className="campus-comparison__grid" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <div
                className="campus-comparison__bars"
                role="list"
                style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(112px, 1fr))` }}
              >
                {groups.map((group) => (
                  <div key={group.key} className="campus-comparison__column" role="listitem">
                    <div className="campus-comparison__bar-slot">
                      <span
                        className="campus-comparison__value"
                        style={{ bottom: `clamp(8px, calc(${group.rate ?? 0}% + 10px), calc(100% - 24px))` }}
                      >
                        {group.rate === null ? '—' : `${group.rate}%`}
                      </span>
                      <div
                        key={`${dimension}-${rangeDays}-${group.key}`}
                        className="campus-comparison__bar"
                        role={group.rate === null ? 'img' : 'progressbar'}
                        aria-label={group.rate === null ? `${group.label}: no recorded marks` : `${group.label} participation rate`}
                        aria-valuemin={group.rate === null ? undefined : 0}
                        aria-valuemax={group.rate === null ? undefined : 100}
                        aria-valuenow={group.rate ?? undefined}
                        style={{ height: `${group.rate ?? 0}%` }}
                      />
                    </div>
                    <div className="campus-comparison__name">{group.label}</div>
                    <div className="campus-comparison__meta">
                      {group.sessions} session{group.sessions === 1 ? '' : 's'} · {group.recorded} marks
                    </div>
                    <div className="campus-comparison__detail">
                      {group.participating} / {group.recorded} recorded marks attended · {group.expected - group.recorded} not recorded
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
