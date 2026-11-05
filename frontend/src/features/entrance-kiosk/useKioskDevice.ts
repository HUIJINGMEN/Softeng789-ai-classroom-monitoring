import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { apiMessage } from '../../lib/apiClient';
import { createCameraSession, type FrameResult } from '../webcam-events';
import { cancelAttempt, confirmCandidate, getDevice, submitCapture } from './api';
import { captureVideoFrame } from './kioskCapture';
import {
  INITIAL_KIOSK_FLOW,
  clockOffsetMs,
  isTransient,
  kioskFlowReducer,
  retryDelayMs,
  windowStateAt
} from './kioskFlowModel';
import { PresenceGate, type PresenceStatus } from './presenceGate';
import type { KioskDevice } from './types';

const DEVICE_REFRESH_MS = 60_000;
const WINDOW_TICK_MS = 5_000;
const CAPTURE_RETRIES = 3;
const CONFIRM_RETRIES = 2;

export type KioskCameraState = 'idle' | 'starting' | 'running' | 'failed';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Device-side kiosk loop: local presence → one capture → candidates → self-confirmation → reset.
 * `paused` stops automatic captures, e.g. while staff have the exit dialog open.
 */
export function useKioskDevice(paused = false) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [device, setDevice] = useState<KioskDevice | null>(null);
  const [deviceError, setDeviceError] = useState('');
  const [camera, setCamera] = useState<KioskCameraState>('idle');
  const [cameraMessage, setCameraMessage] = useState('');
  const [cameraEpoch, setCameraEpoch] = useState(0);
  const [presence, setPresence] = useState<{ status: PresenceStatus; progress: number }>({ status: 'EMPTY', progress: 0 });
  const [flow, dispatch] = useReducer(kioskFlowReducer, INITIAL_KIOSK_FLOW);
  const [now, setNow] = useState(() => Date.now());

  const flowRef = useRef(flow);
  flowRef.current = flow;
  const deviceRef = useRef(device);
  deviceRef.current = device;
  const offsetRef = useRef(0);
  const gate = useRef(new PresenceGate());
  const busy = useRef(false);
  const mounted = useRef(true);
  const previousView = useRef(flow.view);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  const syncWindow = useCallback((current: KioskDevice | null) => {
    if (!current) return;
    dispatch({ type: 'WINDOW', state: windowStateAt(current.opensAt, current.closesAt, serverNow()) });
  }, [serverNow]);

  const loadDevice = useCallback(async () => {
    try {
      const next = await getDevice();
      if (!mounted.current) return;
      offsetRef.current = clockOffsetMs(next.serverTime, Date.now());
      setDevice(next);
      setDeviceError('');
      // The server's view wins when the class session was cancelled or completed early.
      dispatch({ type: 'WINDOW', state: next.windowState === 'OPEN'
        ? windowStateAt(next.opensAt, next.closesAt, serverNow()) : next.windowState });
    } catch (error) {
      // A 401 (kiosk ended or expired) is handled globally: the app returns to the sign-in page.
      if (mounted.current) setDeviceError(apiMessage(error));
    }
  }, [serverNow]);

  useEffect(() => {
    void loadDevice();
    const refresh = window.setInterval(() => void loadDevice(), DEVICE_REFRESH_MS);
    return () => window.clearInterval(refresh);
  }, [loadDevice]);

  useEffect(() => {
    if (!device) return undefined;
    const tick = window.setInterval(() => syncWindow(deviceRef.current), WINDOW_TICK_MS);
    return () => window.clearInterval(tick);
  }, [device, syncWindow]);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    const current = deviceRef.current;
    if (busy.current || flowRef.current.view !== 'scanning' || !video || !current) return;
    if (windowStateAt(current.opensAt, current.closesAt, serverNow()) !== 'OPEN') { syncWindow(current); return; }
    busy.current = true;
    try {
      let image: Blob;
      try {
        image = await captureVideoFrame(video, current.maxImageBytes);
      } catch {
        gate.current.reset();
        return;
      }
      dispatch({ type: 'CAPTURE_STARTED' });
      const key = crypto.randomUUID();
      for (let attempt = 0; ; attempt++) {
        try {
          const result = await submitCapture(image, key);
          if (mounted.current) dispatch({ type: 'CAPTURE_RESULT', result, now: Date.now() });
          return;
        } catch (error) {
          if (isTransient(error) && attempt < CAPTURE_RETRIES && mounted.current) {
            await sleep(retryDelayMs(error, attempt));
            continue;
          }
          if (mounted.current) dispatch({ type: 'CAPTURE_FAILED', error, now: Date.now() });
          return;
        }
      }
    } finally {
      busy.current = false;
    }
  }, [serverNow, syncWindow]);

  const captureRef = useRef(capture);
  captureRef.current = capture;

  const handleFrame = useCallback((result: FrameResult) => {
    if (flowRef.current.view !== 'scanning' || busy.current) return;
    if (pausedRef.current) {
      gate.current.reset();
      setPresence(previous => (previous.status === 'EMPTY' && previous.progress === 0 ? previous : { status: 'EMPTY', progress: 0 }));
      return;
    }
    const update = gate.current.update({ count: result.count, boxes: result.boxes }, result.timestamp);
    setPresence(previous => (previous.status === update.status && Math.abs(previous.progress - update.progress) < 0.05
      ? previous : { status: update.status, progress: update.progress }));
    if (update.trigger) void captureRef.current();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!device || !video) return undefined;
    setCamera('starting');
    setCameraMessage('');
    gate.current.reset();
    const session = createCameraSession(video, {
      onState: () => undefined,
      onFrame: handleFrame,
      onMedia: stream => { if (stream && mounted.current) setCamera('running'); },
      onFailure: () => {
        if (!mounted.current) return;
        setCamera('failed');
        setCameraMessage('The kiosk camera stopped. Ask a staff member to restart it.');
      }
    });
    void session.start();
    return () => session.stop();
    // Restart only when the kiosk first loads or staff asks for a camera restart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device !== null, cameraEpoch, handleFrame]);

  // Re-arm presence detection when the screen returns to scanning, so the same student is not rescanned.
  useEffect(() => {
    const before = previousView.current;
    previousView.current = flow.view;
    if (flow.view === 'scanning' && before !== 'scanning') {
      if (before === 'waiting' || before === 'closed') gate.current.reset();
      else gate.current.release(performance.now());
      setPresence({ status: 'EMPTY', progress: 0 });
    }
  }, [flow.view]);

  useEffect(() => {
    if (flow.view !== 'notice' || flow.noticeUntil === null) return undefined;
    const until = flow.noticeUntil;
    const timer = window.setTimeout(() => dispatch({ type: 'NOTICE_EXPIRED', now: until }), Math.max(0, until - Date.now()));
    return () => window.clearTimeout(timer);
  }, [flow.view, flow.noticeUntil]);

  useEffect(() => {
    if (flow.view !== 'choosing' || flow.selectionDeadline === null || !flow.attemptId) return undefined;
    const attemptId = flow.attemptId;
    const timer = window.setTimeout(() => {
      void cancelAttempt(attemptId, 'TIMEOUT').catch(() => undefined);
      dispatch({ type: 'CANCELLED', reason: 'TIMEOUT', now: Date.now() });
    }, Math.max(0, flow.selectionDeadline - Date.now()));
    const countdown = window.setInterval(() => setNow(Date.now()), 1000);
    setNow(Date.now());
    return () => { window.clearTimeout(timer); window.clearInterval(countdown); };
  }, [flow.view, flow.selectionDeadline, flow.attemptId]);

  const choose = useCallback((candidateId: string) => dispatch({ type: 'SELECT', candidateId }), []);

  const confirm = useCallback(async () => {
    const current = flowRef.current;
    if (busy.current || current.view !== 'choosing' || !current.attemptId || !current.selectedId) return;
    const { attemptId, selectedId } = current;
    busy.current = true;
    dispatch({ type: 'CONFIRM_STARTED' });
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          const result = await confirmCandidate(attemptId, selectedId);
          if (mounted.current) dispatch({ type: 'CONFIRM_RESULT', result, now: Date.now() });
          return;
        } catch (error) {
          // Retrying the same attempt and candidate is safe: the server replays a finished confirmation.
          if (isTransient(error) && attempt < CONFIRM_RETRIES && mounted.current) {
            await sleep(retryDelayMs(error, attempt));
            continue;
          }
          if (mounted.current) dispatch({ type: 'CONFIRM_FAILED', error, now: Date.now() });
          return;
        }
      }
    } finally {
      busy.current = false;
    }
  }, []);

  const notListed = useCallback(() => {
    const current = flowRef.current;
    if (current.view !== 'choosing' || !current.attemptId) return;
    void cancelAttempt(current.attemptId, 'NOT_LISTED').catch(() => undefined);
    dispatch({ type: 'CANCELLED', reason: 'NOT_LISTED', now: Date.now() });
  }, []);

  const checkInNow = useCallback(() => {
    if (camera === 'running' && !pausedRef.current) void captureRef.current();
  }, [camera]);

  const restartCamera = useCallback(() => setCameraEpoch(epoch => epoch + 1), []);

  return {
    videoRef,
    device,
    deviceError,
    camera,
    cameraMessage,
    presence,
    flow,
    now,
    serverNow,
    choose,
    confirm,
    notListed,
    checkInNow,
    restartCamera,
    reloadDevice: loadDevice
  };
}
