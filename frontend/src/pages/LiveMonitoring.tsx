import { eventSubjectLabel, sessionDisplayName } from '../lib/eventDisplay';
import type { Console } from '../hooks/useConsole';

export default function LiveMonitoring({ console: c }: { console: Console }) {
  const alerts = c.settings.notifyLive ? c.liveAlerts : [];
  const trackClass = (trackId: string) => `track-box--${trackId.toLowerCase()}`;

  const meta: [string, string][] = [
    ['Session', sessionDisplayName(c.activeSession)],
    ['Course', c.activeSession.course],
    ['Title', c.activeSession.title],
    ['Room', c.activeSession.room],
    ['Scheduled', `${c.activeSession.dateLabel} · ${c.activeSession.time}`],
    ['Students present', `${c.counts.present + c.counts.late} / ${c.counts.total}`],
    ['Identity display', c.settings.privacy]
  ];

  return (
    <div className="page__inner">
      <div className="notice notice--warn">
        Prototype using simulated data — no camera, facial recognition, or AI model is connected.
        Detections below are scripted for demonstration.
      </div>

      <div className="live-grid">
        <section className="card">
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
              <span>
                {c.monitor === 'running'
                  ? '● LIVE (simulated)'
                  : c.monitor === 'paused'
                    ? '❙❙ paused'
                    : '■ stopped'}
              </span>
              <span>{c.monitor === 'running' ? c.fps.toFixed(1) : '0.0'} fps</span>
              <span>detected {c.trackBoxes.length}</span>
            </div>

            <div className="stage__caption">
              <div className="stage__caption-title">
                Classroom live feed unavailable
              </div>
              <div>{c.activeSession.room} · fixed wide angle</div>
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
              onClick={() => c.setMonitor(c.monitor === 'paused' ? 'running' : 'paused')}
            >
              Pause
            </button>
            <button
              type="button"
              className="btn btn--danger"
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
          <section className="card">
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

          <section className="card">
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
