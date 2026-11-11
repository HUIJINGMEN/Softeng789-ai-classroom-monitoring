import { useEffect, useRef, useState, type RefObject } from 'react';
import type { FaceEnrollmentPose } from '../types';
import type { FrameResult } from '../features/webcam-events';
import { RegistrationCaptureHold, registrationGuideSample } from '../lib/registrationCaptureGuide';

export function useRegistrationGuide(videoRef: RefObject<HTMLVideoElement>, stream: MediaStream | null,
  target: FaceEnrollmentPose | undefined, enabled: boolean, onReady: () => void, resetKey: string) {
  const [state, setState] = useState({ message: 'Loading face guide…', progress: 0, available: true });
  const latest = useRef({ target, enabled, onReady, resetKey });
  const frontPitch = useRef<number | null>(null);
  const baselineEpoch = useRef(0);
  const frontSample = useRef<{ pitch: number; at: number } | null>(null);
  function resetFrontBaseline() {
    baselineEpoch.current++;
    frontPitch.current = null;
    frontSample.current = null;
  }
  // Snapshot at shutter time, then commit only after the same capture is accepted.
  function prepareFrontCapture() {
    const epoch = baselineEpoch.current;
    const sample = frontSample.current;
    const pitch = !document.hidden && latest.current.target === 'front' && sample
      && performance.now() - sample.at <= 500 ? sample.pitch : null;
    return () => { if (baselineEpoch.current === epoch) frontPitch.current = pitch; };
  }
  latest.current = { target, enabled, onReady, resetKey };
  useEffect(() => {
    if (!stream) return;
    let closed = false, worker: Worker | null = null, timer = 0, watchdog = 0;
    let previousTime = -1, previousKey = '', fired = false;
    let waiting = false, timeoutMs = 30000;
    const hold = new RegistrationCaptureHold();
    const clearHold = () => { hold.reset(); fired = false; };
    const fail = () => {
      if (closed) return;
      closed = true; frontSample.current = null; worker?.terminate(); clearTimeout(timer); clearTimeout(watchdog);
      setState({ message: 'Automatic guidance is unavailable. You can still capture each pose manually.', progress: 0, available: false });
    };
    const unavailable = () => {
      frontSample.current = null; clearHold(); setState({ message: 'Waiting for a live camera preview…', progress: 0, available: true });
    };
    // Keep one outstanding frame. Background throttling/sleep is not worker failure.
    function armTimeout(ms: number) {
      waiting = true; timeoutMs = ms;
      const deadline = performance.now() + ms;
      clearTimeout(watchdog);
      watchdog = window.setTimeout(() => {
        if (document.hidden || performance.now() - deadline > 1500) {
          unavailable(); armTimeout(ms);
        } else fail();
      }, ms);
    }
    async function frame() {
      if (closed) return;
      const video = videoRef.current;
      if (document.hidden || !video || video.readyState < 2 || video.currentTime === previousTime
        || !stream!.getVideoTracks().some(track => track.readyState === 'live' && !track.muted)) {
        unavailable(); timer = window.setTimeout(() => void frame(), 150); return;
      }
      previousTime = video.currentTime;
      armTimeout(5000);
      try {
        const timestamp = performance.now();
        const bitmap = await createImageBitmap(video);
        if (closed) { bitmap.close(); return; }
        try { worker!.postMessage({ type: 'frame', bitmap, timestamp }, [bitmap]); }
        catch (error) { bitmap.close(); throw error; }
      } catch { fail(); }
    }
    function visibility() {
      if (closed) return;
      unavailable();
      // Returning to a visible tab starts a fresh stall window for the pending frame.
      if (waiting) armTimeout(timeoutMs);
    }
    document.addEventListener('visibilitychange', visibility);
    setState({ message: 'Loading face guide…', progress: 0, available: true });
    try {
      worker = new Worker(new URL('webcam-worker.js', document.baseURI));
      worker.onerror = fail;
      worker.onmessage = ({ data }: MessageEvent<FrameResult | { type: 'ready' | 'error' }>) => {
        if (closed) return;
        clearTimeout(watchdog); waiting = false;
        if (data.type === 'error') { fail(); return; }
        if (data.type === 'ready') { void frame(); return; }
        if (data.type !== 'result') return;
        const current = latest.current, video = videoRef.current;
        const key = `${current.target}:${current.enabled}:${current.resetKey}:${baselineEpoch.current}`;
        if (key !== previousKey) { clearHold(); previousKey = key; }
        if (document.hidden || performance.now() - data.timestamp > 500 || !video || !current.target
          || !stream.getVideoTracks().some(track => track.readyState === 'live' && !track.muted)) unavailable();
        else {
          const sample = registrationGuideSample(data, current.target, video.videoWidth / video.videoHeight, frontPitch.current);
          frontSample.current = current.target === 'front' && sample.ready && sample.pose
            ? { pitch: sample.pose.pitch, at: data.timestamp } : null;
          const progress = current.enabled ? hold.update(sample, data.timestamp) : 0;
          if (!current.enabled) clearHold();
          setState({ message: sample.message, progress, available: true });
          if (progress === 1 && !fired) {
            fired = true;
            current.onReady();
          }
        }
        timer = window.setTimeout(() => void frame(), 120);
      };
      armTimeout(30000);
      worker.postMessage({ type: 'init' });
    } catch { fail(); }
    return () => {
      closed = true; frontSample.current = null; worker?.terminate(); clearTimeout(timer); clearTimeout(watchdog);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [stream, videoRef]);
  return { ...state, prepareFrontCapture, resetFrontBaseline };
}
