interface Props {
  readonly checked: boolean;
  readonly label: string;
  readonly disabled?: boolean;
  readonly onChange: () => void;
}

/** Accessible checkbox with a compact, directory-friendly visual treatment.
 *
 * Keep the native input in the document so keyboard and screen-reader behaviour stays intact;
 * the adjacent mark is only the visual affordance used by searchable people/course pickers.
 */
export default function SelectionControl({ checked, label, disabled, onChange }: Props) {
  return (
    <>
      <input
        className="selection-control__input"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={onChange}
      />
      <span className="selection-control__mark" aria-hidden="true">
        <svg viewBox="0 0 16 16">
          <path d="m3.5 8.2 2.8 2.7 6.2-6" />
        </svg>
      </span>
    </>
  );
}
