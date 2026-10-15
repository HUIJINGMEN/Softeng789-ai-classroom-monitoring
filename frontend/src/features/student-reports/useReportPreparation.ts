import { useReportReview } from "../report-review/useReportReview";
import {
  generateReportSection,
  prepareStudentReport,
  saveReportSection,
} from "./api";
import type { ReportScope, StudentReport } from "./types";
import type { ReportReviewApi } from "../report-review/types";

const api: ReportReviewApi<StudentReport, ReportScope> = {
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
    [...scope.courseOfferingIds].sort().join() !==
      [...report.document.courseOfferingIds].sort().join(),
};
export const useReportPreparation = (scope: ReportScope) =>
  useReportReview(scope, api);
