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
        <button type="button" className="password-field__toggle" onClick={onToggleShow}>
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
    </label>
  );
}
