import { useCallback, useEffect, useRef, useState } from 'react';

export function useSoftLoading(delayMs = 420) {
  const [loading, setLoading] = useState(false);
  const timer = useRef<number>();

  const softLoad = useCallback(
    (apply: () => void) => {
      apply();
      setLoading(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setLoading(false), delayMs);
    },
    [delayMs]
  );

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    []
  );

  return { loading, softLoad };
}
