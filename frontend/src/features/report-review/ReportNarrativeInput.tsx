import { useLayoutEffect, useRef } from "react";

interface Props {
  readonly label: string;
  readonly value: string;
  readonly disabled: boolean;
  readonly onChange: (text: string) => void;
}

/** Keep all wording visible; scrolling belongs to the report, not each text field. */
export function ReportNarrativeInput({
  label,
  value,
  disabled,
  onChange,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const input = ref.current;
    if (!input) return;
    let width = -1;
    const fit = () => {
      input.style.height = "auto";
      const border = input.offsetHeight - input.clientHeight;
      input.style.height = `${input.scrollHeight + border}px`;
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width === width) return;
      width = entry.contentRect.width;
      fit();
    });
    observer.observe(input);
    return () => observer.disconnect();
  }, [value]);
  return (
    <textarea
      ref={ref}
      aria-label={label}
      rows={3}
      maxLength={6000}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Generate a draft, or write your own summary."
    />
  );
}
