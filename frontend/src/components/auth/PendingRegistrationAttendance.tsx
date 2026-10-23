import { useEffect, useState } from 'react';
import { apiMessage, request } from '../../lib/apiClient';

export default function PendingRegistrationAttendance({ studentId }: { studentId: string }) {
  const [choice, setChoice] = useState<{ attendanceMode: string; faceReviewState: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    request<{ attendanceMode: string; faceReviewState: string }>(`/api/auth/students/${studentId}/registration-attendance`)
      .then(value => { if (!cancelled) setChoice(value); }).catch(e => { if (!cancelled) setError(apiMessage(e)); });
    return () => { cancelled = true; };
  }, [studentId]);
  async function useManual() {
    setBusy(true); setError('');
    try {
      await request(`/api/auth/students/${studentId}/registration-attendance/manual`, { method: 'PUT' });
      setChoice({ attendanceMode: 'MANUAL', faceReviewState: 'PENDING' });
    } catch (e) { setError(apiMessage(e)); } finally { setBusy(false); }
  }
  return <div>
    {choice?.attendanceMode === 'MANUAL' && <p>Manual attendance selected. Your registration does not require face photos.</p>}
    {choice?.attendanceMode === 'FACE' && <>
      <p>{choice.faceReviewState === 'EXPIRED' ? 'Your registration photos expired. Switch to manual attendance so an administrator can approve your account.' : 'Your face captures are awaiting administrator review. They are not active for attendance yet.'}</p>
      <p>Switching to manual attendance removes your pending photos and templates. You can arrange face enrollment after approval.</p>
      <button className="btn" disabled={busy} onClick={() => void useManual()}>{busy ? 'Updating…' : 'Remove photos and use manual attendance'}</button>
    </>}
    {error && <p role="alert">{error}</p>}
    <button className="btn" onClick={() => window.location.reload()}>Refresh approval status</button>
  </div>;
}
