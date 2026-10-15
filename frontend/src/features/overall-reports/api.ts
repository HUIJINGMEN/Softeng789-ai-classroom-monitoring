import { request } from "../../lib/apiClient";
import type { ReportReviewApi } from "../report-review/types";
import type { OverallReport, OverallReportScope } from "./types";

const root = "/api/overall-reports";
const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const ids = (values: string[]) => [...new Set(values)].sort().join(",");
export const overallReportReviewApi: ReportReviewApi<
  OverallReport,
  OverallReportScope
> = {
  prepare: (scope) => request(root + "/prepare", post(scope)),
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
      scope.dateFrom &&
      scope.dateTo &&
      scope.dateFrom <= scope.dateTo &&
      (Date.parse(scope.dateTo) - Date.parse(scope.dateFrom)) / 86400000 <=
        366 &&
      scope.courseOfferingIds.length <= 100,
    ),
  scopeChanged: (scope, report) =>
    scope.dateFrom !== report.document.dateFrom ||
    scope.dateTo !== report.document.dateTo ||
    scope.audience !== report.document.audience ||
    ids(scope.courseOfferingIds) !== ids(report.document.courseOfferingIds),
};
export const finalizeOverallReport = (
  report: OverallReport,
  privacyReviewed: boolean,
) =>
  request<OverallReport>(
    `${root}/${report.id}/finalize`,
    post({ version: report.version, privacyReviewed }),
  );
export const listOverallReports = () =>
  request<OverallReport[]>(root + "/history");
