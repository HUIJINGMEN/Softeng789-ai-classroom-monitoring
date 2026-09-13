import { type FormEvent, useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import SelectMenu from './SelectMenu';
import { apiMessage } from '../lib/apiClient';
import { listMyClassOptions } from '../lib/healthIncidentApi';
import type { HealthClassOption } from '../types';

interface BaseProps {
  readonly saving: boolean;
  readonly onCreate: (payload: { courseOfferingId: string; comment: string }) => Promise<boolean>;
  readonly onClose: () => void;
}

type Props = BaseProps & (
  | {
      readonly target: 'student';
      readonly studentRecordId: string;
      readonly studentName: string;
    }
  | {
      readonly target: 'class';
      readonly courseOfferingId: string;
      readonly classLabel: string;
    }
);

// Text-only — the photo half of a progress report is the companion mobile app's job, not this
// page's (see StudentProfile.tsx's "Progress Reports" card, which shows both kinds mixed together).
export default function CreateFeedbackModal(props: Props) {
  const { saving, onCreate, onClose } = props;
  const targetStudentId = props.target === 'student' ? props.studentRecordId : null;
  const fixedClassId = props.target === 'class' ? props.courseOfferingId : null;
  const fixedClassLabel = props.target === 'class' ? props.classLabel : null;
  const [classOptions, setClassOptions] = useState<HealthClassOption[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(props.target === 'student');
  const [loadError, setLoadError] = useState('');
  const [courseOfferingId, setCourseOfferingId] = useState(
    props.target === 'class' ? props.courseOfferingId : ''
  );
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (props.target === 'class') return;
    let cancelled = false;
    listMyClassOptions()
      .then((options) => {
        if (cancelled) return;
        setClassOptions(options);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(apiMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoadingClasses(false);
      });
    return () => {
      cancelled = true;
    };
  }, [props.target]);

  // Only the classes I teach that this specific student is actually enrolled in — a student can
  // be in several of my classes, or in classes I don't teach at all (those never show up here).
  const myClassesForStudent = useMemo(
    () => targetStudentId
      ? classOptions.filter((option) => option.students.some((student) => student.id === targetStudentId))
      : [{ courseOfferingId: fixedClassId ?? '', label: fixedClassLabel ?? '', students: [] }],
    [classOptions, fixedClassId, fixedClassLabel, targetStudentId]
  );

  useEffect(() => {
    if (!myClassesForStudent.some((option) => option.courseOfferingId === courseOfferingId)) {
      setCourseOfferingId(myClassesForStudent[0]?.courseOfferingId ?? '');
    }
  }, [myClassesForStudent, courseOfferingId]);

  const classSelectOptions = myClassesForStudent.map((option) => ({
    value: option.courseOfferingId,
    label: option.label
  }));

  const valid = useMemo(
    () => Boolean(courseOfferingId && comment.trim()),
    [courseOfferingId, comment]
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid) {
      setError('Select a class and write a comment.');
      return;
    }
    const created = await onCreate({ courseOfferingId, comment: comment.trim() });
    if (created) onClose();
  };

  return (
    <Modal
      onClose={saving ? () => undefined : onClose}
      size="narrow"
      titleId="create-feedback-title"
      title={props.target === 'class' ? 'Add class feedback' : 'Add student feedback'}
      compactTitle
      subtitle={props.target === 'class'
        ? `Record an observation about ${props.classLabel} as a whole. It will inform class and overall report summaries.`
        : `Record a written note for ${props.studentName}. The companion app can attach a photo when needed.`}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving || loadingClasses || !valid}>
            {saving ? 'Saving…' : 'Add feedback'}
          </button>
        </>
      }
    >
      {loadError && (
        <div className="notice notice--warn" style={{ margin: '12px 24px 0' }}>
          <span className="notice__mark" aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      )}

      <div className="modal-form__grid">
        {props.target === 'student' && myClassesForStudent.length > 1 ? (
          <label className="field field--wide">
            Class
            <SelectMenu
              value={courseOfferingId}
              options={classSelectOptions}
              onChange={setCourseOfferingId}
              ariaLabel="Class"
            />
          </label>
        ) : (
          <label className="field field--wide">
            Class
            <input
              value={
                loadingClasses
                  ? 'Loading…'
                  : (myClassesForStudent[0]?.label ?? (
                    props.target === 'class'
                      ? props.classLabel
                      : 'You do not teach a class this student is in'
                  ))
              }
              disabled
            />
          </label>
        )}

        <label className="field field--wide">
          Comment
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={props.target === 'class'
              ? 'What should be recorded about this class?'
              : 'How is this student progressing?'}
            rows={4}
            autoFocus
          />
        </label>

        {error && <div className="form-error field--wide">{error}</div>}
      </div>
    </Modal>
  );
}
