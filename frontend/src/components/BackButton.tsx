import { IconChevronLeft } from './icons';

interface Props {
  readonly label: string;
  readonly onClick: () => void;
  readonly className?: string;
}

/** Shared parent-level navigation for teacher and admin workspaces. */
export default function BackButton({ label, onClick, className = '' }: Props) {
  return (
    <button
      type="button"
      className={`back-button${className ? ` ${className}` : ''}`}
      onClick={onClick}
    >
      <span className="back-button__icon" aria-hidden="true">
        <IconChevronLeft />
      </span>
      <span>{label}</span>
    </button>
  );
}
