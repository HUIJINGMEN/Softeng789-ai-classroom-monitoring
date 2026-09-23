import SelectMenu, { type SelectMenuOption } from '../../components/SelectMenu';
import {
  ALL_ROOMS,
  ATTENDANCE_RANGE_OPTIONS,
  type AttendanceLevelFilter,
  type AttendanceRangeDays
} from '../../lib/attendanceAnalytics';

interface Props {
  readonly campus: string;
  readonly room: string;
  readonly level: AttendanceLevelFilter;
  readonly rangeDays: AttendanceRangeDays;
  readonly campusOptions: readonly SelectMenuOption[];
  readonly roomOptions: readonly SelectMenuOption[];
  readonly levelOptions: readonly SelectMenuOption<AttendanceLevelFilter>[];
  readonly onCampusChange: (campus: string) => void;
  readonly onRoomChange: (room: string) => void;
  readonly onLevelChange: (level: AttendanceLevelFilter) => void;
  readonly onRangeDaysChange: (range: AttendanceRangeDays) => void;
}

export default function AttendanceTrendFilters({
  campus,
  room,
  level,
  rangeDays,
  campusOptions,
  roomOptions,
  levelOptions,
  onCampusChange,
  onRoomChange,
  onLevelChange,
  onRangeDaysChange
}: Props) {
  return (
    <div className="chart__filters" aria-label="Attendance analysis filters">
      <div className="field chart__filter">
        <span>Campus</span>
        <SelectMenu
          value={campus}
          options={campusOptions}
          ariaLabel="Filter attendance trend by campus"
          onChange={(nextCampus) => {
            onCampusChange(nextCampus);
            onRoomChange(ALL_ROOMS);
          }}
        />
      </div>
      <div className="field chart__filter">
        <span>Room</span>
        <SelectMenu
          value={room}
          options={roomOptions}
          ariaLabel="Filter attendance trend by room"
          onChange={onRoomChange}
        />
      </div>
      <div className="field chart__filter">
        <span>Level</span>
        <SelectMenu
          value={level}
          options={levelOptions}
          ariaLabel="Filter attendance trend by student level"
          onChange={onLevelChange}
        />
      </div>
      <div className="field chart__filter">
        <span>Time</span>
        <SelectMenu
          value={rangeDays}
          options={ATTENDANCE_RANGE_OPTIONS}
          ariaLabel="Filter attendance trend by time range"
          onChange={onRangeDaysChange}
        />
      </div>
    </div>
  );
}
