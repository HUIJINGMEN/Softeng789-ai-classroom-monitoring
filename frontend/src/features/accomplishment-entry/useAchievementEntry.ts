import { type FormEvent, useMemo, useState } from 'react';
import { createAccomplishments } from '../../lib/accomplishmentApi';
import { apiMessage } from '../../lib/apiClient';
import type { AccomplishmentCategory, Student } from '../../types';
import { usePagination } from '../../lib/table';
import { formatIsoDateInAuckland } from '../../lib/sessionTime';
import { countLabel } from '../../lib/text';

export interface AchievementEntryProps {
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
  return formatIsoDateInAuckland(new Date());
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

export function useAchievementEntry({
  courseOfferingId,
  classLabel,
  courseOptions = [],
  students,
  initialStudentIds = [],
  onClose,
  onCreated,
  showToast
}: AchievementEntryProps) {
  const validStudentIds = new Set(
    students.flatMap((student) => (student.recordId ? [student.recordId] : []))
  );
  const initialEntries = initialStudentIds
    .filter((id) => validStudentIds.has(id))
    .map((studentId) => ({ studentId, points: '', note: '' }));
  const fixedRecipient = students.length === 1 && initialEntries.length === 1;
  const fixedRecipientName = students[0]?.name ?? 'this student';
  const [step, setStep] = useState<1 | 2>(1);
  const availableCourses = availableCourseOptions(courseOptions, courseOfferingId, classLabel);
  const [selectedCourseId, setSelectedCourseId] = useState(courseOfferingId ?? availableCourses[0]?.id ?? '');
  const selectedCourseLabel =
    availableCourses.find((course) => course.id === selectedCourseId)?.label ?? 'Class';
  const selectedCourseStudentIds = availableCourses.find(
    (course) => course.id === selectedCourseId
  )?.studentIds;
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
    () =>
      eligibleStudents
        .filter(
          (student) =>
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
    : `${countLabel(entries.length, 'student')} selected`;
  const saveDraftLabel = fixedRecipient ? 'Save draft' : 'Save drafts';
  const shareLabel = fixedRecipient ? 'Share with student' : 'Share with students';

  const toggleStudent = (studentId: string) => {
    setEntries((current) =>
      current.some((entry) => entry.studentId === studentId)
        ? current.filter((entry) => entry.studentId !== studentId)
        : [...current, { studentId, points: '', note: '' }]
    );
  };

  const updateEntry = (studentId: string, patch: Partial<Omit<StudentEntry, 'studentId'>>) => {
    setEntries((current) =>
      current.map((entry) => (entry.studentId === studentId ? { ...entry, ...patch } : entry))
    );
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
    } catch (error_) {
      setError(apiMessage(error_));
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

  let handleSubmit;
  if (fixedRecipient) handleSubmit = submitFixedRecipient;
  else if (step === 1) handleSubmit = openRecipients;
  return {
    fixedRecipient,
    fixedRecipientName,
    step,
    setStep,
    availableCourses,
    selectedCourseId,
    selectedCourseLabel,
    selectCourse,
    category,
    setCategory,
    title,
    setTitle,
    description,
    setDescription,
    achievementDate,
    setAchievementDate,
    includeInReport,
    setIncludeInReport,
    fixedEntry,
    updateEntry,
    entries,
    search,
    setSearch,
    setRosterPage,
    roster,
    selectedIds,
    toggleStudent,
    filteredStudents,
    selectedStudents,
    recipientStepLabel,
    nextStepLabel,
    selectedSummary,
    saveDraftLabel,
    shareLabel,
    detailsValid,
    saving,
    error,
    save,
    onClose,
    submitFixedRecipient,
    openRecipients,
    handleSubmit
  };
}

export type AchievementEntryState = ReturnType<typeof useAchievementEntry>;
