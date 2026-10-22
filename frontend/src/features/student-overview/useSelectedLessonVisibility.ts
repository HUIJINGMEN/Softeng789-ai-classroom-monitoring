import { useLayoutEffect, useRef } from 'react';

/** Scroll only the register, accounting for its sticky identity/payment columns. */
export function revealSelectedLesson(register: HTMLDivElement) {
  const selected = register.querySelector<HTMLElement>('[aria-current="true"]');
  const pinned = register.querySelector<HTMLElement>('.student-overview-table__payment');
  if (!selected || !pinned) return;
  const viewport = register.getBoundingClientRect();
  const cell = selected.getBoundingClientRect();
  const left = Math.max(viewport.left, pinned.getBoundingClientRect().right) + 8;
  const right = viewport.right - 8;
  if (right - left < cell.width) return; // Narrow screens use the persistent lesson heading.
  let delta = 0;
  if (cell.right > right) delta = cell.right - right;
  else if (cell.left < left) delta = cell.left - left;
  if (delta) register.scrollLeft = Math.max(0, register.scrollLeft + delta);
}

export default function useSelectedLessonVisibility(selectionKey: string | null, enabled: boolean) {
  const registerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const register = registerRef.current;
    if (!selectionKey || !enabled || !register) return;
    const previousLeft = register.scrollLeft;
    const reveal = () => revealSelectedLesson(register);
    reveal();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(reveal);
    observer?.observe(register);
    window.addEventListener('resize', reveal);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', reveal);
      register.scrollLeft = previousLeft;
    };
  }, [selectionKey, enabled]);
  return registerRef;
}
