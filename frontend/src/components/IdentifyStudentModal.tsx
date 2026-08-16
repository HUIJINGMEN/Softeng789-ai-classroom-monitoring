import { useState } from 'react';
import AddFeedbackPanel from './AddFeedbackPanel';
import CameraCapturePanel from './CameraCapturePanel';
import { identifyStudent, type StudentIdentificationResult } from '../lib/aiMockService';
import { studentCourseLabel } from '../lib/studentCourses';
import type { FeedbackRating, Student, TeacherNote } from '../types';

interface Props {
  students: readonly Student[];
  feedbackByStudent: ReadonlyMap<string, readonly TeacherNote[]>;
  onSaveFeedback: (feedback: {
    studentId: string;
    rating: FeedbackRating;
    comment: string;
  }) => void;
  onOpenProfile: (student: Student) => void;
  onClose: () => void;
}

export default function IdentifyStudentModal({
  students,
  feedbackByStudent,
  onSaveFeedback,
  onOpenProfile,
  onClose
}: Props) {
  const [result, setResult] = useState<StudentIdentificationResult | null>(null);
  const [photo, setPhoto] = useState('');
  const [identifying, setIdentifying] = useState(false);
  const [message, setMessage] = useState('Capture a student photo to identify an existing record.');
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const matchedStudent = result?.status === 'matched' ? result.student : null;
  const matchedConfidence = result?.status === 'matched' ? result.confidence : 0;

  const identify = async (nextPhoto: string) => {
    setPhoto(nextPhoto);
    setIdentifying(true);
    setStatus('checking');
    setMessage('Identifying student from classroom photo...');

    const nextResult = await identifyStudent(nextPhoto, students);
    setResult(nextResult);
    setIdentifying(false);
    setStatus(nextResult.status === 'matched' ? 'success' : 'error');
    setMessage(nextResult.message);
  };

  return (
    <div className="scrim" role="presentation" onClick={onClose}>
      <div
        className="modal modal--identify"
        role="dialog"
        aria-modal="true"
        aria-labelledby="identify-student-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__head">
          <div>
            <div id="identify-student-title" className="modal__title">
              Identify student
            </div>
            <div className="modal__subtitle">
              Take a quick classroom photo, then review the match before opening the profile.
            </div>
          </div>
          <button type="button" className="btn btn--quiet btn--sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="identify-flow">
          <CameraCapturePanel
            title="Camera"
            instruction="Frame one student clearly. Use the guide to keep the face centered."
            captureLabel="Take photo"
            busy={identifying}
            status={status}
            statusText={message}
            onCapture={(nextPhoto) => void identify(nextPhoto)}
          />

          <section className="identify-result" aria-live="polite">
            <div className="card__title card__title--spaced">Recognition result</div>

            {!result && (
              <div className="empty empty--inline">
                No photo has been captured yet.
              </div>
            )}

            {photo && !result && (
              <img className="identify-result__photo" src={photo} alt="Captured student" />
            )}

            {result?.status === 'no_match' && (
              <div className="notice notice--warn">
                <span className="notice__mark">!</span>
                <span>{result.message}</span>
              </div>
            )}

            {matchedStudent && (
              <>
                <div className="identified-student">
                  <div className="identified-student__photo-wrap">
                    {matchedStudent.registrationPhoto ? (
                      <img
                        className="identified-student__photo"
                        src={matchedStudent.registrationPhoto}
                        alt={`${matchedStudent.name} registration`}
                      />
                    ) : (
                      <div className="identified-student__initials">
                        {initials(matchedStudent.name)}
                      </div>
                    )}
                  </div>

                  <div className="identified-student__main">
                    <div className="identified-student__name">{matchedStudent.name}</div>
                    <div className="cell-sub">
                      {matchedStudent.id} · {studentCourseLabel(matchedStudent)}
                    </div>
                    <div className="identified-student__meta">
                      <span>{matchedStudent.program}</span>
                      <span>Seat {matchedStudent.seat}</span>
                      <span>{Math.round(matchedConfidence * 100)}% mock confidence</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn--primary identified-student__action"
                    onClick={() => onOpenProfile(matchedStudent)}
                  >
                    Open profile
                  </button>
                </div>

                <div className="identify-feedback">
                  <div className="card__title card__title--spaced">Add feedback</div>
                  <AddFeedbackPanel
                    studentId={matchedStudent.id}
                    notes={feedbackByStudent.get(matchedStudent.id) ?? []}
                    onSave={onSaveFeedback}
                  />
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
