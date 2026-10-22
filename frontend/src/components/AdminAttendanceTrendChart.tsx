import { useEffect, useMemo } from 'react';
import AttendanceTrendCanvas from '../features/dashboard-attendance/AttendanceTrendCanvas';
import AttendanceTrendFilters from '../features/dashboard-attendance/AttendanceTrendFilters';
import { buildAttendanceTrendSeries } from '../features/dashboard-attendance/attendanceTrendModel';
import {
  ALL_ROOMS,
  ALL_STUDENT_LEVELS,
  ATTENDANCE_LEVEL_OPTIONS,
  sessionCampusName,
  type AttendanceCounts,
  type AttendanceLevelFilter,
  type AttendanceRangeDays
} from '../lib/attendanceAnalytics';
import { sessionRoomLabel } from '../lib/sessionLabels';
import type { Session } from '../types';
import { IconTrendLine } from './icons';

interface Props {
  readonly sessions: readonly Session[];
  readonly scopedSessions: readonly Session[];
  readonly countsForScopedSession: (sessionId: string) => AttendanceCounts;
  readonly rangeStartIso: string;
  readonly rangeEndIso: string;
  readonly campus: string;
  readonly room: string;
  readonly level: AttendanceLevelFilter;
  readonly rangeDays: AttendanceRangeDays;
  readonly onCampusChange: (campus: string) => void;
  readonly onRoomChange: (room: string) => void;
  readonly onLevelChange: (level: AttendanceLevelFilter) => void;
  readonly onRangeDaysChange: (range: AttendanceRangeDays) => void;
  readonly onResetFilters: () => void;
  readonly onGoToSession: (sessionId: string) => void;
  readonly showFilters?: boolean;
}

export default function AdminAttendanceTrendChart({
  sessions,
  scopedSessions,
  countsForScopedSession,
  rangeStartIso,
  rangeEndIso,
  campus,
  room,
  level,
  rangeDays,
  onCampusChange,
  onRoomChange,
  onLevelChange,
  onRangeDaysChange,
  onResetFilters,
  onGoToSession,
  showFilters = true
}: Props) {
  const campusOptions = useMemo(
    () => [
      { value: 'All campuses', label: 'All campuses' },
      ...Array.from(new Set(sessions.map(sessionCampusName)))
        .sort((left, right) => left.localeCompare(right))
        .map((value) => ({ value, label: value }))
    ],
    [sessions]
  );
  const roomOptions = useMemo(() => {
    const availableRooms = new Map<string, string>();
    for (const session of sessions) {
      if (campus !== 'All campuses' && sessionCampusName(session) !== campus) continue;
      const value = sessionRoomLabel(session);
      availableRooms.set(value, campus === 'All campuses' ? value : session.room);
    }
    return [
      { value: ALL_ROOMS, label: ALL_ROOMS },
      ...Array.from(availableRooms, ([value, label]) => ({ value, label })).sort((left, right) =>
        left.label.localeCompare(right.label)
      )
    ];
  }, [campus, sessions]);
  const levelOptions = ATTENDANCE_LEVEL_OPTIONS;

  useEffect(() => {
    if (!campusOptions.some((option) => option.value === campus)) {
      onCampusChange('All campuses');
    }
  }, [campus, campusOptions, onCampusChange]);

  useEffect(() => {
    if (!roomOptions.some((option) => option.value === room)) {
      onRoomChange(ALL_ROOMS);
    }
  }, [onRoomChange, room, roomOptions]);

  const series = useMemo(
    () => buildAttendanceTrendSeries(scopedSessions, countsForScopedSession),
    [countsForScopedSession, scopedSessions]
  );

  const chartIsFiltered =
    campus !== 'All campuses' ||
    room !== ALL_ROOMS ||
    level !== ALL_STUDENT_LEVELS ||
    rangeDays !== '30';
  const emptyMessage = chartIsFiltered
    ? 'No recorded attendance matches the selected scope.'
    : 'No recorded attendance is available for this period.';

  return (
    <section className="card chart dashboard-trend dashboard-enter stagger-4">
      <div className="card__body">
        <div className="card__title-row dashboard-trend__head">
          <div className="card__title-row">
            <span className="icon-inline icon-inline--title" aria-hidden="true">
              <IconTrendLine />
            </span>
            <div>
              <div className="card__title">Attendance Trend</div>
              <div className="card__sub card__sub--chart">
                Attendance rate over time for the selected campus, room and student level
              </div>
            </div>
          </div>
          {showFilters && chartIsFiltered && (
            <button type="button" className="btn btn--quiet btn--sm" onClick={onResetFilters}>
              Reset filters
            </button>
          )}
        </div>

        {showFilters && (
          <AttendanceTrendFilters
            campus={campus}
            room={room}
            level={level}
            rangeDays={rangeDays}
            campusOptions={campusOptions}
            roomOptions={roomOptions}
            levelOptions={levelOptions}
            onCampusChange={onCampusChange}
            onRoomChange={onRoomChange}
            onLevelChange={onLevelChange}
            onRangeDaysChange={onRangeDaysChange}
          />
        )}

        <div className="chart__legend">
          <span className="chart__legend-item">
            <span className="chart__swatch" />
            Attendance rate (%)
          </span>
          {series.aggregateByDay && (
            <span className="chart__legend-item chart__legend-item--muted">Aggregated per day</span>
          )}
          <span className="mono chart__range">
            {series.points.length === 0 ? 'No recorded marks' : `${rangeStartIso} – ${rangeEndIso}`}
          </span>
        </div>
        <p className="card__sub">Rates use recorded marks only. Sessions or days with no recorded marks are not plotted.</p>

        {series.points.length === 0 ? (
          <div className="empty empty--chart">
            <div className="empty__title">{emptyMessage}</div>
            {!chartIsFiltered && (
              <div className="empty__hint">
                Record attendance for a completed session to show a rate. Missing marks are not absences.
              </div>
            )}
          </div>
        ) : (
          <AttendanceTrendCanvas
            key={`${campus}-${room}-${level}-${rangeDays}`}
            points={series.points}
            pointMeta={series.pointMeta}
            aggregateByDay={series.aggregateByDay}
            onGoToSession={onGoToSession}
          />
        )}
      </div>
    </section>
  );
}
