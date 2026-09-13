import { useId, useRef, type RefObject } from 'react';
import { IconSearch } from './icons';

interface Props {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly label?: string;
  readonly placeholder?: string;
  readonly className?: string;
  readonly autoComplete?: string;
  readonly autoFocus?: boolean;
  readonly shortcutLabel?: string;
  readonly inputRef?: RefObject<HTMLInputElement>;
}

/** Consistent search affordance shared by list pages and selection dialogs. */
export default function SearchField({
  value,
  onChange,
  label = 'Search',
  placeholder,
  className,
  autoComplete = 'off',
  autoFocus,
  shortcutLabel,
  inputRef
}: Props) {
  const generatedId = useId();
  const localRef = useRef<HTMLInputElement>(null);
  const resolvedRef = inputRef ?? localRef;
  const hasValue = value.length > 0;
  const rootClassName = [
    'field',
    'search-field',
    hasValue ? 'search-field--has-value' : '',
    !hasValue && shortcutLabel ? 'search-field--shortcut' : '',
    className ?? ''
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClassName}>
      <label htmlFor={generatedId}>{label}</label>
      <div className="search-field__control">
        <span className="search-field__icon" aria-hidden="true">
          <IconSearch />
        </span>
        <input
          id={generatedId}
          ref={resolvedRef}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
        />
        {hasValue ? (
          <button
            type="button"
            className="search-field__clear"
            aria-label={`Clear ${label.toLocaleLowerCase()}`}
            onClick={() => {
              onChange('');
              resolvedRef.current?.focus();
            }}
          >
            Clear
          </button>
        ) : shortcutLabel ? (
          <span className="search-field__shortcut" aria-hidden="true">
            {shortcutLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}
