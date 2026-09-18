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

interface FeedbackTarget {
  readonly studentId: string | null;
  readonly classId: string;
  readonly classLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly placeholder: string;
}

function feedbackTarget(props: Props): FeedbackTarget {
  if (props.target === 'class') {
    return {
      studentId: null,
      classId: props.courseOfferingId,
      classLabel: props.classLabel,
      title: 'Add class feedback',
      subtitle: `Record an observation about ${props.classLabel} as a whole. It will inform class and overall report summaries.`,
      placeholder: 'What should be recorded about this class?'
    };
  }
  return {
    studentId: props.studentRecordId,
    classId: '',
    classLabel: '',
    title: 'Add student feedback',
      subtitle: `Record a written note for ${props.studentName}. On a phone, Quick Capture can include a photo.`,
    placeholder: 'How is this student progressing?'
  };
}

function feedbackClassOptions(
  target: FeedbackTarget,
  options: readonly HealthClassOption[]
): HealthClassOption[] {
  if (!target.studentId) {
    return [{ courseOfferingId: target.classId, label: target.classLabel, students: [] }];
  }
  return options.filter((option) => option.students.some((student) => student.id === target.studentId));
}

// Text-only desktop form. The teacher mobile-web Quick Capture flow uses the same endpoint with
// a photo; both kinds appear together in the student's report history.
export default function CreateFeedbackModal(props: Props) {
  const { saving, onCreate, onClose } = props;
  const target = feedbackTarget(props);
  const [classOptions, setClassOptions] = useState<HealthClassOption[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(props.target === 'student');
  const [loadError, setLoadError] = useState('');
  const [courseOfferingId, setCourseOfferingId] = useState(target.classId);
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
    () => feedbackClassOptions(target, classOptions),
    [classOptions, target.studentId, target.classId, target.classLabel]
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
      className="modal--task-form modal--feedback-form"
      titleId="create-feedback-title"
      title={target.title}
      compactTitle
      subtitle={target.subtitle}
      closeButton
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
        <div className="notice notice--warn modal__notice">
          <span className="notice__mark" aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      )}

      <div className="modal-form__grid">
        {props.target === 'student' && myClassesForStudent.length > 1 ? (
          <label className="field field--wide">
            <span>Class</span>
            <SelectMenu
              value={courseOfferingId}
              options={classSelectOptions}
              onChange={setCourseOfferingId}
              ariaLabel="Class"
            />
          </label>
        ) : (
          <label className="field field--wide">
            <span>Class</span>
            <input
              value={
                loadingClasses
                  ? 'Loading…'
                  : (myClassesForStudent[0]?.label ?? 'You do not teach a class this student is in')
              }
              disabled
            />
          </label>
        )}

        <label className="field field--wide">
          <span>Comment</span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={target.placeholder}
            rows={4}
            autoFocus
          />
        </label>

        {error && <div className="form-error field--wide">{error}</div>}
      </div>
    </Modal>
  );
}
