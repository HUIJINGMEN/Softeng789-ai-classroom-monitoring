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
      title={`Possible ${eventType.toLowerCase()}`}
      subtitle="AI-detected candidate event — requires teacher review before it becomes a record."
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
              {saving ? 'Confirming…' : 'Confirm'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={saving}
              onClick={() => void onDismiss({ teacherNotes })}
            >
              {saving ? 'Dismissing…' : 'Dismiss'}
            </button>
            <button type="button" className="btn" onClick={() => setCorrecting(!correcting)}>
              Correct event type
            </button>
          </>
        )
      }
    >
      <div className="modal__grid">
        <div>
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
          <label className="field field--wide" style={{ marginTop: 12 }}>
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
              <div className="modal__section-title">Correct event type</div>
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
        </div>

        <div className="modal__meta">
          {meta.map(([key, value]) => (
            <div key={key} className="kv kv--plain">
              <span className="kv__k">{key}</span>
              <span className="kv__v">{value}</span>
            </div>
          ))}
          <span className={`${badge.className} modal__status`}>{badge.label}</span>
        </div>
      </div>
    </Modal>
  );
}
