import { useCallback, useEffect, useRef, useState } from 'react';
import { apiMessage } from '../../lib/apiClient';
import { preparePhoto } from './api';
import { checkInLabel, getCheckIns, submitCheckIn, type CheckInWorkspace } from './checkInApi';
import RecognitionCamera from './RecognitionCamera';
import { formatIsoDateInAuckland, formatTimestampTimeRange } from '../../lib/sessionTime';
import type { StudentSchedule } from '../../lib/studentPortalApi';
import './photoAttendance.css';

export default function StudentCheckInPanel({ studentId, schedule, onOpenProfile }: {
  studentId: string; schedule?: StudentSchedule | null; onOpenProfile?: () => void;
}) {
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
  const today = formatIsoDateInAuckland(new Date());
  const sessions = [...(workspace?.sessions ?? [])].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const todaySessions = sessions.filter(s => formatIsoDateInAuckland(new Date(s.startTime)) === today);
  const otherSessions = sessions.filter(s => formatIsoDateInAuckland(new Date(s.startTime)) !== today);
  const renderSessions = (rows: typeof sessions) => <ul className="vision-roster">{rows.map(session => <li key={session.sessionId}>
    <div><strong>{session.course}</strong><p>{formatIsoDateInAuckland(new Date(session.startTime))} · {formatTimestampTimeRange(session.startTime, session.endTime)} (Auckland)</p>
      <p>Attendance: {session.attendanceStatus === 'UNKNOWN' ? 'Not recorded' : session.attendanceStatus}</p>
      {/* Confirmed attendance takes precedence over the separate request history. */}
      {session.attendanceStatus === 'UNKNOWN' && session.request && <p role="status">{checkInLabel(session.request.state)}</p>}
      {!session.canSubmit && session.attendanceStatus === 'UNKNOWN' && session.request?.state !== 'PENDING' && workspace?.ready && <p>Check-in is not open for this session.</p>}
    </div>
    <button type="button" className="btn btn--primary" disabled={!session.canSubmit || busy || !!cameraSession}
      onClick={() => { setRetry(null); setError(''); setMessage(''); setCameraSession(session.sessionId); }}>Check in for {session.course}</button>
  </li>)}</ul>;
  return <section className="vision-panel" aria-label="Student photo check-in">
    <h2>Today's classes</h2>
    <p>Photo requests need teacher approval. Manual attendance is always available from your teacher.</p>
    {!workspace && !error && <p role="status">Loading classes…</p>}
    {workspace?.enabled && (todaySessions.length ? renderSessions(todaySessions) : <p>No classes in today's photo check-in list.</p>)}
    {workspace && !workspace.enabled && <><p>Photo check-in is disabled. Your teacher can record attendance manually.</p>
      <ul className="vision-roster">{schedule?.sessions.filter(s => s.date === today).map(s => <li key={s.id}><div><strong>{s.courseCode} · {s.courseName}</strong><p>{formatTimestampTimeRange(s.startTime, s.endTime)} (Auckland) · {s.status}</p><p>Attendance: {s.attendanceStatus === 'UNKNOWN' ? 'Not recorded' : s.attendanceStatus}</p></div></li>)}</ul>
      {!schedule && <p>Use Full schedule to check your classes.</p>}
    </>}
    {!!otherSessions.length && <details><summary>Nearby classes ({otherSessions.length})</summary>{renderSessions(otherSessions)}</details>}
    {workspace?.enabled && !workspace.ready && <div className="student-check-in-setup"><p>Photo check-in needs optional consent and supervised face enrollment.</p>{onOpenProfile && <button type="button" className="btn" onClick={onOpenProfile}>Open profile and face enrollment</button>}</div>}
    <button type="button" className="btn" disabled={busy} onClick={() => { setError(''); void refresh().catch(e => setError(apiMessage(e))); }}>Refresh check-in status</button>
    <details><summary>How photo check-in works</summary><p>Capture only your own face. Requests open 15 minutes before class and close at its end. Teacher review expires after 30 minutes. A face match does not prove live presence.</p></details>
    {cameraSession && <RecognitionCamera key={cameraSession} selfCheckIn onCapture={image => void capture(cameraSession, image)} onClose={() => setCameraSession(null)} />}
    {busy && <p role="status">Verifying your photo…</p>}
    {retry && !busy && <div>
      <button type="button" className="btn" onClick={() => void send(retry)}>Retry this capture</button>
      <button type="button" className="btn" onClick={() => setRetry(null)}>Discard capture</button>
    </div>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </section>;
}
