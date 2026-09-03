import { type FormEvent, useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import SelectMenu from './SelectMenu';
import { apiMessage } from '../lib/apiClient';
import { listMyClassOptions } from '../lib/healthIncidentApi';
import { SUGGESTED_INCIDENT_TYPES } from '../lib/healthIncidentTypes';
import type { HealthClassOption } from '../types';

interface Props {
  readonly saving: boolean;
  readonly onCreate: (payload: {
    studentId: string;
    courseOfferingId: string;
    incidentType: string;
    occurredAt: string;
    description: string;
    actionTaken?: string;
    teacherNotes?: string;
  }) => Promise<boolean>;
  readonly onClose: () => void;
}

function toLocalDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function CreateHealthIncidentReportModal({ saving, onCreate, onClose }: Props) {
  const [classOptions, setClassOptions] = useState<HealthClassOption[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [courseOfferingId, setCourseOfferingId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [occurredAt, setOccurredAt] = useState(() => toLocalDateTimeInputValue(new Date()));
  const [incidentType, setIncidentType] = useState(SUGGESTED_INCIDENT_TYPES[0]);
  const [customType, setCustomType] = useState('');
  const [description, setDescription] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [teacherNotes, setTeacherNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    listMyClassOptions()
      .then((options) => {
        if (cancelled) return;
        setClassOptions(options);
        if (options.length > 0) setCourseOfferingId(options[0].courseOfferingId);
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
  }, []);

  const selectedClass = classOptions.find((option) => option.courseOfferingId === courseOfferingId);

  useEffect(() => {
    if (selectedClass && !selectedClass.students.some((student) => student.id === studentId)) {
      setStudentId(selectedClass.students[0]?.id ?? '');
    }
  }, [selectedClass, studentId]);

  const classSelectOptions = classOptions.map((option) => ({
    value: option.courseOfferingId,
    label: option.label
  }));
  const studentSelectOptions = (selectedClass?.students ?? []).map((student) => ({
    value: student.id,
    label: `${student.name} (${student.studentNumber})`
  }));
  const typeOptions = SUGGESTED_INCIDENT_TYPES.map((type) => ({ value: type, label: type }));

  const resolvedType = incidentType === 'Other' ? customType.trim() : incidentType;
  const valid = useMemo(
    () =>
      Boolean(courseOfferingId) &&
      Boolean(studentId) &&
      Boolean(resolvedType) &&
      Boolean(description.trim()),
    [courseOfferingId, studentId, resolvedType, description]
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!courseOfferingId) {
      setError('Select a class.');
      return;
    }
    if (!studentId) {
      setError('Select a student.');
      return;
    }
    if (!resolvedType) {
      setError('Enter a type for this incident.');
      return;
    }
    if (!description.trim()) {
      setError('Describe what happened.');
      return;
    }
    const created = await onCreate({
      studentId,
      courseOfferingId,
      incidentType: resolvedType,
      occurredAt: new Date(occurredAt).toISOString(),
      description: description.trim(),
      actionTaken: actionTaken.trim() || undefined,
      teacherNotes: teacherNotes.trim() || undefined
    });
    if (created) onClose();
  };

  return (
    <Modal
      onClose={onClose}
      size="narrow"
      titleId="create-health-report-title"
      title="Report a health incident"
      compactTitle
      subtitle="For anything that needs a record — a nosebleed, a fall, feeling unwell — whether or not it was caught on camera. This does not replace calling for emergency help if the situation is serious."
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving || loadingClasses || !valid}>
            {saving ? 'Reporting…' : 'Report incident'}
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
        <label className="field field--wide">
          Class
          {loadingClasses ? (
            <input value="Loading your classes…" disabled />
          ) : classSelectOptions.length > 0 ? (
            <SelectMenu
              value={courseOfferingId}
              options={classSelectOptions}
              onChange={setCourseOfferingId}
              ariaLabel="Class"
            />
          ) : (
            <input value="No classes available" disabled />
          )}
        </label>

        <label className="field field--wide">
          Student
          {studentSelectOptions.length > 0 ? (
            <SelectMenu
              value={studentId}
              options={studentSelectOptions}
              onChange={setStudentId}
              ariaLabel="Student"
            />
          ) : (
            <input value="No students in this class" disabled />
          )}
        </label>

        <label className="field">
          Date / time
          <input
            type="datetime-local"
            value={occurredAt}
            onChange={(event) => setOccurredAt(event.target.value)}
          />
        </label>

        <label className="field">
          Incident type
          <SelectMenu
            value={incidentType}
            options={typeOptions}
            onChange={setIncidentType}
            ariaLabel="Incident type"
          />
        </label>

        {incidentType === 'Other' && (
          <label className="field field--wide">
            Describe the type
            <input
              value={customType}
              onChange={(event) => setCustomType(event.target.value)}
              placeholder="e.g. Headache"
            />
          </label>
        )}

        <label className="field field--wide">
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What happened."
            rows={3}
          />
        </label>

        <label className="field field--wide">
          Action taken (optional)
          <textarea
            value={actionTaken}
            onChange={(event) => setActionTaken(event.target.value)}
            placeholder="What was done about it."
            rows={2}
          />
        </label>

        <label className="field field--wide">
          Additional notes (optional)
          <textarea value={teacherNotes} onChange={(event) => setTeacherNotes(event.target.value)} rows={2} />
        </label>

        {error && <div className="form-error field--wide">{error}</div>}
      </div>
    </Modal>
  );
}
