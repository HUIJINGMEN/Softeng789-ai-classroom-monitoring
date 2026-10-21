import { useCallback, useEffect, useRef, useState } from 'react';
import { apiMessage } from '../../lib/apiClient';
import { preparePhoto } from './api';
import { checkInLabel, getCheckIns, submitCheckIn, type CheckInWorkspace } from './checkInApi';
import RecognitionCamera from './RecognitionCamera';
import './photoAttendance.css';

export default function StudentCheckInPanel({ studentId }: { studentId: string }) {
  const [workspace, setWorkspace] = useState<CheckInWorkspace | null>(null);
  const [cameraSession, setCameraSession] = useState<string | null>(null);
  const [retry, setRetry] = useState<{ sessionId: string; image: Blob; key: string } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const active = useRef(true);
  const refresh = useCallback(async () => {
    const data = await getCheckIns(studentId);
    if (active.current) setWorkspace(data);
  }, [studentId]);
  useEffect(() => {
    active.current = true;
    void refresh().catch(e => { if (active.current) setError(apiMessage(e)); });
    const timer = window.setInterval(() => void refresh().catch(() => {}), 30000);
    return () => { active.current = false; window.clearInterval(timer); };
  }, [refresh]);
  // Keep failed captures only in memory for a short, explicit retry window.
  useEffect(() => {
    if (!retry) return;
    const timer = window.setTimeout(() => setRetry(null), 5 * 60 * 1000);
    return () => window.clearTimeout(timer);
  }, [retry]);
  useEffect(() => {
    if (workspace && !workspace.ready) { setCameraSession(null); setRetry(null); }
  }, [workspace]);
  async function send(capture: NonNullable<typeof retry>) {
    setBusy(true); setError(''); setMessage('');
    try {
      await submitCheckIn(studentId, capture.sessionId, capture.image, capture.key);
      if (!active.current) return;
      setRetry(null); setMessage('Request received. The current status is shown with your class.');
      await refresh();
    } catch (e) { if (active.current) setError(apiMessage(e)); }
    finally { if (active.current) setBusy(false); }
  }
  async function capture(sessionId: string, image: string) {
    setCameraSession(null); setBusy(true); setError(''); setMessage(''); setRetry(null);
    try {
      const blob = await (await fetch(image)).blob();
      const prepared = await preparePhoto(new File([blob], 'check-in.jpg', { type: 'image/jpeg' }));
      if (!active.current) return;
      const next = { sessionId, image: prepared, key: crypto.randomUUID() };
      setRetry(next); await send(next);
    } catch (e) { if (active.current) setError(apiMessage(e)); }
    finally { if (active.current) setBusy(false); }
  }
  if (workspace && !workspace.enabled) return null;
  return <section className="vision-panel" aria-label="Student photo check-in">
    <h2>Request photo attendance</h2>
    <p>Capture your own face for a class you are enrolled in. A teacher must confirm participation before attendance is saved. Manual attendance is always available from your teacher.</p>
    <p>Requests open 15 minutes before class and close at its end. Teacher review expires after 30 minutes. A face match does not prove live presence.</p>
    <button type="button" className="btn" disabled={busy} onClick={() => { setError(''); void refresh().catch(e => setError(apiMessage(e))); }}>Refresh check-in status</button>
    {!workspace && !error && <p role="status">Loading classes…</p>}
    {workspace && !workspace.ready && <p>Give optional consent above and complete supervised face enrollment with your teacher, then refresh.</p>}
    {workspace?.sessions.length === 0 && <p>No enrolled classes in the current check-in list. Classes from the last 24 hours through the next 24 hours appear here.</p>}
    <ul className="vision-roster">{workspace?.sessions.map(session => <li key={session.sessionId}>
      <div><strong>{session.course}</strong><p>{new Date(session.startTime).toLocaleString(undefined, { timeZone: 'Pacific/Auckland' })} – {new Date(session.endTime).toLocaleTimeString(undefined, { timeZone: 'Pacific/Auckland' })} (Auckland)</p>
        <p>Attendance: {session.attendanceStatus}</p>
        {/* Attendance may be recorded through teacher photo recognition or manual entry.
            Once marked, that record takes precedence over the separate request history. */}
        {session.attendanceStatus === 'UNKNOWN' && session.request && <p role="status">{checkInLabel(session.request.state)}</p>}
        {!session.canSubmit && session.attendanceStatus === 'UNKNOWN' && session.request?.state !== 'PENDING' && workspace.ready && <p>Check-in is not open for this session.</p>}
      </div>
      <button type="button" className="btn btn--primary" disabled={!session.canSubmit || busy || !!cameraSession}
        onClick={() => { setRetry(null); setError(''); setMessage(''); setCameraSession(session.sessionId); }}>Check in for {session.course}</button>
    </li>)}</ul>
    {cameraSession && <RecognitionCamera key={cameraSession} selfCheckIn onCapture={image => void capture(cameraSession, image)} onClose={() => setCameraSession(null)} />}
    {busy && <p role="status">Verifying your photo…</p>}
    {retry && !busy && <div>
      <button type="button" className="btn" onClick={() => void send(retry)}>Retry this capture</button>
      <button type="button" className="btn" onClick={() => setRetry(null)}>Discard capture</button>
    </div>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </section>;
}
