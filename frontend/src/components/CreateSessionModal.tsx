import { type FormEvent, useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import SelectMenu, { type SelectMenuOption } from './SelectMenu';
import { apiMessage } from '../lib/apiClient';
import { listActiveClasses, type ClassSummaryApiResponse } from '../lib/classAdminApi';
import { listCampuses, type CampusApiResponse } from '../lib/campusApi';
import { listRooms, type RoomApiResponse } from '../lib/roomApi';
import { clockFromInstant } from '../lib/sessionTime';
import type { NewClassroomSession, Session } from '../types';

interface Props {
  saving: boolean;
  onCreate: (session: NewClassroomSession) => Promise<boolean>;
  /** Present only when editing an existing session — its id is passed back on submit. */
  onUpdate?: (sessionId: string, session: NewClassroomSession) => Promise<boolean>;
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

const today = () => new Date().toISOString().slice(0, 10);

function sessionSubmitLabel(isEditing: boolean, saving: boolean): string {
  if (saving) return isEditing ? 'Saving...' : 'Creating...';
  return isEditing ? 'Save changes' : 'Create session';
}

function roomUnavailableLabel(loading: boolean, campusId: string): string {
  if (loading) return 'Loading rooms…';
  return campusId ? 'No rooms at this campus' : 'Select a campus first';
}

interface OptionControlProps {
  readonly value: string;
  readonly options: readonly SelectMenuOption[];
  readonly onChange: (value: string) => void;
  readonly label: string;
  readonly unavailableLabel: string;
}

function OptionControl({ value, options, onChange, label, unavailableLabel }: OptionControlProps) {
  if (options.length === 0) return <input value={unavailableLabel} disabled />;
  return <SelectMenu value={value} options={options} onChange={onChange} ariaLabel={label} />;
}

export default function CreateSessionModal({
  saving,
  onCreate,
  onUpdate,
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
    editingSession ? clockFromInstant(editingSession.startTime) : '10:00'
  );
  const [endTime, setEndTime] = useState(
    editingSession ? clockFromInstant(editingSession.endTime) : '11:00'
  );
  const [error, setError] = useState('');

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

  const teacherOptions = useMemo(
    () => activeClassTeachers.map((teacher) => ({ value: teacher.id, label: teacher.name })),
    [activeClassTeachers]
  );

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

  const roomOptions = useMemo(
    () =>
      roomsForCampus.map((room) => ({
        value: room.id,
        label: room.name === room.code ? room.code : `${room.code} — ${room.name}`
      })),
    [roomsForCampus]
  );
  const selectedTeacher = selectedClass?.teachers.find((teacher) => teacher.id === teacherId);

  const valid = useMemo(
    () => Boolean(courseOfferingId && teacherId && campusId && roomId && date && startTime && endTime && endTime > startTime),
    [courseOfferingId, teacherId, campusId, roomId, date, endTime, startTime]
  );

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
    if (editingSession && onUpdate) succeeded = await onUpdate(editingSession.id, draft);
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
  if (lockedCourseOfferingId) {
    const lockedClassLabel = selectedClass
      ? `${selectedClass.courseCode} — ${selectedClass.academicTerm}`
      : 'Loading class…';
    classControl = <input value={lockedClassLabel} disabled />;
  }

  return (
    <Modal
      onClose={onClose}
      size="narrow"
      className="modal--entity-form"
      titleId="create-session-title"
      title={isEditing ? 'Edit session' : 'Create session'}
      compactTitle
      closeButton
      subtitle={
        isEditing
          ? 'Only Scheduled and Live sessions can be edited.'
          : 'Create a classroom session teachers can start and mark.'
      }
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving || !valid}>
            {sessionSubmitLabel(isEditing, saving)}
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

        <label className="field field--wide">
          Teacher
          <OptionControl value={teacherId} options={teacherOptions} onChange={setTeacherId} label="Teacher" unavailableLabel="No teacher assigned to this class" />
        </label>

        <label className="field">
          Campus
          <OptionControl value={campusId} options={campusOptions} onChange={setCampusId} label="Campus" unavailableLabel={locationsLoading ? 'Loading campuses…' : 'No campuses available'} />
        </label>

        <label className="field">
          Room
          <OptionControl value={roomId} options={roomOptions} onChange={setRoomId} label="Room" unavailableLabel={roomUnavailableLabel(locationsLoading, campusId)} />
        </label>

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
      </div>

      {error && <div className="form-error">{error}</div>}
    </Modal>
  );
}
