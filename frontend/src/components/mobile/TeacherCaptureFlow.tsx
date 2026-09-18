import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { apiMessage } from '../../lib/apiClient';
import { prepareFeedbackPhoto } from '../../lib/imageCompression';
import {
  createProgressReport,
  recognizeStudent,
  type FeedbackClassOption,
  type StudentRecognitionResult
} from '../../lib/progressReportApi';

function RecognitionIcon({ matched }: { readonly matched: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {matched ? (
        <path d="m5 12.5 4.2 4.2L19 7" />
      ) : (
        <>
          <circle cx="12" cy="9" r="3.2" />
          <path d="M5 20c0-4 2.8-6.5 7-6.5s7 2.5 7 6.5M4 4v3M4 4h3M20 4h-3M20 4v3" />
        </>
      )}
    </svg>
  );
}

interface Props {
  readonly initialFile: File;
  readonly classes: readonly FeedbackClassOption[];
  readonly defaultClassId: string;
  readonly onClassSelected: (id: string) => void;
  readonly onClose: () => void;
  readonly onSaved: (studentName: string) => void;
}

export default function TeacherCaptureFlow({ initialFile, classes, defaultClassId, onClassSelected, onClose, onSaved }: Props) {
  const [courseOfferingId, setCourseOfferingId] = useState(defaultClassId || classes[0]?.courseOfferingId || '');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState('');
  const [recognition, setRecognition] = useState<StudentRecognitionResult | null>(null);
  const [studentId, setStudentId] = useState('');
  const [choosingStudent, setChoosingStudent] = useState(false);
  const [comment, setComment] = useState('');
  const [stage, setStage] = useState<'preparing' | 'recognizing' | 'ready'>('preparing');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const retakeRef = useRef<HTMLInputElement>(null);
  const photoRequestRef = useRef(0);
  const selectedClass = classes.find((item) => item.courseOfferingId === courseOfferingId);
  const selectedStudent = selectedClass?.students.find((item) => item.id === studentId);

  const processPhoto = async (file: File) => {
    const requestId = ++photoRequestRef.current;
    setError('');
    setRecognition(null);
    setStudentId('');
    setChoosingStudent(false);
    setStage('preparing');
    try {
      const prepared = await prepareFeedbackPhoto(file);
      if (requestId !== photoRequestRef.current) return;
      setPhoto(prepared);
      setPreview(URL.createObjectURL(prepared));
    } catch (reason) {
      setError(apiMessage(reason));
      setStage('ready');
    }
  };

  useEffect(() => {
    void processPhoto(initialFile);
  }, [initialFile]);

  useEffect(() => {
    if (!preview) return undefined;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose, saving]);

  useEffect(() => {
    if (!photo || !courseOfferingId) return;
    let cancelled = false;
    setStage('recognizing');
    setError('');
    recognizeStudent(courseOfferingId, photo)
      .then((result) => {
        if (cancelled) return;
        setRecognition(result);
        setStudentId(result.studentId);
        setChoosingStudent(false);
      })
      .catch((reason) => {
        if (!cancelled) {
          setChoosingStudent(true);
          setError(`${apiMessage(reason)} Select the student below to continue.`);
        }
      })
      .finally(() => { if (!cancelled) setStage('ready'); });
    return () => { cancelled = true; };
  }, [photo, courseOfferingId]);

  useEffect(() => {
    if (classes.length === 0 || classes.some((item) => item.courseOfferingId === courseOfferingId)) return;
    const firstClassId = classes[0].courseOfferingId;
    setCourseOfferingId(firstClassId);
    onClassSelected(firstClassId);
  }, [classes, courseOfferingId, onClassSelected]);

  const valid = useMemo(() => Boolean(photo && courseOfferingId && studentId && comment.trim()), [photo, courseOfferingId, studentId, comment]);

  const selectClass = (id: string) => {
    setCourseOfferingId(id);
    setStudentId('');
    setRecognition(null);
    setChoosingStudent(false);
    onClassSelected(id);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid || !photo || saving) return;
    setSaving(true);
    setError('');
    try {
      await createProgressReport({ studentId, courseOfferingId, comment: comment.trim(), photo });
      onSaved(selectedStudent?.name ?? recognition?.studentName ?? 'the student');
    } catch (reason) {
      setError(apiMessage(reason));
      setSaving(false);
    }
  };

  return (
    <div className="teacher-capture" role="dialog" aria-modal="true" aria-labelledby="capture-title">
      <form className="teacher-capture__shell" onSubmit={submit}>
        <header className="teacher-capture__head">
          <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <div><span>Quick feedback</span><h1 id="capture-title">Add to student report</h1></div>
          <span className="teacher-capture__step">Ready</span>
        </header>

        <main className="teacher-capture__body">
          <section className="teacher-capture__photo">
            {preview ? <img src={preview} alt="Classroom capture for feedback" /> : <div className="teacher-capture__photo-placeholder">Preparing photo…</div>}
            <button type="button" onClick={() => retakeRef.current?.click()}>Retake</button>
            <input ref={retakeRef} type="file" accept="image/*" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void processPhoto(file); }} />
          </section>

          <section className="teacher-capture__form-card">
            <div className="teacher-capture__form-intro">
              <strong>Review the match</strong>
              <span>Confirm the student, then write the feedback that should appear in their report.</span>
            </div>
            <label className="teacher-capture__field">
              <span>Class</span>
              <select value={courseOfferingId} onChange={(event) => selectClass(event.target.value)}>
                {classes.length === 0 && <option value="">No available classes</option>}
                {classes.map((item) => <option key={item.courseOfferingId} value={item.courseOfferingId}>{item.label}</option>)}
              </select>
            </label>

            <div className={`teacher-capture__identity teacher-capture__identity--${stage}`}>
              <span className="teacher-capture__identity-mark" aria-hidden="true"><RecognitionIcon matched={stage === 'ready' && Boolean(studentId)} /></span>
              <div>
                <small>{stage === 'preparing' ? 'Preparing photo' : stage === 'recognizing' ? 'Identifying student…' : studentId ? 'Student identified' : 'Select student'}</small>
                {studentId && <strong>{selectedStudent?.name ?? recognition?.studentName}</strong>}
                {studentId && <span>{selectedStudent?.studentNumber ?? recognition?.studentNumber}{recognition ? ` · ${Math.round(recognition.confidence * 100)}% demo match` : ''}</span>}
              </div>
            </div>

            {studentId && !choosingStudent ? (
              <button
                type="button"
                className="teacher-capture__change-student"
                onClick={() => setChoosingStudent(true)}
              >
                Not the right student? <strong>Change</strong>
              </button>
            ) : (
              <label className="teacher-capture__field">
                <span>Choose student</span>
                <select
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  disabled={!selectedClass || stage !== 'ready'}
                >
                  <option value="">Select a student</option>
                  {selectedClass?.students.map((student) => (
                    <option key={student.id} value={student.id}>{student.name} · {student.studentNumber}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="teacher-capture__field teacher-capture__field--feedback">
              <span>Feedback for the report</span>
              <textarea maxLength={500} rows={4} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="What did you observe? Keep it clear and useful for the report." />
              <small>{comment.length}/500</small>
            </label>
            {error && <div className="teacher-capture__error" role="alert">{error}</div>}
          </section>
        </main>

        <footer className="teacher-capture__foot">
          <div><strong>{selectedStudent?.name ?? recognition?.studentName ?? 'No student selected'}</strong><span>{selectedClass?.label ?? 'Select a class'}</span></div>
          <button type="submit" disabled={!valid || saving}>{saving ? 'Adding…' : 'Confirm & add'}</button>
        </footer>
      </form>
    </div>
  );
}
