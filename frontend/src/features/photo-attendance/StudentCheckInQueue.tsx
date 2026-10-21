import { useCallback, useEffect, useRef, useState } from 'react';
import { apiMessage } from '../../lib/apiClient';
import { checkInLabel, decideCheckIn, getCheckInQueue, type CheckInRequest } from './checkInApi';

export default function StudentCheckInQueue({ sessionId, onSaved }: { sessionId: string; onSaved: () => Promise<void> | void }) {
  const [rows, setRows] = useState<CheckInRequest[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [message, setMessage] = useState(''); const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const active = useRef(true);
  const refresh = useCallback(async () => {
    const next = await getCheckInQueue(sessionId); if (active.current) setRows(next);
  }, [sessionId]);
  useEffect(() => {
    active.current = true;
    void refresh().catch(e => { if (active.current) setError(apiMessage(e)); });
    const timer = window.setInterval(() => void refresh().catch(() => {}), 30000);
    return () => { active.current = false; window.clearInterval(timer); };
  }, [refresh]);
  async function decide(id: string, status: 'PRESENT' | 'LATE' | 'REJECTED') {
    if (!confirmed[id]) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await decideCheckIn(id, status);
      if (!active.current) return;
      setRows(current => current.map(r => r.id === id ? result : r));
      setConfirmed(current => ({ ...current, [id]: false }));
      setMessage(status === 'REJECTED' ? 'Request rejected. No attendance was recorded.' : 'Attendance saved after teacher approval.');
      if (status !== 'REJECTED') {
        try { await onSaved(); } catch { setError('Attendance was saved, but the table could not refresh. Reload the session.'); }
      }
    } catch (e) { if (active.current) setError(apiMessage(e)); }
    finally { if (active.current) setBusy(false); }
  }
  return <section aria-label="Student check-in requests">
    <h3>Student check-in requests</h3>
    <p>Students were compared only with their own enrolled face. Photos are not retained and liveness is not verified. Confirm actual participation independently before approving.</p>
    <button type="button" className="btn" disabled={busy} onClick={() => { setError(''); void refresh().catch(e => setError(apiMessage(e))); }}>Refresh student requests</button>
    {!rows.length && <p>No student requests for this session.</p>}
    <ul className="vision-roster">{rows.map(row => {
      const pending = row.state === 'PENDING' && new Date(row.expiresAt).getTime() > Date.now();
      return <li key={row.id}><div><strong>{row.studentName}</strong>
        <p>Submitted {new Date(row.createdAt).toLocaleString()}</p>
        <p role="status">{checkInLabel(row.state === 'PENDING' && !pending ? 'EXPIRED' : row.state)}</p>
        {pending && <>
          <p>Review by {new Date(row.expiresAt).toLocaleTimeString()}.</p>
          <label><input type="checkbox" checked={confirmed[row.id] ?? false} disabled={busy}
            onChange={e => setConfirmed(current => ({ ...current, [row.id]: e.target.checked }))} /> I checked {row.studentName}'s participation and confirm my decision.</label>
          <div>{(['PRESENT', 'LATE', 'REJECTED'] as const).map(status => <button key={status} type="button" className="btn"
            disabled={busy || !confirmed[row.id]} onClick={() => void decide(row.id, status)}>
            {status === 'PRESENT' ? 'Approve present' : status === 'LATE' ? 'Approve late' : 'Reject request'}</button>)}</div>
        </>}
      </div></li>;
    })}</ul>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </section>;
}
