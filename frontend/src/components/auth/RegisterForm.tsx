import type { FormEvent } from 'react';
import FaceEnrollmentFlow from '../FaceEnrollmentFlow';
import PasswordField from '../PasswordField';
import type { PublicClassSummaryApiResponse } from '../../lib/classAdminApi';
import type { FaceEnrollmentCapture, UserRole } from '../../types';

interface Props {
  readonly role: UserRole;
  readonly onSwitchRole: (role: UserRole) => void;

  readonly email: string;
  readonly onEmailChange: (value: string) => void;
  readonly password: string;
  readonly onPasswordChange: (value: string) => void;
  readonly confirmPassword: string;
  readonly onConfirmPasswordChange: (value: string) => void;
  readonly showPassword: boolean;
  readonly onToggleShowPassword: () => void;

  readonly fullName: string;
  readonly onFullNameChange: (value: string) => void;
  readonly studentNumber: string;
  readonly onStudentNumberChange: (value: string) => void;
  readonly classes: readonly PublicClassSummaryApiResponse[];
  readonly classesLoading: boolean;
  readonly classesError: string;
  readonly selectedClassIds: readonly string[];
  readonly onToggleClass: (id: string) => void;
  readonly consentGiven: boolean;
  readonly onConsentChange: (value: boolean) => void;
  readonly captures: FaceEnrollmentCapture[];
  readonly onCapturesChange: (captures: FaceEnrollmentCapture[]) => void;

  readonly staffNumber: string;
  readonly onStaffNumberChange: (value: string) => void;
  readonly teacherName: string;
  readonly onTeacherNameChange: (value: string) => void;

  readonly errorMessage: string;
  readonly busy: boolean;
  readonly onSubmit: (event: FormEvent) => void;
  readonly onSwitchToLogin: () => void;
  readonly onBack?: () => void;
}

export default function RegisterForm({
  role,
  onSwitchRole,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  showPassword,
  onToggleShowPassword,
  fullName,
  onFullNameChange,
  studentNumber,
  onStudentNumberChange,
  classes,
  classesLoading,
  classesError,
  selectedClassIds,
  onToggleClass,
  consentGiven,
  onConsentChange,
  captures,
  onCapturesChange,
  staffNumber,
  onStaffNumberChange,
  teacherName,
  onTeacherNameChange,
  errorMessage,
  busy,
  onSubmit,
  onSwitchToLogin,
  onBack
}: Props) {
  return (
    <form
      className={`auth-card auth-card--wide${role === 'student' ? ' auth-card--registration' : ''}`}
      onSubmit={onSubmit}
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
          onClick={() => onSwitchRole('student')}
        >
          <span className="role-toggle__label">Student</span>
          <span className="role-toggle__hint">Track your attendance</span>
        </button>
        <button
          type="button"
          className={`role-toggle__btn${role === 'teacher' ? ' role-toggle__btn--on' : ''}`}
          onClick={() => onSwitchRole('teacher')}
        >
          <span className="role-toggle__label">Teacher</span>
          <span className="role-toggle__hint">Run classroom sessions</span>
        </button>
      </div>

      <div className="auth-form">
        {role === 'student' ? (
          <>
            <div className="auth-form__grid">
              <label className="field field--wide">
                Full name
                <input
                  value={fullName}
                  onChange={(event) => onFullNameChange(event.target.value)}
                  placeholder="Ana Ngata"
                />
              </label>
              <label className="field">
                Student ID
                <input
                  value={studentNumber}
                  onChange={(event) => onStudentNumberChange(event.target.value)}
                  placeholder="123456789"
                />
              </label>
              <label className="field">
                University email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => onEmailChange(event.target.value)}
                  placeholder="ana.ngata@aucklanduni.ac.nz"
                />
              </label>
              <div className="field field--wide">
                <span>Classes</span>
                {classesError && (
                  <div className="notice notice--warn">
                    <span className="notice__mark" aria-hidden="true" />
                    <span>Could not load classes: {classesError}</span>
                  </div>
                )}
                {!classesLoading && !classesError && classes.length === 0 && (
                  <div className="empty empty--inline">
                    No classes are open for registration yet. Contact your Admin.
                  </div>
                )}
                {classes.length > 0 && (
                  <div className="course-checklist" aria-label="Choose your classes">
                    {classes.map((klass) => (
                      <label key={klass.id} className="course-checklist__item">
                        <input
                          type="checkbox"
                          checked={selectedClassIds.includes(klass.id)}
                          onChange={() => onToggleClass(klass.id)}
                        />
                        <span>
                          {klass.courseCode} — {klass.academicTerm}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <PasswordField
                label="Password"
                value={password}
                onChange={onPasswordChange}
                show={showPassword}
                onToggleShow={onToggleShowPassword}
                autoComplete="new-password"
                placeholder="At least 8 characters"
              />
              <label className="field">
                Confirm password
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => onConfirmPasswordChange(event.target.value)}
                  placeholder="Repeat password"
                />
              </label>
              <label className="consent-row field--wide">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(event) => onConsentChange(event.target.checked)}
                />
                <span>I consent to this system storing my attendance and face enrolment photos.</span>
              </label>
            </div>

            <div className="field field--wide">
              <span>Face enrolment</span>
              <FaceEnrollmentFlow captures={captures} onChange={onCapturesChange} />
            </div>
          </>
        ) : (
          <div className="auth-form__grid">
            <label className="field field--wide">
              Full name
              <input
                value={teacherName}
                onChange={(event) => onTeacherNameChange(event.target.value)}
                placeholder="Dr. Dana Kessler"
              />
            </label>
            <label className="field">
              Staff ID
              <input
                value={staffNumber}
                onChange={(event) => onStaffNumberChange(event.target.value)}
                placeholder="STAFF-0142"
              />
            </label>
            <label className="field">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                placeholder="dana.kessler@auckland.ac.nz"
              />
            </label>
            <PasswordField
              label="Password"
              value={password}
              onChange={onPasswordChange}
              show={showPassword}
              onToggleShow={onToggleShowPassword}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
            <label className="field">
              Confirm password
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => onConfirmPasswordChange(event.target.value)}
                placeholder="Repeat password"
              />
            </label>
          </div>
        )}

        {errorMessage && <div className="form-error">{errorMessage}</div>}

        <button type="submit" className="btn btn--primary auth-form__submit" disabled={busy}>
          {busy ? 'Creating account...' : `Create ${role} account`}
        </button>
      </div>

      <div className="auth-card__switch">
        Already have an account?{' '}
        <button type="button" onClick={onSwitchToLogin}>
          Sign in
        </button>
      </div>
    </form>
  );
}
