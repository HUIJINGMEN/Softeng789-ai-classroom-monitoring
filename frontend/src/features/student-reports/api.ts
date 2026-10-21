import { request } from '../../lib/apiClient';
import { reportScopeQuery } from '../report-review/reportScopeQuery';
import type { ReportEmailResult, ReportScope, ReportTopic, StudentReport } from './types';
import type { StudentReportProgress } from './workspaceTypes';
import { runSequential } from '../report-review/runSequential';

const root = '/api/student-reports';
const post = (body?: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});
export const getStudentReport = (id: string) => request<StudentReport>(`${root}/${id}`);
export const loadStudentReportDraft = async (scope: ReportScope) =>
  (await request<StudentReport | null>(`${root}/draft?${reportScopeQuery(scope)}`)) ?? null;
/** Chunk the read-only batch, not the draft preparation endpoint. */
export async function listStudentReportProgress(scopes: ReportScope[]) {
  const batches = Array.from({ length: Math.ceil(scopes.length / 100) }, (_, index) =>
    scopes.slice(index * 100, (index + 1) * 100));
  return runSequential(batches, [] as StudentReportProgress[], async (rows, batch) => [
    ...rows, ...await request<StudentReportProgress[]>(`${root}/workspace`, post({ scopes: batch }))
  ]);
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
