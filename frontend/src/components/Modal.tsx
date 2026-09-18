import { useEffect, useId, useRef } from 'react';
import type { FormEvent, KeyboardEvent, MouseEvent, ReactNode } from 'react';

let openModalCount = 0;
let bodyOverflowBeforeModal = '';

function lockPageScroll() {
  if (openModalCount === 0) {
    bodyOverflowBeforeModal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  openModalCount += 1;

  return () => {
    openModalCount = Math.max(0, openModalCount - 1);
    if (openModalCount === 0) {
      document.body.style.overflow = bodyOverflowBeforeModal;
    }
  };
}

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
  const generatedTitleId = useId();
  const resolvedTitleId = titleId ?? `modal-title-${generatedTitleId}`;
  const subtitleId = `${resolvedTitleId}-description`;
  const modalRef = useRef<HTMLElement | null>(null);
  const className = `modal modal--${size}${customClassName ? ` ${customClassName}` : ''}`;
  const stopPropagation = (event: MouseEvent) => event.stopPropagation();

  useEffect(() => lockPageScroll(), []);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      const preferredControl = modalRef.current?.querySelector<HTMLElement>('[autofocus]');
      const firstControl = modalRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      (preferredControl ?? firstControl ?? modalRef.current)?.focus();
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
        <div id={resolvedTitleId} className={`modal__title${compactTitle ? ' modal__title--compact' : ''}`}>
          {title}
        </div>
        {subtitle && <div id={subtitleId} className="card__sub modal__subtitle">{subtitle}</div>}
      </div>
      {closeButton && (
        <button type="button" className="modal__close" aria-label="Close dialog" onClick={onClose}>
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
    <div className="scrim" onClick={onClose}>
      {onSubmit ? (
        <form
          ref={(node) => { modalRef.current = node; }}
          className={className}
          role={role}
          aria-modal="true"
          aria-labelledby={resolvedTitleId}
          aria-describedby={subtitle ? subtitleId : undefined}
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
          aria-labelledby={resolvedTitleId}
          aria-describedby={subtitle ? subtitleId : undefined}
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
