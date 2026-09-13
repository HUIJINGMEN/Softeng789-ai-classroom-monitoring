import type { StudentApiResponse } from './studentApi';
import { request } from './apiClient';

export type ClassStatus = 'ACTIVE' | 'ARCHIVED';

export interface ClassTeacherSummary {
  id: string;
  name: string;
  email: string;
  status: 'ACTIVE' | 'DEACTIVATED';
}

export interface ClassApiResponse {
  id: string;
  courseCode: string;
  offeringCode: string;
  academicTerm: string;
  status: ClassStatus;
  teachers: ClassTeacherSummary[];
  studentCount: number;
}

/** Lightweight listing for the session-scheduling dropdown and the teacher-facing read-only
 *  "Classes" page — scoped server-side to the caller's own classes unless they're an admin. */
export interface ClassSummaryApiResponse {
  id: string;
  courseCode: string;
  offeringCode: string;
  academicTerm: string;
  teachers: ClassTeacherSummary[];
  studentCount: number;
}

export async function listClasses(): Promise<ClassApiResponse[]> {
  return request<ClassApiResponse[]>('/api/admin/classes');
}

export async function listActiveClasses(): Promise<ClassSummaryApiResponse[]> {
  return request<ClassSummaryApiResponse[]>('/api/classes');
}

/** Minimal, unauthenticated listing — used by the student self-registration page. */
export interface PublicClassSummaryApiResponse {
  id: string;
  courseCode: string;
  offeringCode: string;
  academicTerm: string;
}

export async function listPublicClasses(): Promise<PublicClassSummaryApiResponse[]> {
  return request<PublicClassSummaryApiResponse[]>('/api/classes/public');
}

export async function createClass(payload: {
  courseCode: string;
  academicTerm: string;
  teacherIds: string[];
}): Promise<ClassApiResponse> {
  return request<ClassApiResponse>('/api/admin/classes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function updateClass(
  id: string,
  payload: { academicTerm: string; status: ClassStatus }
): Promise<ClassApiResponse> {
  return request<ClassApiResponse>(`/api/admin/classes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function addClassTeacher(classId: string, teacherId: string): Promise<ClassApiResponse> {
  return request<ClassApiResponse>(`/api/admin/classes/${classId}/teachers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teacherId })
  });
}

export async function removeClassTeacher(classId: string, teacherId: string): Promise<ClassApiResponse> {
  return request<ClassApiResponse>(`/api/admin/classes/${classId}/teachers/${teacherId}`, {
    method: 'DELETE'
  });
}

export async function listClassStudents(classId: string): Promise<StudentApiResponse[]> {
  return request<StudentApiResponse[]>(`/api/classes/${classId}/students`);
}

export async function removeClassStudent(classId: string, studentId: string): Promise<void> {
  await request<void>(`/api/admin/classes/${classId}/students/${studentId}`, {
    method: 'DELETE'
  });
}

export async function addClassStudents(classId: string, studentIds: string[]): Promise<ClassApiResponse> {
  return request<ClassApiResponse>(`/api/admin/classes/${classId}/students/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentIds })
  });
}

export async function removeClassStudents(classId: string, studentIds: string[]): Promise<void> {
  await request<void>(`/api/admin/classes/${classId}/students/batch-withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentIds })
  });
}

export async function transferClassStudent(
  fromClassId: string,
  studentId: string,
  toClassId: string
): Promise<void> {
  await request<void>(`/api/admin/classes/${fromClassId}/students/${studentId}/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toClassId })
  });
}
