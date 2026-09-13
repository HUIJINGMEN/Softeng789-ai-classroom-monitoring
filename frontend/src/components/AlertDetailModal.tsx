import { useState } from 'react';
import Modal from './Modal';
import { healthAlertStatusBadge } from '../lib/healthAlertStatus';
import { formatDateTime } from '../lib/format';
import { SUGGESTED_INCIDENT_TYPES } from '../lib/healthIncidentTypes';
import type { HealthAlert } from '../types';

interface Props {
  readonly alert: HealthAlert;
  readonly saving: boolean;
  readonly onConfirm: (payload: { eventType: string; teacherNotes: string; actionTaken: string }) => Promise<boolean>;
  readonly onDismiss: (payload: { teacherNotes: string }) => Promise<boolean>;
  readonly onClose: () => void;
}

export default function AlertDetailModal({ alert, saving, onConfirm, onDismiss, onClose }: Props) {
  const [correcting, setCorrecting] = useState(false);
  const [eventType, setEventType] = useState(alert.eventType);
  const [teacherNotes, setTeacherNotes] = useState(alert.teacherNotes ?? '');
  const [actionTaken, setActionTaken] = useState(alert.actionTaken ?? '');

  const awaiting = alert.status === 'awaiting-review';
  const badge = healthAlertStatusBadge(alert.status);

  const meta: [string, string][] = [
    ['Student', alert.studentName],
    ['Class', alert.classLabel],
    ['Room', alert.room],
    ['Detected at', formatDateTime(alert.detectedAt)],
    ['Event type', eventType],
    ['AI confidence', alert.confidence !== null ? `${Math.round(alert.confidence * 100)}%` : 'Not provided'],
    ['Source', 'AI-detected']
  ];
  if (!awaiting) {
    meta.push(['Reviewed by', alert.reviewedByTeacherName ?? '—']);
    if (alert.reviewedAt) meta.push(['Reviewed at', formatDateTime(alert.reviewedAt)]);
  }

  return (
    <Modal
      onClose={onClose}
      size="wide"
      titleId={`health-alert-title-${alert.id}`}
      title={`Potential ${eventType.toLowerCase()}`}
      subtitle="AI-detected health or safety concern — review the observable evidence before creating an incident record."
      closeButton
      footCompact={false}
      footer={
        awaiting && (
          <>
            <button
              type="button"
              className="btn btn--ok"
              disabled={saving}
              onClick={() => void onConfirm({ eventType, teacherNotes, actionTaken })}
            >
              {saving ? 'Creating record…' : 'Create incident record'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={saving}
              onClick={() => void onDismiss({ teacherNotes })}
            >
              {saving ? 'Dismissing…' : 'Dismiss concern'}
            </button>
            <button type="button" className="btn" onClick={() => setCorrecting(!correcting)}>
              Adjust incident type
            </button>
          </>
        )
      }
    >
      <div className="health-detail">
        <section className="health-detail__evidence">
          <div className="modal__section-title">Evidence</div>
          {alert.evidenceUrl ? (
            <img
              className="health-detail__image"
              src={alert.evidenceUrl}
              alt={`AI evidence for potential ${eventType.toLowerCase()} involving ${alert.studentName}`}
            />
          ) : (
            <div className="evidence-slot health-detail__placeholder">
              <div className="evidence-slot__label">Evidence unavailable</div>
              <div>No snapshot or video was provided with this alert.</div>
            </div>
          )}
          <div className="health-detail__observation">
            <strong>AI observation</strong>
            <p>
              The system detected an observable event that may match {eventType.toLowerCase()}.
              This is not a medical diagnosis and requires human review.
            </p>
          </div>
        </section>

        <section className="health-detail__incident">
          <div className="modal__section-title">Incident information</div>
          <div className="modal__meta">
            {meta.map(([key, value]) => (
              <div key={key} className="kv kv--plain">
                <span className="kv__k">{key}</span>
                <span className="kv__v">{value}</span>
              </div>
            ))}
            <span className={`${badge.className} modal__status`}>{badge.label}</span>
          </div>
        </section>

        <section className="health-detail__response">
          <div className="modal__section-title">Response</div>
          <label className="field field--wide">
            Teacher notes
            <textarea
              value={teacherNotes}
              onChange={(event) => setTeacherNotes(event.target.value)}
              placeholder="e.g. Student slipped while standing up."
              rows={3}
              disabled={!awaiting}
            />
          </label>
          <label className="field field--wide health-detail__field">
            Action taken
            <textarea
              value={actionTaken}
              onChange={(event) => setActionTaken(event.target.value)}
              placeholder="e.g. Checked the student and confirmed no further assistance was required."
              rows={3}
              disabled={!awaiting}
            />
          </label>

          {awaiting && correcting && (
            <div className="modal__correction">
              <div className="modal__section-title">Adjust incident type</div>
              <div className="modal__option-list">
                {SUGGESTED_INCIDENT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`option-btn option-btn--choice${type === eventType ? ' option-btn--on' : ''}`}
                    onClick={() => {
                      setEventType(type);
                      setCorrecting(false);
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
