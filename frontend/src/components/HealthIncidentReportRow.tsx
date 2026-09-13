import { IconHeartPulse } from './icons';
import { formatDateTime } from '../lib/format';
import type { HealthIncidentReport } from '../types';

interface Props {
  readonly report: HealthIncidentReport;
}

export default function HealthIncidentReportRow({ report }: Props) {
  return (
    <article className="health-record">
      <div className="health-record__identity">
        <span className="health-alert__icon health-alert__icon--record" aria-hidden="true">
          <IconHeartPulse />
        </span>
        <div>
          <span className={`source-badge source-badge--${report.source === 'ai-detected' ? 'ai' : 'teacher'}`}>
            {report.source === 'ai-detected' ? 'AI detected' : 'Teacher reported'}
          </span>
          <div className="health-record__title">{report.incidentType}</div>
          <div className="health-record__description">{report.description}</div>
        </div>
      </div>
      <div className="health-record__person">
        <div className="cell-strong">{report.studentName}</div>
        <div>{report.classLabel}</div>
        {report.sessionLabel && <div>{report.sessionLabel}</div>}
      </div>
      <div className="health-record__response">
        <span>Response recorded</span>
        <div>{report.actionTaken || 'No action was recorded.'}</div>
      </div>
      <div className="health-record__time">
        <div>{formatDateTime(report.occurredAt)}</div>
        <div>Reported by {report.teacherName}</div>
      </div>
    </article>
  );
}
