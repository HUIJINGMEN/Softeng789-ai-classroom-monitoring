import { request } from '../../lib/apiClient';
import { ALL_CLASSES, type LessonSelection, type StudentOverviewPage, type StudentOverviewScope, type StudentOverviewSource } from './types';

function scopeParams(scope: StudentOverviewScope) {
  const params = new URLSearchParams({ weekStart: scope.weekStart, view: scope.view });
  if (scope.courseOfferingId !== ALL_CLASSES) params.set('courseOfferingId', scope.courseOfferingId);
  return params;
}

export function getStudentOverview(scope: StudentOverviewScope, signal: AbortSignal): Promise<StudentOverviewPage> {
  const params = scopeParams(scope);
  params.set('query', scope.query);
  params.set('exceptionsOnly', String(scope.exceptionsOnly));
  params.set('page', String(scope.page));
  params.set('size', '6');
  return request(`/api/admin/student-overview?${params}`, { signal });
}

export function getStudentOverviewStudent(scope: StudentOverviewScope, selection: LessonSelection, signal: AbortSignal): Promise<StudentOverviewSource> {
  const params = scopeParams({ ...scope, courseOfferingId: selection.session.courseOfferingId });
  return request(`/api/admin/student-overview/students/${selection.row.studentId}?${params}`, { signal });
}
