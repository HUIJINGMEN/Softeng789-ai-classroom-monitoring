import { API_BASE_URL, request } from './apiClient';
import type { ProgressReport } from '../types';

export interface FeedbackClassOption {
  courseOfferingId: string;
  label: string;
  students: { id: string; name: string; studentNumber: string }[];
}

export interface StudentRecognitionResult {
  studentId: string;
  studentName: string;
  studentNumber: string;
  confidence: number;
  mode: string;
}

interface ProgressReportApiResponse {
  id: string;
  studentId: string;
  studentName: string;
  courseOfferingId: string;
  classLabel: string;
  teacherId: string;
  teacherName: string;
  comment: string;
  photoUrl: string | null;
  createdAt: string;
}

// A report is never edited after creation, so unlike face-enrollment photos (which get
// re-uploaded and need cache-busting), the photo URL can be used as-is. Text-only feedback
// written on the web has no photo at all — photoUrl stays null rather than a broken image link.
function mapReportApiToUi(report: ProgressReportApiResponse): ProgressReport {
  return { ...report, photoUrl: report.photoUrl ? `${API_BASE_URL}${report.photoUrl}` : null };
}

export async function listProgressReportsForStudent(studentId: string): Promise<ProgressReport[]> {
  const reports = await request<ProgressReportApiResponse[]>(
    `/api/progress-reports?studentId=${encodeURIComponent(studentId)}`
  );
  return reports.map(mapReportApiToUi);
}

/** Student-portal equivalent of the teacher query above. The route is deliberately separate:
 * the backend accepts only the matching student session, so it cannot bypass teacher class scope. */
export async function listMyProgressReports(studentId: string): Promise<ProgressReport[]> {
  const reports = await request<ProgressReportApiResponse[]>(
    `/api/students/${encodeURIComponent(studentId)}/progress-reports`
  );
  return reports.map(mapReportApiToUi);
}

// Used by the class detail page's Reports tab — every report written for this class, regardless
// of which student it's about.
export async function listProgressReportsForClass(courseOfferingId: string): Promise<ProgressReport[]> {
  const reports = await request<ProgressReportApiResponse[]>(
    `/api/progress-reports?courseOfferingId=${encodeURIComponent(courseOfferingId)}`
  );
  return reports.map(mapReportApiToUi);
}

// Used by the system-wide Reports page — every report the caller can see at all (admin: every
// report; teacher: only from classes they teach), with no student/class filter. Reports.tsx
// applies its own course/date-range filters client-side, same as it already does for sessions
// and events.
export async function listAllProgressReports(): Promise<ProgressReport[]> {
  const reports = await request<ProgressReportApiResponse[]>('/api/progress-reports');
  return reports.map(mapReportApiToUi);
}

export async function createProgressReport(payload: {
  studentId: string;
  courseOfferingId: string;
  comment: string;
  photo?: Blob;
}): Promise<ProgressReport> {
  const formData = new FormData();
  formData.append('studentId', payload.studentId);
  formData.append('courseOfferingId', payload.courseOfferingId);
  formData.append('comment', payload.comment);
  if (payload.photo) formData.append('photo', payload.photo, 'feedback-photo.jpg');

  const report = await request<ProgressReportApiResponse>('/api/progress-reports', {
    method: 'POST',
    body: formData
  });
  return mapReportApiToUi(report);
}

/** Classes are scoped by the backend to the signed-in teacher. */
export function listFeedbackClasses(): Promise<FeedbackClassOption[]> {
  return request<FeedbackClassOption[]>('/api/progress-reports/my-classes');
}

/** Demo recognition today; the lab service can replace the backend adapter without changing UI. */
export function recognizeStudent(
  courseOfferingId: string,
  photo: Blob
): Promise<StudentRecognitionResult> {
  const formData = new FormData();
  formData.append('courseOfferingId', courseOfferingId);
  formData.append('photo', photo, 'classroom-capture.jpg');
  return request<StudentRecognitionResult>('/api/progress-reports/recognize-student', {
    method: 'POST',
    body: formData
  });
}
