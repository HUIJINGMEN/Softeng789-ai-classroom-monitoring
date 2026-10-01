interface Props {
  readonly className?: string;
}

export const BRAND_NAME = 'ClassLens';

/** The ClassLens initial wrapping a focused lens. */
export default function BrandMark({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M20.2 7.85A8.6 8.6 0 1 0 20.2 20.15"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <circle cx="17.6" cy="14" r="3.45" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17.6" cy="14" r="1.15" fill="currentColor" />
    </svg>
  );
}
