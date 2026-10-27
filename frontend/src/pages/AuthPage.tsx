import { type FormEvent, useEffect, useState } from 'react';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';
import StudentFaceRegistrationStep from '../components/auth/StudentFaceRegistrationStep';
import { apiMessage } from '../lib/apiClient';
import { listPublicClasses, type PublicClassSummaryApiResponse } from '../lib/classAdminApi';
import { hasRequiredEnrollmentCaptures } from '../lib/faceEnrollment';
import { isEmailAddress } from '../lib/emailAddress';
import type { Auth } from '../hooks/useAuth';
import type { FaceEnrollmentCapture, StudentLevel, UserRole } from '../types';
import AccountLinkRequestForm from '../features/account-access/AccountLinkRequestForm';
import type { AccountLinkDetails } from '../features/account-access/api';
import { passwordIssue } from '../features/account-access/accountLinkModel';

type Mode = 'login' | 'register' | 'recover';
type StudentRegistrationStep = 'details' | 'face';

interface Props {
  readonly auth: Auth;
  readonly initialMode?: Mode;
  readonly onBack?: () => void;
  readonly verification?: AccountLinkDetails & { token: string };
  readonly onRegistered?: () => void;
}

export default function AuthPage({ auth, initialMode = 'login', onBack, verification, onRegistered }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [role, setRole] = useState<UserRole>(verification && verification.role !== 'STUDENT' ? 'teacher' : 'student');
  const [studentStep, setStudentStep] = useState<StudentRegistrationStep>('details');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  const [email, setEmail] = useState(verification?.email ?? '');
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

  const changeSelectedClasses = (ids: string[]) => {
    setSelectedClassIds(ids);
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

    const issue = passwordIssue(password, confirmPassword);
    if (issue) { setLocalError(issue); return; }

    if (role === 'student') {
      if (!studentNumber.trim() || !email.trim() || !fullName.trim()) {
        setLocalError('Fill in every field.');
        return;
      }
      if (!isEmailAddress(email.trim())) {
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
    const registered = await auth.registerTeacher({
      staffNumber: staffNumber.trim(),
      email: email.trim(),
      name: teacherName.trim(),
      password,
      emailProof: verification?.token ?? ''
    });
    if (registered) onRegistered?.();
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

    const registered = await auth.registerStudent(
      {
        studentNumber: studentNumber.trim(),
        universityEmail: email.trim(),
        fullName: fullName.trim(),
        course: courseLabel,
        classOfferingIds: selectedClassIds,
        password,
        consentGiven,
        level,
        emailProof: verification?.token
      },
      captures
    );
    if (registered) onRegistered?.();
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
      onForgotPassword={() => switchMode('recover')}
      onBack={onBack}
    />;
  }

  if (mode === 'recover' || (mode === 'register' && role !== 'student' && !verification)) {
    const registrationPurpose = role === 'student' ? 'STUDENT_REGISTRATION' : 'STAFF_ACTIVATION';
    const purpose = mode === 'recover' ? 'PASSWORD_RESET' : registrationPurpose;
    return <AccountLinkRequestForm purpose={purpose}
      onPurposeChange={purpose => switchRole(purpose === 'STUDENT_REGISTRATION' ? 'student' : 'teacher')}
      onBack={() => switchMode('login')} />;
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
      verifiedEmail={!!verification}
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
      onClassSelectionChange={changeSelectedClasses}
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
