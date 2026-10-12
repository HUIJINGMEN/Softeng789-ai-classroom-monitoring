import { useEffect, useMemo, useState } from 'react';
import { apiMessage } from '../lib/apiClient';
import { listCampuses, type CampusApiResponse } from '../lib/campusApi';
import {
  checkClassroomScheduleAvailability,
  createClassroomSchedule,
  previewClassroomSchedule,
  type ClassroomScheduleAvailabilityApiResponse,
  type CreateClassroomSchedulePayload,
  type ScheduleAvailabilityGroupApiResponse,
  type ScheduleConflictApiResponse
} from '../lib/classroomApi';
import { listRooms, type RoomApiResponse } from '../lib/roomApi';
import { formatIsoDateInAuckland } from '../lib/sessionTime';
import {
  availabilityDatesLabel,
  buildScheduleAvailabilityPayload,
  buildScheduleSessions,
  defaultScheduleEndDate,
  generateScheduleOccurrences,
  scheduleWeekdayRank,
  type EditableWeeklyRule
} from '../features/class-schedule';
import type { ClassApiResponse, ClassSummaryApiResponse } from '../lib/classAdminApi';
import SearchableSelect from './SearchableSelect';
import ScheduleBuilderPreview from './class-schedule/ScheduleBuilderPreview';
import ScheduleBuilderReview from './class-schedule/ScheduleBuilderReview';
import ScheduleWeeklyRulesEditor from './class-schedule/ScheduleWeeklyRulesEditor';

interface Props {
  readonly klass: ClassApiResponse | ClassSummaryApiResponse;
  readonly onCreated: (count: number) => Promise<void> | void;
  readonly onClose: () => void;
}

export default function ClassScheduleBuilder({ klass, onCreated, onClose }: Props) {
  const today = formatIsoDateInAuckland(new Date());
  const defaultTeacherEmail = klass.teachers.find((teacher) => teacher.status === 'ACTIVE')?.email ?? '';
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(defaultScheduleEndDate(today));
  const [rules, setRules] = useState<EditableWeeklyRule[]>(() => [1, 3, 5].map((weekday) => ({
    seriesId: crypto.randomUUID(),
    weekday,
    startTime: '10:00',
    endTime: '11:00',
    override: null
  })));
  const [teacherEmail, setTeacherEmail] = useState(defaultTeacherEmail);
  const [campusId, setCampusId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [campuses, setCampuses] = useState<CampusApiResponse[]>([]);
  const [rooms, setRooms] = useState<RoomApiResponse[]>([]);
  const [excludedDates, setExcludedDates] = useState<Set<string>>(() => new Set());
  const [conflicts, setConflicts] = useState<ScheduleConflictApiResponse[] | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [availability, setAvailability] = useState<{
    signature: string;
    response: ClassroomScheduleAvailabilityApiResponse;
  } | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [availabilityRetry, setAvailabilityRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([listCampuses(), listRooms()])
      .then(([campusResult, roomResult]) => {
        if (cancelled) return;
        const firstCampusId = campusResult[0]?.id ?? '';
        const firstRoomId = roomResult.find((room) => room.campusId === firstCampusId)?.id ?? '';
        setCampuses(campusResult);
        setRooms(roomResult);
        setCampusId(firstCampusId);
        setRoomId(firstRoomId);
        setError('');
      })
      .catch((reason) => {
        if (!cancelled) setError(`Locations could not load: ${apiMessage(reason)}`);
      })
      .finally(() => {
        if (!cancelled) setLoadingLocations(false);
      });
    return () => { cancelled = true; };
  }, []);

  const resetReview = () => {
    setConflicts(null);
    setAcknowledged(false);
    setError('');
  };

  const updateRule = (weekday: number, patch: Partial<EditableWeeklyRule>) => {
    setRules((current) => current.map((rule) => rule.weekday === weekday ? { ...rule, ...patch } : rule));
    resetReview();
  };

  const updateRuleOverride = (weekday: number, patch: Partial<NonNullable<EditableWeeklyRule['override']>>) => {
    setRules((current) => current.map((rule) => {
      if (rule.weekday !== weekday || !rule.override) return rule;
      return { ...rule, override: { ...rule.override, ...patch } };
    }));
    resetReview();
  };

  const toggleRuleOverride = (weekday: number) => {
    setRules((current) => current.map((rule) => {
      if (rule.weekday !== weekday) return rule;
      return {
        ...rule,
        override: rule.override ? null : { teacherEmail, campusId, roomId }
      };
    }));
    resetReview();
  };

  const copyFirstTimeToAll = () => {
    const source = rules[0];
    if (!source) return;
    setRules((current) => current.map((rule) => ({
      ...rule,
      startTime: source.startTime,
      endTime: source.endTime
    })));
    resetReview();
  };

  const toggleWeekday = (weekday: number) => {
    setRules((current) => {
      if (current.some((rule) => rule.weekday === weekday)) return current.filter((rule) => rule.weekday !== weekday);
      const source = current[0];
      return [...current, {
        seriesId: crypto.randomUUID(),
        weekday,
        startTime: source?.startTime ?? '10:00',
        endTime: source?.endTime ?? '11:00',
        override: null
      }].sort((left, right) => scheduleWeekdayRank(left.weekday) - scheduleWeekdayRank(right.weekday));
    });
    resetReview();
  };

  const occurrences = useMemo(
    () => generateScheduleOccurrences({
      startDate,
      endDate,
      rules: rules.map((rule) => ({ key: String(rule.weekday), weekday: rule.weekday })),
      limit: null,
      excludedDates
    }),
    [endDate, excludedDates, rules, startDate]
  );
  const activeTeachers = klass.teachers.filter((teacher) => teacher.status === 'ACTIVE');
  const roomsForDefaultCampus = rooms.filter((room) => room.campusId === campusId);
  const teacherNameByEmail = useMemo(
    () => new Map(activeTeachers.map((teacher) => [teacher.email, teacher.name])),
    [activeTeachers]
  );
  const teacherIdByEmail = useMemo(
    () => new Map(activeTeachers.map((teacher) => [teacher.email, teacher.id])),
    [activeTeachers]
  );
  const roomById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);
  const sessions = buildScheduleSessions(occurrences, rules, { teacherEmail, campusId, roomId });

  const availabilityPayload = useMemo(
    () => buildScheduleAvailabilityPayload(klass.id, occurrences, rules),
    [klass.id, occurrences, rules]
  );
  const availabilitySignature = JSON.stringify(availabilityPayload);

  useEffect(() => {
    if (availabilityPayload.groups.length === 0) {
      setAvailability(null);
      setAvailabilityError('');
      setCheckingAvailability(false);
      return undefined;
    }
    let cancelled = false;
    setCheckingAvailability(true);
    setAvailabilityError('');
    const timer = window.setTimeout(() => {
      checkClassroomScheduleAvailability(availabilityPayload)
        .then((response) => {
          if (!cancelled) setAvailability({ signature: availabilitySignature, response });
        })
        .catch((reason) => {
          if (!cancelled) {
            setAvailability(null);
            setAvailabilityError(`Availability could not be checked: ${apiMessage(reason)}`);
          }
        })
        .finally(() => {
          if (!cancelled) setCheckingAvailability(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [availabilityPayload, availabilityRetry, availabilitySignature]);

  const availabilityCurrent = availability?.signature === availabilitySignature;
  const availabilityByKey = useMemo(
    () => new Map((availabilityCurrent ? availability.response.groups : [])
      .map((group) => [group.key, group])),
    [availability, availabilityCurrent]
  );
  const availabilityReady = availabilityPayload.groups.length === 0
    || (availabilityCurrent && !checkingAvailability && !availabilityError);
  const availabilityGroup = (key: string): ScheduleAvailabilityGroupApiResponse | undefined =>
    availabilityByKey.get(key);
  const teacherConflictDates = (key: string, email: string): string[] => {
    const teacherId = teacherIdByEmail.get(email);
    return teacherId ? availabilityGroup(key)?.teacherConflicts[teacherId] ?? [] : [];
  };
  const roomConflictDates = (key: string, selectedRoomId: string): string[] =>
    availabilityGroup(key)?.roomConflicts[selectedRoomId] ?? [];
  const courseConflictDates = (key: string): string[] =>
    availabilityGroup(key)?.courseConflicts ?? [];
  const teacherOptions = (key: string) => activeTeachers.map((teacher) => {
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
  const roomOptions = (key: string, roomList: readonly RoomApiResponse[]) => roomList.map((room) => {
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
  const selectedAvailabilityIssues = rules.flatMap((rule) => {
    const assignment = rule.override ?? { teacherEmail, campusId, roomId };
    const key = rule.override ? `day-${rule.weekday}` : 'default';
    return [
      ...courseConflictDates(key),
      ...teacherConflictDates(key, assignment.teacherEmail),
      ...roomConflictDates(key, assignment.roomId)
    ];
  });
  const courseTimeConflictDates = [...new Set(
    availabilityPayload.groups.flatMap((group) => courseConflictDates(group.key))
  )].sort((left, right) => left.localeCompare(right));
  const valid = Boolean(
    sessions.length > 0
      && rules.length > 0
      && startDate <= endDate
      && availabilityReady
      && selectedAvailabilityIssues.length === 0
      && rules.every((rule) => {
        const assignment = rule.override ?? { teacherEmail, campusId, roomId };
        return assignment.teacherEmail && assignment.roomId && rule.endTime > rule.startTime;
      })
  );

  const payload = (allowConflicts: boolean): CreateClassroomSchedulePayload => ({
    courseOfferingId: klass.id,
    sessions,
    allowConflicts
  });

  const review = async () => {
    if (!valid) {
      setError('Complete the time, teacher and room for every class day before reviewing.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await previewClassroomSchedule(payload(false));
      setConflicts(result.conflicts);
      setAcknowledged(false);
    } catch (reason) {
      setError(apiMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (conflicts === null) return;
    setBusy(true);
    setError('');
    try {
      const created = await createClassroomSchedule(payload(conflicts.some((item) => item.overridable)));
      await onCreated(created.length);
      onClose();
    } catch (reason) {
      setError(apiMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const hasBlockedConflict = conflicts?.some((item) => !item.overridable) ?? false;
  const hasWarnings = conflicts?.some((item) => item.overridable) ?? false;

  return (
    <section className="schedule-builder" aria-labelledby="schedule-builder-title">
      <header className="schedule-builder__header">
        <div>
          <h3 id="schedule-builder-title">Build class schedule</h3>
          <p>Set the defaults once, then adjust only the days that are different.</p>
        </div>
        <button type="button" className="btn btn--quiet btn--sm" onClick={onClose}>Close</button>
      </header>

      <div className="schedule-builder__layout">
        <div className="schedule-builder__form">
          <div className="schedule-builder__section">
            <h4>Schedule period</h4>
            <div className="schedule-builder__fields schedule-builder__fields--period">
              <label className="field">
                <span>Start date</span>
                <input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); resetReview(); }} />
              </label>
              <label className="field">
                <span>End date</span>
                <input type="date" min={startDate} value={endDate} onChange={(event) => { setEndDate(event.target.value); resetReview(); }} />
              </label>
            </div>
          </div>

          <div className="schedule-builder__section">
            <div className="schedule-builder__section-heading">
              <div>
                <h4>Default teacher and room</h4>
                <p>These apply to every class day unless you customise a day below.</p>
              </div>
            </div>
            <div className="schedule-builder__fields">
              <div className="field">
                <span>Teacher</span>
                <SearchableSelect
                  label="Teacher"
                  value={teacherEmail}
                  options={teacherOptions('default')}
                  searchPlaceholder="Search teacher name or email"
                  disabled={activeTeachers.length === 0 || !availabilityReady}
                  emptyMessage="No assigned teachers match this search."
                  onChange={(value) => { setTeacherEmail(value); resetReview(); }}
                />
                {teacherConflictDates('default', teacherEmail).length > 0 && (
                  <small className="schedule-builder__availability-error">
                    This teacher is unavailable on {availabilityDatesLabel(teacherConflictDates('default', teacherEmail))}.
                  </small>
                )}
              </div>
              <label className="field">
                <span>Campus</span>
                <select
                  disabled={loadingLocations || campuses.length === 0}
                  value={campusId}
                  onChange={(event) => {
                    const nextCampusId = event.target.value;
                    setCampusId(nextCampusId);
                    setRoomId(rooms.find((room) => room.campusId === nextCampusId)?.id ?? '');
                    resetReview();
                  }}
                >
                  {campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}
                </select>
              </label>
              <div className="field">
                <span>Room</span>
                <SearchableSelect
                  label="Room"
                  value={roomId}
                  options={roomOptions('default', roomsForDefaultCampus)}
                  searchPlaceholder="Search room code or name"
                  disabled={loadingLocations || roomsForDefaultCampus.length === 0 || !availabilityReady}
                  emptyMessage="No rooms match this search."
                  onChange={(value) => { setRoomId(value); resetReview(); }}
                />
                {roomConflictDates('default', roomId).length > 0 && (
                  <small className="schedule-builder__availability-error">
                    This room is already booked on {availabilityDatesLabel(roomConflictDates('default', roomId))}.
                  </small>
                )}
              </div>
            </div>
          </div>

          <ScheduleWeeklyRulesEditor
            rules={rules}
            occurrences={occurrences}
            defaults={{ teacherEmail, campusId, roomId }}
            activeTeachers={activeTeachers}
            campuses={campuses}
            rooms={rooms}
            teacherNameByEmail={teacherNameByEmail}
            roomById={roomById}
            availabilityByKey={availabilityByKey}
            availabilityReady={availabilityReady}
            loadingLocations={loadingLocations}
            onCopyFirstTime={copyFirstTimeToAll}
            onToggleWeekday={toggleWeekday}
            onUpdateRule={updateRule}
            onToggleOverride={toggleRuleOverride}
            onUpdateOverride={updateRuleOverride}
          />
        </div>

        <ScheduleBuilderPreview
          sessions={sessions}
          roomById={roomById}
          teacherNameByEmail={teacherNameByEmail}
          excludedDateCount={excludedDates.size}
          onRestoreDates={() => { setExcludedDates(new Set()); resetReview(); }}
          onRemoveDate={(date) => {
            setExcludedDates((current) => new Set([...current, date]));
            resetReview();
          }}
        />
      </div>

      <ScheduleBuilderReview
        conflicts={conflicts}
        acknowledged={acknowledged}
        onAcknowledged={setAcknowledged}
      />

      <div className="schedule-builder__availability-status" aria-live="polite">
        {(checkingAvailability || (!availabilityReady && !availabilityError)) && (
          <span>Checking teacher and room availability for the full schedule…</span>
        )}
        {availabilityReady && availabilityPayload.groups.length > 0 && selectedAvailabilityIssues.length === 0 && (
          <span className="is-clear">Teachers and rooms are available for every generated session.</span>
        )}
        {availabilityReady && courseTimeConflictDates.length > 0 && (
          <span className="is-error">
            Course time conflict on {availabilityDatesLabel(courseTimeConflictDates)}.
          </span>
        )}
        {availabilityError && (
          <span className="is-error">
            {availabilityError}
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => setAvailabilityRetry((value) => value + 1)}>
              Retry
            </button>
          </span>
        )}
      </div>

      {activeTeachers.length === 0 && <div className="notice notice--warn">Assign an active teacher to this class before building its schedule.</div>}
      {error && <div className="notice notice--warn">{error}</div>}

      <footer className="schedule-builder__footer">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        {conflicts === null ? (
          <button type="button" className="btn btn--primary" disabled={!valid || busy} onClick={() => void review()}>
            {busy ? 'Checking…' : `Review ${sessions.length || ''} sessions`}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy || hasBlockedConflict || (hasWarnings && !acknowledged)}
            onClick={() => void create()}
          >
            {busy ? 'Creating…' : `Create ${sessions.length} sessions`}
          </button>
        )}
      </footer>
    </section>
  );
}
