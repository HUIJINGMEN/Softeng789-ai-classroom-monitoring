import { useEffect, useRef } from 'react';
import SearchField from './SearchField';
import SelectMenu from './SelectMenu';

const ALL_TERMS = 'All';

interface Props {
  readonly query: string;
  readonly onQueryChange: (value: string) => void;
  readonly term: string;
  readonly onTermChange: (value: string) => void;
  readonly termOptions: readonly string[];
  readonly showShortcut?: boolean;
}

/** Shared by AdminClasses.tsx and MyClasses.tsx — a search box focusable via Cmd/Ctrl+K while
 *  this toolbar is mounted (scoped to this component, not a page-wide shortcut), and a Term
 *  filter built from whatever terms are actually present in the caller's own class list. The
 *  class count itself lives in the card's own title/subtitle, same as every other list page in
 *  the app (Students, Staff, ...) — not duplicated here as a separate stat tile. */
export default function ClassesListToolbar({
  query,
  onQueryChange,
  term,
  onTermChange,
  termOptions,
  showShortcut = true
}: Props) {
  const searchRef = useRef<HTMLInputElement>(null);
  const shortcutLabel = showShortcut
    ? typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
      ? '⌘K'
      : 'Ctrl K'
    : undefined;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="list-toolbar classes-toolbar" role="search" aria-label="Filter classes">
      <SearchField
        className="classes-toolbar__search"
        inputRef={searchRef}
        value={query}
        onChange={onQueryChange}
        placeholder="Course, term or teacher"
        shortcutLabel={shortcutLabel}
      />

      <SelectMenu
        className="classes-toolbar__term"
        value={term}
        options={[
          { value: ALL_TERMS, label: 'Term: All' },
          ...termOptions.map((option) => ({ value: option, label: `Term: ${option}` }))
        ]}
        onChange={onTermChange}
        ariaLabel="Filter classes by term"
        align="right"
      />
    </div>
  );
}
