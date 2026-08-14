import { useCallback, useEffect, useRef, useState } from 'react';

export function useToast(timeoutMs = 2800) {
  const [toast, setToast] = useState('');
  const timer = useRef<number>();

  const showToast = useCallback(
    (message: string) => {
      setToast(message);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setToast(''), timeoutMs);
    },
    [timeoutMs]
  );

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    []
  );

  return { toast, showToast };
}
