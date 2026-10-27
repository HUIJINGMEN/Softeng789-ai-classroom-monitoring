import { useId, type FormEvent } from 'react';
import PasswordField from '../PasswordField';
import SelectMenu from '../SelectMenu';
import { IconChevronLeft } from '../icons';
import type { PublicClassSummaryApiResponse } from '../../lib/classAdminApi';
import { STUDENT_LEVEL_OPTIONS } from '../../lib/studentLevels';
import type { StudentLevel, UserRole } from '../../types';
import RegistrationCourseSelector from './RegistrationCourseSelector';
import StudentRegistrationProgress from './StudentRegistrationProgress';

interface Props {
  readonly verifiedEmail?: boolean;
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
  readonly level: StudentLevel;
  readonly onLevelChange: (value: StudentLevel) => void;
  readonly classes: readonly PublicClassSummaryApiResponse[];
  readonly classesLoading: boolean;
  readonly classesError: string;
  readonly selectedClassIds: readonly string[];
  readonly onClassSelectionChange: (ids: string[]) => void;

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
  verifiedEmail = false,
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
  level,
  onLevelChange,
  classes,
  classesLoading,
  classesError,
  selectedClassIds,
  onClassSelectionChange,
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
  const fieldIds = useId();
  const isStudent = role === 'student';
  let submitLabel = isStudent ? 'Continue to face enrolment' : 'Activate staff account';
  if (busy) submitLabel = 'Creating account…';

  return (
    <form
      className={`auth-card auth-card--wide${role === 'student' ? ' auth-card--registration' : ''}`}
      onSubmit={onSubmit}
      aria-busy={busy}
      noValidate
    >
      {onBack && (
        <button type="button" className="auth-card__back" onClick={onBack}>
          <IconChevronLeft />
          <span>Back to home</span>
        </button>
      )}
      <h2 className="auth-card__title">
        {role === 'student' ? 'Create your student account' : 'Activate your staff account'}
      </h2>
      {role === 'student' ? (
        <StudentRegistrationProgress currentStep={1} />
      ) : (
        <p className="auth-card__sub">
          Your email is verified. Confirm your staff details and choose a password.
        </p>
      )}

      {!verifiedEmail && (
        <div className="role-toggle">
          <button
            type="button"
            className={`role-toggle__btn${role === 'student' ? ' role-toggle__btn--on' : ''}`}
            onClick={() => onSwitchRole('student')}
            aria-pressed={role === 'student'}
          >
            <span className="role-toggle__label">Student</span>
            <span className="role-toggle__hint">Track your attendance</span>
          </button>
          <button
            type="button"
            className={`role-toggle__btn${role === 'teacher' ? ' role-toggle__btn--on' : ''}`}
            onClick={() => onSwitchRole('teacher')}
            aria-pressed={role === 'teacher'}
          >
            <span className="role-toggle__label">Teacher</span>
            <span className="role-toggle__hint">Run classroom sessions</span>
          </button>
        </div>
      )}

      <div className="auth-form">
        {role === 'student' ? (
          <div className="auth-form__grid">
            <label className="field">
              <span>Full name</span>
              <input
                value={fullName}
                onChange={(event) => onFullNameChange(event.target.value)}
                placeholder="Ana Ngata"
                autoComplete="name"
                required
              />
            </label>
            <label className="field">
              <span>Student ID</span>
              <input
                value={studentNumber}
                onChange={(event) => onStudentNumberChange(event.target.value)}
                placeholder="123456789"
                required
              />
            </label>
            <label className="field">
              <span>University email</span>
              <input
                type="email"
                readOnly={verifiedEmail}
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                placeholder="ana.ngata@aucklanduni.ac.nz"
                autoComplete="email"
                required
              />
            </label>
            <label htmlFor={`${fieldIds}-field-0`} className="field">
              <span>Level</span>
              <SelectMenu
                id={`${fieldIds}-field-0`}
                value={level}
                options={STUDENT_LEVEL_OPTIONS}
                onChange={onLevelChange}
                ariaLabel="Level"
              />
            </label>
            <RegistrationCourseSelector
              classes={classes}
              loading={classesLoading}
              error={classesError}
              selectedClassIds={selectedClassIds}
              onSelectionChange={onClassSelectionChange}
            />
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
              <span>Confirm password</span>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => onConfirmPasswordChange(event.target.value)}
                placeholder="Repeat password"
                required
              />
            </label>
          </div>
        ) : (
          <div className="auth-form__grid">
            <label className="field field--wide">
              <span>Full name</span>
              <input
                value={teacherName}
                onChange={(event) => onTeacherNameChange(event.target.value)}
                placeholder="Dr. Dana Kessler"
                autoComplete="name"
                required
              />
            </label>
            <label className="field">
              <span>Staff ID</span>
              <input
                value={staffNumber}
                onChange={(event) => onStaffNumberChange(event.target.value)}
                placeholder="STAFF-0142"
                required
              />
            </label>
            <label className="field">
              <span>University email</span>
              <input
                type="email"
                readOnly={verifiedEmail}
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                placeholder="dana.kessler@auckland.ac.nz"
                autoComplete="email"
                required
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
              <span>Confirm password</span>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => onConfirmPasswordChange(event.target.value)}
                placeholder="Repeat password"
                required
              />
            </label>
          </div>
        )}

        {errorMessage && (
          <div className="form-error" role="alert">
            {errorMessage}
          </div>
        )}

        <button type="submit" className="btn btn--primary auth-form__submit" disabled={busy}>
          {submitLabel}
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
