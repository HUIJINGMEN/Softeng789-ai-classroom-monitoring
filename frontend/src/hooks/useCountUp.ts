import { useEffect, useRef, useState } from 'react';

/** Animates a numeric display value toward `target` whenever it changes. */
export function useCountUp(target: number, durationMs = 700): number {
  const [value, setValue] = useState(0);
  // Tracks the value actually on screen, updated every frame, so an
  // interrupted animation resumes from where it visually left off.
  const currentRef = useRef(0);
  const frameRef = useRef<number>();

  useEffect(() => {
    const from = currentRef.current;
    const to = target;
    if (from === to) {
      setValue(to);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + (to - from) * eased);
      currentRef.current = next;
      setValue(next);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target, durationMs]);

  return value;
}
