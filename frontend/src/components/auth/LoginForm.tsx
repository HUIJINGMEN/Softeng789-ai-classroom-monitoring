import type { FormEvent } from 'react';
import PasswordField from '../PasswordField';

interface Props {
  readonly email: string;
  readonly onEmailChange: (value: string) => void;
  readonly password: string;
  readonly onPasswordChange: (value: string) => void;
  readonly showPassword: boolean;
  readonly onToggleShowPassword: () => void;
  readonly errorMessage: string;
  readonly busy: boolean;
  readonly onSubmit: (event: FormEvent) => void;
  readonly onSwitchToRegister: () => void;
  readonly onBack?: () => void;
}

export default function LoginForm({
  email,
  onEmailChange,
  password,
  onPasswordChange,
  showPassword,
  onToggleShowPassword,
  errorMessage,
  busy,
  onSubmit,
  onSwitchToRegister,
  onBack
}: Props) {
  return (
    <form className="auth-card" onSubmit={onSubmit} noValidate>
      {onBack && (
        <button type="button" className="auth-card__back" onClick={onBack}>
          ← Back to home
        </button>
      )}
      <div className="auth-card__eyebrow">Welcome back</div>
      <h2 className="auth-card__title">Sign in</h2>
      <p className="auth-card__sub">Use the email and password from your student or teacher account.</p>

      <div className="auth-form">
        <label className="field">
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="you@auckland.ac.nz"
          />
        </label>

        <PasswordField
          label="Password"
          value={password}
          onChange={onPasswordChange}
          show={showPassword}
          onToggleShow={onToggleShowPassword}
          autoComplete="current-password"
          placeholder="••••••••"
        />

        {errorMessage && <div className="form-error">{errorMessage}</div>}

        <button type="submit" className="btn btn--primary auth-form__submit" disabled={busy}>
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </div>

      <div className="auth-card__switch">
        New here?{' '}
        <button type="button" onClick={onSwitchToRegister}>
          Create an account
        </button>
      </div>
    </form>
  );
}
