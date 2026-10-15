import type { OverallReport } from "./types";

export const overallAudienceLabel = (audience: string) =>
  audience === "PARTNER" ? "Partner report" : "Internal operations report";
export const overallDateTime = (value: string) =>
  new Date(value).toLocaleString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Pacific/Auckland",
    timeZoneName: "short",
  });
export const overallReportFilename = (report: OverallReport) =>
  `${overallAudienceLabel(report.document.audience)} - ${report.document.dateFrom} to ${report.document.dateTo}`;
