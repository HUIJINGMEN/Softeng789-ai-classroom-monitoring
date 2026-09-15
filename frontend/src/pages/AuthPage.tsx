import { type FormEvent, useEffect, useState } from 'react';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';
import StudentFaceRegistrationStep from '../components/auth/StudentFaceRegistrationStep';
import { apiMessage } from '../lib/apiClient';
import { listPublicClasses, type PublicClassSummaryApiResponse } from '../lib/classAdminApi';
import { hasRequiredEnrollmentCaptures } from '../lib/faceEnrollment';
import type { Auth } from '../hooks/useAuth';
import type { FaceEnrollmentCapture, StudentLevel, UserRole } from '../types';

type Mode = 'login' | 'register';
type StudentRegistrationStep = 'details' | 'face';

interface Props {
  readonly auth: Auth;
  readonly initialMode?: Mode;
  readonly onBack?: () => void;
}

export default function AuthPage({ auth, initialMode = 'login', onBack }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [role, setRole] = useState<UserRole>('student');
  const [studentStep, setStudentStep] = useState<StudentRegistrationStep>('details');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [studentNumber, setStudentNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [level, setLevel] = useState<StudentLevel>('LEVEL_1');
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
    setClassesLoading(true);
    setClassesError('');
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
    setStudentStep('details');
    setLocalError('');
    auth.clearError();
  };

  const switchRole = (next: UserRole) => {
    setRole(next);
    setStudentStep('details');
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
    if (password.length > 72) {
      setLocalError('Password must be 72 characters or fewer.');
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
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
        setLocalError('Enter a valid university email address.');
        return;
      }
      if (selectedClassIds.length === 0) {
        setLocalError('Select at least one class.');
        return;
      }
      setStudentStep('face');
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

  const submitStudentRegistration = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError('');
    if (!hasRequiredEnrollmentCaptures(captures)) {
      setLocalError('Complete every required face enrolment capture before submitting.');
      return;
    }
    if (!consentGiven) {
      setLocalError('Consent is required before face enrolment can be submitted.');
      return;
    }

    const courseLabel = classes
      .filter((klass) => selectedClassIds.includes(klass.id))
      .map((klass) => klass.courseCode)
      .join(', ');

    await auth.registerStudent(
      {
        studentNumber: studentNumber.trim(),
        universityEmail: email.trim(),
        fullName: fullName.trim(),
        course: courseLabel,
        classOfferingIds: selectedClassIds,
        password,
        consentGiven,
        level
      },
      captures
    );
  };

  const selectedClassLabels = classes
    .filter((klass) => selectedClassIds.includes(klass.id))
    .map((klass) => `${klass.courseCode} · ${klass.offeringCode}`);

  if (mode === 'login') {
    return <LoginForm
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
    />;
  }

  if (role === 'student' && studentStep === 'face') {
    return <StudentFaceRegistrationStep
      fullName={fullName}
      studentNumber={studentNumber}
      classLabels={selectedClassLabels}
      consentGiven={consentGiven}
      onConsentChange={setConsentGiven}
      captures={captures}
      onCapturesChange={setCaptures}
      errorMessage={errorMessage}
      busy={auth.busy}
      onSubmit={submitStudentRegistration}
      onBackToDetails={() => {
        setStudentStep('details');
        setLocalError('');
        auth.clearError();
      }}
    />;
  }

  return (
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
      level={level}
      onLevelChange={setLevel}
      classes={classes}
      classesLoading={classesLoading}
      classesError={classesError}
      selectedClassIds={selectedClassIds}
      onToggleClass={toggleClass}
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
