import { useCallback, useEffect, useState } from 'react';
import {
  apiMessage,
  createStudent,
  listStudents,
  mapStudentApiToUi,
  uploadFaceEnrollment
} from '../lib/studentApi';
import type { NewStudentRegistration, Student } from '../types';

interface UseStudentsDataOptions {
  onStudentCreated: (student: Student) => void;
  showToast: (message: string) => void;
}

export function useStudentsData({ onStudentCreated, showToast }: UseStudentsDataOptions) {
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState('');

  const refreshStudents = useCallback(async () => {
    setStudentsLoading(true);
    try {
      const apiStudents = await listStudents();
      setStudents(apiStudents.map((student) => mapStudentApiToUi(student)));
      setStudentsError('');
    } catch (error) {
      setStudents([]);
      setStudentsError(`Backend student API unavailable: ${apiMessage(error)}`);
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStudents();
  }, [refreshStudents]);

  const addStudent = useCallback(
    async (registration: NewStudentRegistration) => {
      const created = await createStudent(registration);
      const initialStudent = mapStudentApiToUi(created);
      setStudents((current) => [
        initialStudent,
        ...current.filter((student) => student.recordId !== initialStudent.recordId)
      ]);
      setStudentsError('');
      onStudentCreated(initialStudent);

      const enrollment = await uploadFaceEnrollment(created.id, registration.registrationPhoto);
      const enrolledStudent = mapStudentApiToUi(created, enrollment);
      setStudents((current) =>
        current.map((student) =>
          student.recordId === enrolledStudent.recordId ? enrolledStudent : student
        )
      );
      onStudentCreated(enrolledStudent);
      showToast(
        enrollment.status === 'PHOTO_CAPTURED'
          ? `${enrolledStudent.name} saved. Registration photo captured.`
          : `${enrolledStudent.name} saved, but face enrollment failed.`
      );
    },
    [onStudentCreated, showToast]
  );

  return {
    students,
    studentsLoading,
    studentsError,
    refreshStudents,
    addStudent
  };
}
