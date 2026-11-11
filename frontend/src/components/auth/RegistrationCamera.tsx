import './registrationFace.css';
import { useEffect, useRef, useState } from 'react';
import { useCameraCapture } from '../../hooks/useCameraCapture';
import { useCaptureValidation } from '../../hooks/useCaptureValidation';
import { REQUIRED_FACE_ENROLLMENT_STEPS } from '../../lib/faceEnrollment';
import type { FaceEnrollmentCapture } from '../../types';
import { useRegistrationGuide } from '../../hooks/useRegistrationGuide';
import { useCaptureSound } from '../../hooks/useCaptureSound';

/** Local pose guidance with server acceptance for every automatic or manual capture. */
export default function RegistrationCamera({ captures, onChange, busy, retakeIndex, onRetakeChange, noticeVersion }: {
  captures: FaceEnrollmentCapture[]; onChange: (captures: FaceEnrollmentCapture[]) => void; busy: boolean;
  retakeIndex: number | null; onRetakeChange: (index: number | null) => void;
  noticeVersion: string;
}) {
  const camera = useCameraCapture();
  const validation = useCaptureValidation('/api/auth/registration-capture-check', noticeVersion);
  const feedback = useRef<HTMLParagraphElement>(null);
  const [automatic, setAutomatic] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;
  const [success, setSuccess] = useState('');
  const [aspect, setAspect] = useState(4 / 3);
  const captureLock = useRef(false);
  const successTimer = useRef(0);
  const sound = useCaptureSound();
  useEffect(() => () => window.clearTimeout(successTimer.current), []);
  useEffect(() => { if (validation.error) feedback.current?.scrollIntoView({ block: 'nearest' }); }, [validation.error]);
  const locked = busy || validation.checking || !!success;
  const captureIndex = retakeIndex ?? captures.length;
  const step = REQUIRED_FACE_ENROLLMENT_STEPS[captureIndex];
  const guide = useRegistrationGuide(camera.videoRef, camera.stream, step?.pose,
    automatic && !locked && !validation.error, () => void capture(), `${captureIndex}:${retakeIndex}:${captures.length}`);
  useEffect(() => { if (!guide.available) setAutomatic(false); }, [guide.available]);
  const direction = step?.pose.includes('left') ? 'left' : step?.pose.includes('right') ? 'right'
    : step?.pose === 'chin_up' ? 'up' : step?.pose === 'chin_down' ? 'down' : 'front';
  async function capture() {
    if (!step || locked || captureLock.current || !camera.stream || document.hidden) return;
    const acceptFrontBaseline = step.pose === 'front' ? guide.prepareFrontCapture() : null;
    const photo = camera.captureFrame();
    if (!photo) { setAutomatic(false); return; }
    captureLock.current = true;
    const accepted = await validation.check(photo);
    captureLock.current = false;
    if (!accepted) { setAutomatic(false); return; }
    acceptFrontBaseline?.();
    const next = [...captures];
    next[captureIndex] = { pose: step.pose, label: step.label, photo, qualityScore: 0, poseScore: 0,
      capturedAt: new Date().toISOString(), optional: false };
    onChange(next);
    onRetakeChange(null);
    setSuccess(`${step.label} captured`);
    if (soundEnabledRef.current) sound.play();
    window.clearTimeout(successTimer.current);
    successTimer.current = window.setTimeout(() => setSuccess(''), 1000);
    if (next.length === REQUIRED_FACE_ENROLLMENT_STEPS.length) { setAutomatic(false); camera.stopCamera(); }
  }
  return <section aria-label="Registration webcam">
    <p>Capture only yourself in good light. Turn gently and keep both eyes visible.
      Each photo is sent for a quality check before you continue and is not saved by that check.
      All seven photos are checked again for quality and identity at submission. Local direction guidance does not verify liveness or ownership of a student ID.</p>
    <div className={`registration-guide${guide.progress > 0 ? ' is-aligned' : ''}${success ? ' is-success' : ''}`} hidden={!step && !success} style={{ aspectRatio: aspect }}>
      <video ref={camera.videoRef} muted playsInline className="registration-face-camera"
        onLoadedMetadata={event => { const video = event.currentTarget; if (video.videoHeight) setAspect(video.videoWidth / video.videoHeight); }} />
      <div className="registration-guide__top"><span>{Math.min(captureIndex + 1, 7)} / 7 poses</span><span>{automatic ? 'Auto capture on' : 'Manual capture'}</span></div>
      <div className="registration-guide__oval" aria-hidden="true"><span className="registration-guide__eyes" /></div>
      {!success && step && <div className={`registration-guide__motion registration-guide__motion--${direction}`} aria-hidden="true">
        <span>{direction === 'left' ? '←' : direction === 'right' ? '→' : direction === 'up' ? '↑' : direction === 'down' ? '↓' : '•'}</span>
      </div>}
      {success && <div className="registration-guide__check" aria-hidden="true">✓</div>}
    </div>
    {(step || success) && <div className="registration-guide__caption" aria-live="polite">
        <strong>{success || (validation.checking ? 'Checking photo…' : step?.prompt)}</strong>
        <span>{success ? 'Photo accepted' : camera.isStarting ? 'Starting camera…' : !camera.stream ? 'Camera preview unavailable' : guide.message}</span>
    </div>}
    <canvas ref={camera.canvasRef} hidden />
    {step && <>
      <p aria-live="polite"><strong>{retakeIndex === null ? 'Capture' : 'Retake capture'} {captureIndex + 1} of 7: {step.prompt}</strong></p>
      <p className="registration-guide__help">Follow the arrow in your mirrored preview. With auto capture on, hold the correct position for one second. Photos advance after the quality check.</p>
      <progress className="registration-guide__progress" max={1} value={locked || !automatic ? 0 : guide.progress} aria-label="Hold still for automatic capture" />
      <div className="registration-guide__actions">
      <button type="button" className="btn btn--primary" disabled={locked || !camera.stream || camera.isStarting || !guide.available}
        aria-pressed={automatic} onClick={() => { if (soundEnabled) sound.unlock(); validation.clear(); setAutomatic(value => !value); }}>{automatic ? 'Pause auto capture' : 'Start auto capture'}</button>
      <button type="button" className="btn" disabled={locked || !camera.stream || camera.isStarting} onClick={() => { if (soundEnabled) sound.unlock(); void capture(); }}>{validation.checking ? 'Checking photo…' : 'Capture pose manually'}</button>
      <button type="button" className="btn" aria-pressed={soundEnabled} onClick={() => { if (!soundEnabled) sound.unlock(); setSoundEnabled(value => !value); }}>Sound {soundEnabled ? 'on' : 'off'}</button>
      {!camera.stream && <button type="button" className="btn" disabled={locked || camera.isStarting} onClick={() => void camera.startCamera()}>Retry camera</button>}
      {retakeIndex !== null && <button type="button" className="btn" disabled={busy} onClick={() => {
        setAutomatic(false);
        validation.cancel();
        onRetakeChange(null); if (captures.length === 7) camera.stopCamera();
      }}>Cancel retake</button>}
      </div>
    </>}
    {validation.checking && <p role="status">Checking capture {captureIndex + 1}… Please hold on.</p>}
    {validation.error && <p ref={feedback} role="alert">Capture {captureIndex + 1}: {validation.error} This photo has not been added. Capture again to retry.</p>}
    {validation.rejectedPhoto && <figure><img className="registration-face-rejected" src={validation.rejectedPhoto} alt="Rejected photo from the current capture" /><figcaption>Rejected photo — not added</figcaption></figure>}
    {camera.error && <p role="alert">{camera.error} You can return to account details and choose manual attendance.</p>}
    <div className="registration-face-captures">{captures.map((capture, index) => <figure key={capture.pose}>
      <img src={capture.photo} alt={`Registration capture ${index + 1}: ${capture.label}`} /><figcaption>{index + 1}. {capture.label}</figcaption>
      <button type="button" className="btn" disabled={locked || camera.isStarting} aria-pressed={retakeIndex === index}
        onClick={() => { setAutomatic(false); validation.clear(); if (index === 0) guide.resetFrontBaseline(); onRetakeChange(index); if (!camera.stream) void camera.startCamera(); }}>Retake {index + 1}</button>
    </figure>)}</div>
    {captures.length === 7 && !step && <p role="status">All seven photos captured. Ready to submit for review.</p>}
    {captures.length > 0 && <button type="button" className="btn" disabled={locked || camera.isStarting} onClick={() => { setAutomatic(false); validation.cancel(); guide.resetFrontBaseline(); onRetakeChange(null); onChange([]); void camera.startCamera(); }}>Retake all</button>}
  </section>;
}
