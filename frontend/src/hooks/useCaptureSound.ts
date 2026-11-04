import { useEffect, useRef } from 'react';

export function useCaptureSound() {
  const context = useRef<AudioContext | null>(null);
  useEffect(() => () => { void context.current?.close().catch(() => {}); context.current = null; }, []);
  function unlock() {
    try {
      context.current ??= new AudioContext();
      void context.current.resume().catch(() => {});
    } catch { /* Sound is optional; capture remains available. */ }
  }
  function play() {
    const audio = context.current;
    if (!audio || audio.state !== 'running') return;
    try {
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      const now = audio.currentTime;
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.frequency.setValueAtTime(660, now);
      oscillator.frequency.setValueAtTime(880, now + .09);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(.1, now + .015);
      gain.gain.exponentialRampToValueAtTime(.001, now + .24);
      oscillator.start(now); oscillator.stop(now + .25);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    } catch { /* A visual success indication is always shown too. */ }
  }
  return { unlock, play };
}
