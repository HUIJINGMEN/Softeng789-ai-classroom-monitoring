import { IconHeartPulse } from './icons';
import { formatDateTime } from '../lib/format';
import type { HealthIncidentReport } from '../types';

interface Props {
  readonly report: HealthIncidentReport;
}

export default function HealthIncidentReportRow({ report }: Props) {
  return (
    <div className="health-alert">
      <span className="health-alert__icon" aria-hidden="true">
        <IconHeartPulse />
      </span>
      <div className="health-alert__main">
        <div className="cell-strong">
          {report.incidentType} · {report.studentName}
        </div>
        <div className="health-alert__note">{report.description}</div>
      </div>
      <div className="health-alert__meta">
        <div>{report.source === 'ai-detected' ? 'AI detected' : 'Teacher reported'}</div>
        <div>{formatDateTime(report.occurredAt)}</div>
        <div>{report.classLabel}</div>
      </div>
    </div>
  );
}
