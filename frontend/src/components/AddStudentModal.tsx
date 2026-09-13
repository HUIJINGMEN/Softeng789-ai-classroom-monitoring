import { useEffect, useMemo, useState } from 'react';
import FaceEnrollmentFlow from './FaceEnrollmentFlow';
import Modal from './Modal';
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

export default function AddStudentModal({ isAdmin, onClose, onCreated }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [classes, setClasses] = useState<HealthClassOption[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [universityEmail, setUniversityEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [programme, setProgramme] = useState('');
  const [level, setLevel] = useState<StudentLevel>('LEVEL_1');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [consentGiven, setConsentGiven] = useState(false);
  const [captures, setCaptures] = useState<FaceEnrollmentCapture[]>([]);

  useEffect(() => {
    listMyClassOptions()
      .then(setClasses)
      .catch((reason) => setError(apiMessage(reason)))
      .finally(() => setLoadingClasses(false));
  }, []);

  const selectedLabels = useMemo(
    () => classes.filter((item) => selectedClassIds.includes(item.courseOfferingId)).map((item) => item.label),
    [classes, selectedClassIds]
  );
  const detailsReady = Boolean(
    studentNumber.trim() && universityEmail.trim() && firstName.trim() && lastName.trim() && selectedClassIds.length
  );

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
      onCreated(
        result.reviewRequired
          ? `${result.fullName} was sent to Admin for approval.`
          : `${result.fullName} was added and enrolled.`
      );
    } catch (reason) {
      setError(apiMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      size="wide"
      className={`modal--staff-student${step === 2 ? ' modal--staff-student-face' : ''}`}
      onClose={busy ? () => undefined : onClose}
      closeButton
      titleId="add-student-title"
      title={step === 1 ? 'Add student' : 'Face enrolment'}
      subtitle={
        step === 1
          ? `Enter the student’s details and choose ${isAdmin ? 'their classes' : 'from your classes'}.`
          : `${firstName} ${lastName} · ${selectedLabels.length} selected class${selectedLabels.length === 1 ? '' : 'es'}`
      }
      footer={
        step === 1 ? (
          <>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={!detailsReady || loadingClasses}
              onClick={() => { setError(''); setStep(2); }}
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
              {busy ? 'Submitting…' : isAdmin ? 'Add student' : 'Submit for Admin review'}
            </button>
          </>
        )
      }
    >
      <div className="staff-student-progress" aria-label={`Step ${step} of 2`}>
        <span className={step === 1 ? 'is-current' : 'is-complete'}>1 <small>Student &amp; classes</small></span>
        <span className={step === 2 ? 'is-current' : ''}>2 <small>Face enrolment</small></span>
      </div>

      {step === 1 ? (
        <div className="modal-form__grid staff-student-form">
          <label className="field">First name<input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" /></label>
          <label className="field">Last name<input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" /></label>
          <label className="field">Student ID<input value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} /></label>
          <label className="field">University email<input type="email" value={universityEmail} onChange={(e) => setUniversityEmail(e.target.value)} autoComplete="email" /></label>
          <label className="field">
            Level
            <SelectMenu value={level} options={STUDENT_LEVEL_OPTIONS} onChange={setLevel} ariaLabel="Level" />
          </label>
          <label className="field">Programme <span className="field__optional">Optional</span><input value={programme} onChange={(e) => setProgramme(e.target.value)} /></label>
          <fieldset className="staff-student-classes field--wide">
            <legend>Classes</legend>
            <div className="course-checklist course-checklist--scroll">
              {classes.map((item) => (
                <label className="course-checklist__item" key={item.courseOfferingId}>
                  <input
                    type="checkbox"
                    checked={selectedClassIds.includes(item.courseOfferingId)}
                    onChange={() => setSelectedClassIds((current) => current.includes(item.courseOfferingId) ? current.filter((id) => id !== item.courseOfferingId) : [...current, item.courseOfferingId])}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
              {!loadingClasses && classes.length === 0 && <div className="empty empty--inline">No available classes.</div>}
              {loadingClasses && <div className="cell-sub">Loading classes…</div>}
            </div>
          </fieldset>
        </div>
      ) : (
        <div className="staff-student-face-step">
          <label className="face-consent">
            <input type="checkbox" checked={consentGiven} onChange={(e) => setConsentGiven(e.target.checked)} />
            <span><strong>Student is present and has consented</strong><small>Face captures are stored for classroom identity matching.</small></span>
          </label>
          {consentGiven ? (
            <FaceEnrollmentFlow captures={captures} onChange={setCaptures} />
          ) : (
            <div className="face-consent-gate"><strong>Camera starts after consent</strong><span>Confirm the student is present and has agreed before capturing.</span></div>
          )}
        </div>
      )}
      {error && <div className="form-error staff-student-error" role="alert">{error}</div>}
    </Modal>
  );
}
