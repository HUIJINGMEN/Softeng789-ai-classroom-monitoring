import { useCallback, useEffect, useState } from 'react';
import { apiMessage } from '../lib/apiClient';
import { listStudents, mapStudentApiToUi } from '../lib/studentApi';
import type { Student } from '../types';

export function useStudentsData() {
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

  return {
    students,
    studentsLoading,
    studentsError,
    refreshStudents
  };
}
