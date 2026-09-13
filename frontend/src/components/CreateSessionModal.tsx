import { type FormEvent, useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import SelectMenu from './SelectMenu';
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
    () =>
      Boolean(courseOfferingId) &&
      Boolean(teacherId) &&
      Boolean(campusId) &&
      Boolean(roomId) &&
      date &&
      startTime &&
      endTime &&
      endTime > startTime,
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
    const succeeded =
      editingSession && onUpdate ? await onUpdate(editingSession.id, draft) : await onCreate(draft);
    if (succeeded) onClose();
  };

  return (
    <Modal
      onClose={onClose}
      size="narrow"
      titleId="create-session-title"
      title={isEditing ? 'Edit Session' : 'Create Session'}
      compactTitle
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
            {isEditing
              ? saving
                ? 'Saving...'
                : 'Save changes'
              : saving
                ? 'Creating...'
                : '+ Create Session'}
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
          {lockedCourseOfferingId ? (
            <input
              value={
                selectedClass
                  ? `${selectedClass.courseCode} — ${selectedClass.academicTerm}`
                  : 'Loading class…'
              }
              disabled
            />
          ) : classOptions.length > 0 ? (
            <SelectMenu
              value={courseOfferingId}
              options={classOptions}
              onChange={setCourseOfferingId}
              ariaLabel="Class"
            />
          ) : (
            <input value={classesLoading ? 'Loading classes…' : 'No classes available'} disabled />
          )}
        </label>

        <label className="field field--wide">
          Teacher
          {teacherOptions.length > 0 ? (
            <SelectMenu
              value={teacherId}
              options={teacherOptions}
              onChange={setTeacherId}
              ariaLabel="Teacher"
            />
          ) : (
            <input value="No teacher assigned to this class" disabled />
          )}
        </label>

        <label className="field field--wide">
          Campus
          {campusOptions.length > 0 ? (
            <SelectMenu
              value={campusId}
              options={campusOptions}
              onChange={setCampusId}
              ariaLabel="Campus"
            />
          ) : (
            <input value={locationsLoading ? 'Loading campuses…' : 'No campuses available'} disabled />
          )}
        </label>

        <label className="field field--wide">
          Room
          {roomOptions.length > 0 ? (
            <SelectMenu
              value={roomId}
              options={roomOptions}
              onChange={setRoomId}
              ariaLabel="Room"
            />
          ) : (
            <input
              value={
                locationsLoading
                  ? 'Loading rooms…'
                  : campusId
                    ? 'No rooms at this campus'
                    : 'Select a campus first'
              }
              disabled
            />
          )}
        </label>

        <label className="field field--wide">
          Date
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>

        <label className="field">
          Start Time
          <input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </label>

        <label className="field">
          End Time
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
