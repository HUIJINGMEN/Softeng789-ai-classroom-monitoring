import { useEffect, useRef, useState } from 'react';
import type { FrameResult } from './cameraSession';
import { EyeHeadObserver, LOCAL_LIMITS, type Reading } from './eyeHeadModel';

function Readout({ title, reading }: { title: string; reading: Reading }) {
  return <div className="local-eye-head__reading" data-state={reading.status}>
    <h4>{title}</h4>
    <strong>{reading.status === 'unavailable' ? 'Not measurable' : reading.status === 'sustained' ? 'Sustained observation' : reading.status === 'pending' ? 'Measuring duration' : 'Not observed'}</strong>
    <span>{(reading.durationMs / 1000).toFixed(1)} seconds continuously observed</span>
    <small>{reading.reason}</small>
  </div>;
}

export default function LocalEyeHeadPanel({ sample, camera, onEnabledChange }: { sample: FrameResult | null; camera: MediaStream | null; onEnabledChange?: (enabled: boolean) => void }) {
  const enabledChange = useRef(onEnabledChange);
  enabledChange.current = onEnabledChange;
  const observer = useRef(new EyeHeadObserver());
  const [enabled, setEnabled] = useState(false);
  const [view, setView] = useState(observer.current.current());
  useEffect(() => {
    observer.current = new EyeHeadObserver(); setView(observer.current.current()); setEnabled(false); enabledChange.current?.(false);
  }, [camera]);
  useEffect(() => {
    if (!enabled || !camera) return;
    setView(sample && !document.hidden ? observer.current.update(sample) : observer.current.pause());
  }, [sample, enabled, camera]);
  useEffect(() => {
    const visibility = () => { if (document.hidden) setView(observer.current.pause('Tab hidden; continuous durations reset.')); };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);

  return <fieldset className="webcam-events__sharing local-eye-head" aria-label="Local eye and head observations">
    <legend>Local eye and head observations · experimental</legend>
    <p>Measure sustained eye closure and a lowered head on this device. These measurements do not determine sleep, fatigue or attention, and do not change attendance.</p>
    <label><input type="checkbox" checked={enabled} disabled={!camera} onChange={e => {
      setEnabled(e.target.checked); enabledChange.current?.(e.target.checked); observer.current = new EyeHeadObserver(); setView(observer.current.current());
    }} /> Enable local eye and head observations</label>
    <p>These new measurements and their history are not sent to your teacher or stored on the server, even when observation sharing is on. If live video sharing is on, your teacher can still see your camera image.</p>
    {enabled && <>
      <div className="webcam-events__controls">
        <button className="btn" type="button" disabled={!sample || view.calibrating} onClick={() => setView(observer.current.calibrate())}>{view.calibrated ? 'Recalibrate open eyes and head' : 'Calibrate open eyes and head'}</button>
        <button className="btn" type="button" disabled={!view.events.length} onClick={() => setView(observer.current.clearHistory())}>Clear local eye/head history</button>
      </div>
      <p role="status">{view.message}{view.calibrating ? ` (${view.progress}%)` : ''}</p>
      <p>For calibration, keep your eyes naturally open and face forward for 2 seconds. Use steady lighting and keep the camera still. This reference is separate from the existing head-movement reference.</p>
      <div className="local-eye-head__grid">
        <Readout title="Eye closure" reading={view.eyes} />
        <Readout title="Lowered head" reading={view.head} />
      </div>
      <p>Experimental thresholds: eye closure for {LOCAL_LIMITS.eyesMs / 1000} seconds; head lowered at least {LOCAL_LIMITS.headDegrees}° for {LOCAL_LIMITS.headMs / 1000} seconds. Brief blinks are not added to history. Uncertain measurements or sample gaps reset duration.</p>
      <details><summary>Measurement limits</summary><p>Glasses, reflections, eyelid shape, partial covering, camera angle and poor lighting can cause false results. The quality checks cannot detect every obstruction or distinguish closed eyes from a model error. This is an unvalidated local experiment. Use Not measurable as a reason to adjust the camera, not as a judgement about participation. Recalibrate after changing position or camera; do not use these observations for grading or attendance.</p></details>
      <h4>Local eye/head history ({view.events.length}/{LOCAL_LIMITS.history})</h4>
      {view.events.length ? <ol className="webcam-events__history">{view.events.map(event => <li key={`${event.kind}-${event.at}`}>
        <strong>{event.kind === 'EYES_CLOSED' ? 'Sustained eye closure observed' : 'Sustained lowered head observed'}</strong>
        <span>{(event.durationMs / 1000).toFixed(1)}s at detection; current duration is shown above.</span>
      </li>)}</ol> : <p>No sustained eye/head observations yet.</p>}
      <p>Only the latest 20 detections remain in page memory. Disabling this test, recalibrating, stopping the camera or closing the panel clears its reference and history. Turning this test off does not stop your other camera functions.</p>
    </>}
    {!camera && <p>Start the classroom camera first. This test stays off until you enable it.</p>}
  </fieldset>;
}
