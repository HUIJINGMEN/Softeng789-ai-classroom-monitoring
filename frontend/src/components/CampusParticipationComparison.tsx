import { useMemo, useState } from 'react';
import SelectMenu from './SelectMenu';
import { IconBarChart } from './icons';
import {
  ALL_STUDENT_LEVELS,
  ATTENDANCE_RANGE_OPTIONS,
  attendanceCountsForLevel,
  attendanceRangeStart,
  percentageOf,
  sessionCampusName,
  type AttendanceCounts,
  type AttendanceRangeDays
} from '../lib/attendanceAnalytics';
import { formatIsoDateInAuckland } from '../lib/sessionTime';
import { STUDENT_LEVEL_OPTIONS } from '../lib/studentLevels';
import type { AttendanceStatus, Session, Student } from '../types';

type ComparisonDimension = 'campus' | 'level';

interface Props {
  readonly sessions: readonly Session[];
  readonly students: readonly Student[];
  readonly countsForSession: (sessionId: string) => AttendanceCounts;
  readonly attendanceStatusFor: (studentId: string, sessionId: string) => AttendanceStatus;
}

interface ParticipationGroup {
  key: string;
  label: string;
  participating: number;
  expected: number;
  recorded: number;
  sessions: number;
  rate: number;
}

function finishGroup(group: Omit<ParticipationGroup, 'rate'>): ParticipationGroup {
  return {
    ...group,
    rate: percentageOf(group.participating, group.expected, 0)
  };
}

export default function CampusParticipationComparison({
  sessions,
  students,
  countsForSession,
  attendanceStatusFor
}: Props) {
  const [dimension, setDimension] = useState<ComparisonDimension>('campus');
  const [rangeDays, setRangeDays] = useState<AttendanceRangeDays>('30');
  const todayIso = formatIsoDateInAuckland(new Date());
  const rangeStartIso = attendanceRangeStart(todayIso, rangeDays);

  const eligibleSessions = useMemo(
    () =>
      sessions.filter(
        (session) =>
          session.status !== 'Cancelled' &&
          session.status !== 'Scheduled' &&
          session.date >= rangeStartIso &&
          session.date <= todayIso
      ),
    [rangeStartIso, sessions, todayIso]
  );

  const groups = useMemo(() => {
    if (dimension === 'level') {
      return STUDENT_LEVEL_OPTIONS.map((option) => {
        const group: Omit<ParticipationGroup, 'rate'> = {
          key: option.value,
          label: option.label,
          participating: 0,
          expected: 0,
          recorded: 0,
          sessions: 0
        };

        for (const session of eligibleSessions) {
          const counts = attendanceCountsForLevel(
            session,
            option.value,
            students,
            attendanceStatusFor,
            countsForSession
          );
          if (counts.total === 0) continue;
          group.participating += counts.present + counts.late;
          group.expected += counts.total;
          group.recorded += counts.present + counts.late + counts.absent;
          group.sessions += 1;
        }

        return finishGroup(group);
      }).filter((group) => group.expected > 0);
    }

    const grouped = new Map<string, Omit<ParticipationGroup, 'rate'>>();
    for (const session of eligibleSessions) {
      const counts = attendanceCountsForLevel(
        session,
        ALL_STUDENT_LEVELS,
        students,
        attendanceStatusFor,
        countsForSession
      );
      if (counts.total === 0) continue;

      const campus = sessionCampusName(session);
      const group = grouped.get(campus) ?? {
        key: campus,
        label: campus,
        participating: 0,
        expected: 0,
        recorded: 0,
        sessions: 0
      };
      group.participating += counts.present + counts.late;
      group.expected += counts.total;
      group.recorded += counts.present + counts.late + counts.absent;
      group.sessions += 1;
      grouped.set(campus, group);
    }

    return Array.from(grouped.values())
      .map(finishGroup)
      .sort((left, right) => right.rate - left.rate || left.label.localeCompare(right.label));
  }, [attendanceStatusFor, countsForSession, dimension, eligibleSessions, students]);

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
                Compare present-or-late rates by campus or student level
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
                        style={{ bottom: `clamp(8px, calc(${group.rate}% + 10px), calc(100% - 24px))` }}
                      >
                        {group.rate}%
                      </span>
                      <div
                        key={`${dimension}-${rangeDays}-${group.key}`}
                        className="campus-comparison__bar"
                        role="progressbar"
                        aria-label={`${group.label} participation rate`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={group.rate}
                        style={{ height: `${group.rate}%` }}
                      />
                    </div>
                    <div className="campus-comparison__name">{group.label}</div>
                    <div className="campus-comparison__meta">
                      {group.sessions} session{group.sessions === 1 ? '' : 's'} · {group.recorded} marks
                    </div>
                    <div className="campus-comparison__detail">
                      {group.participating} / {group.expected} participating
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
