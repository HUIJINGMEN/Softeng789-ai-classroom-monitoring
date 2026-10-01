import type { FormEvent } from 'react';
import FaceEnrollmentFlow from '../FaceEnrollmentFlow';
import { IconChevronLeft } from '../icons';
import { hasRequiredEnrollmentCaptures, REQUIRED_FACE_ENROLLMENT_STEPS } from '../../lib/faceEnrollment';
import type { FaceEnrollmentCapture } from '../../types';
import StudentRegistrationProgress from './StudentRegistrationProgress';

interface Props {
  readonly fullName: string;
  readonly studentNumber: string;
  readonly classLabels: readonly string[];
  readonly consentGiven: boolean;
  readonly onConsentChange: (value: boolean) => void;
  readonly captures: FaceEnrollmentCapture[];
  readonly onCapturesChange: (captures: FaceEnrollmentCapture[]) => void;
  readonly errorMessage: string;
  readonly busy: boolean;
  readonly onSubmit: (event: FormEvent) => void;
  readonly onBackToDetails: () => void;
}

function getCaptureStatus(
  complete: boolean,
  captured: number,
  remaining: number
): { title: string; detail: string } {
  if (complete) {
    return {
      title: `${REQUIRED_FACE_ENROLLMENT_STEPS.length} captures complete`,
      detail: 'Ready for admin review'
    };
  }

  const captureLabel = remaining === 1 ? 'capture' : 'captures';
  return {
    title: `${captured} of ${REQUIRED_FACE_ENROLLMENT_STEPS.length} captured`,
    detail: `${remaining} required ${captureLabel} remaining`
  };
}

export default function StudentFaceRegistrationStep({
  fullName,
  studentNumber,
  classLabels,
  consentGiven,
  onConsentChange,
  captures,
  onCapturesChange,
  errorMessage,
  busy,
  onSubmit,
  onBackToDetails
}: Props) {
  const requiredComplete = hasRequiredEnrollmentCaptures(captures);
  const requiredCaptured = REQUIRED_FACE_ENROLLMENT_STEPS.filter((step) =>
    captures.some((capture) => capture.pose === step.pose)
  ).length;
  const remaining = REQUIRED_FACE_ENROLLMENT_STEPS.length - requiredCaptured;
  const requestedClassLabel = classLabels.length === 1 ? 'class' : 'classes';
  const captureStatus = getCaptureStatus(requiredComplete, requiredCaptured, remaining);
  const submitLabel = busy ? 'Submitting securely…' : 'Submit for review';

  return (
    <form
      className="auth-card auth-card--wide auth-card--registration auth-card--face-step"
      onSubmit={onSubmit}
      aria-busy={busy}
      noValidate
    >
      <header className="face-step__header">
        <button
          type="button"
          className="auth-card__back face-step__back"
          onClick={onBackToDetails}
          disabled={busy}
          aria-label="Back to account details"
        >
          <IconChevronLeft />
          <span>Account details</span>
        </button>

        <h2 className="auth-card__title face-step__title">Face enrolment</h2>
        <div
          className="face-step__context"
          aria-label={
            `${fullName}, student ${studentNumber}, ${classLabels.length} requested ${requestedClassLabel}`
          }
        >
          <strong className="face-step__context-name">{fullName}</strong>
          <span className="face-step__context-meta">
            <span>Student ID {studentNumber}</span>
            <span className="face-step__context-dot" aria-hidden="true" />
            <span className="face-step__context-classes">
              {classLabels.length} requested {requestedClassLabel}
            </span>
          </span>
        </div>

        <StudentRegistrationProgress currentStep={2} compact />
      </header>

      <div className="face-step__workspace">
        <label className="face-consent">
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(event) => onConsentChange(event.target.checked)}
          />
          <span>
            <strong>I consent to face enrolment</strong>
            <small>Capture photos will be stored for classroom identity matching.</small>
          </span>
        </label>

        {consentGiven ? (
          <FaceEnrollmentFlow captures={captures} onChange={onCapturesChange} />
        ) : (
          <div className="face-consent-gate">
            <strong>Camera access starts after consent</strong>
            <span>Your camera remains off until you accept the face enrolment statement above.</span>
          </div>
        )}

        {errorMessage && <div className="form-error" role="alert">{errorMessage}</div>}

        <div className="face-registration__submit-row">
          <div className="face-registration__status" aria-live="polite">
            <span
              className={`face-registration__status-mark${requiredComplete ? ' is-ready' : ''}`}
              aria-hidden="true"
            />
            <span className="face-registration__status-copy">
              <strong>{captureStatus.title}</strong>
              <span>{captureStatus.detail}</span>
            </span>
          </div>
          <button
            type="submit"
            className="btn btn--primary auth-form__submit"
            disabled={busy || !requiredComplete || !consentGiven}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
