import { useMemo, useState, type FormEvent } from 'react';
import { apiMessage } from '../lib/studentApi';
import { useCameraCapture } from '../hooks/useCameraCapture';
import type { NewStudentRegistration } from '../types';

interface Props {
  courses: readonly string[];
  existingIds: readonly string[];
  onClose: () => void;
  onSave: (registration: NewStudentRegistration) => Promise<void> | void;
}

interface FormState {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  courses: string[];
  program: string;
  seat: string;
  consent: boolean;
}

const initialForm = (course: string): FormState => ({
  id: '',
  firstName: '',
  lastName: '',
  email: '',
  courses: course ? [course] : [],
  program: 'BSc Computer Science, Year 1',
  seat: '',
  consent: false
});

export default function AddStudentModal({ courses, existingIds, onClose, onSave }: Props) {
  const firstCourse = courses[0] ?? 'COMPSCI 335';
  const [form, setForm] = useState<FormState>(() => initialForm(firstCourse));
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const camera = useCameraCapture();

  const normalisedExistingIds = useMemo(
    () => existingIds.map((id) => id.trim().toLowerCase()),
    [existingIds]
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const id = form.id.trim();
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const email = form.email.trim();
    const program = form.program.trim();
    const enrolledCourses = form.courses.filter(Boolean);

    if (!id || !firstName || !lastName || !email || !program || enrolledCourses.length === 0) {
      setFormError('Complete the required student details before saving.');
      return;
    }
    if (normalisedExistingIds.includes(id.toLowerCase())) {
      setFormError('This student ID already exists in the current records.');
      return;
    }
    if (!camera.photo) {
      setFormError('Capture a registration photo before saving this student.');
      return;
    }
    if (!form.consent) {
      setFormError('Record consent before saving a supervised camera registration.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        studentNumber: id,
        universityEmail: email,
        firstName,
        lastName,
        course: enrolledCourses[0],
        courses: enrolledCourses,
        seat: form.seat.trim() || 'Unassigned',
        programme: program,
        registrationPhoto: camera.photo,
        consentGiven: true
      });
      camera.stopCamera();
    } catch (error) {
      setFormError(apiMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const close = () => {
    camera.stopCamera();
    onClose();
  };

  const toggleCourse = (course: string) => {
    setForm((current) => {
      const selected = current.courses.includes(course);
      const courses = selected
        ? current.courses.filter((candidate) => candidate !== course)
        : [...current.courses, course];
      return { ...current, courses };
    });
    setFormError('');
  };

  return (
    <div className="scrim" role="presentation">
      <form
        className="modal modal--student-registration"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-student-title"
        onSubmit={submit}
      >
        <div className="modal__head">
          <div>
            <div id="add-student-title" className="modal__title">
              Add new student
            </div>
            <div className="modal__subtitle">
              Supervised classroom registration with a consented camera capture.
            </div>
          </div>
          <button type="button" className="btn btn--quiet btn--sm" onClick={close}>
            Close
          </button>
        </div>

        <div className="student-registration">
          <section className="student-registration__form" aria-label="Student details">
            <div className="student-registration__grid">
              <label className="field">
                Student ID
                <input
                  value={form.id}
                  placeholder="UOA-100412"
                  autoFocus
                  onChange={(event) => update('id', event.target.value)}
                />
              </label>
              <label className="field">
                University email
                <input
                  value={form.email}
                  type="email"
                  placeholder="student@aucklanduni.ac.nz"
                  onChange={(event) => update('email', event.target.value)}
                />
              </label>
              <label className="field">
                First name
                <input
                  value={form.firstName}
                  placeholder="First name"
                  onChange={(event) => update('firstName', event.target.value)}
                />
              </label>
              <label className="field">
                Last name
                <input
                  value={form.lastName}
                  placeholder="Last name"
                  onChange={(event) => update('lastName', event.target.value)}
                />
              </label>
              <div className="field student-registration__wide">
                <span>Enrolled courses</span>
                <div className="course-checklist" aria-label="Choose enrolled courses">
                  {courses.map((course) => (
                    <label key={course} className="course-checklist__item">
                      <input
                        type="checkbox"
                        checked={form.courses.includes(course)}
                        onChange={() => toggleCourse(course)}
                      />
                      <span>{course}</span>
                    </label>
                  ))}
                </div>
              </div>
              <label className="field">
                Seat
                <input
                  value={form.seat}
                  placeholder="Unassigned"
                  onChange={(event) => update('seat', event.target.value)}
                />
              </label>
              <label className="field student-registration__wide">
                Programme
                <input
                  value={form.program}
                  placeholder="Programme and year"
                  onChange={(event) => update('program', event.target.value)}
                />
              </label>
            </div>

            <label className="consent-row">
              <input
                type="checkbox"
                checked={form.consent}
                onChange={(event) => update('consent', event.target.checked)}
              />
              <span>
                Consent has been recorded for storing a registration image for this classroom
                monitoring prototype.
              </span>
            </label>

            {formError && <div className="form-error">{formError}</div>}
          </section>

          <section className="student-registration__camera" aria-label="Registration camera">
            <div className="camera-frame">
              {camera.photo ? (
                <img src={camera.photo} alt="Captured student registration" />
              ) : (
                <video ref={camera.videoRef} playsInline muted />
              )}
              {!camera.stream && !camera.photo && (
                <div className="camera-frame__empty">
                  {camera.isStarting ? 'Starting camera...' : 'Camera preview unavailable'}
                </div>
              )}
            </div>

            <canvas ref={camera.canvasRef} className="camera-canvas" aria-hidden="true" />

            <div className="camera-actions">
              <button
                type="button"
                className="btn"
                disabled={camera.isStarting || isSaving}
                onClick={camera.retakePhoto}
              >
                {camera.stream ? 'Restart camera' : 'Start camera'}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!camera.stream || camera.isStarting || isSaving}
                onClick={camera.capturePhoto}
              >
                Capture photo
              </button>
            </div>

            {camera.photo && (
              <button
                type="button"
                className="btn btn--quiet camera-retake"
                onClick={camera.retakePhoto}
              >
                Retake photo
              </button>
            )}

            {camera.error && <div className="form-error form-error--camera">{camera.error}</div>}

            <div className="privacy-note">
              This prototype stores the captured image only in the current browser session. A real
              deployment should save consent, retention policy, and access controls with the student
              record.
            </div>
          </section>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
          <span className="spacer" />
          <button type="submit" className="btn btn--primary" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save student'}
          </button>
        </div>
      </form>
    </div>
  );
}
