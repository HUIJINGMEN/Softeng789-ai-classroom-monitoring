import { type FormEvent, useState } from 'react';
import { createPortal } from 'react-dom';
import Modal from '../Modal';
import PasswordField from '../PasswordField';
import SearchField from '../SearchField';
import SelectMenu from '../SelectMenu';
import type { PublicClassSummaryApiResponse } from '../../lib/classAdminApi';
import { STUDENT_LEVEL_OPTIONS } from '../../lib/studentLevels';
import type { StudentLevel, UserRole } from '../../types';
import StudentRegistrationProgress from './StudentRegistrationProgress';

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
  readonly level: StudentLevel;
  readonly onLevelChange: (value: StudentLevel) => void;
  readonly classes: readonly PublicClassSummaryApiResponse[];
  readonly classesLoading: boolean;
  readonly classesError: string;
  readonly selectedClassIds: readonly string[];
  readonly onToggleClass: (id: string) => void;

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
  level,
  onLevelChange,
  classes,
  classesLoading,
  classesError,
  selectedClassIds,
  onToggleClass,
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
  const [coursesOpen, setCoursesOpen] = useState(false);
  const [draftClassIds, setDraftClassIds] = useState<string[]>([]);
  const [courseQuery, setCourseQuery] = useState('');
  const selectedClasses = classes.filter((klass) => selectedClassIds.includes(klass.id));
  const normalizedCourseQuery = courseQuery.trim().toLocaleLowerCase();
  const matchingClasses = classes
    .filter((klass) =>
      !normalizedCourseQuery || [klass.courseCode, klass.academicTerm, klass.offeringCode]
        .some((value) => value.toLocaleLowerCase().includes(normalizedCourseQuery))
    )
    .sort((first, second) => {
      if (normalizedCourseQuery) return 0;
      return Number(draftClassIds.includes(second.id)) - Number(draftClassIds.includes(first.id));
    });
  const visibleClasses = matchingClasses.slice(0, 5);

  const openCoursePicker = () => {
    setDraftClassIds([...selectedClassIds]);
    setCourseQuery('');
    setCoursesOpen(true);
  };

  const toggleDraftClass = (id: string) => {
    setDraftClassIds((current) =>
      current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]
    );
  };

  const applyCourseSelection = () => {
    classes.forEach((klass) => {
      if (selectedClassIds.includes(klass.id) !== draftClassIds.includes(klass.id)) {
        onToggleClass(klass.id);
      }
    });
    setCoursesOpen(false);
  };

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
      <h2 className="auth-card__title">
        {role === 'student' ? 'Create your student account' : 'Create your teacher account'}
      </h2>
      {role === 'student' ? (
        <StudentRegistrationProgress currentStep={1} />
      ) : (
        <p className="auth-card__sub">Enter your staff details to create an account.</p>
      )}

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
              <label className="field">
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
              <label className="field">
                Level
                <SelectMenu
                  value={level}
                  options={STUDENT_LEVEL_OPTIONS}
                  onChange={onLevelChange}
                  ariaLabel="Level"
                />
              </label>
              <div className="field field--wide course-field">
                <span className="auth-field-heading">Courses</span>

                {classesError && (
                  <div className="notice notice--warn">
                    <span className="notice__mark" aria-hidden="true" />
                    <span>Could not load classes: {classesError}</span>
                  </div>
                )}
                <div className="course-selector">
                  <div className="course-selector__value" aria-live="polite">
                    {selectedClasses.length > 0 ? (
                      <span className="course-selector__selection">
                        <strong>
                          {selectedClasses.length} course{selectedClasses.length === 1 ? '' : 's'}
                        </strong>
                        <small>{selectedClasses.map((klass) => klass.courseCode).join(', ')}</small>
                      </span>
                    ) : (
                      <span className="course-selector__placeholder">No courses added</span>
                    )}

                    <button
                      type="button"
                      className="course-selector__add"
                      aria-haspopup="dialog"
                      disabled={classesLoading || classes.length === 0}
                      onClick={openCoursePicker}
                    >
                      {classesLoading
                        ? 'Loading courses…'
                        : selectedClasses.length > 0
                          ? 'Edit courses'
                          : 'Add courses'}
                    </button>
                  </div>
                </div>

                {!classesLoading && !classesError && classes.length === 0 && (
                  <small className="course-field__help">
                    No courses are open for registration. Contact your Admin.
                  </small>
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

        {errorMessage && <div className="form-error" role="alert">{errorMessage}</div>}

        <button type="submit" className="btn btn--primary auth-form__submit" disabled={busy}>
          {busy
            ? 'Creating account...'
            : role === 'student'
              ? 'Continue to face enrolment'
              : 'Create teacher account'}
        </button>
      </div>

      <div className="auth-card__switch">
        Already have an account?{' '}
        <button type="button" onClick={onSwitchToLogin}>
          Sign in
        </button>
      </div>

      {coursesOpen && createPortal(
        <Modal
          onClose={() => setCoursesOpen(false)}
          size="narrow"
          className="auth-course-modal"
          titleId="add-registration-courses-title"
          title="Add courses"
          compactTitle
          subtitle="Choose one or more classes for your enrolment request."
          footer={
            <>
              <button
                type="button"
                className="btn auth-course-modal__clear"
                disabled={draftClassIds.length === 0}
                onClick={() => setDraftClassIds([])}
              >
                Clear selection
              </button>
              <span className="auth-course-modal__footer-spacer" aria-hidden="true" />
              <button type="button" className="btn" onClick={() => setCoursesOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={applyCourseSelection}
              >
                Save selection{draftClassIds.length > 0 ? ` · ${draftClassIds.length}` : ''}
              </button>
            </>
          }
        >
          <div className="course-picker-modal">
            <SearchField
              className="course-picker-modal__search"
              label="Search courses"
              value={courseQuery}
              onChange={setCourseQuery}
              placeholder="Course code, term or offering"
              autoFocus
            />

            <div className="course-picker-modal__summary" aria-live="polite">
              <span>
                {draftClassIds.length} selected
              </span>
              <span>
                {normalizedCourseQuery
                  ? `${matchingClasses.length} match${matchingClasses.length === 1 ? '' : 'es'}`
                  : `Showing ${visibleClasses.length} of ${classes.length}`}
              </span>
            </div>

            {visibleClasses.length > 0 ? (
              <div className="course-picker-modal__list" aria-label="Course search results">
                {visibleClasses.map((klass) => (
                  <label key={klass.id} className="course-option">
                    <input
                      type="checkbox"
                      checked={draftClassIds.includes(klass.id)}
                      onChange={() => toggleDraftClass(klass.id)}
                    />
                    <span>
                      <strong>{klass.courseCode}</strong>
                      <small>{klass.academicTerm} · {klass.offeringCode}</small>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="course-picker-modal__empty">
                No courses match “{courseQuery.trim()}”. Try a course code or offering.
              </div>
            )}

            {matchingClasses.length > visibleClasses.length && (
              <p className="course-picker-modal__hint">
                {matchingClasses.length - visibleClasses.length} more result{
                  matchingClasses.length - visibleClasses.length === 1 ? '' : 's'
                }. Add another keyword to narrow the list.
              </p>
            )}
          </div>
        </Modal>,
        document.body
      )}
    </form>
  );
}
