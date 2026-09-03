import type { FormEvent, MouseEvent, ReactNode } from 'react';

interface Props {
  readonly onClose: () => void;
  readonly size: 'narrow' | 'wide' | 'confirm';
  readonly role?: 'dialog' | 'alertdialog';
  readonly titleId?: string;
  readonly title: ReactNode;
  readonly compactTitle?: boolean;
  readonly subtitle?: ReactNode;
  readonly closeButton?: boolean;
  readonly onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  readonly footer?: ReactNode;
  readonly footCompact?: boolean;
  readonly children?: ReactNode;
}

export default function Modal({
  onClose,
  size,
  role = 'dialog',
  titleId,
  title,
  compactTitle,
  subtitle,
  closeButton,
  onSubmit,
  footer,
  footCompact = true,
  children
}: Props) {
  const className = `modal modal--${size}`;
  const stopPropagation = (event: MouseEvent) => event.stopPropagation();

  const head = (
    <div className="modal__head">
      <div>
        <div id={titleId} className={`modal__title${compactTitle ? ' modal__title--compact' : ''}`}>
          {title}
        </div>
        {subtitle && <div className="card__sub">{subtitle}</div>}
      </div>
      {closeButton && (
        <button type="button" className="btn btn--sm" onClick={onClose}>
          Close
        </button>
      )}
    </div>
  );

  const foot = footer && (
    <div className={`modal__foot${footCompact ? ' modal__foot--compact' : ''}`}>{footer}</div>
  );

  return (
    <div className="scrim" onClick={onClose}>
      {onSubmit ? (
        <form
          className={className}
          role={role}
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={stopPropagation}
          onSubmit={onSubmit}
        >
          {head}
          {children}
          {foot}
        </form>
      ) : (
        <div className={className} role={role} aria-modal="true" aria-labelledby={titleId} onClick={stopPropagation}>
          {head}
          {children}
          {foot}
        </div>
      )}
    </div>
  );
}
