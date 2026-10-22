import './registrationFace.css';
import { useCameraCapture } from '../../hooks/useCameraCapture';
import { REQUIRED_FACE_ENROLLMENT_STEPS } from '../../lib/faceEnrollment';
import type { FaceEnrollmentCapture } from '../../types';

/** Capture prompts only; quality/identity consistency is validated by the real server model. */
export default function RegistrationCamera({ captures, onChange, busy, retakeIndex, onRetakeChange }: {
  captures: FaceEnrollmentCapture[]; onChange: (captures: FaceEnrollmentCapture[]) => void; busy: boolean;
  retakeIndex: number | null; onRetakeChange: (index: number | null) => void;
}) {
  const camera = useCameraCapture();
  const captureIndex = retakeIndex ?? captures.length;
  const step = REQUIRED_FACE_ENROLLMENT_STEPS[captureIndex];
  function capture() {
    if (!step || busy) return;
    const photo = camera.captureFrame();
    if (!photo) return;
    const next = [...captures];
    next[captureIndex] = { pose: step.pose, label: step.label, photo, qualityScore: 0, poseScore: 0,
      capturedAt: new Date().toISOString(), optional: false };
    onChange(next);
    onRetakeChange(null);
    if (next.length === 7) camera.stopCamera();
  }
  return <section aria-label="Registration webcam">
    <p>Capture only yourself in good light. Turn gently and keep both eyes visible.
      The server checks image quality and whether the captures show the same face. This does not verify liveness or ownership of a student ID.</p>
    <video ref={camera.videoRef} muted playsInline className="registration-face-camera" hidden={!step} />
    <canvas ref={camera.canvasRef} hidden />
    {step && <>
      <p aria-live="polite"><strong>{retakeIndex === null ? 'Capture' : 'Retake capture'} {captureIndex + 1} of 7: {step.prompt}</strong></p>
      <button type="button" className="btn btn--primary" disabled={busy || !camera.stream || camera.isStarting} onClick={capture}>Capture pose</button>
      {!camera.stream && <button type="button" className="btn" disabled={busy || camera.isStarting} onClick={() => void camera.startCamera()}>Retry camera</button>}
      {retakeIndex !== null && <button type="button" className="btn" disabled={busy} onClick={() => {
        onRetakeChange(null); if (captures.length === 7) camera.stopCamera();
      }}>Cancel retake</button>}
    </>}
    {camera.error && <p role="alert">{camera.error} You can return to account details and choose manual attendance.</p>}
    <div className="registration-face-captures">{captures.map((capture, index) => <figure key={capture.pose}>
      <img src={capture.photo} alt={`Registration capture ${index + 1}: ${capture.label}`} /><figcaption>{index + 1}. {capture.label}</figcaption>
      <button type="button" className="btn" disabled={busy || camera.isStarting} aria-pressed={retakeIndex === index}
        onClick={() => { onRetakeChange(index); if (!camera.stream) void camera.startCamera(); }}>Retake {index + 1}</button>
    </figure>)}</div>
    {captures.length > 0 && <button type="button" className="btn" disabled={busy || camera.isStarting} onClick={() => { onRetakeChange(null); onChange([]); void camera.startCamera(); }}>Retake all</button>}
  </section>;
}
