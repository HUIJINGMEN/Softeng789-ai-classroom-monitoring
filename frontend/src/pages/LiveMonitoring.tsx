import { useMemo, useState } from 'react';
import BackButton from '../components/BackButton';
import { IconMonitor } from '../components/icons';
import SearchField from '../components/SearchField';
import { sessionRoomLabel } from '../lib/classroomApi';
import { eventSubjectLabel, sessionDisplayName } from '../lib/eventDisplay';
import { statusClass } from '../lib/format';
import { studentCourses } from '../lib/studentCourses';
import type { Console } from '../hooks/useConsole';
import type { Session, Student } from '../types';

function monitorStateLabel(state: 'running' | 'paused' | 'stopped') {
  if (state === 'running') return 'Live · simulated';
  if (state === 'paused') return 'Paused';
  return 'Stopped';
}

export default function LiveMonitoring({ console: c }: { readonly console: Console }) {
  // Every visit starts at the picker rather than remembering the last classroom — with many
  // teachers/classes in the system, jumping straight into whatever session happened to be active
  // elsewhere stopped being a sensible default.
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);

  if (!viewingSessionId) {
    return (
      <LiveMonitoringPicker
        sessions={c.sessions}
        students={c.students}
        onSelect={(id) => {
          c.selectSession(id);
          setViewingSessionId(id);
        }}
      />
    );
  }

  const alerts = c.settings.notifyLive ? c.liveAlerts : [];
  const trackClass = (trackId: string) => `track-box--${trackId.toLowerCase()}`;

  const meta: [string, string][] = [
    ['Session', sessionDisplayName(c.activeSession)],
    ['Course', c.activeSession.course],
    ['Title', c.activeSession.title],
    ['Room', sessionRoomLabel(c.activeSession)],
    ['Scheduled', `${c.activeSession.dateLabel} · ${c.activeSession.time}`],
    ['Students present', `${c.counts.present + c.counts.late} / ${c.counts.total}`],
    ['Identity display', c.settings.privacy]
  ];

  return (
    <div className="page__inner">
      <BackButton label="Back to classrooms" onClick={() => setViewingSessionId(null)} className="page-action" />

      <div className="notice notice--warn dashboard-enter stagger-0">
        Prototype using simulated data — no camera, facial recognition, or AI model is connected.
        Detections below are scripted for demonstration.
      </div>

      <div className="live-grid">
        <section className="card dashboard-enter stagger-1">
          <div className="stage">
            {c.trackBoxes.map((box) => (
              <div
                key={box.trackId}
                className={`track-box ${trackClass(box.trackId)}${
                  box.color === 'var(--warn)' ? ' track-box--flagged' : ''
                }`}
              >
                <div className="track-box__label">
                  {box.label}
                </div>
              </div>
            ))}

            <div className="stage__hud">
              <span className={`monitor-state monitor-state--${c.monitor}`}>
                <span className="monitor-state__mark" aria-hidden="true" />
                {monitorStateLabel(c.monitor)}
              </span>
              <span>{c.monitor === 'running' ? c.fps.toFixed(1) : '0.0'} fps</span>
              <span>detected {c.trackBoxes.length}</span>
            </div>

            <div className="stage__caption">
              <div className="stage__caption-title">
                Classroom live feed unavailable
              </div>
              <div>{sessionRoomLabel(c.activeSession)} · fixed wide angle</div>
            </div>
          </div>

          <div className="live-controls">
            <button
              type="button"
              className="btn btn--ok"
              onClick={() => {
                c.setMonitor('running');
                c.showToast('Monitoring started — simulated detection stream.');
              }}
            >
              Start monitoring
            </button>
            <button
              type="button"
              className="btn"
              disabled={c.monitor === 'stopped'}
              onClick={() => c.setMonitor(c.monitor === 'paused' ? 'running' : 'paused')}
            >
              {c.monitor === 'paused' ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              disabled={c.monitor === 'stopped'}
              onClick={() => {
                c.setMonitor('stopped');
                c.clearLiveAlerts();
                c.showToast('Monitoring stopped.');
              }}
            >
              Stop monitoring
            </button>
            <div className="spacer" />
            <div className="live-controls__meta">
              Detection threshold {c.settings.confidence.toFixed(2)} · head-down{' '}
              {c.settings.headDown}s
            </div>
          </div>
        </section>

        <div className="live-side">
          <section className="card dashboard-enter stagger-2">
            <div className="card__body">
              <div className="card__title card__title--session">
                Current session
              </div>
              {meta.map(([key, value]) => (
                <div key={key} className="kv">
                  <span className="kv__k">{key}</span>
                  <span className="kv__v">{value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card dashboard-enter stagger-3">
            <div className="card__head">
              <div className="card__title">Candidate event notifications</div>
            </div>
            <div className="alert-list">
              {alerts.map((alert) => (
                <div key={alert.id} className="alert">
                  <div className="alert__head">
                    <div className="alert__title">{alert.type}</div>
                    <div className="mono alert__time">
                      {alert.start}
                    </div>
                  </div>
                  <div className="alert__meta">
                    {eventSubjectLabel(alert, c.students)} · conf {alert.confidence.toFixed(2)} ·
                    awaiting teacher review
                  </div>
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() => {
                      c.setModalId(alert.id);
                      c.setCorrecting(false);
                    }}
                  >
                    Open evidence
                  </button>
                </div>
              ))}

              {alerts.length === 0 && (
                <div className="empty empty--notifications">
                  No candidate events yet. Start monitoring to simulate detections.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function LiveMonitoringPicker({
  sessions,
  students,
  onSelect
}: {
  readonly sessions: readonly Session[];
  readonly students: readonly Student[];
  readonly onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return sessions;
    return sessions.filter((session) => matchesQuery(session, trimmed, students));
  }, [sessions, students, query]);

  return (
    <div className="page__inner">
      <section className="card dashboard-enter stagger-0">
        <div className="card__head">
          <div className="card__title-row">
            <span className="icon-inline icon-inline--title" aria-hidden="true">
              <IconMonitor />
            </span>
            <div>
              <div className="card__title">Choose a classroom to monitor</div>
              <div className="card__sub">
                Search by room, course, teacher or student, then pick one to open its live view.
              </div>
            </div>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="empty">No classroom sessions have been scheduled yet.</div>
        ) : (
          <>
            <SearchField
              className="card-list-search"
              value={query}
              onChange={setQuery}
              placeholder="Room, course, teacher or student"
              autoFocus
            />

            <div className="live-picker-list">
              {matches.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  className="live-picker-item"
                  onClick={() => onSelect(session.id)}
                >
                  <div>
                    <div className="cell-strong">{session.course}</div>
                    <div className="cell-sub">
                      {sessionRoomLabel(session)} · {session.teacherName ?? 'Unassigned Teacher'} · {session.dateLabel}
                    </div>
                  </div>
                  <span className={statusClass(session.status)}>{session.status}</span>
                </button>
              ))}
              {matches.length === 0 && (
                <div className="live-picker-empty">
                  <strong>No matching classrooms</strong>
                  <span>Try another room, course, teacher or student.</span>
                  <button type="button" className="btn btn--sm" onClick={() => setQuery('')}>Clear search</button>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function matchesQuery(session: Session, query: string, students: readonly Student[]): boolean {
  if (
    session.room.toLowerCase().includes(query) ||
    session.course.toLowerCase().includes(query) ||
    (session.teacherName ?? '').toLowerCase().includes(query)
  ) {
    return true;
  }
  return students.some(
    (student) =>
      student.name.toLowerCase().includes(query) && studentCourses(student).includes(session.course)
  );
}
