import { useEffect, useState, type CSSProperties } from 'react';
import Modal from '../../components/Modal';
import { formatTimestampClock } from '../../lib/sessionTime';
import { candidateInitials } from './kioskFlowModel';
import type { PresenceStatus } from './presenceGate';
import { kioskPrivacyDetails, kioskPrivacySummary } from './privacyNotice';
import { useKioskDevice } from './useKioskDevice';
import './entranceKiosk.css';

/** An unattended privacy dialog closes itself so automatic check-in resumes for the next person. */
const PRIVACY_AUTO_CLOSE_MS = 60_000;
const privacySummary = kioskPrivacySummary();
const privacyDetails = kioskPrivacyDetails();

interface Props {
  /** Ends the kiosk session on this device (server logout) and returns to the sign-in page. */
  readonly onExit: () => void;
  readonly exiting?: boolean;
}

function presencePrompt(status: PresenceStatus): { title: string; hint: string } {
  switch (status) {
    case 'TOO_FAR': return { title: 'Step a little closer', hint: 'Stand so your face fills the circle.' };
    case 'MULTIPLE': return { title: 'One person at a time, please', hint: 'Ask others to step out of the camera view.' };
    case 'HOLDING':
    case 'TRIGGERED': return { title: 'Hold still…', hint: 'Looking for you in this class list.' };
    case 'REARMING': return { title: 'Next person, please', hint: 'Step up to the camera when you are ready.' };
    default: return { title: 'Check in for class', hint: 'Stand in front of the camera for two seconds.' };
  }
}

function useClock() {
  const [time, setTime] = useState(() => new Date().toISOString());
  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date().toISOString()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  return formatTimestampClock(time);
}

export default function KioskDeviceScreen({ onExit, exiting = false }: Props) {
  const [exitOpen, setExitOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  // No photo is taken while someone is reading the privacy notice.
  const kiosk = useKioskDevice(exitOpen || privacyOpen || exiting);
  useEffect(() => {
    if (!privacyOpen) return undefined;
    const timer = window.setTimeout(() => setPrivacyOpen(false), PRIVACY_AUTO_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [privacyOpen]);
  const { device, flow, presence } = kiosk;
  const clock = useClock();
  const prompt = presencePrompt(presence.status);
  const secondsLeft = flow.selectionDeadline === null ? 0 : Math.max(0, Math.ceil((flow.selectionDeadline - kiosk.now) / 1000));
  const scanning = flow.view === 'scanning';
  const progressStyle = { '--kiosk-progress': `${Math.round((scanning ? presence.progress : 0) * 100)}%` } as CSSProperties;

  return (
    <div className="kiosk" data-view={flow.view} style={progressStyle}>
      <header className="kiosk__bar">
        <div className="kiosk__context">
          <strong>{device?.classLabel ?? 'Entrance kiosk'}</strong>
          <span>{device ? `${device.locationLabel} · ${device.campusName}` : 'Loading kiosk…'}</span>
        </div>
        <div className="kiosk__bar-end">
          <span className="kiosk__clock" aria-label={`Time ${clock}`}>{clock}</span>
          <button type="button" className="btn btn--quiet btn--sm kiosk__staff" onClick={() => setExitOpen(true)}>
            Staff
          </button>
        </div>
      </header>

      <main className="kiosk__main">
        <section className="kiosk__camera" aria-label="Kiosk camera">
          <video ref={kiosk.videoRef} className="kiosk__video" muted playsInline aria-hidden="true" />
          <div className={`kiosk__ring${scanning && presence.status === 'HOLDING' ? ' kiosk__ring--active' : ''}`} aria-hidden="true" />
          {kiosk.camera === 'starting' && <p className="kiosk__camera-note" role="status">Starting camera…</p>}
          {kiosk.camera === 'failed' && (
            <div className="kiosk__camera-note kiosk__camera-note--error" role="alert">
              <p>{kiosk.cameraMessage}</p>
              <button type="button" className="btn btn--sm" onClick={kiosk.restartCamera}>Restart camera</button>
            </div>
          )}
        </section>

        <section className="kiosk__panel" aria-live="polite">
          {kiosk.deviceError && !device && (
            <div className="kiosk__state kiosk__state--help">
              <h1>Kiosk unavailable</h1>
              <p>{kiosk.deviceError}</p>
              <button type="button" className="btn" onClick={() => void kiosk.reloadDevice()}>Try again</button>
            </div>
          )}

          {device && flow.view === 'waiting' && (
            <div className="kiosk__state">
              <h1>Check-in opens at {formatTimestampClock(device.opensAt)}</h1>
              <p>{device.course} starts at {formatTimestampClock(device.startTime)}. Please come back closer to class time.</p>
            </div>
          )}

          {device && flow.view === 'closed' && (
            <div className="kiosk__state kiosk__state--help">
              <h1>Check-in has closed</h1>
              <p>Please see your teacher to record your attendance.</p>
            </div>
          )}

          {device && scanning && (
            <div className="kiosk__state">
              <h1>{prompt.title}</h1>
              <p>{prompt.hint}</p>
              <div className="kiosk__progress" aria-hidden="true"><span /></div>
              <button type="button" className="btn kiosk__manual" disabled={kiosk.camera !== 'running'} onClick={kiosk.checkInNow}>
                Check in now
              </button>
            </div>
          )}

          {flow.view === 'recognizing' && (
            <div className="kiosk__state">
              <h1>Checking…</h1>
              <p>Please stay where you are.</p>
            </div>
          )}

          {(flow.view === 'choosing' || flow.view === 'confirming') && (
            <div className="kiosk__state kiosk__choose">
              <h1>Is this you?</h1>
              <p>Tap your name, then confirm. {flow.view === 'choosing' && <span className="kiosk__countdown">{secondsLeft}s left</span>}</p>
              <ul className="kiosk__candidates" aria-label="Possible matches">
                {flow.candidates.map(candidate => (
                  <li key={candidate.candidateId}>
                    <button
                      type="button"
                      className="kiosk__candidate"
                      aria-pressed={flow.selectedId === candidate.candidateId}
                      disabled={flow.view === 'confirming'}
                      onClick={() => kiosk.choose(candidate.candidateId)}
                    >
                      {candidate.photo
                        ? <img className="kiosk__avatar" src={candidate.photo} alt="" />
                        : <span className="kiosk__avatar" aria-hidden="true">{candidateInitials(candidate.displayName)}</span>}
                      <span className="kiosk__name">{candidate.displayName}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="kiosk__actions">
                <button
                  type="button"
                  className="btn btn--primary kiosk__confirm"
                  disabled={!flow.selectedId || flow.view === 'confirming'}
                  onClick={() => void kiosk.confirm()}
                >
                  {flow.view === 'confirming' ? 'Recording…' : 'Confirm attendance'}
                </button>
                <button type="button" className="btn" disabled={flow.view === 'confirming'} onClick={kiosk.notListed}>
                  I’m not listed
                </button>
              </div>
            </div>
          )}

          {flow.view === 'notice' && flow.notice && (
            <div className={`kiosk__state kiosk__state--${flow.notice.tone}`} role={flow.notice.tone === 'help' ? 'alert' : 'status'}>
              <h1>{flow.notice.title}</h1>
              {flow.notice.displayName && (
                <p className="kiosk__result">
                  <strong>{flow.notice.displayName}</strong>
                  {flow.notice.statusLabel && <span className="kiosk__badge">{flow.notice.statusLabel}</span>}
                  {flow.notice.timeLabel && <span>{flow.notice.timeLabel}</span>}
                </p>
              )}
              <p>{flow.notice.message}</p>
            </div>
          )}
        </section>
      </main>

      <footer className="kiosk__privacy" aria-label="Privacy notice">
        <div className="kiosk__privacy-copy">
          <strong>{privacySummary.heading}</strong>
          <span className="kiosk__privacy-text"> {privacySummary.text}</span>
          <span className="kiosk__privacy-more"> {privacySummary.moreInfo}</span>
        </div>
        <button type="button" className="btn btn--sm kiosk__privacy-open" aria-haspopup="dialog" onClick={() => setPrivacyOpen(true)}>
          Privacy
        </button>
      </footer>

      {privacyOpen && (
        <Modal
          size="narrow"
          title="Face check-in privacy notice"
          subtitle={privacySummary.heading}
          closeButton
          onClose={() => setPrivacyOpen(false)}
          footer={<button type="button" className="btn btn--primary" onClick={() => setPrivacyOpen(false)}>Close</button>}
        >
          <dl className="kiosk-privacy">
            {privacyDetails.map(item => (
              <div key={item.label} className="kiosk-privacy__item">
                <dt>{item.label}</dt>
                <dd>{item.text}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}

      {exitOpen && (
        <Modal
          size="confirm"
          role="alertdialog"
          title="Exit kiosk mode?"
          subtitle="This ends the kiosk on this device. A staff member will need to sign in again to use this browser."
          closeButton
          closeDisabled={exiting}
          onClose={() => setExitOpen(false)}
          footer={<>
            <button type="button" className="btn" disabled={exiting} onClick={() => setExitOpen(false)}>Keep kiosk running</button>
            <button type="button" className="btn btn--danger" disabled={exiting} onClick={onExit}>
              {exiting ? 'Exiting…' : 'Exit kiosk'}
            </button>
          </>}
        />
      )}
    </div>
  );
}
