import { useCallback } from 'react';
import {
  listStudentDirectory,
  mapStudentApiToUi,
  type StudentDirectoryFilters
} from '../lib/studentApi';
import type { Student } from '../types';
import { usePagedResource } from './usePagedResource';

function mapDirectoryStudent(item: Awaited<ReturnType<typeof listStudentDirectory>>['items'][number]): Student {
  return {
    ...mapStudentApiToUi(item.student),
    rate: item.attendanceRate
  };
}

export function useStudentDirectoryPage(
  page: number,
  size: number,
  filters: StudentDirectoryFilters,
  refreshKey: string
) {
  const { query, course, level, sort, direction } = filters;
  const loadPage = useCallback(
    () => listStudentDirectory(page, size, { query, course, level, sort, direction }),
    [course, direction, level, page, query, refreshKey, size, sort]
  );
  return usePagedResource(size, loadPage, mapDirectoryStudent, 'Students');
}
