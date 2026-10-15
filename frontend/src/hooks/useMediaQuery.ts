import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (
    typeof window === 'undefined' ? false : window.matchMedia(query).matches
  ));

  useEffect(() => {
    const media = window.matchMedia(query);
    const print = window.matchMedia('print');
    let printing = print.matches;
    let refreshFrame: number | null = null;
    const update = () => {
      if (!printing && !print.matches) setMatches(media.matches);
    };
    // Print paper width must not replace responsive route components and
    // unmount their open report/dialog while the browser is creating a PDF.
    const beforePrint = () => { printing = true; };
    const afterPrint = () => {
      printing = false;
      if (refreshFrame !== null) window.cancelAnimationFrame(refreshFrame);
      refreshFrame = window.requestAnimationFrame(update);
    };
    const printChanged = () => {
      if (print.matches) beforePrint();
      else afterPrint();
    };
    media.addEventListener('change', update);
    print.addEventListener('change', printChanged);
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    update();
    return () => {
      media.removeEventListener('change', update);
      print.removeEventListener('change', printChanged);
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
      if (refreshFrame !== null) window.cancelAnimationFrame(refreshFrame);
    };
  }, [query]);

  return matches;
}

export default useMediaQuery;
