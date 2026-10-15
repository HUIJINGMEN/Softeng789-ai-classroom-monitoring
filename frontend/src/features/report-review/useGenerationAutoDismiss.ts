import { useEffect, useRef } from "react";

/** Show 100% briefly without adding a confirmation step. */
export function useGenerationAutoDismiss(
  complete: boolean,
  onDismiss: () => void,
) {
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    if (!complete) return;
    const timer = window.setTimeout(() => dismiss.current(), 650);
    return () => window.clearTimeout(timer);
  }, [complete]);
}
