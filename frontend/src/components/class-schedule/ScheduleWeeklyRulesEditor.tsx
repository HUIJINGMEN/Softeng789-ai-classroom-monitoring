import type { CampusApiResponse } from '../../lib/campusApi';
import type { ClassTeacherSummary } from '../../lib/classAdminApi';
import type { ScheduleAvailabilityGroupApiResponse } from '../../lib/classroomApi';
import type { RoomApiResponse } from '../../lib/roomApi';
import {
  availabilityDatesLabel,
  type EditableWeeklyRule,
  type ScheduleAssignment,
  type ScheduleOccurrence
} from '../../features/class-schedule';
import SearchableSelect, { type SearchableSelectOption } from '../SearchableSelect';

const WEEKDAYS = [
  { value: 1, shortLabel: 'Mon', label: 'Monday' },
  { value: 2, shortLabel: 'Tue', label: 'Tuesday' },
  { value: 3, shortLabel: 'Wed', label: 'Wednesday' },
  { value: 4, shortLabel: 'Thu', label: 'Thursday' },
  { value: 5, shortLabel: 'Fri', label: 'Friday' },
  { value: 6, shortLabel: 'Sat', label: 'Saturday' },
  { value: 0, shortLabel: 'Sun', label: 'Sunday' }
] as const;

interface Props {
  readonly rules: readonly EditableWeeklyRule[];
  readonly occurrences: readonly ScheduleOccurrence[];
  readonly defaults: ScheduleAssignment;
  readonly activeTeachers: readonly ClassTeacherSummary[];
  readonly campuses: readonly CampusApiResponse[];
  readonly rooms: readonly RoomApiResponse[];
  readonly teacherNameByEmail: ReadonlyMap<string, string>;
  readonly roomById: ReadonlyMap<string, RoomApiResponse>;
  readonly availabilityByKey: ReadonlyMap<string, ScheduleAvailabilityGroupApiResponse>;
  readonly availabilityReady: boolean;
  readonly loadingLocations: boolean;
  readonly onCopyFirstTime: () => void;
  readonly onToggleWeekday: (weekday: number) => void;
  readonly onUpdateRule: (weekday: number, patch: Partial<EditableWeeklyRule>) => void;
  readonly onToggleOverride: (weekday: number) => void;
  readonly onUpdateOverride: (
    weekday: number,
    patch: Partial<NonNullable<EditableWeeklyRule['override']>>
  ) => void;
}

export default function ScheduleWeeklyRulesEditor({
  rules,
  occurrences,
  defaults,
  activeTeachers,
  campuses,
  rooms,
  teacherNameByEmail,
  roomById,
  availabilityByKey,
  availabilityReady,
  loadingLocations,
  onCopyFirstTime,
  onToggleWeekday,
  onUpdateRule,
  onToggleOverride,
  onUpdateOverride
}: Props) {
  const availabilityGroup = (key: string) => availabilityByKey.get(key);
  const teacherOptions = (key: string): SearchableSelectOption[] => activeTeachers.map((teacher) => {
    const conflictDates = availabilityGroup(key)?.teacherConflicts[teacher.id] ?? [];
    return {
      value: teacher.email,
      label: teacher.name,
      meta: conflictDates.length > 0
        ? `${teacher.email} · Unavailable ${availabilityDatesLabel(conflictDates)}`
        : teacher.email,
      keywords: teacher.email,
      disabled: conflictDates.length > 0
    };
  });
  const roomOptions = (key: string, roomList: readonly RoomApiResponse[]): SearchableSelectOption[] =>
    roomList.map((room) => {
      const conflictDates = availabilityGroup(key)?.roomConflicts[room.id] ?? [];
      return {
        value: room.id,
        label: `${room.code} · ${room.name}`,
        meta: conflictDates.length > 0
          ? `Unavailable ${availabilityDatesLabel(conflictDates)}`
          : `${room.campusName} · Capacity ${room.capacity}`,
        keywords: `${room.code} ${room.name} ${room.campusName} ${room.capacity}`,
        disabled: conflictDates.length > 0
      };
    });

  return (
    <div className="schedule-builder__section schedule-builder__section--weekly">
      <div className="schedule-builder__section-heading">
        <div>
          <h4>Typical week</h4>
          <p>Select class days and set their times.</p>
        </div>
        <div className="schedule-builder__weekly-actions">
          <span>{rules.length} day{rules.length === 1 ? '' : 's'} per week</span>
          {rules.length > 1 && (
            <button type="button" className="btn btn--quiet btn--sm" onClick={onCopyFirstTime}>
              Copy first time to all
            </button>
          )}
        </div>
      </div>
      <fieldset className="schedule-builder__weekdays">
        <legend>Class days</legend>
        {WEEKDAYS.map((day) => (
          <label key={day.value} className={rules.some((rule) => rule.weekday === day.value) ? 'is-selected' : ''}>
            <input
              type="checkbox"
              checked={rules.some((rule) => rule.weekday === day.value)}
              onChange={() => onToggleWeekday(day.value)}
            />
            <span>{day.shortLabel}</span>
          </label>
        ))}
      </fieldset>

      <div className="schedule-builder__rules">
        {rules.map((rule) => {
          const day = WEEKDAYS.find((item) => item.value === rule.weekday);
          const assignment = rule.override ?? defaults;
          const assignedRoom = roomById.get(assignment.roomId);
          const roomsForCampus = rooms.filter((room) => room.campusId === assignment.campusId);
          const ruleDates = new Set(occurrences
            .filter((occurrence) => occurrence.ruleKey === String(rule.weekday))
            .map((occurrence) => occurrence.date));
          const availabilityKey = rule.override ? `day-${rule.weekday}` : 'default';
          const ruleTimeConflicts = (availabilityGroup(availabilityKey)?.courseConflicts ?? [])
            .filter((date) => ruleDates.has(date));
          const teacherConflictDates = availabilityGroup(availabilityKey)
            ?.teacherConflicts[activeTeachers.find((teacher) => teacher.email === assignment.teacherEmail)?.id ?? ''] ?? [];
          const roomConflictDates = availabilityGroup(availabilityKey)?.roomConflicts[assignment.roomId] ?? [];

          return (
            <section className="schedule-builder__rule" key={rule.weekday} aria-label={`${day?.label} schedule`}>
              <div className="schedule-builder__rule-day">
                <strong>{day?.label}</strong>
                <span>Repeats weekly</span>
              </div>
              <label className="field">
                <span>Starts</span>
                <input
                  type="time"
                  value={rule.startTime}
                  onChange={(event) => onUpdateRule(rule.weekday, { startTime: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Ends</span>
                <input
                  type="time"
                  value={rule.endTime}
                  onChange={(event) => onUpdateRule(rule.weekday, { endTime: event.target.value })}
                />
              </label>
              <div className="schedule-builder__rule-assignment">
                <span>{teacherNameByEmail.get(assignment.teacherEmail) ?? 'Teacher required'}</span>
                <small>
                  {assignedRoom ? `${assignedRoom.code} · ${assignedRoom.campusName}` : 'Room required'}
                  {rule.override ? ' · Custom' : ''}
                </small>
              </div>
              <button
                type="button"
                className="btn btn--quiet btn--sm schedule-builder__customize"
                aria-expanded={Boolean(rule.override)}
                onClick={() => onToggleOverride(rule.weekday)}
              >
                {rule.override ? 'Use defaults' : 'Customise'}
              </button>
              {ruleTimeConflicts.length > 0 && (
                <div className="schedule-builder__rule-conflict">
                  This class already has another session at this time on {availabilityDatesLabel(ruleTimeConflicts)}.
                  {' '}Change the time or remove those dates.
                </div>
              )}
              {rule.override && (
                <div className="schedule-builder__rule-override">
                  <div className="field">
                    <span>Teacher for {day?.shortLabel}</span>
                    <SearchableSelect
                      label={`Teacher for ${day?.label}`}
                      value={assignment.teacherEmail}
                      options={teacherOptions(availabilityKey)}
                      searchPlaceholder="Search teacher name or email"
                      disabled={activeTeachers.length === 0 || !availabilityReady}
                      emptyMessage="No assigned teachers match this search."
                      onChange={(value) => onUpdateOverride(rule.weekday, { teacherEmail: value })}
                    />
                    {teacherConflictDates.length > 0 && (
                      <small className="schedule-builder__availability-error">
                        Unavailable on {availabilityDatesLabel(teacherConflictDates)}.
                      </small>
                    )}
                  </div>
                  <label className="field">
                    <span>Campus for {day?.shortLabel}</span>
                    <select
                      disabled={loadingLocations || campuses.length === 0}
                      value={assignment.campusId}
                      onChange={(event) => {
                        const campusId = event.target.value;
                        onUpdateOverride(rule.weekday, {
                          campusId,
                          roomId: rooms.find((room) => room.campusId === campusId)?.id ?? ''
                        });
                      }}
                    >
                      {campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}
                    </select>
                  </label>
                  <div className="field">
                    <span>Room for {day?.shortLabel}</span>
                    <SearchableSelect
                      label={`Room for ${day?.label}`}
                      value={assignment.roomId}
                      options={roomOptions(availabilityKey, roomsForCampus)}
                      searchPlaceholder="Search room code or name"
                      disabled={loadingLocations || roomsForCampus.length === 0 || !availabilityReady}
                      emptyMessage="No rooms match this search."
                      onChange={(value) => onUpdateOverride(rule.weekday, { roomId: value })}
                    />
                    {roomConflictDates.length > 0 && (
                      <small className="schedule-builder__availability-error">
                        Booked on {availabilityDatesLabel(roomConflictDates)}.
                      </small>
                    )}
                  </div>
                </div>
              )}
            </section>
          );
        })}
        {rules.length === 0 && (
          <div className="empty empty--compact">Select at least one class day to build the weekly pattern.</div>
        )}
      </div>
    </div>
  );
}
