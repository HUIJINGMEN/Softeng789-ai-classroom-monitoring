import { useState, type ReactNode } from 'react';
import {
  ALL_ROOMS,
  ALL_STUDENT_LEVELS,
  ATTENDANCE_RANGE_OPTIONS,
  type AttendanceLevelFilter,
  type AttendanceRangeDays
} from '../../lib/attendanceAnalytics';
import { STUDENT_LEVEL_OPTIONS } from '../../lib/studentLevels';

interface ScopeProps {
  readonly campus: string;
  readonly room: string;
  readonly level: AttendanceLevelFilter;
  readonly rangeDays: AttendanceRangeDays;
  readonly scopeLabel: string;
  readonly campusOptions: readonly string[];
  readonly roomOptions: readonly { value: string; label: string }[];
  readonly onCampusChange: (value: string) => void;
  readonly onRoomChange: (value: string) => void;
  readonly onLevelChange: (value: AttendanceLevelFilter) => void;
  readonly onRangeDaysChange: (value: AttendanceRangeDays) => void;
  readonly onReset: () => void;
}

export function MobileAttendanceScope({
  campus,
  room,
  level,
  rangeDays,
  scopeLabel,
  campusOptions,
  roomOptions,
  onCampusChange,
  onRoomChange,
  onLevelChange,
  onRangeDaysChange,
  onReset
}: ScopeProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className={`teacher-mobile-scope${open ? ' is-open' : ''}`} aria-label="Attendance scope">
      <button
        type="button"
        className="teacher-mobile-scope__summary"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          <strong>Attendance scope</strong>
          <small>{scopeLabel}</small>
        </span>
        <span>{open ? 'Done' : 'Change'}</span>
      </button>
      {open && (
        <div className="teacher-mobile-scope__fields">
          <label>
            <span>Campus</span>
            <select
              value={campus}
              onChange={(event) => {
                onCampusChange(event.target.value);
                onRoomChange(ALL_ROOMS);
              }}
            >
              {campusOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Room</span>
            <select value={room} onChange={(event) => onRoomChange(event.target.value)}>
              {roomOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Level</span>
            <select
              value={level}
              onChange={(event) => onLevelChange(event.target.value as AttendanceLevelFilter)}
            >
              <option value={ALL_STUDENT_LEVELS}>All levels</option>
              {STUDENT_LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Time</span>
            <select
              value={rangeDays}
              onChange={(event) => onRangeDaysChange(event.target.value as AttendanceRangeDays)}
            >
              {ATTENDANCE_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <button type="button" className="teacher-mobile-scope__reset" onClick={onReset}>
            Reset scope
          </button>
        </div>
      )}
    </section>
  );
}

interface InsightProps {
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}

export function MobileAttendanceInsight({ title, description, children }: InsightProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className={`teacher-mobile-insight${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="teacher-mobile-insight__trigger"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        <span className="teacher-mobile-insight__chevron" aria-hidden="true" />
      </button>
      {open && <div className="teacher-mobile-insight__content">{children}</div>}
    </section>
  );
}
