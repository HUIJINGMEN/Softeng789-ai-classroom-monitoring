import { useEffect, useState } from 'react';
import { apiMessage } from '../../lib/apiClient';
import { confirm, getRoster, getStatus, preparePhoto, recognize } from './api';
import EnrollmentCapture from './EnrollmentCapture';
import RecognitionCamera from './RecognitionCamera';
import StudentCheckInQueue from './StudentCheckInQueue';
import { buildDecisions } from './reviewModel';
import type { PhotoReview, RosterStudent } from './types';
import './photoAttendance.css';

export default function SessionPhotoPanel({ sessionId, onSaved }: { sessionId: string; onSaved: () => Promise<void> | void }) {
  const [enabled, setEnabled] = useState(false); const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [enrolling, setEnrolling] = useState<RosterStudent | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photo, setPhoto] = useState<Blob | null>(null); const [preview, setPreview] = useState('');
  const [requestKey, setRequestKey] = useState(''); const [review, setReview] = useState<PhotoReview | null>(null);
  const [choices, setChoices] = useState<Record<string, string>>({}); const [late, setLate] = useState<Record<string, boolean>>({});
  const [consent, setConsent] = useState(false); const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    let active = true;
    getStatus().then(async status => {
      if (!active) return; setEnabled(status.enabled);
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
    setBusy(true); setError(''); setMessage(''); setReview(null); setPhoto(null); setChoices({}); setLate({}); setConfirmed(false); setConsent(false);
    try { setPhoto(await preparePhoto(file)); setRequestKey(crypto.randomUUID()); }
    catch (e) { setError(apiMessage(e)); } finally { setBusy(false); }
  }
  async function analyze() {
    if (!photo || !consent) return;
    setBusy(true); setError('');
    try { setReview(await recognize(sessionId, photo, requestKey)); setChoices({}); setLate({}); setConfirmed(false); }
    catch (e) { setError(apiMessage(e)); } finally { setBusy(false); }
  }
  async function recognizeCapture(image: string) {
    setCameraOpen(false); setBusy(true); setError(''); setMessage(''); setReview(null); setPhoto(null);
    setChoices({}); setLate({}); setConfirmed(false); setConsent(true);
    try {
      const blob = await (await fetch(image)).blob();
      const prepared = await preparePhoto(new File([blob], 'camera.jpg', { type: 'image/jpeg' }));
      const key = crypto.randomUUID();
      setPhoto(prepared); setRequestKey(key);
      setReview(await recognize(sessionId, prepared, key));
    } catch (e) { setError(apiMessage(e)); } finally { setBusy(false); }
  }
  function chooseIdentity(faceId: string, studentId: string) {
    setChoices(current => ({ ...current, [faceId]: studentId }));
    setConfirmed(false);
  }
  async function save() {
    if (!review || !confirmed) return;
    setBusy(true); setError('');
    try {
      const decisions = buildDecisions(review, choices, late);
      const saved = await confirm(review.id, decisions); setReview(saved); setPhoto(null);
      setMessage(`Review saved. ${decisions.filter(d => d.studentId).length} attendance marks recorded; all other students are unchanged.`);
      try { await onSaved(); } catch { setError('Attendance was saved, but the table could not refresh. Reload the session.'); }
    } catch (e) { setError(apiMessage(e)); } finally { setBusy(false); }
  }
  if (!enabled) return error ? <section className="vision-panel"><p role="alert">Photo attendance: {error}</p></section> : null;
  const faces = review?.result.recognition.faces ?? [];
  return <section className="vision-panel" aria-label="Photo attendance">
    <h2>Photo attendance · teacher review</h2>
    <StudentCheckInQueue key={sessionId} sessionId={sessionId} onSaved={onSaved} />
    <p>Enroll consenting adult students, then photograph a group of up to 30. Each match needs your confirmation.
      Missing or unrecognized faces never create an absence. Manual attendance remains available below.</p>
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
    <label className="vision-upload">Or take or choose a photo file
      <input type="file" accept="image/jpeg,image/png" capture="environment" disabled={busy || !!enrolling || cameraOpen}
        onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void loadPhoto(file); }} />
    </label>
    <p>Include only people who agreed to photo capture and biometric processing. Keep non-participants out of the frame and use manual attendance for them.</p>
    {preview && !cameraOpen && <div className="vision-photo">
      <img src={preview} alt="Selected classroom photo with numbered detected faces" />
      {faces.map((face, index) => <span key={face.faceId} className="vision-box" style={{ left: `${face.box.x * 100}%`, top: `${face.box.y * 100}%`, width: `${face.box.width * 100}%`, height: `${face.box.height * 100}%` }}><b>{index + 1}</b></span>)}
    </div>}
    {photo && !review && !cameraOpen && <>
      <label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} disabled={busy} /> Everyone in this photo consented to capture and biometric processing.</label>
      <button className="btn btn--primary" disabled={busy || !consent} onClick={() => void analyze()}>{busy ? 'Recognizing faces…' : 'Recognize faces'}</button>
    </>}
    {review?.state === 'PENDING' && !expired && !cameraOpen && <>
      <p>Review expires at {new Date(review.expiresAt).toLocaleTimeString()}. Suggestions are uncalibrated pilot results; scores are cosine similarity, not confidence percentages.</p>
      {!faces.length && <p>No faces detected. Try a closer, well-lit photo or record attendance manually.</p>}
      <div className="vision-review-grid">{faces.map((face, index) => <article key={face.faceId}>
        <h3>Face {index + 1} · {face.decision.replace(/_/g, ' ').toLowerCase()}</h3>
        {!!face.qualityReasons.length && <p>{face.qualityReasons.join(', ').replace(/_/g, ' ')}</p>}
        {face.candidates.length ? <div className="vision-candidates">
          <p>Suggested matches — select a name after checking the photo.</p>
          {face.candidates.map(candidate => {
            const student = review.result.roster.find(s => s.studentId === candidate.studentId);
            if (!student) return null;
            const selected = choices[face.faceId] === student.studentId;
            return <button key={student.studentId} type="button" className="btn vision-candidate" disabled={busy}
              aria-label={`Select ${student.name} for face ${index + 1}`} aria-pressed={selected}
              onClick={() => chooseIdentity(face.faceId, student.studentId)}>
              <strong>{selected ? 'Selected: ' : ''}{student.name}</strong>
              <span>Similarity {candidate.similarity.toFixed(3)}</span>
            </button>;
          })}
        </div> : <p>No identity suggestion. Confirm manually or exclude.</p>}
        <label>Confirm identity for face {index + 1}
          <select value={choices[face.faceId] ?? ''} disabled={busy} onChange={e => chooseIdentity(face.faceId, e.target.value)}>
            <option value="">Choose after checking the photo</option><option value="EXCLUDE">Exclude / cannot identify</option>
            {review.result.roster.map(s => <option key={s.studentId} value={s.studentId}>{s.name} ({s.studentNumber})</option>)}
          </select>
        </label>
        <p className="vision-selection" role="status">
          {choices[face.faceId] === 'EXCLUDE' ? 'Excluded — no attendance will be recorded for this face.'
            : choices[face.faceId] ? `Selected: ${review.result.roster.find(s => s.studentId === choices[face.faceId])?.name} — not saved yet.`
            : 'No student selected yet.'}
        </p>
        <label><input type="checkbox" checked={late[face.faceId] ?? false} disabled={busy || !choices[face.faceId] || choices[face.faceId] === 'EXCLUDE'}
          onChange={e => { setLate(current => ({ ...current, [face.faceId]: e.target.checked })); setConfirmed(false); }} /> Mark this student late</label>
      </article>)}</div>
      {!!faces.length && <>
        <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} /> I checked every face and confirm these attendance decisions.</label>
        <button className="btn btn--primary" disabled={busy || !confirmed || faces.some(face => !choices[face.faceId])} onClick={() => void save()}>{busy ? 'Saving review…' : 'Confirm and save attendance'}</button>
      </>}
    </>}
    {expired && <p role="status">This review has expired. Take a new photo or use manual attendance.</p>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {photo && !cameraOpen && <button className="btn" disabled={busy} onClick={() => { setPhoto(null); setReview(null); setChoices({}); setConfirmed(false); }}>Discard photo</button>}
  </section>;
}
