import { request } from '../../lib/apiClient';
import type { ReportEmailResult, ReportScope, ReportTopic, StudentReport } from './types';
import type { StudentReportProgress } from './workspaceTypes';

const root = '/api/student-reports';
const post = (body?: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});
export const getStudentReport = (id: string) => request<StudentReport>(`${root}/${id}`);
/** Chunk the read-only batch, not the draft preparation endpoint. */
export async function listStudentReportProgress(scopes: ReportScope[]) {
  const result: StudentReportProgress[] = [];
  for (let start = 0; start < scopes.length; start += 100) {
    result.push(...await request<StudentReportProgress[]>(`${root}/workspace`, post({ scopes: scopes.slice(start, start + 100) })));
  }
  return result;
}
export const prepareStudentReport = (scope: ReportScope) =>
  request<StudentReport>(`${root}/prepare`, post(scope));
export const generateReportSection = (
  report: StudentReport,
  topic: ReportTopic
) =>
  request<StudentReport>(
    `${root}/${report.id}/sections/${topic}/generate`,
    post({ version: report.version })
  );
export const saveReportSection = (
  report: StudentReport,
  topic: ReportTopic,
  text: string,
  approve: boolean,
  evidenceReviewed = false
) =>
  request<StudentReport>(`${root}/${report.id}/sections/${topic}`, {
    ...post({ version: report.version, text, approve, evidenceReviewed }),
    method: 'PUT'
  });
export const publishStudentReport = (report: StudentReport) =>
  request<StudentReport>(
    `${root}/${report.id}/publish`,
    post({ version: report.version })
  );
export const emailStudentReport = (report: StudentReport) =>
  request<ReportEmailResult>(
    `${root}/${report.id}/email`,
    post({ version: report.version })
  );
export const listPublishedStudentReports = (studentId: string) =>
  request<StudentReport[]>(`/api/students/${studentId}/reports`);
