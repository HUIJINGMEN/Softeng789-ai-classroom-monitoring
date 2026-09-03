import { IconHeartPulse } from './icons';
import { formatDateTime } from '../lib/format';
import { healthAlertStatusBadge } from '../lib/healthAlertStatus';
import type { HealthAlert } from '../types';

interface Props {
  readonly alert: HealthAlert;
  readonly onOpen: () => void;
}

export default function HealthAlertCard({ alert, onOpen }: Props) {
  const badge = healthAlertStatusBadge(alert.status);
  const awaiting = alert.status === 'awaiting-review';

  return (
    <div className={`health-alert${awaiting ? ' health-alert--awaiting' : ''}`}>
      <span className="health-alert__icon" aria-hidden="true">
        <IconHeartPulse />
      </span>
      <div className="health-alert__main">
        <div className="cell-strong">
          {alert.eventType} · {alert.studentName}
        </div>
        <div className="health-alert__note">
          {alert.classLabel} · {alert.room}
        </div>
      </div>
      <div className="health-alert__meta">
        <div>{formatDateTime(alert.detectedAt)}</div>
        <div>
          AI detected{alert.confidence !== null ? ` · ${Math.round(alert.confidence * 100)}% confidence` : ''}
        </div>
      </div>
      <div className="row-inline">
        <span className={badge.className}>{badge.label}</span>
        <button type="button" className="btn btn--sm" onClick={onOpen}>
          {awaiting ? 'Review' : 'View'}
        </button>
      </div>
    </div>
  );
}
