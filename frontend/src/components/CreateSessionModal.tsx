import { type FormEvent, useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import SelectMenu, { type SelectMenuOption } from './SelectMenu';
import SearchableSelect from './SearchableSelect';
import { apiMessage } from '../lib/apiClient';
import { listActiveClasses, type ClassSummaryApiResponse } from '../lib/classAdminApi';
import { listCampuses, type CampusApiResponse } from '../lib/campusApi';
import {
  checkClassroomScheduleAvailability,
  type ClassroomScheduleAvailabilityApiResponse
} from '../lib/classroomApi';
import { listRooms, type RoomApiResponse } from '../lib/roomApi';
import { sessionTimeFields, formatIsoDateInAuckland } from '../lib/sessionTime';
import type { NewClassroomSession, Session } from '../types';

interface Props {
  saving: boolean;
  onCreate: (session: NewClassroomSession) => Promise<boolean>;
  /** Present only when editing an existing session — its id is passed back on submit. */
  onUpdate?: (sessionId: string, session: NewClassroomSession) => Promise<boolean>;
  onUpdateFuture?: (sessionId: string, session: NewClassroomSession) => Promise<boolean>;
  /** When set, the form opens pre-filled for this session and submits via onUpdate instead of
   *  onCreate. The caller is responsible for only offering this on a still-editable session
   *  (Scheduled or Live) — the backend enforces the same rule either way. */
  editingSession?: Session;
  /** Opens the form pre-selected for (and locked to) this class — used by a class's own Sessions
   *  tab, where re-picking the class you're already looking at would just be extra friction. Not
   *  used together with editingSession, which already carries its own courseOfferingId. */
  lockedCourseOfferingId?: string;
  onClose: () => void;
}

const today = () => formatIsoDateInAuckland(new Date());

function sessionSubmitLabel(
  isEditing: boolean,
  saving: boolean,
  updateScope: 'single' | 'future'
): string {
  if (saving) return isEditing ? 'Saving...' : 'Creating...';
  if (!isEditing) return 'Create session';
  return updateScope === 'future' ? 'Update weekly slot' : 'Update this session';
}

function weekdayLabel(value: string): string {
  return new Intl.DateTimeFormat('en-NZ', { weekday: 'long', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00Z`));
}

function roomUnavailableLabel(loading: boolean, campusId: string): string {
  if (loading) return 'Loading rooms…';
  return campusId ? 'No rooms at this campus' : 'Select a campus first';
}

function sessionModalSubtitle(session?: Session): string {
  if (session?.status === 'Scheduled' && session.scheduleSeriesId) {
    return 'Choose whether this is one exception or a change to the recurring weekly slot.';
  }
  if (session) return 'Change the time, teacher or room for this individual session.';
  return 'Add a single exceptional class outside the recurring timetable.';
}

interface OptionControlProps {
  readonly value: string;
  readonly options: readonly SelectMenuOption[];
  readonly onChange: (value: string) => void;
  readonly label: string;
  readonly unavailableLabel: string;
}

function OptionControl({ value, options, onChange, label, unavailableLabel }: OptionControlProps) {
  if (options.length === 0) return <input aria-label={label} value={unavailableLabel} disabled />;
  return <SelectMenu value={value} options={options} onChange={onChange} ariaLabel={label} />;
}

export default function CreateSessionModal({
  saving,
  onCreate,
  onUpdate,
  onUpdateFuture,
  editingSession,
  lockedCourseOfferingId,
  onClose
}: Props) {
  const isEditing = Boolean(editingSession);
  const [classes, setClasses] = useState<ClassSummaryApiResponse[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState('');
  const [courseOfferingId, setCourseOfferingId] = useState(
    editingSession?.courseOfferingId ?? lockedCourseOfferingId ?? ''
  );
  const [teacherId, setTeacherId] = useState(editingSession?.teacherId ?? '');
  const [campuses, setCampuses] = useState<CampusApiResponse[]>([]);
  const [rooms, setRooms] = useState<RoomApiResponse[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsError, setLocationsError] = useState('');
  const [campusId, setCampusId] = useState(editingSession?.campusId ?? '');
  const [roomId, setRoomId] = useState(editingSession?.roomId ?? '');
  const [date, setDate] = useState(editingSession?.date ?? today());
  const [startTime, setStartTime] = useState(
    editingSession ? sessionTimeFields(editingSession.startTime, editingSession.endTime, editingSession.date).startTime : '10:00'
  );
  const [endTime, setEndTime] = useState(
    editingSession ? sessionTimeFields(editingSession.startTime, editingSession.endTime, editingSession.date).endTime : '11:00'
  );
  const [error, setError] = useState('');
  const [updateScope, setUpdateScope] = useState<'single' | 'future'>('single');
  const [availability, setAvailability] = useState<{
    signature: string;
    response: ClassroomScheduleAvailabilityApiResponse;
  } | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [availabilityRetry, setAvailabilityRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listActiveClasses()
      .then((result) => {
        if (cancelled) return;
        setClasses(result);
        setCourseOfferingId((current) => current || result[0]?.id || '');
        setClassesError('');
      })
      .catch((fetchError) => {
        if (!cancelled) setClassesError(apiMessage(fetchError));
      })
      .finally(() => {
        if (!cancelled) setClassesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listCampuses(), listRooms()])
      .then(([campusResult, roomResult]) => {
        if (cancelled) return;
        setCampuses(campusResult);
        setRooms(roomResult);
        setCampusId((current) => current || campusResult[0]?.id || '');
        setLocationsError('');
      })
      .catch((fetchError) => {
        if (!cancelled) setLocationsError(apiMessage(fetchError));
      })
      .finally(() => {
        if (!cancelled) setLocationsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const classOptions = useMemo(
    () =>
      classes.map((klass) => ({
        value: klass.id,
        label: `${klass.courseCode} — ${klass.academicTerm}`
      })),
    [classes]
  );
  const selectedClass = classes.find((klass) => klass.id === courseOfferingId);

  // The teacher list is scoped to whichever class is selected — a session's teacher must be one
  // of that class's assigned teachers, not an arbitrary free-typed name/email. Deactivated
  // teachers are excluded even if still assigned to the class (the backend rejects them too, but
  // a session shouldn't be created against someone who can no longer run one).
  const activeClassTeachers = useMemo(
    () => (selectedClass?.teachers ?? []).filter((teacher) => teacher.status === 'ACTIVE'),
    [selectedClass]
  );

  useEffect(() => {
    const stillAssigned = activeClassTeachers.some((teacher) => teacher.id === teacherId);
    if (!stillAssigned) {
      setTeacherId(activeClassTeachers[0]?.id ?? '');
    }
  }, [activeClassTeachers, teacherId]);

  const campusOptions = useMemo(
    () => campuses.map((campus) => ({ value: campus.id, label: campus.name })),
    [campuses]
  );

  // Rooms are scoped to whichever campus is selected — the same room code can exist at more than
  // one campus, so picking a room only makes sense once a campus is picked first.
  const roomsForCampus = useMemo(
    () => rooms.filter((room) => room.campusId === campusId),
    [rooms, campusId]
  );

  useEffect(() => {
    const stillAtCampus = roomsForCampus.some((room) => room.id === roomId);
    if (!stillAtCampus) {
      setRoomId(roomsForCampus[0]?.id ?? '');
    }
  }, [roomsForCampus, roomId]);

  const selectedTeacher = selectedClass?.teachers.find((teacher) => teacher.id === teacherId);

  const basicValid = useMemo(
    () => Boolean(courseOfferingId && teacherId && campusId && roomId && date && startTime && endTime && endTime > startTime),
    [courseOfferingId, teacherId, campusId, roomId, date, endTime, startTime]
  );

  const availabilityPayload = useMemo(() => ({
    courseOfferingId,
    groups: basicValid
      ? [{ key: 'session', slots: [{ date, startTime, endTime }] }]
      : [],
    ignoredSessionIds: editingSession ? [editingSession.id] : []
  }), [basicValid, courseOfferingId, date, editingSession, endTime, startTime]);
  const availabilitySignature = JSON.stringify(availabilityPayload);

  useEffect(() => {
    if (!basicValid) {
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
  }, [availabilityPayload, availabilityRetry, availabilitySignature, basicValid]);

  const availabilityCurrent = availability?.signature === availabilitySignature;
  const availabilityGroup = availabilityCurrent ? availability.response.groups[0] : undefined;
  const availabilityReady = Boolean(
    basicValid && availabilityCurrent && !checkingAvailability && !availabilityError
  );
  const courseConflict = (availabilityGroup?.courseConflicts.length ?? 0) > 0;
  const teacherConflict = (availabilityGroup?.teacherConflicts[teacherId]?.length ?? 0) > 0;
  const roomConflict = (availabilityGroup?.roomConflicts[roomId]?.length ?? 0) > 0;

  const teacherOptions = useMemo(
    () => activeClassTeachers.map((teacher) => {
      const unavailable = (availabilityGroup?.teacherConflicts[teacher.id]?.length ?? 0) > 0;
      return {
        value: teacher.id,
        label: teacher.name,
        meta: unavailable ? `${teacher.email} · Unavailable at this time` : teacher.email,
        keywords: teacher.email,
        disabled: unavailable
      };
    }),
    [activeClassTeachers, availabilityGroup]
  );

  const roomOptions = useMemo(
    () => roomsForCampus.map((room) => {
      const unavailable = (availabilityGroup?.roomConflicts[room.id]?.length ?? 0) > 0;
      return {
        value: room.id,
        label: room.name === room.code ? room.code : `${room.code} — ${room.name}`,
        meta: unavailable ? 'Unavailable at this time' : `Capacity ${room.capacity}`,
        keywords: `${room.code} ${room.name} ${room.capacity}`,
        disabled: unavailable
      };
    }),
    [availabilityGroup, roomsForCampus]
  );

  const valid = availabilityReady && !courseConflict && !teacherConflict && !roomConflict;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid || !selectedClass || !selectedTeacher) {
      setError('Check the class, teacher, room, date and time range.');
      return;
    }
    const draft: NewClassroomSession = {
      courseOfferingId,
      courseLabel: selectedClass.courseCode,
      roomId,
      teacherEmail: selectedTeacher.email,
      date,
      startTime,
      endTime
    };
    let succeeded = false;
    if (editingSession && updateScope === 'future' && onUpdateFuture) {
      succeeded = await onUpdateFuture(editingSession.id, draft);
    } else if (editingSession && onUpdate) succeeded = await onUpdate(editingSession.id, draft);
    else succeeded = await onCreate(draft);
    if (succeeded) onClose();
  };

  let classControl = (
    <OptionControl
      value={courseOfferingId}
      options={classOptions}
      onChange={setCourseOfferingId}
      label="Class"
      unavailableLabel={classesLoading ? 'Loading classes…' : 'No classes available'}
    />
  );
  if (lockedCourseOfferingId || editingSession) {
    const lockedClassLabel = selectedClass
      ? `${selectedClass.courseCode} — ${selectedClass.academicTerm}`
      : 'Loading class…';
    classControl = <input value={lockedClassLabel} disabled />;
  }
  const subtitle = sessionModalSubtitle(editingSession);

  return (
    <Modal
      onClose={onClose}
      size="narrow"
      className="modal--entity-form"
      titleId="create-session-title"
      title={isEditing ? 'Edit scheduled session' : 'Create one-off session'}
      compactTitle
      closeButton
      subtitle={subtitle}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving || !valid}>
            {sessionSubmitLabel(isEditing, saving, updateScope)}
          </button>
        </>
      }
    >
      {classesError && (
        <div className="notice notice--warn">
          <span className="notice__mark" aria-hidden="true" />
          <span>Could not load classes: {classesError}</span>
        </div>
      )}

      {!classesLoading && !classesError && classes.length === 0 && (
        <div className="notice notice--info">
          <span className="notice__mark">i</span>
          <span>No classes exist yet. Ask an Admin to create one under Classes first.</span>
        </div>
      )}

      {locationsError && (
        <div className="notice notice--warn">
          <span className="notice__mark" aria-hidden="true" />
          <span>Could not load campuses/rooms: {locationsError}</span>
        </div>
      )}

      {!locationsLoading && !locationsError && campuses.length === 0 && (
        <div className="notice notice--info">
          <span className="notice__mark">i</span>
          <span>No campuses exist yet. Ask an Admin to create one under Campuses first.</span>
        </div>
      )}

      <div className="modal-form__grid">
        <label className="field field--wide">
          Class
          {classControl}
        </label>

        <div className="field field--wide">
          <span>Teacher</span>
          {activeClassTeachers.length > 0 ? (
            <SearchableSelect
              value={teacherId}
              options={teacherOptions}
              onChange={setTeacherId}
              label="Teacher"
              searchPlaceholder="Search teacher name or email"
              disabled={!basicValid || !availabilityCurrent}
              emptyMessage="No assigned teachers match this search."
            />
          ) : <input value="No teacher assigned to this class" disabled />}
          {teacherConflict && (
            <small className="schedule-builder__availability-error">
              This teacher is unavailable at the selected time.
            </small>
          )}
        </div>

        <div className="field">
          <span>Campus</span>
          <OptionControl value={campusId} options={campusOptions} onChange={setCampusId} label="Campus" unavailableLabel={locationsLoading ? 'Loading campuses…' : 'No campuses available'} />
        </div>

        <div className="field">
          <span>Room</span>
          {roomOptions.length > 0 ? (
            <SearchableSelect
              value={roomId}
              options={roomOptions}
              onChange={setRoomId}
              label="Room"
              searchPlaceholder="Search room code or name"
              disabled={locationsLoading || !basicValid || !availabilityCurrent}
              emptyMessage="No rooms match this search."
            />
          ) : <input value={roomUnavailableLabel(locationsLoading, campusId)} disabled />}
          {roomConflict && (
            <small className="schedule-builder__availability-error">
              This room is already booked at the selected time.
            </small>
          )}
        </div>

        <label className="field field--wide">
          Date
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>

        <label className="field">
          Start time
          <input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </label>

        <label className="field">
          End time
          <input
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
          />
        </label>

        {editingSession?.status === 'Scheduled' && editingSession.scheduleSeriesId && onUpdateFuture && (
          <fieldset className="session-update-scope field--wide">
            <legend>Apply schedule change to</legend>
            <label aria-label="Only this session">
              <input type="radio" name="session-update-scope" checked={updateScope === 'single'} onChange={() => setUpdateScope('single')} />
              <span>
                <b>Only this session</b>
                <small>Make {editingSession.dateLabel} an exception. Later weekly changes will not overwrite it.</small>
              </span>
            </label>
            <label aria-label="This weekly slot from this date">
              <input type="radio" name="session-update-scope" checked={updateScope === 'future'} onChange={() => setUpdateScope('future')} />
              <span>
                <b>This weekly slot from this date</b>
                <small>Change this {weekdayLabel(editingSession.date)} slot and its later dates only. Other weekdays stay unchanged.</small>
              </span>
            </label>
          </fieldset>
        )}

        {editingSession?.status === 'Scheduled' && !editingSession.scheduleSeriesId && (
          <div className="session-update-note field--wide">
            This session is not linked to a recurring timetable, so the change applies only to this date.
          </div>
        )}
      </div>

      <div className="session-availability-status" aria-live="polite">
        {(checkingAvailability || (basicValid && !availabilityCurrent && !availabilityError)) && (
          <span>Checking teacher and room availability…</span>
        )}
        {availabilityReady && !courseConflict && !teacherConflict && !roomConflict && (
          <span className="is-clear">The class, teacher and room are available.</span>
        )}
        {availabilityReady && courseConflict && (
          <span className="is-error">This class already has another session at the selected time.</span>
        )}
        {availabilityError && (
          <span className="is-error">
            {availabilityError}
            <button
              type="button"
              className="btn btn--quiet btn--sm"
              onClick={() => setAvailabilityRetry((value) => value + 1)}
            >
              Retry
            </button>
          </span>
        )}
      </div>

      {error && <div className="form-error">{error}</div>}
    </Modal>
  );
}
