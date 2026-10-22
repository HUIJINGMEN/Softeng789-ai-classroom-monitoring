import { useReportReview } from "../report-review/useReportReview";
import {
  generateReportSection,
  prepareStudentReport,
  loadStudentReportDraft,
  saveReportSection,
} from "./api";
import type { ReportScope, StudentReport } from "./types";
import type { ReportReviewApi } from "../report-review/types";

const api: ReportReviewApi<StudentReport, ReportScope> = {
  load: loadStudentReportDraft,
  prepare: prepareStudentReport,
  generate: generateReportSection,
  save: saveReportSection,
  scopeValid: (scope) =>
    scope.courseOfferingIds.length > 0 &&
    Boolean(scope.dateFrom && scope.dateTo) &&
    scope.dateFrom <= scope.dateTo,
  scopeChanged: (scope, report) =>
    scope.dateFrom !== report.document.dateFrom ||
    scope.dateTo !== report.document.dateTo ||
    [...scope.courseOfferingIds].sort((a, b) => a.localeCompare(b)).join() !==
      [...report.document.courseOfferingIds].sort((a, b) => a.localeCompare(b)).join(),
};
export const useReportPreparation = (scope: ReportScope) =>
  useReportReview(scope, api);
