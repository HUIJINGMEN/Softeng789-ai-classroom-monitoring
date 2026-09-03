import { type FormEvent, useEffect, useState } from 'react';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';
import { apiMessage } from '../lib/apiClient';
import { listPublicClasses, type PublicClassSummaryApiResponse } from '../lib/classAdminApi';
import { hasRequiredEnrollmentCaptures } from '../lib/faceEnrollment';
import { uploadFaceEnrollment } from '../lib/studentApi';
import type { Auth } from '../hooks/useAuth';
import type { FaceEnrollmentCapture, UserRole } from '../types';

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
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [consentGiven, setConsentGiven] = useState(false);
  const [captures, setCaptures] = useState<FaceEnrollmentCapture[]>([]);

  const [classes, setClasses] = useState<PublicClassSummaryApiResponse[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState('');

  const [staffNumber, setStaffNumber] = useState('');
  const [teacherName, setTeacherName] = useState('');

  const errorMessage = localError || auth.error;

  useEffect(() => {
    if (mode !== 'register' || role !== 'student') return;
    let cancelled = false;
    listPublicClasses()
      .then((result) => {
        if (!cancelled) {
          setClasses(result);
          setClassesError('');
        }
      })
      .catch((error) => {
        if (!cancelled) setClassesError(apiMessage(error));
      })
      .finally(() => {
        if (!cancelled) setClassesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, role]);

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

  const toggleClass = (id: string) => {
    setSelectedClassIds((current) =>
      current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]
    );
    setLocalError('');
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
      if (!studentNumber.trim() || !email.trim() || !fullName.trim()) {
        setLocalError('Fill in every field.');
        return;
      }
      if (selectedClassIds.length === 0) {
        setLocalError('Select at least one class.');
        return;
      }
      if (!hasRequiredEnrollmentCaptures(captures)) {
        setLocalError('Complete the required face enrolment captures before continuing.');
        return;
      }
      if (!consentGiven) {
        setLocalError('You must consent to continue.');
        return;
      }

      const courseLabel = classes
        .filter((klass) => selectedClassIds.includes(klass.id))
        .map((klass) => klass.courseCode)
        .join(', ');

      const registered = await auth.registerStudent({
        studentNumber: studentNumber.trim(),
        universityEmail: email.trim(),
        fullName: fullName.trim(),
        course: courseLabel,
        classOfferingIds: selectedClassIds,
        password,
        consentGiven
      });

      if (registered) {
        try {
          await uploadFaceEnrollment(registered.id, captures);
        } catch (error) {
          setLocalError(
            `Account created, but face enrolment upload failed: ${apiMessage(error)}. ` +
              'You can try again from your profile later.'
          );
        }
      }
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

  return mode === 'login' ? (
    <LoginForm
      email={email}
      onEmailChange={setEmail}
      password={password}
      onPasswordChange={setPassword}
      showPassword={showPassword}
      onToggleShowPassword={() => setShowPassword((current) => !current)}
      errorMessage={errorMessage}
      busy={auth.busy}
      onSubmit={submitLogin}
      onSwitchToRegister={() => switchMode('register')}
      onBack={onBack}
    />
  ) : (
    <RegisterForm
      role={role}
      onSwitchRole={switchRole}
      email={email}
      onEmailChange={setEmail}
      password={password}
      onPasswordChange={setPassword}
      confirmPassword={confirmPassword}
      onConfirmPasswordChange={setConfirmPassword}
      showPassword={showPassword}
      onToggleShowPassword={() => setShowPassword((current) => !current)}
      fullName={fullName}
      onFullNameChange={setFullName}
      studentNumber={studentNumber}
      onStudentNumberChange={setStudentNumber}
      classes={classes}
      classesLoading={classesLoading}
      classesError={classesError}
      selectedClassIds={selectedClassIds}
      onToggleClass={toggleClass}
      consentGiven={consentGiven}
      onConsentChange={setConsentGiven}
      captures={captures}
      onCapturesChange={setCaptures}
      staffNumber={staffNumber}
      onStaffNumberChange={setStaffNumber}
      teacherName={teacherName}
      onTeacherNameChange={setTeacherName}
      errorMessage={errorMessage}
      busy={auth.busy}
      onSubmit={submitRegister}
      onSwitchToLogin={() => switchMode('login')}
      onBack={onBack}
    />
  );
}
