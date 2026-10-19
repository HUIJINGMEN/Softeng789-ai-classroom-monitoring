import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Auth } from '../hooks/useAuth';
import PasswordField from '../components/PasswordField';
import AuthPage from './AuthPage';
import { apiMessage } from '../lib/apiClient';
import { inspectAccountLink, resetAccountPassword, type AccountLinkDetails } from '../features/account-access/api';
import { passwordIssue } from '../features/account-access/accountLinkModel';
import '../features/account-access/account-access.css';

export default function AccountAccessPage({ token, auth }: { readonly token: string; readonly auth: Auth }) {
  const [details, setDetails] = useState<AccountLinkDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const submitting = useRef(false);
  const signIn = () => window.location.assign('/');
  useEffect(() => {
    delete document.body.dataset.theme;
    let cancelled = false;
    inspectAccountLink(token).then(value => { if (!cancelled) setDetails(value); })
      .catch(failure => { if (!cancelled) setError(apiMessage(failure)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    const issue = passwordIssue(password, confirmation); setError(issue);
    if (issue) return;
    submitting.current = true; setBusy(true);
    try { await resetAccountPassword(token, password); setPassword(''); setConfirmation(''); setDone(true); }
    catch (failure) { setError(apiMessage(failure)); }
    finally { submitting.current = false; setBusy(false); }
  };
  let content;
  if (loading) content = <p role="status">Checking your email link…</p>;
  else if (details && details.purpose !== 'PASSWORD_RESET') content = <AuthPage auth={auth} initialMode="register"
    verification={{ token, ...details }} onRegistered={signIn} onBack={signIn} />;
  else if (done) content = <section className="auth-card account-access" aria-live="polite">
    <h1 className="auth-card__title">Password updated</h1>
    <p className="auth-card__sub">All previous sessions are signed out. Sign in with your new password.</p>
    <button className="btn btn--primary" onClick={signIn}>Back to sign in</button>
  </section>;
  else content = <form className="auth-card account-access" onSubmit={submit} aria-busy={busy}>
    <h1 className="auth-card__title">{details ? 'Choose a new password' : 'Link unavailable'}</h1>
    {details && <>
      <p className="auth-card__sub">Resetting {details.email} signs out all existing sessions. It does not change your records.</p>
      <div className="auth-form">
        <PasswordField label="New password" value={password} onChange={setPassword} show={showPassword}
          onToggleShow={() => setShowPassword(value => !value)} autoComplete="new-password" />
        <PasswordField label="Confirm new password" value={confirmation} onChange={setConfirmation} show={showPassword}
          onToggleShow={() => setShowPassword(value => !value)} autoComplete="new-password" />
      </div>
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {details && <button className="btn btn--primary auth-form__submit" disabled={busy}>{busy ? 'Updating password…' : 'Update password'}</button>}
    <button type="button" className="auth-card__back" onClick={signIn} disabled={busy}>Back to sign in</button>
    <p className="account-access__hint">For your privacy, refreshing this page clears the link. Reopen the original email or request a new one.</p>
  </form>;
  return <main className="account-access-screen">{content}</main>;
}
