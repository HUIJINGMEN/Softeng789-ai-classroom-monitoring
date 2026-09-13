import { IconHeartPulse } from './icons';
import { formatDateTime } from '../lib/format';
import { healthAlertStatusBadge } from '../lib/healthAlertStatus';
import type { HealthAlert } from '../types';

interface Props {
  readonly alert: HealthAlert;
  readonly onOpen: () => void;
  readonly onOpenStudent: (studentId: string) => void;
  readonly onOpenSession: (sessionId: string) => void;
}

export default function HealthAlertCard({ alert, onOpen, onOpenStudent, onOpenSession }: Props) {
  const badge = healthAlertStatusBadge(alert.status);
  const awaiting = alert.status === 'awaiting-review';
  const confidence = alert.confidence !== null ? `${Math.round(alert.confidence * 100)}% confidence` : null;

  return (
    <article className={`health-alert${awaiting ? ' health-alert--awaiting' : ''}`}>
      <div className="health-alert__signal">
        <span className="health-alert__icon" aria-hidden="true">
          <IconHeartPulse />
        </span>
      </div>
      <div className="health-alert__incident">
        <div className="health-alert__label-row">
          <span className="source-badge source-badge--ai">AI detected</span>
          <span className={badge.className}>{badge.label}</span>
        </div>
        <div className="health-alert__title">Potential {alert.eventType.toLowerCase()}</div>
        <div className="health-alert__note">AI detected an observable event that may require attention.</div>
      </div>
      <div className="health-alert__student">
        <button type="button" className="cell-strong link-reset" onClick={() => onOpenStudent(alert.studentId)}>
          {alert.studentName}
        </button>
        <button type="button" className="health-alert__note link-reset" onClick={() => onOpenSession(alert.sessionId)}>
          {alert.classLabel} · {alert.room}
        </button>
      </div>
      <div className="health-alert__meta">
        <div>{formatDateTime(alert.detectedAt)}</div>
        {confidence && <div>{confidence}</div>}
        {alert.actionTaken && <div className="health-alert__action">Action: {alert.actionTaken}</div>}
      </div>
      <div className="health-alert__open">
        <button type="button" className={`btn btn--sm${awaiting ? ' btn--health' : ''}`} onClick={onOpen}>
          {awaiting ? 'Review concern' : 'View review'}
        </button>
      </div>
    </article>
  );
}
