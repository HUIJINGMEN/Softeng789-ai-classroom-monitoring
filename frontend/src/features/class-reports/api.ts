import { request } from "../../lib/apiClient";
import { reportScopeQuery } from "../report-review/reportScopeQuery";
import type { ReportReviewApi } from "../report-review/types";
import type { ClassReport, ClassReportScope } from "./types";

const root = "/api/class-reports";
const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
export const classReportReviewApi: ReportReviewApi<
  ClassReport,
  ClassReportScope
> = {
  load: async scope => (await request<ClassReport | null>(`${root}/draft?${reportScopeQuery(scope)}`)) ?? null,
  prepare: (scope) => request(`${root}/prepare`, post(scope)),
  generate: (report, topic) =>
    request(
      `${root}/${report.id}/sections/${topic}/generate`,
      post({ version: report.version }),
    ),
  save: (report, topic, text, approve, evidenceReviewed = false) =>
    request(`${root}/${report.id}/sections/${topic}`, {
      ...post({ version: report.version, text, approve, evidenceReviewed }),
      method: "PUT",
    }),
  scopeValid: (scope) =>
    Boolean(
      scope.courseOfferingId &&
      scope.dateFrom &&
      scope.dateTo &&
      scope.dateFrom <= scope.dateTo,
    ),
  scopeChanged: (scope, report) =>
    scope.courseOfferingId !== report.courseOfferingId ||
    scope.dateFrom !== report.document.dateFrom ||
    scope.dateTo !== report.document.dateTo,
};
export const finalizeClassReport = (report: ClassReport) =>
  request<ClassReport>(
    `${root}/${report.id}/finalize`,
    post({ version: report.version }),
  );
export const listClassReports = (courseId: string) =>
  request<ClassReport[]>(`${root}/history/${courseId}`);
