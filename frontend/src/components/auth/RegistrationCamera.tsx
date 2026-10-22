import './registrationFace.css';
import { useEffect, useRef } from 'react';
import { useCameraCapture } from '../../hooks/useCameraCapture';
import { useCaptureValidation } from '../../hooks/useCaptureValidation';
import { REQUIRED_FACE_ENROLLMENT_STEPS } from '../../lib/faceEnrollment';
import type { FaceEnrollmentCapture } from '../../types';

/** Capture prompts only; quality/identity consistency is validated by the real server model. */
export default function RegistrationCamera({ captures, onChange, busy, retakeIndex, onRetakeChange, noticeVersion }: {
  captures: FaceEnrollmentCapture[]; onChange: (captures: FaceEnrollmentCapture[]) => void; busy: boolean;
  retakeIndex: number | null; onRetakeChange: (index: number | null) => void;
  noticeVersion: string;
}) {
  const camera = useCameraCapture();
  const validation = useCaptureValidation('/api/auth/registration-capture-check', noticeVersion);
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (validation.error) feedback.current?.scrollIntoView({ block: 'nearest' }); }, [validation.error]);
  const locked = busy || validation.checking;
  const captureIndex = retakeIndex ?? captures.length;
  const step = REQUIRED_FACE_ENROLLMENT_STEPS[captureIndex];
  async function capture() {
    if (!step || locked) return;
    const photo = camera.captureFrame();
    if (!photo) return;
    if (!await validation.check(photo)) return;
    const next = [...captures];
    next[captureIndex] = { pose: step.pose, label: step.label, photo, qualityScore: 0, poseScore: 0,
      capturedAt: new Date().toISOString(), optional: false };
    onChange(next);
    onRetakeChange(null);
    if (next.length === 7) camera.stopCamera();
  }
  return <section aria-label="Registration webcam">
    <p>Capture only yourself in good light. Turn gently and keep both eyes visible.
      Each photo is sent for a quality check before you continue and is not saved by that check.
      All seven photos are checked again for quality and identity at submission. This does not verify liveness, pose or ownership of a student ID.</p>
    <video ref={camera.videoRef} muted playsInline className="registration-face-camera" hidden={!step} />
    <canvas ref={camera.canvasRef} hidden />
    {step && <>
      <p aria-live="polite"><strong>{retakeIndex === null ? 'Capture' : 'Retake capture'} {captureIndex + 1} of 7: {step.prompt}</strong></p>
      <button type="button" className="btn btn--primary" disabled={locked || !camera.stream || camera.isStarting} onClick={() => void capture()}>{validation.checking ? 'Checking photo…' : 'Capture pose'}</button>
      {!camera.stream && <button type="button" className="btn" disabled={locked || camera.isStarting} onClick={() => void camera.startCamera()}>Retry camera</button>}
      {retakeIndex !== null && <button type="button" className="btn" disabled={busy} onClick={() => {
        validation.cancel();
        onRetakeChange(null); if (captures.length === 7) camera.stopCamera();
      }}>Cancel retake</button>}
    </>}
    {validation.checking && <p role="status">Checking capture {captureIndex + 1}… Please hold on.</p>}
    {validation.error && <p ref={feedback} role="alert">Capture {captureIndex + 1}: {validation.error} This photo has not been added. Capture again to retry.</p>}
    {validation.rejectedPhoto && <figure><img className="registration-face-rejected" src={validation.rejectedPhoto} alt="Rejected photo from the current capture" /><figcaption>Rejected photo — not added</figcaption></figure>}
    {camera.error && <p role="alert">{camera.error} You can return to account details and choose manual attendance.</p>}
    <div className="registration-face-captures">{captures.map((capture, index) => <figure key={capture.pose}>
      <img src={capture.photo} alt={`Registration capture ${index + 1}: ${capture.label}`} /><figcaption>{index + 1}. {capture.label}</figcaption>
      <button type="button" className="btn" disabled={locked || camera.isStarting} aria-pressed={retakeIndex === index}
        onClick={() => { validation.clear(); onRetakeChange(index); if (!camera.stream) void camera.startCamera(); }}>Retake {index + 1}</button>
    </figure>)}</div>
    {captures.length > 0 && <button type="button" className="btn" disabled={busy || camera.isStarting} onClick={() => { validation.cancel(); onRetakeChange(null); onChange([]); void camera.startCamera(); }}>Retake all</button>}
  </section>;
}
