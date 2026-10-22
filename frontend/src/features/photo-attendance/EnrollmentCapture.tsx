import { useState } from 'react';
import { useCameraCapture } from '../../hooks/useCameraCapture';
import { apiMessage } from '../../lib/apiClient';
import { enroll } from './api';

const POSES = ['Face forward', 'Turn slightly left', 'Turn further left (keep both eyes visible)', 'Turn slightly right',
  'Turn further right (keep both eyes visible)', 'Lift your chin slightly', 'Lower your chin slightly'];

export default function EnrollmentCapture({ studentId, name, onDone, onCancel }: {
  studentId: string; name: string; onDone: () => void; onCancel: () => void;
}) {
  const camera = useCameraCapture();
  const [captures, setCaptures] = useState<string[]>([]); const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null);
  const captureIndex = retakeIndex ?? captures.length;
  function capture() {
    if (busy || captureIndex >= 7) return;
    const image = camera.captureFrame(); if (!image) return;
    const next = [...captures]; next[captureIndex] = image;
    setCaptures(next); setRetakeIndex(null); setConfirmed(false); setError('');
    if (next.length === 7) camera.stopCamera();
  }
  async function save() {
    if (busy || retakeIndex !== null || captures.length !== 7 || !confirmed) return;
    setBusy(true); setError('');
    try { await enroll(studentId, captures); onDone(); }
    catch (e) { setError(apiMessage(e)); } finally { setBusy(false); }
  }
  return <section className="vision-enrollment" aria-label={`Enroll ${name}`}>
    <h3>Supervised enrollment · {name}</h3>
    <p>Check the student's identity in person. Capture one real person in good light, without a screen or printed photo.
      Quality and identity consistency are checked; automated liveness and pose verification are not performed.</p>
    <video ref={camera.videoRef} muted playsInline className="vision-camera" hidden={captureIndex === 7} />
    {captureIndex < 7 && <>
      <p aria-live="polite"><strong>{retakeIndex === null ? 'Capture' : 'Retake capture'} {captureIndex + 1} of 7: {POSES[captureIndex]}</strong></p>
      <button type="button" className="btn" disabled={busy || !camera.stream || camera.isStarting} onClick={capture}>Capture pose</button>
      {!camera.stream && <button type="button" className="btn" disabled={busy || camera.isStarting} onClick={() => void camera.startCamera()}>Retry camera</button>}
      {retakeIndex !== null && <button type="button" className="btn" disabled={busy} onClick={() => {
        setRetakeIndex(null); if (captures.length === 7) camera.stopCamera();
      }}>Cancel retake</button>}
    </>}
    <canvas ref={camera.canvasRef} hidden />
    <div className="vision-captures">{captures.map((photo, index) => <figure key={index}>
      <img src={photo} alt={`Capture ${index + 1}: ${POSES[index]}`} /><figcaption>{index + 1}. {POSES[index]}</figcaption>
      <button type="button" className="btn" disabled={busy || camera.isStarting} aria-pressed={retakeIndex === index}
        onClick={() => { setRetakeIndex(index); setConfirmed(false); if (!camera.stream) void camera.startCamera(); }}>Retake {index + 1}</button>
    </figure>)}</div>
    {(error || camera.error) && <p role="alert">{error || camera.error}</p>}
    {captures.length === 7 && <>
      <label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={busy || retakeIndex !== null} />
        I checked this student's identity and all seven live poses in person.</label>
      <button type="button" className="btn btn--primary" disabled={!confirmed || busy || retakeIndex !== null} onClick={() => void save()}>{busy ? 'Checking captures…' : 'Check and save face enrollment'}</button>
    </>}
    <button type="button" className="btn" disabled={busy || camera.isStarting} onClick={() => { setRetakeIndex(null); setCaptures([]); setConfirmed(false); setError(''); void camera.startCamera(); }}>Retake all</button>
    <button type="button" className="btn" disabled={busy} onClick={onCancel}>Close enrollment</button>
  </section>;
}
