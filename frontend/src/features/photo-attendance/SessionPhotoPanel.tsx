import { useEffect, useRef, useState } from 'react';
import { apiMessage } from '../../lib/apiClient';
import { confirm, getRoster, getStatus, preparePhoto, recognize } from './api';
import EnrollmentCapture from './EnrollmentCapture';
import RecognitionCamera from './RecognitionCamera';
import PhotoFaceReview from './PhotoFaceReview';
import { buildDecisions } from './reviewModel';
import type { PhotoReview, RosterStudent } from './types';
import './photoAttendance.css';

export default function SessionPhotoPanel({ sessionId, onSaved, onManualAttendance, initialCameraOpen = false }: { sessionId: string; onSaved: () => Promise<void> | void; onManualAttendance?: () => void; initialCameraOpen?: boolean }) {
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [enabled, setEnabled] = useState(false); const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [enrolling, setEnrolling] = useState<RosterStudent | null>(null);
  const [cameraOpen, setCameraOpen] = useState(initialCameraOpen);
  const [photo, setPhoto] = useState<Blob | null>(null); const [preview, setPreview] = useState('');
  const [requestKey, setRequestKey] = useState(''); const [review, setReview] = useState<PhotoReview | null>(null);
  const [choices, setChoices] = useState<Record<string, string>>({}); const [late, setLate] = useState<Record<string, boolean>>({});
  const [consent, setConsent] = useState(false); const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [expired, setExpired] = useState(false);
  const scope = useRef(0);
  useEffect(() => { scope.current++; return () => { scope.current++; }; }, [sessionId]);
  useEffect(() => {
    let active = true;
    getStatus().then(async status => {
      if (!active) return; setEnabled(status.enabled); setStatusLoaded(true);
      if (status.enabled) { const rows = await getRoster(sessionId); if (active) setRoster(rows); }
    }).catch(e => { if (active) setError(apiMessage(e)); });
    return () => { active = false; };
  }, [sessionId]);
  useEffect(() => {
    if (!photo) { setPreview(''); return; }
    const url = URL.createObjectURL(photo); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  useEffect(() => {
    if (!review) { setExpired(false); return; }
    const remaining = new Date(review.expiresAt).getTime() - Date.now();
    setExpired(remaining <= 0);
    const timer = window.setTimeout(() => { setExpired(true); setPhoto(null); }, Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [review]);
  async function loadPhoto(file: File) {
    const epoch = scope.current;
    setBusy(true); setError(''); setMessage(''); setReview(null); setPhoto(null); setChoices({}); setLate({}); setConfirmed(false); setConsent(false);
    try { const prepared = await preparePhoto(file); if (epoch !== scope.current) return; setPhoto(prepared); setRequestKey(crypto.randomUUID()); }
    catch (e) { if (epoch === scope.current) setError(apiMessage(e)); } finally { if (epoch === scope.current) setBusy(false); }
  }
  async function analyze() {
    if (!photo || !consent || busy) return;
    const epoch = scope.current;
    setBusy(true); setError('');
    try { const result = await recognize(sessionId, photo, requestKey); if (epoch !== scope.current) return; setReview(result); setChoices({}); setLate({}); setConfirmed(false); }
    catch (e) { if (epoch === scope.current) setError(apiMessage(e)); } finally { if (epoch === scope.current) setBusy(false); }
  }
  async function recognizeCapture(image: string) {
    const epoch = scope.current;
    setCameraOpen(false); setBusy(true); setError(''); setMessage(''); setReview(null); setPhoto(null);
    setChoices({}); setLate({}); setConfirmed(false); setConsent(true);
    try {
      const blob = await (await fetch(image)).blob();
      const prepared = await preparePhoto(new File([blob], 'camera.jpg', { type: 'image/jpeg' }));
      if (epoch !== scope.current) return;
      const key = crypto.randomUUID();
      setPhoto(prepared); setRequestKey(key);
      const result = await recognize(sessionId, prepared, key);
      if (epoch === scope.current) setReview(result);
    } catch (e) { if (epoch === scope.current) setError(apiMessage(e)); } finally { if (epoch === scope.current) setBusy(false); }
  }
  function chooseIdentity(faceId: string, studentId: string) {
    setChoices(current => ({ ...current, [faceId]: studentId }));
    setLate(current => ({ ...current, [faceId]: false }));
    setConfirmed(false);
  }
  async function save() {
    if (!review || !confirmed || busy || expired) return;
    const epoch = scope.current;
    setBusy(true); setError('');
    try {
      const decisions = buildDecisions(review, choices, late);
      const saved = await confirm(review.id, decisions);
      if (epoch !== scope.current) return;
      setReview(saved); setPhoto(null);
      setMessage(`Review saved. ${decisions.filter(d => d.studentId).length} attendance marks recorded; all other students are unchanged.`);
      try { await onSaved(); } catch { setError('Attendance was saved, but the table could not refresh. Reload the session.'); }
    } catch (e) { if (epoch === scope.current) setError(apiMessage(e)); } finally { if (epoch === scope.current) setBusy(false); }
  }
  if (!enabled) return error ? <section className="vision-panel"><p role="alert">Photo attendance: {error}</p>
      {onManualAttendance && <button type="button" className="btn" onClick={onManualAttendance}>Open manual attendance</button>}</section>
    : initialCameraOpen ? <section className="vision-panel"><p role="status">{statusLoaded ? 'Photo attendance is unavailable. Use manual attendance for this session.' : 'Loading photo attendance…'}</p>
      {statusLoaded && onManualAttendance && <button type="button" className="btn" onClick={onManualAttendance}>Open manual attendance</button>}</section> : null;
  const faces = review?.result.recognition.faces ?? [];
  return <section className="vision-panel" aria-label="Photo attendance">
    <h2>Photo attendance · teacher review</h2>
    <p>Enroll consenting adult students, then photograph a group of up to 30. Each match needs your confirmation.
      Missing or unrecognized faces never create an absence. Use the attendance review table for manual attendance.</p>
    <details><summary>Face enrollment and consent status</summary>
      <p>Students give optional consent in their portal before supervised enrollment.</p>
      <button className="btn" disabled={busy} onClick={() => { setError(''); void getRoster(sessionId).then(setRoster).catch(e => setError(apiMessage(e))); }}>Refresh consent status</button>
      <ul className="vision-roster">{roster.map(student => <li key={student.studentId}>
        <span>{student.name} ({student.studentNumber}) · {student.enrolled ? 'Enrolled' : student.consentActive ? 'Ready to enroll' : 'No active consent'}</span>
        <button className="btn btn--sm" disabled={!student.consentActive || busy || !!enrolling || cameraOpen} onClick={() => setEnrolling(student)}>{student.enrolled ? 'Replace enrollment' : 'Enroll face'}</button>
      </li>)}</ul>
    </details>
    {enrolling && <EnrollmentCapture key={enrolling.studentId} studentId={enrolling.studentId} name={enrolling.name}
      onCancel={() => setEnrolling(null)} onDone={() => { setEnrolling(null); setMessage('Face enrollment saved.'); setReview(null); setPhoto(null);
        void getRoster(sessionId).then(setRoster).catch(e => setError(apiMessage(e))); }} />}
    {!cameraOpen && <button type="button" className="btn btn--primary" disabled={busy || !!enrolling} onClick={() => setCameraOpen(true)}>Open camera</button>}
    {cameraOpen && <RecognitionCamera onCapture={image => void recognizeCapture(image)} onClose={() => setCameraOpen(false)} />}
    <label className="vision-upload">Use phone camera
      <input type="file" accept="image/jpeg,image/png" capture="environment" disabled={busy || !!enrolling || cameraOpen}
        onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void loadPhoto(file); }} />
    </label>
    <label className="vision-upload">Choose saved photo
      <input type="file" accept="image/jpeg,image/png" disabled={busy || !!enrolling || cameraOpen}
        onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void loadPhoto(file); }} />
    </label>
    <p>Include only people who agreed to photo capture and biometric processing. Keep non-participants out of the frame and use manual attendance for them.</p>
    {preview && !review && !cameraOpen && <div className="vision-photo">
      <img src={preview} alt="Selected classroom photo awaiting recognition" />
    </div>}
    {photo && !review && !cameraOpen && <>
      <label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} disabled={busy} /> Everyone in this photo consented to capture and biometric processing.</label>
      <button className="btn btn--primary" disabled={busy || !consent} onClick={() => void analyze()}>{busy ? 'Recognizing faces…' : 'Recognize faces'}</button>
    </>}
    {review?.state === 'PENDING' && !expired && !cameraOpen && <>
      <p>Review expires at {new Date(review.expiresAt).toLocaleTimeString()}. Suggestions are uncalibrated pilot results; scores are cosine similarity, not confidence percentages.</p>
      <PhotoFaceReview key={review.id} review={review} preview={preview} choices={choices} late={late} busy={busy}
        onChoose={chooseIdentity} onLate={(faceId, value) => { setLate(current => ({ ...current, [faceId]: value })); setConfirmed(false); }} />
      {!!faces.length && <>
        <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} /> I checked every face and confirm these attendance decisions.</label>
        <button className="btn btn--primary" disabled={busy || !confirmed || faces.some(face => !choices[face.faceId])} onClick={() => void save()}>{busy ? 'Saving review…' : 'Confirm and save attendance'}</button>
      </>}
    </>}
    {onManualAttendance && !cameraOpen && <button type="button" className="btn" disabled={busy} onClick={onManualAttendance}>Open manual attendance</button>}
    {expired && <p role="status">This review has expired. Take a new photo or use manual attendance.</p>}
    {busy && <p role="status">{review ? 'Saving review…' : 'Preparing or recognizing photo…'}</p>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {photo && !cameraOpen && <button className="btn" disabled={busy} onClick={() => { setPhoto(null); setReview(null); setChoices({}); setConfirmed(false); }}>Discard photo</button>}
  </section>;
}
