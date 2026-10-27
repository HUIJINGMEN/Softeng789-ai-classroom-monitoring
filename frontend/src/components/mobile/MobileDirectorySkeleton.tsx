interface Props {
  readonly label: string;
  readonly rows?: number;
}

export default function MobileDirectorySkeleton({ label, rows = 3 }: Props) {
  return (
    <output className="mobile-directory-skeleton"  aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className="mobile-directory-skeleton__row" aria-hidden="true">
          <i />
          <span>
            <b />
            <b />
          </span>
          <em />
        </span>
      ))}
      <span className="sr-only">{label}</span>
    </output>
  );
}
