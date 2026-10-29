import { useCallback, useEffect, useState } from 'react';
import type { Theme } from '../types';

export function useTheme(initial: Theme = 'dark') {
  const [storedTheme, setStoredTheme] = useState<Theme>(initial);

  const setTheme = useCallback((next: Theme) => {
    document.body.dataset.theme = next;
    setStoredTheme(next);
  }, []);

  useEffect(() => {
    document.body.dataset.theme = storedTheme;
  }, [storedTheme]);

  return { theme: storedTheme, setTheme };
}
