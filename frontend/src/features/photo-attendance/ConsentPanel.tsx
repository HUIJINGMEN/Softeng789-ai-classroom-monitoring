import { useEffect, useState } from 'react';
import { apiMessage } from '../../lib/apiClient';
import { getProfile, setConsent } from './api';
import type { FaceProfile } from './types';
import './photoAttendance.css';

export default function ConsentPanel({ studentId }: { studentId: string }) {
  const [profile, setProfile] = useState<FaceProfile | null>(null);
  const [adult, setAdult] = useState(false); const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    getProfile(studentId).then(p => { if (active) setProfile(p); }).catch(e => { if (active) setError(apiMessage(e)); });
    return () => { active = false; };
  }, [studentId]);
  async function change(granted: boolean) {
    if (!profile) return;
    setBusy(true); setError('');
    try { setProfile(await setConsent(studentId, granted, adult, profile.noticeVersion)); setAgreed(false); }
    catch (e) { setError(apiMessage(e)); } finally { setBusy(false); }
  }
  if (!profile && !error) return null;
  return <section className="vision-panel" aria-label="Optional photo attendance">
    <h2>Optional photo attendance</h2>
    <p>Manual attendance is available without facial recognition. Participation is voluntary and does not affect access to classes.</p>
    {error && <p role="alert">{error}</p>}
    {profile?.consentActive ? <>
      <p>{profile.enrolled ? 'Face enrollment is complete.' : 'Consent recorded. Ask your teacher to complete supervised face enrollment.'}
        {' '}Consent and templates expire on {new Date(profile.expiresAt!).toLocaleDateString()}.</p>
      <button className="btn" disabled={busy} onClick={() => void change(false)}>{busy ? 'Updating…' : 'Withdraw consent and delete face templates'}</button>
      <p>Withdrawal invalidates pending photo matches. Previously confirmed attendance remains in your academic record.</p>
    </> : profile?.enabled ? <>
      <p>For this adult volunteer pilot, seven supervised face captures create an encrypted face template used to suggest your identity in class photos.
        A teacher reviews each attendance mark. No emotion, fatigue or attention is inferred. Face images are processed in memory and are not saved by this feature.
        Encrypted templates expire after 30 days; candidate data expires after 30 minutes. Review audit metadata is kept for 90 days.
        You can withdraw here at any time. Contact your teacher for access, correction or privacy questions.</p>
      <label><input type="checkbox" checked={adult} onChange={e => setAdult(e.target.checked)} /> I am 18 or older and participating voluntarily.</label>
      <label><input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} /> I consent to face enrollment and teacher-reviewed photo attendance under this notice.</label>
      <button className="btn btn--primary" disabled={busy || !adult || !agreed} onClick={() => void change(true)}>{busy ? 'Saving…' : 'Give optional consent'}</button>
    </> : <p>Photo attendance is currently disabled. Your teacher can record attendance manually.</p>}
  </section>;
}
