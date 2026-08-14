import { useEffect, useId, useRef, useState } from 'react';

export interface SelectMenuOption<T extends string = string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  options: readonly SelectMenuOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  buttonClassName?: string;
  align?: 'left' | 'right';
}

export default function SelectMenu<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
  buttonClassName = '',
  align = 'left'
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const moveSelection = (direction: 1 | -1) => {
    const currentIndex = Math.max(
      0,
      options.findIndex((option) => option.value === value)
    );
    const next = options[(currentIndex + direction + options.length) % options.length];
    if (next) onChange(next.value);
  };

  return (
    <div
      ref={rootRef}
      className={`select-menu${open ? ' select-menu--open' : ''} select-menu--${align}${
        className ? ` ${className}` : ''
      }`}
    >
      <button
        type="button"
        className={`select-menu__button select-control${buttonClassName ? ` ${buttonClassName}` : ''}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!open) setOpen(true);
            else moveSelection(1);
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) setOpen(true);
            else moveSelection(-1);
          }
        }}
      >
        <span className="select-menu__value">{selected?.label ?? value}</span>
        <span className="select-menu__chevron" aria-hidden="true" />
      </button>

      {open && (
        <div id={listId} className="select-menu__list" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`select-menu__option${
                option.value === value ? ' select-menu__option--selected' : ''
              }`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              {option.value === value && <span className="select-menu__check" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
