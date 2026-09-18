import { useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Modal from './Modal';
import SearchField from './SearchField';

export interface MultiSelectPickerOption {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
}

interface PickerProps {
  readonly title: string;
  readonly subtitle: string;
  readonly searchLabel: string;
  readonly searchPlaceholder: string;
  readonly options: readonly MultiSelectPickerOption[];
  readonly selectedIds: readonly string[];
  readonly onApply: (ids: string[]) => void;
  readonly onClose: () => void;
}

interface SummaryProps {
  readonly label: string;
  readonly actionNoun: string;
  readonly selectedLabels: readonly string[];
  readonly emptyLabel: string;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly onOpen: () => void;
}

const RESULT_LIMIT = 6;

export function MultiSelectSummary({
  label,
  actionNoun,
  selectedLabels,
  emptyLabel,
  disabled,
  loading,
  onOpen
}: SummaryProps) {
  const hasSelection = selectedLabels.length > 0;
  return (
    <div className="field multi-select-summary">
      <span>{label}</span>
      <div className="multi-select-summary__control">
        <span className={hasSelection ? 'multi-select-summary__value' : 'multi-select-summary__empty'}>
          {hasSelection && <strong>{selectedLabels.length} selected</strong>}
          <small title={hasSelection ? selectedLabels.join(', ') : undefined}>
            {hasSelection ? selectedLabels.join(', ') : emptyLabel}
          </small>
        </span>
        <button type="button" className="btn btn--sm" disabled={disabled} aria-haspopup="dialog" onClick={onOpen}>
          {loading ? 'Loading…' : hasSelection ? `Edit ${actionNoun}` : `Add ${actionNoun}`}
        </button>
      </div>
    </div>
  );
}

export default function MultiSelectPickerModal({
  title,
  subtitle,
  searchLabel,
  searchPlaceholder,
  options,
  selectedIds,
  onApply,
  onClose
}: PickerProps) {
  const titleId = useId();
  const [query, setQuery] = useState('');
  const [draftIds, setDraftIds] = useState<string[]>([...selectedIds]);
  const selectedSet = useMemo(() => new Set(draftIds), [draftIds]);
  const normalizedQuery = query.trim().toLowerCase();
  const matches = useMemo(
    () => options
      .filter((option) => !normalizedQuery || `${option.label} ${option.description ?? ''}`.toLowerCase().includes(normalizedQuery))
      .sort((left, right) => {
        const selectedDifference = Number(selectedSet.has(right.id)) - Number(selectedSet.has(left.id));
        return selectedDifference || left.label.localeCompare(right.label);
      }),
    [normalizedQuery, options, selectedSet]
  );
  const visible = matches.slice(0, RESULT_LIMIT);
  const hiddenCount = matches.length - visible.length;

  const toggle = (id: string) => {
    setDraftIds((current) => current.includes(id)
      ? current.filter((candidate) => candidate !== id)
      : [...current, id]);
  };

  return createPortal(
    <Modal
      onClose={onClose}
      size="narrow"
      className="modal--multi-select-picker"
      titleId={titleId}
      title={(
        <span className="modal-task-title">
          <span>{title}</span>
          <span className="badge badge--neutral" aria-live="polite">{draftIds.length} selected</span>
        </span>
      )}
      compactTitle
      closeButton
      subtitle={subtitle}
      footer={(
        <>
          <button type="button" className="btn btn--quiet" disabled={draftIds.length === 0} onClick={() => setDraftIds([])}>Clear</button>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--primary" onClick={() => { onApply(draftIds); onClose(); }}>Save selection</button>
        </>
      )}
    >
      <div className="multi-select-picker">
        <SearchField
          label={searchLabel}
          value={query}
          onChange={setQuery}
          placeholder={searchPlaceholder}
          autoFocus
        />

        <div className="multi-select-picker__result-summary">
          <span>{normalizedQuery ? `${matches.length} matching` : `${options.length} available`}</span>
          <span>Showing up to {RESULT_LIMIT}</span>
        </div>

        {visible.length > 0 ? (
          <div className="multi-select-picker__list" aria-label={`${title} search results`}>
            {visible.map((option) => (
              <label key={option.id} className="multi-select-picker__option">
                <input type="checkbox" checked={selectedSet.has(option.id)} onChange={() => toggle(option.id)} />
                <span>
                  <strong>{option.label}</strong>
                  {option.description && <small>{option.description}</small>}
                </span>
              </label>
            ))}
          </div>
        ) : (
          <div className="multi-select-picker__empty">
            {normalizedQuery ? `No results match “${query.trim()}”.` : 'No options are available.'}
          </div>
        )}

        {hiddenCount > 0 && (
          <p className="multi-select-picker__hint">
            {hiddenCount} more result{hiddenCount === 1 ? '' : 's'}. Add another keyword to narrow the list.
          </p>
        )}
      </div>
    </Modal>,
    document.body
  );
}
