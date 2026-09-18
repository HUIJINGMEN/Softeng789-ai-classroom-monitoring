import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import FaceEnrollmentFlow from './FaceEnrollmentFlow';
import Modal from './Modal';
import MultiSelectPickerModal, { MultiSelectSummary } from './MultiSelectPickerModal';
import SelectMenu from './SelectMenu';
import { hasRequiredEnrollmentCaptures } from '../lib/faceEnrollment';
import { listMyClassOptions } from '../lib/healthIncidentApi';
import { apiMessage } from '../lib/apiClient';
import { createStudentByStaff } from '../lib/studentApi';
import { STUDENT_LEVEL_OPTIONS } from '../lib/studentLevels';
import type { FaceEnrollmentCapture, HealthClassOption, StudentLevel } from '../types';

interface Props {
  readonly isAdmin: boolean;
  readonly onClose: () => void;
  readonly onCreated: (message: string) => void;
}

function createdStudentMessage(fullName: string, reviewRequired: boolean): string {
  if (reviewRequired) return `${fullName} was sent to Admin for approval.`;
  return `${fullName} was added and enrolled.`;
}

function addStudentSubtitle(step: 1 | 2, isAdmin: boolean, firstName: string, lastName: string, classCount: number) {
  if (step === 1) {
    return `Enter the student’s details and choose ${isAdmin ? 'their classes' : 'from your classes'}.`;
  }
  const classLabel = classCount === 1 ? 'class' : 'classes';
  return `${firstName} ${lastName} · ${classCount} selected ${classLabel}`;
}

function submissionLabel(busy: boolean, isAdmin: boolean): string {
  if (busy) return 'Submitting…';
  return isAdmin ? 'Add student' : 'Submit for Admin review';
}

export default function AddStudentModal({ isAdmin, onClose, onCreated }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [classes, setClasses] = useState<HealthClassOption[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [classesError, setClassesError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [universityEmail, setUniversityEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [programme, setProgramme] = useState('');
  const [level, setLevel] = useState<StudentLevel>('LEVEL_1');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [classPickerOpen, setClassPickerOpen] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [captures, setCaptures] = useState<FaceEnrollmentCapture[]>([]);

  const loadClasses = useCallback(async () => {
    setLoadingClasses(true);
    setClassesError('');
    try {
      setClasses(await listMyClassOptions());
    } catch (reason) {
      setClassesError(apiMessage(reason));
    } finally {
      setLoadingClasses(false);
    }
  }, []);

  useEffect(() => { void loadClasses(); }, [loadClasses]);

  const selectedLabels = useMemo(
    () => classes.filter((item) => selectedClassIds.includes(item.courseOfferingId)).map((item) => item.label),
    [classes, selectedClassIds]
  );
  const detailsReady = Boolean(
    studentNumber.trim() && universityEmail.trim() && firstName.trim() && lastName.trim() && selectedClassIds.length
  );

  const advance = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step !== 1 || !detailsReady || loadingClasses || classesError) return;
    setError('');
    setStep(2);
  };

  const submit = async () => {
    if (!detailsReady || !consentGiven || !hasRequiredEnrollmentCaptures(captures)) return;
    setBusy(true);
    setError('');
    try {
      const result = await createStudentByStaff({
        studentNumber: studentNumber.trim(),
        universityEmail: universityEmail.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        programme: programme.trim(),
        classOfferingIds: selectedClassIds,
        consentGiven,
        level,
        captures
      });
      onCreated(createdStudentMessage(result.fullName, result.reviewRequired));
    } catch (reason) {
      setError(apiMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  if (classPickerOpen) {
    return (
      <MultiSelectPickerModal
        title="Choose classes"
        subtitle="Search and select one or more classes for this student."
        searchLabel="Search classes"
        searchPlaceholder="Course code or teaching term"
        options={classes.map((item) => ({ id: item.courseOfferingId, label: item.label }))}
        selectedIds={selectedClassIds}
        onApply={setSelectedClassIds}
        onClose={() => setClassPickerOpen(false)}
      />
    );
  }

  return (
    <Modal
      size="wide"
      className={`modal--staff-student${step === 2 ? ' modal--staff-student-face' : ''}`}
      onClose={busy ? () => undefined : onClose}
      onSubmit={advance}
      closeButton
      titleId="add-student-title"
      title="Add student"
      subtitle={addStudentSubtitle(step, isAdmin, firstName, lastName, selectedLabels.length)}
      footer={
        step === 1 ? (
          <>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={!detailsReady || loadingClasses || Boolean(classesError)}
            >
              Continue to face enrolment
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn" disabled={busy} onClick={() => setStep(1)}>Back</button>
            <span className="spacer" />
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy || !consentGiven || !hasRequiredEnrollmentCaptures(captures)}
              onClick={() => void submit()}
            >
              {submissionLabel(busy, isAdmin)}
            </button>
          </>
        )
      }
    >
      <div className="staff-student-progress" aria-label={`Step ${step} of 2`}>
        <span className={step === 1 ? 'is-current' : 'is-complete'} aria-current={step === 1 ? 'step' : undefined}>
          <b>1</b>
          <span>
            <small>Student &amp; classes</small>
            <em>{step === 1 ? 'Current step' : 'Completed'}</em>
          </span>
        </span>
        <span className={step === 2 ? 'is-current' : ''} aria-current={step === 2 ? 'step' : undefined}>
          <b>2</b>
          <span>
            <small>Face enrolment</small>
            <em>{step === 2 ? 'Current step' : 'Next'}</em>
          </span>
        </span>
      </div>

      {step === 1 ? (
        <div className="modal-form__grid staff-student-form">
          <label className="field">
            <span>First name</span>
            <input value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" autoFocus required />
          </label>
          <label className="field">
            <span>Last name</span>
            <input value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" required />
          </label>
          <label className="field">
            <span>Student ID</span>
            <input value={studentNumber} onChange={(event) => setStudentNumber(event.target.value)} autoComplete="off" required />
          </label>
          <label className="field">
            <span>University email</span>
            <input type="email" value={universityEmail} onChange={(event) => setUniversityEmail(event.target.value)} autoComplete="email" required />
          </label>
          <label className="field">
            <span>Level</span>
            <SelectMenu value={level} options={STUDENT_LEVEL_OPTIONS} onChange={setLevel} ariaLabel="Level" />
          </label>
          <MultiSelectSummary
            label="Classes"
            actionNoun="classes"
            selectedLabels={selectedLabels}
            emptyLabel="No classes selected"
            loading={loadingClasses}
            disabled={loadingClasses || Boolean(classesError) || classes.length === 0}
            onOpen={() => setClassPickerOpen(true)}
          />
          <details className="staff-student-optional field--wide">
            <summary>Add programme <span>Optional</span></summary>
            <label className="field">
              <span>Programme</span>
              <input value={programme} onChange={(event) => setProgramme(event.target.value)} />
            </label>
          </details>
          <div className="staff-student-class-state field--wide">
            {classesError && (
              <div className="notice notice--warn staff-student-class-error">
                <span>Classes could not be loaded: {classesError}</span>
                <button type="button" className="btn btn--sm" onClick={() => void loadClasses()}>Retry</button>
              </div>
            )}
            {!loadingClasses && !classesError && classes.length === 0 && (
              <div className="cell-sub">No classes are available.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="staff-student-face-step">
          <div className="staff-student-face-step__head">
            <div>
              <strong>Complete face enrolment</strong>
              <span>Consent is required before the camera can start.</span>
            </div>
          </div>
          <label className="face-consent">
            <input type="checkbox" checked={consentGiven} onChange={(event) => setConsentGiven(event.target.checked)} />
            <span>
              <strong>Student is present and has consented</strong>
              <small>Face captures are stored for classroom identity matching.</small>
            </span>
          </label>
          {consentGiven ? (
            <FaceEnrollmentFlow captures={captures} onChange={setCaptures} />
          ) : (
            <div className="face-consent-gate">
              <strong>Camera starts after consent</strong>
              <span>Confirm the student is present and has agreed before capturing.</span>
            </div>
          )}
        </div>
      )}
      {error && <div className="form-error staff-student-error" role="alert">{error}</div>}
    </Modal>
  );
}
