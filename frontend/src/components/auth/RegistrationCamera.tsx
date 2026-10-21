import './registrationFace.css';
import { useCameraCapture } from '../../hooks/useCameraCapture';
import { REQUIRED_FACE_ENROLLMENT_STEPS } from '../../lib/faceEnrollment';
import type { FaceEnrollmentCapture } from '../../types';

/** Capture prompts only; quality/identity consistency is validated by the real server model. */
export default function RegistrationCamera({ captures, onChange, busy }: {
  captures: FaceEnrollmentCapture[]; onChange: (captures: FaceEnrollmentCapture[]) => void; busy: boolean;
}) {
  const camera = useCameraCapture();
  const step = REQUIRED_FACE_ENROLLMENT_STEPS[captures.length];
  function capture() {
    if (!step || busy) return;
    const photo = camera.captureFrame();
    if (!photo) return;
    onChange([...captures, { pose: step.pose, label: step.label, photo, qualityScore: 0, poseScore: 0,
      capturedAt: new Date().toISOString(), optional: false }]);
    if (captures.length === 6) camera.stopCamera();
  }
  return <section aria-label="Registration webcam">
    <p>Capture only yourself in good light. Turn gently and keep both eyes visible.
      The server checks image quality and whether the captures show the same face. This does not verify liveness or ownership of a student ID.</p>
    <video ref={camera.videoRef} muted playsInline className="registration-face-camera" hidden={!step} />
    <canvas ref={camera.canvasRef} hidden />
    {step && <>
      <p><strong>Capture {captures.length + 1} of 7: {step.prompt}</strong></p>
      <button type="button" className="btn btn--primary" disabled={busy || !camera.stream || camera.isStarting} onClick={capture}>Capture pose</button>
      {!camera.stream && <button type="button" className="btn" disabled={busy || camera.isStarting} onClick={() => void camera.startCamera()}>Retry camera</button>}
    </>}
    {camera.error && <p role="alert">{camera.error} You can return to account details and choose manual attendance.</p>}
    <div className="registration-face-captures">{captures.map((capture, index) => <figure key={capture.pose}>
      <img src={capture.photo} alt={`Registration capture ${index + 1}: ${capture.label}`} /><figcaption>{index + 1}. {capture.label}</figcaption>
    </figure>)}</div>
    {captures.length > 0 && <button type="button" className="btn" disabled={busy} onClick={() => { onChange([]); void camera.startCamera(); }}>Retake all</button>}
  </section>;
}
