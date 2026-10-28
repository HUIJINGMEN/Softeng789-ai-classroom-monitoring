import { useId } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useDialogFocus } from '../hooks/useDialogFocus';

interface Props {
  readonly onClose: () => void;
  readonly size: 'narrow' | 'wide' | 'confirm';
  readonly className?: string;
  readonly role?: 'dialog' | 'alertdialog';
  readonly titleId?: string;
  readonly title: ReactNode;
  readonly compactTitle?: boolean;
  readonly subtitle?: ReactNode;
  readonly closeButton?: boolean;
  readonly closeDisabled?: boolean;
  readonly onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  readonly footer?: ReactNode;
  readonly footCompact?: boolean;
  readonly children?: ReactNode;
}

export default function Modal({
  onClose,
  size,
  className: customClassName,
  role = 'dialog',
  titleId,
  title,
  compactTitle,
  subtitle,
  closeButton,
  closeDisabled = false,
  onSubmit,
  footer,
  footCompact = true,
  children
}: Props) {
  const generatedTitleId = useId();
  const resolvedTitleId = titleId ?? `modal-title-${generatedTitleId}`;
  const subtitleId = `${resolvedTitleId}-description`;
  const { ref: modalRef, onKeyDown: handleKeyDown } = useDialogFocus(onClose, closeDisabled);
  const className = [`modal modal--${size}`, customClassName].filter(Boolean).join(' ');
  const requestClose = () => {
    if (!closeDisabled) onClose();
  };

  const head = (
    <div className="modal__head">
      <div>
        <div id={resolvedTitleId} className={`modal__title${compactTitle ? ' modal__title--compact' : ''}`}>
          {title}
        </div>
        {subtitle && <div id={subtitleId} className="card__sub modal__subtitle">{subtitle}</div>}
      </div>
      {closeButton && (
        <button type="button" className="modal__close" aria-label="Close dialog" disabled={closeDisabled} onClick={requestClose}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </div>
  );

  const foot = footer && (
    <div className={`modal__foot${footCompact ? ' modal__foot--compact' : ''}`}>{footer}</div>
  );

  return (
    <div className="scrim">
      <button type="button" className="modal-backdrop" tabIndex={-1} aria-label="Close dialog" disabled={closeDisabled} onClick={requestClose} />
      {onSubmit ? (
        <form
          ref={(node) => { modalRef.current = node; }}
          className={className}
          role={role}
          aria-modal="true"
          aria-labelledby={resolvedTitleId}
          aria-describedby={subtitle ? subtitleId : undefined}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          onSubmit={onSubmit}
        >
          {head}
          {children}
          {foot}
        </form>
      ) : (
        <div
          ref={(node) => { modalRef.current = node; }}
          className={className}
          role={role}
          aria-modal="true"
          aria-labelledby={resolvedTitleId}
          aria-describedby={subtitle ? subtitleId : undefined}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
        >
          {head}
          {children}
          {foot}
        </div>
      )}
    </div>
  );
}
