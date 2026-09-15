import type { FormEvent } from 'react';
import FaceEnrollmentFlow from '../FaceEnrollmentFlow';
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

  return (
    <form
      className="auth-card auth-card--wide auth-card--registration auth-card--face-step"
      onSubmit={onSubmit}
      noValidate
    >
      <button type="button" className="auth-card__back" onClick={onBackToDetails} disabled={busy}>
        ← Back to account details
      </button>

      <h2 className="auth-card__title face-step__title">Face enrolment</h2>
      <p className="face-step__context">
        {fullName} · {studentNumber} · {classLabels.length} requested class{
          classLabels.length === 1 ? '' : 'es'
        }
      </p>

      <StudentRegistrationProgress currentStep={2} compact />

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
        <p className="face-registration__status" aria-live="polite">
          {requiredComplete
            ? 'All required captures are ready.'
            : `${remaining} required capture${remaining === 1 ? '' : 's'} remaining.`}
        </p>
        <button
          type="submit"
          className="btn btn--primary auth-form__submit"
          disabled={busy || !requiredComplete || !consentGiven}
        >
          {busy ? 'Submitting securely…' : 'Submit for Admin review'}
        </button>
      </div>
    </form>
  );
}
