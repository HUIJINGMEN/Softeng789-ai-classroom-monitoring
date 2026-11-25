import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { ApiError, apiMessage } from '../../lib/apiClient';
import { formatIsoDateInAuckland, formatTimestampClock } from '../../lib/sessionTime';
import type { PageResponse } from '../../lib/pagination';
import { endKiosk, getLaunchOptions, launchKiosk, listAttempts, listKiosks } from './api';
import {
  DEFAULT_LATE_MINUTES,
  LOCATION_MAX,
  activeKiosks,
  attemptStateLabel,
  blockedReasonLabel,
  buildLaunchRequest,
  classOptions,
  kioskStatusLabel,
  launchErrorMessage,
  reviewKindLabel,
  sessionOptionLabel,
  sessionsForClass
} from './launchModel';
import type { KioskAttemptLogRow, KioskSessionSummary, LaunchOptions } from './types';
import './entranceKiosk.css';

interface Props {
  /** Re-reads the signed-in account; after a launch this browser is the kiosk. */
  readonly onKioskStarted: () => Promise<void>;
}

export default function KioskLaunchPage({ onKioskStarted }: Props) {
  const formId = useId();
  const [date, setDate] = useState(() => formatIsoDateInAuckland(new Date()));
  const [campusId, setCampusId] = useState('');
  const [offeringId, setOfferingId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [location, setLocation] = useState('');
  const [lateEnabled, setLateEnabled] = useState(true);
  const [lateMinutes, setLateMinutes] = useState(String(DEFAULT_LATE_MINUTES));
  const [deviceConfirmed, setDeviceConfirmed] = useState(false);
  const [options, setOptions] = useState<LaunchOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [launching, setLaunching] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!date) return undefined;
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    getLaunchOptions(date, campusId || undefined)
      .then(next => { if (!cancelled) setOptions(next); })
      .catch(error => { if (!cancelled) { setOptions(null); setLoadError(apiMessage(error)); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date, campusId]);

  const sessions = useMemo(() => options?.sessions ?? [], [options]);
  const classes = useMemo(() => classOptions(sessions), [sessions]);
  const classSessions = useMemo(() => sessionsForClass(sessions, offeringId), [sessions, offeringId]);
  const session = classSessions.find(item => item.sessionId === sessionId) ?? null;

  // Keep selections valid when the date or campus changes the available sessions.
  useEffect(() => {
    if (offeringId && !classes.some(item => item.offeringId === offeringId)) setOfferingId('');
  }, [classes, offeringId]);
  useEffect(() => {
    if (sessionId && !classSessions.some(item => item.sessionId === sessionId)) setSessionId('');
  }, [classSessions, sessionId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (launching) return;
    const draft = buildLaunchRequest({ campusId, session, location, lateEnabled, lateMinutes, deviceConfirmed });
    if (!draft.ok) { setFormError(draft.error); return; }
    setFormError('');
    setLaunching(true);
    try {
      await launchKiosk(draft.request);
      await onKioskStarted();
    } catch (error) {
      setFormError(launchErrorMessage(error));
      // A lost response may still have switched this browser to kiosk mode; re-read the account.
      if (!(error instanceof ApiError)) await onKioskStarted().catch(() => undefined);
    } finally {
      setLaunching(false);
    }
  }

  const campusName = options?.campuses.find(item => item.id === campusId)?.name;

  return (
    <div className="kiosk-launch">
      <form className="card kiosk-launch__form" aria-labelledby={`${formId}-title`} onSubmit={submit} noValidate>
        <div className="kiosk-launch__head">
          <h2 id={`${formId}-title`}>Start an entrance kiosk</h2>
          <p className="card__sub">
            Students check themselves in by choosing their own name from up to three face matches.
            Choosing a name other than the original top match, and blocked attempts, are sent to admin review.
          </p>
        </div>

        <div className="kiosk-launch__grid">
          <label className="kiosk-field">
            <span>Date</span>
            <input type="date" value={date} onChange={event => setDate(event.target.value)} required />
          </label>
          <label className="kiosk-field">
            <span>Campus</span>
            <select value={campusId} onChange={event => setCampusId(event.target.value)} required>
              <option value="">Choose a campus</option>
              {options?.campuses.map(campus => <option key={campus.id} value={campus.id}>{campus.name}</option>)}
            </select>
          </label>
          <label className="kiosk-field">
            <span>Class</span>
            <select value={offeringId} disabled={!campusId || classes.length === 0}
              onChange={event => { setOfferingId(event.target.value); setSessionId(''); }} required>
              <option value="">{campusId && !loading && classes.length === 0 ? 'No classes on this date' : 'Choose a class'}</option>
              {classes.map(item => (
                <option key={item.offeringId} value={item.offeringId}>
                  {item.classLabel}{item.launchableCount === 0 ? ' — no session available' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="kiosk-field">
            <span>Session</span>
            <select value={sessionId} disabled={!offeringId} onChange={event => setSessionId(event.target.value)} required>
              <option value="">Choose a session</option>
              {classSessions.map(item => (
                <option key={item.sessionId} value={item.sessionId} disabled={!item.launchable}>
                  {sessionOptionLabel(item)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading && <p className="kiosk-launch__hint" role="status">Loading classes…</p>}
        {loadError && <p className="kiosk-launch__error" role="alert">{loadError}</p>}
        {campusId && !loading && !loadError && sessions.length === 0 && (
          <p className="kiosk-launch__hint">You have no class sessions{campusName ? ` at ${campusName}` : ''} on this date.</p>
        )}

        {session && (
          <p className={`kiosk-launch__readiness${session.launchable ? '' : ' kiosk-launch__readiness--blocked'}`}>
            {session.launchable
              ? `${session.faceReadyCount} of ${session.rosterSize} students have face check-in set up. Others need manual attendance.`
              : blockedReasonLabel(session.blockedReason ?? '')}
          </p>
        )}

        <label className="kiosk-field">
          <span>Kiosk location</span>
          <input
            type="text"
            value={location}
            maxLength={LOCATION_MAX}
            list={`${formId}-locations`}
            placeholder="e.g. Main entrance"
            onChange={event => setLocation(event.target.value)}
            required
          />
          <datalist id={`${formId}-locations`}>
            {options?.recentLocations.map(item => <option key={item} value={item} />)}
          </datalist>
        </label>

        <fieldset className="kiosk-field kiosk-launch__late">
          <legend>Late arrivals</legend>
          <label className="kiosk-check">
            <input type="checkbox" checked={lateEnabled} onChange={event => setLateEnabled(event.target.checked)} />
            <span>Mark Late after</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={60}
              step={1}
              className="kiosk-launch__minutes"
              aria-label="Minutes after class starts"
              value={lateMinutes}
              disabled={!lateEnabled}
              onChange={event => setLateMinutes(event.target.value)}
            />
            <span>minutes from the start</span>
          </label>
          <p className="kiosk-launch__hint">
            {lateEnabled ? 'Uses the server time of the student’s photo.' : 'Every kiosk check-in is recorded as Present.'}
            {' '}You can correct any mark in the session register.
          </p>
        </fieldset>

        <label className="kiosk-check kiosk-launch__device">
          <input type="checkbox" checked={deviceConfirmed} onChange={event => setDeviceConfirmed(event.target.checked)} />
          <span>
            This browser will sign out of my account in every tab and become the kiosk until someone exits kiosk mode
            or the session ends.
          </span>
        </label>

        {formError && <p className="kiosk-launch__error" role="alert">{formError}</p>}

        <div className="kiosk-launch__actions">
          <button type="submit" className="btn btn--primary" disabled={launching}>
            {launching ? 'Starting kiosk…' : 'Start kiosk on this device'}
          </button>
        </div>
      </form>

      <KioskSessionActivity sessionId={session?.sessionId ?? ''} />
    </div>
  );
}

function KioskSessionActivity({ sessionId }: { readonly sessionId: string }) {
  const [kiosks, setKiosks] = useState<KioskSessionSummary[]>([]);
  const [log, setLog] = useState<PageResponse<KioskAttemptLogRow> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ending, setEnding] = useState('');

  const load = useCallback(async () => {
    if (!sessionId) { setKiosks([]); setLog(null); return; }
    setLoading(true);
    setError('');
    try {
      const [nextKiosks, nextLog] = await Promise.all([listKiosks(sessionId), listAttempts(sessionId, 0, 20)]);
      setKiosks(nextKiosks);
      setLog(nextLog);
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { void load(); }, [load]);

  async function end(kioskSessionId: string) {
    setEnding(kioskSessionId);
    try {
      await endKiosk(kioskSessionId);
      await load();
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setEnding('');
    }
  }

  if (!sessionId) {
    return (
      <section className="card kiosk-launch__activity" aria-label="Kiosk activity">
        <h2>Kiosk activity</h2>
        <p className="card__sub">Choose a session to see its kiosks and check-in log.</p>
      </section>
    );
  }

  const running = activeKiosks(kiosks);
  return (
    <section className="card kiosk-launch__activity" aria-label="Kiosk activity">
      <div className="kiosk-launch__activity-head">
        <h2>Kiosk activity</h2>
        <button type="button" className="btn btn--sm" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {error && <p className="kiosk-launch__error" role="alert">{error}</p>}

      <h3>Kiosks</h3>
      {kiosks.length === 0
        ? <p className="card__sub">No kiosk has been started for this session.</p>
        : (
          <ul className="kiosk-list">
            {kiosks.map(kiosk => (
              <li key={kiosk.kioskSessionId}>
                <div>
                  <strong>{kiosk.locationLabel}</strong>
                  <span>{kiosk.campusName} · started {formatTimestampClock(kiosk.launchedAt)}
                    {kiosk.launchedByName ? ` by ${kiosk.launchedByName}` : ''} · {kiosk.confirmedCount} checked in</span>
                </div>
                <span className={`kiosk-pill${kiosk.endedAt ? '' : ' kiosk-pill--ok'}`}>{kioskStatusLabel(kiosk)}</span>
                {!kiosk.endedAt && (
                  <button type="button" className="btn btn--sm" disabled={ending === kiosk.kioskSessionId}
                    onClick={() => void end(kiosk.kioskSessionId)}>
                    {ending === kiosk.kioskSessionId ? 'Ending…' : 'End'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      {running.length > 0 && <p className="kiosk-launch__hint">Ending a kiosk signs that device out immediately.</p>}

      <h3>Check-in log</h3>
      {!log || log.items.length === 0
        ? <p className="card__sub">No kiosk check-ins yet.</p>
        : (
          <div className="kiosk-table-wrap">
            <table className="kiosk-table">
              <thead>
                <tr><th scope="col">Time</th><th scope="col">Student</th><th scope="col">Result</th><th scope="col">Location</th></tr>
              </thead>
              <tbody>
                {log.items.map(row => (
                  <tr key={row.attemptId}>
                    <td>{formatTimestampClock(row.processedAt ?? row.capturedAt)}</td>
                    <td>{row.student?.name ?? '—'}</td>
                    <td>
                      {attemptStateLabel(row.state)}
                      {row.attendanceStatus && ` · ${row.attendanceStatus === 'LATE' ? 'Late' : 'Present'}`}
                      {row.reviewKind && <span className="kiosk-pill kiosk-pill--warn">{reviewKindLabel(row.reviewKind)}</span>}
                    </td>
                    <td>{row.locationLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      {log && log.totalItems > log.items.length && (
        <p className="kiosk-launch__hint">Showing the latest {log.items.length} of {log.totalItems} entries.</p>
      )}
    </section>
  );
}
