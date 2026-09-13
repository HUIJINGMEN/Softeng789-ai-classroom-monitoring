interface Props {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly show: boolean;
  readonly onToggleShow: () => void;
  readonly autoComplete: 'current-password' | 'new-password';
  readonly placeholder?: string;
}

export default function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  autoComplete,
  placeholder
}: Props) {
  return (
    <label className="field">
      {label}
      <div className="password-field">
        <input
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="password-field__toggle"
          onClick={onToggleShow}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
        >
          {show ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 3l18 18" />
              <path d="M10.6 6.1A10.8 10.8 0 0112 6c6 0 9.5 6 9.5 6a15 15 0 01-3 3.7" />
              <path d="M6.2 6.3C3.8 8 2.5 12 2.5 12S6 18 12 18c1.3 0 2.5-.3 3.5-.7" />
              <path d="M9.9 9.8a3 3 0 004.2 4.3" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </label>
  );
}
