interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggleShow: () => void;
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
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
