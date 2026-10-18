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
  function capture() {
    const image = camera.captureFrame(); if (!image) return;
    setCaptures(current => [...current, image]);
    if (captures.length === 6) camera.stopCamera();
  }
  async function save() {
    setBusy(true); setError('');
    try { await enroll(studentId, captures); onDone(); }
    catch (e) { setError(apiMessage(e)); } finally { setBusy(false); }
  }
  return <section className="vision-enrollment" aria-label={`Enroll ${name}`}>
    <h3>Supervised enrollment · {name}</h3>
    <p>Check the student's identity in person. Capture one real person in good light, without a screen or printed photo.
      Quality and identity consistency are checked; automated liveness and pose verification are not performed.</p>
    <video ref={camera.videoRef} muted playsInline className="vision-camera" hidden={captures.length === 7} />
    {captures.length < 7 && <>
      <p><strong>Capture {captures.length + 1} of 7: {POSES[captures.length]}</strong></p>
      <button className="btn" disabled={!camera.stream || camera.isStarting} onClick={capture}>Capture pose</button>
      {!camera.stream && <button className="btn" onClick={() => void camera.startCamera()}>Retry camera</button>}
    </>}
    <canvas ref={camera.canvasRef} hidden />
    <div className="vision-captures">{captures.map((photo, index) => <figure key={index}>
      <img src={photo} alt={`Capture ${index + 1}: ${POSES[index]}`} /><figcaption>{index + 1}. {POSES[index]}</figcaption>
    </figure>)}</div>
    {(error || camera.error) && <p role="alert">{error || camera.error}</p>}
    {captures.length === 7 && <>
      <label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={busy} />
        I checked this student's identity and all seven live poses in person.</label>
      <button className="btn btn--primary" disabled={!confirmed || busy} onClick={() => void save()}>{busy ? 'Checking captures…' : 'Check and save face enrollment'}</button>
    </>}
    <button className="btn" disabled={busy} onClick={() => { setCaptures([]); setConfirmed(false); setError(''); void camera.startCamera(); }}>Retake all</button>
    <button className="btn" disabled={busy} onClick={onCancel}>Close enrollment</button>
  </section>;
}
