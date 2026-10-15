import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** A viewport-bound note: opening help must never reflow the report settings. */
export function OverallReportHelp() {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setOpen(false);
        return;
      }
      const width = Math.min(320, window.innerWidth - 32);
      const height = panel.current?.offsetHeight ?? 180;
      const below = rect.bottom + 8;
      const top =
        below + height <= window.innerHeight - 16
          ? below
          : Math.max(16, rect.top - height - 8);
      const left = Math.max(
        16,
        Math.min(rect.right - width, window.innerWidth - width - 16),
      );
      setPosition({ top, left, width });
    };
    const outside = (event: Event) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !trigger.current?.contains(target) &&
        !panel.current?.contains(target)
      )
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open, position?.width]);
  return (
    <div className="overall-report-scope-help">
      <button
        type="button"
        className="overall-report-help-trigger"
        ref={trigger}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6m0-10v.5" />
        </svg>
        About this report
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="note"
            className="overall-report-help-panel"
            style={position}
          >
            <strong>About this report</strong>
            <p>No billing or financial information in this edition.</p>
            <p>
              Changing audience or dates loads a separate draft; existing saved
              wording is preserved.
            </p>
          </div>,
          document.body,
        )}
    </div>
  );
}
