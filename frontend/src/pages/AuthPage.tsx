import { type FormEvent, useState } from 'react';
import PasswordField from '../components/PasswordField';
import type { Auth } from '../hooks/useAuth';
import type { UserRole } from '../types';

type Mode = 'login' | 'register';

interface Props {
  readonly auth: Auth;
  readonly initialMode?: Mode;
  readonly onBack?: () => void;
}

export default function AuthPage({ auth, initialMode = 'login', onBack }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [role, setRole] = useState<UserRole>('student');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [studentNumber, setStudentNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [course, setCourse] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);

  const [staffNumber, setStaffNumber] = useState('');
  const [teacherName, setTeacherName] = useState('');

  const errorMessage = localError || auth.error;

  const switchMode = (next: Mode) => {
    setMode(next);
    setLocalError('');
    auth.clearError();
  };

  const switchRole = (next: UserRole) => {
    setRole(next);
    setLocalError('');
    auth.clearError();
  };

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError('');
    if (!email.trim() || !password) {
      setLocalError('Enter your email and password.');
      return;
    }
    await auth.login({ email: email.trim(), password });
  };

  const submitRegister = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError('');

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    if (role === 'student') {
      if (!studentNumber.trim() || !email.trim() || !fullName.trim() || !course.trim()) {
        setLocalError('Fill in every field.');
        return;
      }
      if (!consentGiven) {
        setLocalError('You must consent to continue.');
        return;
      }
      await auth.registerStudent({
        studentNumber: studentNumber.trim(),
        universityEmail: email.trim(),
        fullName: fullName.trim(),
        course: course.trim(),
        password,
        consentGiven
      });
      return;
    }

    if (!staffNumber.trim() || !email.trim() || !teacherName.trim()) {
      setLocalError('Fill in every field.');
      return;
    }
    await auth.registerTeacher({
      staffNumber: staffNumber.trim(),
      email: email.trim(),
      name: teacherName.trim(),
      password
    });
  };

  return (
    <>
      {mode === 'login' ? (
          <form
            className="auth-card"
            onSubmit={submitLogin}
            onClick={(event) => event.stopPropagation()}
            noValidate
          >
            {onBack && (
              <button type="button" className="auth-card__back" onClick={onBack}>
                ← Back to home
              </button>
            )}
            <div className="auth-card__eyebrow">Welcome back</div>
            <h2 className="auth-card__title">Sign in</h2>
            <p className="auth-card__sub">
              Use the email and password from your student or teacher account.
            </p>

            <div className="auth-form">
              <label className="field">
                Email
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@auckland.ac.nz"
                />
              </label>

              <PasswordField
                label="Password"
                value={password}
                onChange={setPassword}
                show={showPassword}
                onToggleShow={() => setShowPassword((current) => !current)}
                autoComplete="current-password"
                placeholder="••••••••"
              />

              {errorMessage && <div className="form-error">{errorMessage}</div>}

              <button type="submit" className="btn btn--primary auth-form__submit" disabled={auth.busy}>
                {auth.busy ? 'Signing in...' : 'Sign in'}
              </button>
            </div>

            <div className="auth-card__switch">
              New here?{' '}
              <button type="button" onClick={() => switchMode('register')}>
                Create an account
              </button>
            </div>
          </form>
        ) : (
          <form
            className="auth-card auth-card--wide"
            onSubmit={submitRegister}
            onClick={(event) => event.stopPropagation()}
            noValidate
          >
            {onBack && (
              <button type="button" className="auth-card__back" onClick={onBack}>
                ← Back to home
              </button>
            )}
            <div className="auth-card__eyebrow">Get started</div>
            <h2 className="auth-card__title">Create your account</h2>
            <p className="auth-card__sub">Pick a role to get started.</p>

            <div className="role-toggle">
              <button
                type="button"
                className={`role-toggle__btn${role === 'student' ? ' role-toggle__btn--on' : ''}`}
                onClick={() => switchRole('student')}
              >
                <span className="role-toggle__label">Student</span>
                <span className="role-toggle__hint">Track your attendance</span>
              </button>
              <button
                type="button"
                className={`role-toggle__btn${role === 'teacher' ? ' role-toggle__btn--on' : ''}`}
                onClick={() => switchRole('teacher')}
              >
                <span className="role-toggle__label">Teacher</span>
                <span className="role-toggle__hint">Run classroom sessions</span>
              </button>
            </div>

            <div className="auth-form">
              {role === 'student' ? (
                <div className="auth-form__grid">
                  <label className="field field--wide">
                    Full name
                    <input
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Ana Ngata"
                    />
                  </label>
                  <label className="field">
                    Student ID
                    <input
                      value={studentNumber}
                      onChange={(event) => setStudentNumber(event.target.value)}
                      placeholder="123456789"
                    />
                  </label>
                  <label className="field">
                    University email
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="ana.ngata@aucklanduni.ac.nz"
                    />
                  </label>
                  <label className="field">
                    Course
                    <input
                      value={course}
                      onChange={(event) => setCourse(event.target.value)}
                      placeholder="COMPSCI 730"
                    />
                  </label>
                  <PasswordField
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    show={showPassword}
                    onToggleShow={() => setShowPassword((current) => !current)}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                  />
                  <label className="field">
                    Confirm password
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Repeat password"
                    />
                  </label>
                  <label className="consent-row field--wide">
                    <input
                      type="checkbox"
                      checked={consentGiven}
                      onChange={(event) => setConsentGiven(event.target.checked)}
                    />
                    <span>
                      I consent to this system storing my attendance and, later, a face
                      enrolment photo.
                    </span>
                  </label>
                </div>
              ) : (
                <div className="auth-form__grid">
                  <label className="field field--wide">
                    Full name
                    <input
                      value={teacherName}
                      onChange={(event) => setTeacherName(event.target.value)}
                      placeholder="Dr. Dana Kessler"
                    />
                  </label>
                  <label className="field">
                    Staff ID
                    <input value={staffNumber} onChange={(event) => setStaffNumber(event.target.value)} placeholder="STAFF-0142" />
                  </label>
                  <label className="field">
                    Email
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="dana.kessler@auckland.ac.nz"
                    />
                  </label>
                  <PasswordField
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    show={showPassword}
                    onToggleShow={() => setShowPassword((current) => !current)}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                  />
                  <label className="field">
                    Confirm password
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Repeat password"
                    />
                  </label>
                </div>
              )}

              {errorMessage && <div className="form-error">{errorMessage}</div>}

              <button type="submit" className="btn btn--primary auth-form__submit" disabled={auth.busy}>
                {auth.busy ? 'Creating account...' : `Create ${role} account`}
              </button>
            </div>

            <div className="auth-card__switch">
              Already have an account?{' '}
              <button type="button" onClick={() => switchMode('login')}>
                Sign in
              </button>
            </div>
          </form>
        )}
    </>
  );
}
