import { type FormEvent, useMemo, useState } from 'react';
import { ACCOMPLISHMENT_CATEGORIES } from '../lib/accomplishments';
import { createAccomplishments } from '../lib/accomplishmentApi';
import { apiMessage } from '../lib/apiClient';
import type { AccomplishmentCategory, Student } from '../types';
import Modal from './Modal';
import Pager from './Pager';
import SearchField from './SearchField';
import SelectMenu from './SelectMenu';
import { IconAward } from './icons';
import { usePagination } from '../lib/table';

interface Props {
  readonly courseOfferingId?: string;
  readonly classLabel?: string;
  readonly courseOptions?: readonly CourseOption[];
  readonly students: readonly Student[];
  readonly initialStudentIds?: readonly string[];
  readonly onClose: () => void;
  readonly onCreated: () => void | Promise<void>;
  readonly showToast: (message: string) => void;
}

interface StudentEntry {
  readonly studentId: string;
  readonly points: string;
  readonly note: string;
}

interface CourseOption {
  readonly id: string;
  readonly label: string;
  readonly studentIds?: readonly string[];
}

function localDateInputValue(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function availableCourseOptions(
  courseOptions: readonly CourseOption[],
  courseOfferingId?: string,
  classLabel?: string
): readonly CourseOption[] {
  if (courseOptions.length > 0) return courseOptions;
  if (courseOfferingId && classLabel) return [{ id: courseOfferingId, label: classLabel }];
  return [];
}

function savedAchievementLabel(confirm: boolean, fixedRecipient: boolean): string {
  if (!confirm) return 'saved as draft';
  return fixedRecipient ? 'shared with the student' : 'shared with students';
}

export default function CreateAccomplishmentModal({
  courseOfferingId,
  classLabel,
  courseOptions = [],
  students,
  initialStudentIds = [],
  onClose,
  onCreated,
  showToast
}: Props) {
  const validStudentIds = new Set(students.flatMap((student) => student.recordId ? [student.recordId] : []));
  const initialEntries = initialStudentIds
    .filter((id) => validStudentIds.has(id))
    .map((studentId) => ({ studentId, points: '', note: '' }));
  const fixedRecipient = students.length === 1 && initialEntries.length === 1;
  const fixedRecipientName = students[0]?.name ?? 'this student';
  const [step, setStep] = useState<1 | 2>(1);
  const availableCourses = availableCourseOptions(courseOptions, courseOfferingId, classLabel);
  const [selectedCourseId, setSelectedCourseId] = useState(courseOfferingId ?? availableCourses[0]?.id ?? '');
  const selectedCourseLabel = availableCourses.find((course) => course.id === selectedCourseId)?.label ?? 'Class';
  const selectedCourseStudentIds = availableCourses.find((course) => course.id === selectedCourseId)?.studentIds;
  const eligibleStudents = selectedCourseStudentIds
    ? students.filter((student) => student.recordId && selectedCourseStudentIds.includes(student.recordId))
    : students;
  const [category, setCategory] = useState<AccomplishmentCategory>('PROJECT');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [achievementDate, setAchievementDate] = useState(localDateInputValue);
  const [includeInReport, setIncludeInReport] = useState(true);
  const [entries, setEntries] = useState<StudentEntry[]>(initialEntries);
  const [search, setSearch] = useState('');
  const [rosterPage, setRosterPage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const query = search.trim().toLowerCase();
  const filteredStudents = useMemo(
    () => eligibleStudents
      .filter((student) =>
        !query ||
        student.name.toLowerCase().includes(query) ||
        (student.studentNumber ?? student.id).toLowerCase().includes(query)
      )
      .sort((left, right) => left.name.localeCompare(right.name)),
    [eligibleStudents, query]
  );
  const roster = usePagination(filteredStudents, rosterPage, setRosterPage, 6);
  const selectedIds = new Set(entries.map((entry) => entry.studentId));
  const selectedStudents = entries.flatMap((entry) => {
    const student = eligibleStudents.find((candidate) => candidate.recordId === entry.studentId);
    return student ? [{ student, entry }] : [];
  });
  const fixedEntry = fixedRecipient ? entries[0] : undefined;
  const recipientStepLabel = fixedRecipient ? 'Student' : 'Students';
  const nextStepLabel = fixedRecipient ? 'Add student details' : 'Choose students';
  const selectedSummary = fixedRecipient
    ? fixedRecipientName
    : `${entries.length} student${entries.length === 1 ? '' : 's'} selected`;
  const saveDraftLabel = fixedRecipient ? 'Save draft' : 'Save drafts';
  const shareLabel = fixedRecipient ? 'Share with student' : 'Share with students';

  const toggleStudent = (studentId: string) => {
    setEntries((current) => current.some((entry) => entry.studentId === studentId)
      ? current.filter((entry) => entry.studentId !== studentId)
      : [...current, { studentId, points: '', note: '' }]);
  };

  const updateEntry = (studentId: string, patch: Partial<Omit<StudentEntry, 'studentId'>>) => {
    setEntries((current) => current.map((entry) =>
      entry.studentId === studentId ? { ...entry, ...patch } : entry
    ));
  };

  const selectCourse = (value: string) => {
    setSelectedCourseId(value);
    if (!fixedRecipient) setEntries([]);
    setSearch('');
    setRosterPage(0);
  };

  const detailsValid = Boolean(selectedCourseId && title.trim() && achievementDate);

  const openRecipients = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detailsValid) {
      setError('Choose a class, then add what was achieved and the date completed.');
      return;
    }
    setError('');
    setStep(2);
  };

  const save = async (confirm: boolean) => {
    if (entries.length === 0) {
      setError('Select at least one student.');
      return;
    }
    const hasInvalidPoints = entries.some(({ points }) => {
      if (points === '') return false;
      const value = Number(points);
      return !Number.isFinite(value) || value < 0;
    });
    if (hasInvalidPoints) {
      setError('Points must be zero or a positive number.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createAccomplishments({
        courseOfferingId: selectedCourseId,
        category,
        title: title.trim(),
        description: description.trim(),
        achievementDate,
        includeInReport,
        confirm,
        entries: entries.map((entry) => ({
          studentId: entry.studentId,
          points: entry.points === '' ? null : Number(entry.points),
          note: entry.note.trim()
        }))
      });
      await onCreated();
      showToast(
        `${entries.length} achievement${entries.length === 1 ? '' : 's'} ${savedAchievementLabel(confirm, fixedRecipient)}.`
      );
      onClose();
    } catch (caught) {
      setError(apiMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const submitFixedRecipient = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detailsValid) {
      setError('Choose a class, then add what was achieved and the date completed.');
      return;
    }
    void save(true);
  };

  return (
    <Modal
      onClose={saving ? () => undefined : onClose}
      size="wide"
      className={`accomplishment-modal${fixedRecipient ? ' accomplishment-modal--single' : ''}`}
      titleId="create-accomplishment-title"
      title={<span className="accomplishment-modal__title"><span aria-hidden="true"><IconAward /></span>Add an achievement</span>}
      compactTitle
      closeButton
      subtitle={fixedRecipient
        ? `Record completed work for ${fixedRecipientName}.`
        : 'Record completed work, then choose the students who earned it.'}
      onSubmit={fixedRecipient ? submitFixedRecipient : step === 1 ? openRecipients : undefined}
      footer={fixedRecipient ? (
        <>
          <button type="button" className="btn" disabled={saving || !detailsValid} onClick={() => void save(false)}>
            {saving ? 'Saving…' : 'Save draft'}
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving || !detailsValid}>
            {saving ? 'Sharing…' : 'Share with student'}
          </button>
        </>
      ) : step === 1 ? (
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={!detailsValid}>
            {nextStepLabel}
          </button>
        </>
      ) : (
        <>
          <button type="button" className="btn" disabled={saving} onClick={() => setStep(1)}>Back</button>
          <span className="accomplishment-modal__footer-count">
            {selectedSummary}
          </span>
          <button type="button" className="btn" disabled={saving || entries.length === 0} onClick={() => void save(false)}>
            {saving ? 'Saving…' : saveDraftLabel}
          </button>
          <button type="button" className="btn btn--primary" disabled={saving || entries.length === 0} onClick={() => void save(true)}>
            {saving ? 'Sharing…' : shareLabel}
          </button>
        </>
      )}
    >
      {!fixedRecipient && <div className="accomplishment-modal__steps" aria-label="Progress">
        <span className={step === 1 ? 'is-active' : 'is-complete'}>
          <b>1</b>
          <span><small>Achievement details</small><em>{step === 1 ? 'Current step' : 'Completed'}</em></span>
        </span>
        <i aria-hidden="true" />
        <span className={step === 2 ? 'is-active' : ''}>
          <b>2</b>
          <span><small>{recipientStepLabel}</small><em>{step === 2 ? 'Current step' : 'Next'}</em></span>
        </span>
      </div>}

      {step === 1 ? (
        <div className={`accomplishment-modal__details${fixedRecipient ? ' accomplishment-modal__details--single' : ''}`}>
          {!fixedRecipient && <div className="accomplishment-modal__details-intro">
            <h3>What was completed?</h3>
            <p>Start with a short, specific title. The remaining details provide context.</p>
          </div>}
          <label className="field accomplishment-modal__title-field">
            <span>{fixedRecipient ? 'What was completed?' : 'Achievement'}</span>
            <input
              value={title}
              maxLength={160}
              placeholder="e.g. Completed the service integration project"
              autoFocus
              onChange={(event) => setTitle(event.target.value)}
            />
            <small>{title.length}/160</small>
          </label>

          <div className="accomplishment-modal__facts">
            {availableCourses.length > 1 ? (
              <label className="field">
                <span>Class</span>
                <SelectMenu
                  value={selectedCourseId}
                  options={availableCourses.map((course) => ({ value: course.id, label: course.label }))}
                  onChange={selectCourse}
                  ariaLabel="Class"
                />
              </label>
            ) : (
              <div className="accomplishment-modal__fixed-class">
                <span>Class</span><strong>{selectedCourseLabel}</strong>
              </div>
            )}
            <label className="field">
              <span>Type</span>
              <SelectMenu
                value={category}
                options={ACCOMPLISHMENT_CATEGORIES}
                onChange={setCategory}
                ariaLabel="Achievement type"
              />
            </label>
            <label className="field">
              <span>Date completed</span>
              <input type="date" value={achievementDate} onChange={(event) => setAchievementDate(event.target.value)} />
            </label>
          </div>

          <details className={`accomplishment-modal__optional${fixedRecipient ? ' accomplishment-modal__optional--single' : ''}`}>
            <summary>
              <span>
                <strong>{fixedRecipient ? 'Optional details' : 'Supporting detail'}</strong>
                <small>{fixedRecipient ? 'Description, points or a personal note' : 'Optional evidence or context for the student'}</small>
              </span>
            </summary>
            <div className="accomplishment-modal__optional-body">
              <label className="field accomplishment-modal__description-field">
                <span>Description</span>
                <textarea
                  value={description}
                  maxLength={4000}
                  rows={3}
                  placeholder="Add evidence or explain why this achievement matters."
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              {fixedRecipient && fixedEntry && (
                <div className="accomplishment-modal__single-student-fields">
                  <label className="field">
                    <span>Points <small>Optional</small></span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={fixedEntry.points}
                      placeholder="30"
                      onChange={(event) => updateEntry(fixedEntry.studentId, { points: event.target.value })}
                    />
                  </label>
                  <label className="field accomplishment-modal__personal-note">
                    <span>Personal note <small>Optional</small></span>
                    <input
                      value={fixedEntry.note}
                      maxLength={2000}
                      placeholder={`Add a short note for ${fixedRecipientName}`}
                      onChange={(event) => updateEntry(fixedEntry.studentId, { note: event.target.value })}
                    />
                  </label>
                </div>
              )}
            </div>
          </details>
          <label className="check-row accomplishment-modal__report-toggle">
            <input type="checkbox" checked={includeInReport} onChange={(event) => setIncludeInReport(event.target.checked)} />
            <span><strong>Include in reports</strong><small>After it is shared, this achievement can appear in reports covering this date.</small></span>
          </label>
        </div>
      ) : (
        <div className={`accomplishment-modal__recipients${fixedRecipient ? ' accomplishment-modal__recipients--single' : ''}`}>
          <div className="accomplishment-modal__recipient-context">
            <span aria-hidden="true"><IconAward /></span>
            <div>
              <strong>{title}</strong>
              <small>{selectedCourseLabel} · {ACCOMPLISHMENT_CATEGORIES.find((option) => option.value === category)?.label} · {achievementDate}</small>
            </div>
          </div>
          {!fixedRecipient && <section className="accomplishment-modal__roster">
            <div className="accomplishment-modal__section-head">
              <div><strong>Class roster</strong><span>Select one or more students</span></div>
              <span className={`accomplishment-modal__selected-count${entries.length > 0 ? ' has-selection' : ''}`}>{entries.length} selected</span>
            </div>
            <SearchField
              label="Search class roster"
              value={search}
              onChange={(value) => { setSearch(value); setRosterPage(0); }}
              placeholder="Name or student number"
            />
            <div className="accomplishment-modal__roster-list">
              {roster.rows.map((student) => {
                const studentId = student.recordId;
                if (!studentId) return null;
                return (
                  <label key={studentId} className="accomplishment-modal__student-option">
                    <input type="checkbox" checked={selectedIds.has(studentId)} onChange={() => toggleStudent(studentId)} />
                    <span><strong>{student.name}</strong><small>{student.studentNumber ?? student.id}</small></span>
                  </label>
                );
              })}
            </div>
            {filteredStudents.length === 0 && <div className="empty empty--compact">No students match this search.</div>}
            {roster.pageCount > 1 && (
              <Pager label={roster.label} page={roster.page} pageCount={roster.pageCount} canPrev={roster.canPrev} canNext={roster.canNext} onPrev={roster.prev} onNext={roster.next} onGoToPage={roster.goToPage} />
            )}
          </section>}

          <section className="accomplishment-modal__scores">
            <div className="accomplishment-modal__section-head">
              <div>
                <strong>{fixedRecipient ? fixedRecipientName : 'Student details'}</strong>
                <span>Points and a personal note are optional</span>
              </div>
            </div>
            {selectedStudents.length === 0 ? (
              <div className="accomplishment-modal__selection-empty">
                <strong>No students selected</strong>
                <span>Choose students from the class roster, then add points or a personal note if needed.</span>
              </div>
            ) : (
              <div className="accomplishment-modal__score-list">
                {selectedStudents.map(({ student, entry }) => (
                  <div className="accomplishment-modal__score-row" key={entry.studentId}>
                    <div><strong>{student.name}</strong><small>{student.studentNumber ?? student.id}</small></div>
                    <label><span>Points</span><input type="number" min="0" step="0.5" value={entry.points} placeholder="30" onChange={(event) => updateEntry(entry.studentId, { points: event.target.value })} /></label>
                    <label><span>Personal note</span><input value={entry.note} maxLength={2000} placeholder="Optional context" onChange={(event) => updateEntry(entry.studentId, { note: event.target.value })} /></label>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {error && <div className="form-error accomplishment-modal__error" role="alert">{error}</div>}
    </Modal>
  );
}
