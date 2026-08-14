import { type FormEvent, useMemo, useState } from 'react';
import type { NewClassroomSession } from '../types';

interface Props {
  courseOptions: readonly string[];
  saving: boolean;
  onCreate: (session: NewClassroomSession) => Promise<boolean>;
  onClose: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);
const TIMESTAMP_SUFFIX = /\s+\d{10,}$/;

export default function CreateSessionModal({
  courseOptions,
  saving,
  onCreate,
  onClose
}: Props) {
  const firstCourse = courseOptions.find((course) => course !== 'All courses') ?? '';
  const [course, setCourse] = useState(firstCourse);
  const [room, setRoom] = useState('Room 405-460');
  const [teacherName, setTeacherName] = useState('Unassigned Teacher');
  const [teacherEmail, setTeacherEmail] = useState('unassigned.teacher@auckland.ac.nz');
  const [date, setDate] = useState(today());
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [error, setError] = useState('');

  const valid = useMemo(
    () =>
      course.trim() &&
      room.trim() &&
      teacherName.trim() &&
      teacherEmail.trim() &&
      date &&
      startTime &&
      endTime &&
      endTime > startTime &&
      !TIMESTAMP_SUFFIX.test(course.trim()),
    [course, date, endTime, room, startTime, teacherEmail, teacherName]
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid) {
      setError(
        TIMESTAMP_SUFFIX.test(course.trim())
          ? 'Use the course code only, for example SOFTENG 789.'
          : 'Check the course, room, teacher, date and time range.'
      );
      return;
    }
    const created = await onCreate({
      course: course.trim(),
      room: room.trim(),
      teacherName: teacherName.trim(),
      teacherEmail: teacherEmail.trim(),
      date,
      startTime,
      endTime
    });
    if (created) onClose();
  };

  return (
    <div className="scrim" onClick={onClose}>
      <form
        className="modal modal--narrow session-create"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-session-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <div className="modal__head">
          <div>
            <div id="create-session-title" className="modal__title modal__title--compact">
              Create Session
            </div>
            <div className="card__sub">Create a classroom session teachers can start and mark.</div>
          </div>
        </div>

        <div className="session-create__grid">
          <label className="field">
            Course
            <input
              value={course}
              list="session-course-options"
              placeholder="SOFTENG 789"
              onChange={(event) => setCourse(event.target.value)}
            />
            <datalist id="session-course-options">
              {courseOptions
                .filter((option) => option !== 'All courses')
                .map((option) => (
                  <option key={option} value={option} />
                ))}
            </datalist>
          </label>

          <label className="field">
            Room
            <input
              value={room}
              placeholder="405-460"
              onChange={(event) => setRoom(event.target.value)}
            />
          </label>

          <label className="field">
            Teacher
            <input
              value={teacherName}
              placeholder="Dr. Dana Kessler"
              onChange={(event) => setTeacherName(event.target.value)}
            />
          </label>

          <label className="field">
            Teacher Email
            <input
              type="email"
              value={teacherEmail}
              placeholder="teacher@auckland.ac.nz"
              onChange={(event) => setTeacherEmail(event.target.value)}
            />
          </label>

          <label className="field">
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

        <div className="modal__foot modal__foot--compact">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving || !valid}>
            {saving ? 'Creating...' : '+ Create Session'}
          </button>
        </div>
      </form>
    </div>
  );
}
