import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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

const MENU_MAX_HEIGHT = 280;
const MENU_GAP = 7;

interface MenuPosition {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
}

// Rendered into a portal and positioned with `fixed` coordinates computed from the trigger
// button's own bounding rect — an ordinary absolutely-positioned dropdown gets silently clipped
// by any ancestor with overflow:hidden/auto (every modal and most scrollable cards in this app),
// which is exactly what was happening: opening a dropdown near the bottom of a modal or card
// either hid the options entirely or left them requiring a scroll to reach. Escaping to
// document.body sidesteps every ancestor's overflow and stacking context at once.
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
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  const updatePosition = useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 8;
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP - margin;
    const spaceAbove = rect.top - MENU_GAP - margin;
    // Open upward only if that direction genuinely has more room — and either way, cap the list's
    // own height to whatever room actually exists in the chosen direction, rather than assuming
    // MENU_MAX_HEIGHT always fits. A screen too short for either direction to fit the full list
    // (a small laptop, devtools eating half the viewport) still gets a fully on-screen list, just
    // a shorter one with its own internal scroll.
    const openUpward = spaceBelow < MENU_MAX_HEIGHT && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(MENU_MAX_HEIGHT, openUpward ? spaceAbove : spaceBelow));
    const width = Math.max(rect.width, 240);
    const left = Math.min(
      Math.max(align === 'right' ? rect.right - width : rect.left, margin),
      window.innerWidth - width - margin
    );
    setPosition({
      left,
      width,
      maxHeight,
      top: openUpward ? undefined : rect.bottom + MENU_GAP,
      bottom: openUpward ? window.innerHeight - rect.top + MENU_GAP : undefined
    });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    updatePosition();
    // Capture phase so a scroll inside any ancestor scrollable container (a modal body, a card
    // list) is caught too — scroll events don't bubble, but capturing dispatch still reaches
    // window before the target, regardless of where the scroll actually happened.
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !listRef.current?.contains(target)) {
        setOpen(false);
      }
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

      {open &&
        position &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            className="select-menu__list"
            role="listbox"
            aria-label={ariaLabel}
            style={{
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
              top: position.top,
              bottom: position.bottom
            }}
          >
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
          </div>,
          document.body
        )}
    </div>
  );
}
