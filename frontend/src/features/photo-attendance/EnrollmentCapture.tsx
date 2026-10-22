import { useEffect, useRef, useState } from 'react';
import { useCameraCapture } from '../../hooks/useCameraCapture';
import { useCaptureValidation } from '../../hooks/useCaptureValidation';
import { apiMessage } from '../../lib/apiClient';
import { enroll } from './api';

const POSES = ['Face forward', 'Turn slightly left', 'Turn further left (keep both eyes visible)', 'Turn slightly right',
  'Turn further right (keep both eyes visible)', 'Lift your chin slightly', 'Lower your chin slightly'];

export default function EnrollmentCapture({ studentId, name, onDone, onCancel }: {
  studentId: string; name: string; onDone: () => void; onCancel: () => void;
}) {
  const camera = useCameraCapture();
  const validation = useCaptureValidation(`/api/vision/students/${studentId}/capture-check`);
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (validation.error) feedback.current?.scrollIntoView({ block: 'nearest' }); }, [validation.error]);
  const [captures, setCaptures] = useState<string[]>([]); const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null);
  const captureIndex = retakeIndex ?? captures.length;
  const locked = busy || validation.checking;
  async function capture() {
    if (locked || captureIndex >= 7) return;
    const image = camera.captureFrame(); if (!image) return;
    if (!await validation.check(image)) return;
    const next = [...captures]; next[captureIndex] = image;
    setCaptures(next); setRetakeIndex(null); setConfirmed(false); setError('');
    if (next.length === 7) camera.stopCamera();
  }
  async function save() {
    if (locked || retakeIndex !== null || captures.length !== 7 || !confirmed) return;
    setBusy(true); setError('');
    try { await enroll(studentId, captures); onDone(); }
    catch (e) { setError(apiMessage(e)); } finally { setBusy(false); }
  }
  return <section className="vision-enrollment" aria-label={`Enroll ${name}`}>
    <h3>Supervised enrollment · {name}</h3>
    <p>Check the student's identity in person. Capture one real person in good light, without a screen or printed photo.
      Each photo is sent for a quality check without being saved by that check. All seven are checked again at submission.
      Automated liveness and pose verification are not performed.</p>
    <video ref={camera.videoRef} muted playsInline className="vision-camera" hidden={captureIndex === 7} />
    {captureIndex < 7 && <>
      <p aria-live="polite"><strong>{retakeIndex === null ? 'Capture' : 'Retake capture'} {captureIndex + 1} of 7: {POSES[captureIndex]}</strong></p>
      <button type="button" className="btn" disabled={locked || !camera.stream || camera.isStarting} onClick={() => void capture()}>{validation.checking ? 'Checking photo…' : 'Capture pose'}</button>
      {!camera.stream && <button type="button" className="btn" disabled={locked || camera.isStarting} onClick={() => void camera.startCamera()}>Retry camera</button>}
      {retakeIndex !== null && <button type="button" className="btn" disabled={busy} onClick={() => {
        validation.cancel();
        setRetakeIndex(null); if (captures.length === 7) camera.stopCamera();
      }}>Cancel retake</button>}
    </>}
    <canvas ref={camera.canvasRef} hidden />
    <div className="vision-captures">{captures.map((photo, index) => <figure key={index}>
      <img src={photo} alt={`Capture ${index + 1}: ${POSES[index]}`} /><figcaption>{index + 1}. {POSES[index]}</figcaption>
      <button type="button" className="btn" disabled={locked || camera.isStarting} aria-pressed={retakeIndex === index}
        onClick={() => { validation.clear(); setRetakeIndex(index); setConfirmed(false); if (!camera.stream) void camera.startCamera(); }}>Retake {index + 1}</button>
    </figure>)}</div>
    {(error || camera.error) && <p role="alert">{error || camera.error}</p>}
    {validation.checking && <p role="status">Checking capture {captureIndex + 1}… Please hold on.</p>}
    {validation.error && <p ref={feedback} role="alert">Capture {captureIndex + 1}: {validation.error} This photo has not been added. Capture again to retry.</p>}
    {validation.rejectedPhoto && <figure><img width="160" src={validation.rejectedPhoto} alt="Rejected photo from the current capture" /><figcaption>Rejected photo — not added</figcaption></figure>}
    {captures.length === 7 && <>
      <label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={busy || retakeIndex !== null} />
        I checked this student's identity and all seven live poses in person.</label>
      <button type="button" className="btn btn--primary" disabled={!confirmed || locked || retakeIndex !== null} onClick={() => void save()}>{busy ? 'Checking captures…' : 'Check and save face enrollment'}</button>
    </>}
    <button type="button" className="btn" disabled={busy || camera.isStarting} onClick={() => { validation.cancel(); setRetakeIndex(null); setCaptures([]); setConfirmed(false); setError(''); void camera.startCamera(); }}>Retake all</button>
    <button type="button" className="btn" disabled={busy} onClick={onCancel}>Close enrollment</button>
  </section>;
}
