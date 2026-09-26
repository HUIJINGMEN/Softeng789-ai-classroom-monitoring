import { useCallback } from 'react';
import { enrolledCountForSession } from '../features/session-attendance/sessionAttendanceModel';
import {
  listClassroomSessionsPage,
  mapClassroomSessionApiToUi
} from '../lib/classroomApi';
import type { Student } from '../types';
import { usePagedResource } from './usePagedResource';

export function useSessionDirectoryPage(
  page: number,
  size: number,
  query: string,
  students: readonly Student[],
  refreshKey: string
) {
  const loadPage = useCallback(
    () => listClassroomSessionsPage(page, size, query),
    [page, query, refreshKey, size]
  );
  const mapSession = useCallback((item: Parameters<typeof mapClassroomSessionApiToUi>[0]) => {
    const session = mapClassroomSessionApiToUi(item, 0);
    return { ...session, enrolled: enrolledCountForSession(session, students) };
  }, [students]);
  return usePagedResource(size, loadPage, mapSession, 'Sessions');
}
