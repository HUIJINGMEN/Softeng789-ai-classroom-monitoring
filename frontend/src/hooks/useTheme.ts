import { useCallback, useEffect, useState } from 'react';
import type { Theme } from '../types';

export function useTheme(initial: Theme = 'dark') {
  const [theme, setThemeState] = useState<Theme>(initial);

  const setTheme = useCallback((next: Theme) => {
    document.body.dataset.theme = next;
    setThemeState(next);
  }, []);

  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  return { theme, setTheme };
}
