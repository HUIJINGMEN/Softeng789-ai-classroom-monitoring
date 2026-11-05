import { useCallback, useEffect, useState } from 'react';
import { getKioskReviewSummary } from './api';

const REFRESH_MS = 60_000;

/** Open kiosk review count for the admin navigation badge. Disabled for teachers. */
export function useKioskReviewCount(enabled: boolean) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const summary = await getKioskReviewSummary();
      setCount(Number.isFinite(summary.open) ? summary.open : 0);
    } catch {
      // A badge is a hint only; the review page shows real errors.
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) { setCount(0); return undefined; }
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [enabled, refresh]);

  return { count, refresh };
}
