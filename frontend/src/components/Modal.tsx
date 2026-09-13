import { useEffect, useRef } from 'react';
import type { FormEvent, KeyboardEvent, MouseEvent, ReactNode } from 'react';

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
  onSubmit,
  footer,
  footCompact = true,
  children
}: Props) {
  const modalRef = useRef<HTMLElement | null>(null);
  const className = `modal modal--${size}${customClassName ? ` ${customClassName}` : ''}`;
  const stopPropagation = (event: MouseEvent) => event.stopPropagation();

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      const firstControl = modalRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      (firstControl ?? modalRef.current)?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      opener?.focus();
    };
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !modalRef.current) return;
    const controls = Array.from(
      modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
    if (controls.length === 0) {
      event.preventDefault();
      modalRef.current.focus();
      return;
    }
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

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
          ref={(node) => { modalRef.current = node; }}
          className={className}
          role={role}
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          onClick={stopPropagation}
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
          aria-labelledby={titleId}
          tabIndex={-1}
          onClick={stopPropagation}
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
