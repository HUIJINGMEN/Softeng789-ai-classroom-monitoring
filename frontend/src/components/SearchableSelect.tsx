import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconSearch } from './icons';

export interface SearchableSelectOption {
  value: string;
  label: string;
  meta?: string;
  keywords?: string;
  disabled?: boolean;
}

interface Props {
  readonly value: string;
  readonly options: readonly SearchableSelectOption[];
  readonly onChange: (value: string) => void;
  readonly label: string;
  readonly searchPlaceholder: string;
  readonly disabled?: boolean;
  readonly emptyMessage?: string;
}

interface PanelPosition {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

const PANEL_GAP = 7;
const PANEL_MAX_HEIGHT = 360;

/** Search-first single selection for directories that can contain dozens of people or rooms. */
export default function SearchableSelect({
  value,
  options,
  onChange,
  label,
  searchPlaceholder,
  disabled = false,
  emptyMessage = 'No matching options.'
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const normalised = query.trim().toLowerCase();
    if (!normalised) return options;
    return options.filter((option) =>
      `${option.label} ${option.meta ?? ''} ${option.keywords ?? ''}`.toLowerCase().includes(normalised)
    );
  }, [options, query]);

  const updatePosition = useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 8;
    const spaceBelow = window.innerHeight - rect.bottom - PANEL_GAP - margin;
    const spaceAbove = rect.top - PANEL_GAP - margin;
    const openUpward = spaceBelow < 260 && spaceAbove > spaceBelow;
    const available = openUpward ? spaceAbove : spaceBelow;
    const width = Math.min(Math.max(rect.width, 320), window.innerWidth - margin * 2);
    setPosition({
      left: Math.min(Math.max(rect.left, margin), window.innerWidth - width - margin),
      width,
      maxHeight: Math.max(180, Math.min(PANEL_MAX_HEIGHT, available)),
      top: openUpward ? undefined : rect.bottom + PANEL_GAP,
      bottom: openUpward ? window.innerHeight - rect.top + PANEL_GAP : undefined
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return undefined;
    inputRef.current?.focus();
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
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

  const choose = (option: SearchableSelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={rootRef} className={`searchable-select${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="searchable-select__trigger select-control"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => {
          setQuery('');
          setOpen((current) => !current);
        }}
      >
        <span className="searchable-select__selection">
          <span>{selected?.label ?? `Select ${label.toLowerCase()}`}</span>
          {selected?.meta && <small>{selected.meta}</small>}
        </span>
        <span className="select-menu__chevron" aria-hidden="true" />
      </button>

      {open && position && createPortal(
        <div
          ref={panelRef}
          className="searchable-select__panel"
          style={{
            left: position.left,
            width: position.width,
            maxHeight: position.maxHeight,
            top: position.top,
            bottom: position.bottom
          }}
        >
          <label className="searchable-select__search">
            <span className="sr-only">Search {label.toLowerCase()}</span>
            <span aria-hidden="true"><IconSearch /></span>
            <input
              ref={inputRef}
              type="search"
              value={query}
              placeholder={searchPlaceholder}
              autoComplete="off"
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && filtered[0]) {
                  const firstAvailable = filtered.find((option) => !option.disabled);
                  if (!firstAvailable) return;
                  event.preventDefault();
                  choose(firstAvailable);
                }
              }}
            />
          </label>
          <div id={listId} className="searchable-select__options" role="listbox" aria-label={label}>
            {filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                aria-disabled={option.disabled || undefined}
                disabled={option.disabled}
                className={`searchable-select__option${option.value === value ? ' is-selected' : ''}${option.disabled ? ' is-disabled' : ''}`}
                onClick={() => choose(option)}
              >
                <span>{option.label}</span>
                {option.meta && <small>{option.meta}</small>}
              </button>
            ))}
            {filtered.length === 0 && <p className="searchable-select__empty">{emptyMessage}</p>}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
