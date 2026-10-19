import { useRef, useState, type FormEvent } from 'react';
import { apiMessage } from '../../lib/apiClient';
import { requestAccountLink, type AccountLinkPurpose } from './api';
import './account-access.css';

interface Props {
  readonly purpose: AccountLinkPurpose;
  readonly onPurposeChange?: (purpose: AccountLinkPurpose) => void;
  readonly onBack: () => void;
}
export default function AccountLinkRequestForm({ purpose, onPurposeChange, onBack }: Props) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const reset = purpose === 'PASSWORD_RESET';
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim()) || email.trim().length > 255) {
      setError('Enter a valid email address.'); return;
    }
    submitting.current = true; setBusy(true);
    try { setMessage((await requestAccountLink(email.trim(), purpose)).message); }
    catch (failure) { setError(apiMessage(failure)); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <form className="auth-card account-access" onSubmit={submit} aria-busy={busy}>
    <button type="button" className="auth-card__back" onClick={onBack} disabled={busy}>Back to sign in</button>
    <h2 className="auth-card__title">{reset ? 'Reset your password' : 'Verify your email'}</h2>
    <p className="auth-card__sub">{reset
      ? 'Use the email registered to your account. We will send a single-use link valid for 30 minutes.'
      : 'Verify your mailbox before setting up your account. Staff must already have an account added by an administrator.'}</p>
    <div className="auth-form">
      {!reset && onPurposeChange && <fieldset className="account-access__roles" disabled={busy || !!message}>
        <legend>Account type</legend>
        {(['STUDENT_REGISTRATION', 'STAFF_ACTIVATION'] as const).map(option => <label key={option}>
          <input type="radio" name="account-type" checked={purpose === option} onChange={() => onPurposeChange(option)} />
          {option === 'STUDENT_REGISTRATION' ? 'Student' : 'Staff'}
        </label>)}
      </fieldset>}
      <label className="field">Email
        <input type="email" autoComplete="email" required maxLength={255} value={email}
          onChange={event => setEmail(event.target.value)} disabled={busy || !!message} />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message ? <div role="status" className="account-access__notice">
        <h3>Check your inbox</h3><p>{message}</p>
        <p>Opening the email link does not change your password. Only submitting the next form does.</p>
      </div> : <button type="submit" className="btn btn--primary auth-form__submit" disabled={busy}>
        {busy ? 'Requesting link…' : 'Send email link'}
      </button>}
    </div>
  </form>;
}
