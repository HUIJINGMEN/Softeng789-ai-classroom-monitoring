import { useEffect, useRef, type KeyboardEvent } from 'react';
import { lockDialogScroll } from '../lib/dialogScrollLock';

const CONTROLS =
  'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

function focusableControls(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(CONTROLS)).filter(
    (control) => control.tabIndex >= 0 && control.getClientRects().length > 0
  );
}

/** Focus, Escape, tab wrapping and scroll ownership for custom-styled dialogs and sheets. */
export function useDialogFocus(onClose: () => void, closeDisabled = false, open = true) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => (open ? lockDialogScroll() : undefined), [open]);
  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      const root = ref.current;
      if (!root) return;
      const preferred = root.querySelector<HTMLElement>('[data-initial-focus], [autofocus]');
      (preferred ?? focusableControls(root)[0] ?? root).focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (!closeDisabled) onClose();
      return;
    }
    const root = ref.current;
    if (event.key !== 'Tab' || !root) return;
    const controls = focusableControls(root);
    if (!controls.length) {
      event.preventDefault();
      root.focus();
      return;
    }
    const first = controls[0],
      last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  return { ref, onKeyDown };
}
