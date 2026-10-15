import type { ReportEmailResult, StudentReport } from './types';

interface DeliveryApi {
  publish: (report: StudentReport) => Promise<StudentReport>;
  email: (report: StudentReport) => Promise<ReportEmailResult>;
}
interface DeliveryProgress {
  published: (report: StudentReport) => void;
  emailed: (result: ReportEmailResult) => void;
}

/** Publication advances the version. Retain that revision even if the following email response fails. */
export async function deliverReportRevision(
  report: StudentReport,
  choices: { publish: boolean; email: boolean },
  api: DeliveryApi,
  progress: DeliveryProgress
) {
  let latest = report;
  if (choices.publish && !latest.publishedAt) {
    latest = await api.publish(latest);
    progress.published(latest);
  }
  if (choices.email) progress.emailed(await api.email(latest));
  return latest;
}
