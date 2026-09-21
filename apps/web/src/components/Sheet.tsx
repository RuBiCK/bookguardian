import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CloseIcon } from './icons';

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Sticky footer, typically the primary button. */
  footer?: ReactNode;
}

/** Sheets currently open, bottom to top: only the topmost answers Escape. */
const openSheets: symbol[] = [];

/**
 * Bottom sheet: slides up from the tab bar edge so its controls sit in thumb
 * reach. Closes on backdrop tap and Escape; locks page scroll while open.
 * Sheets stack (search results over the add form): Escape closes the top one.
 */
export function Sheet({ open, title, onClose, children, footer }: SheetProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const id = Symbol(titleId);
    openSheets.push(id);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && openSheets.at(-1) === id) onClose();
    };
    document.addEventListener('keydown', onKey);
    // Focus the first field so the keyboard opens right away on phones.
    const first = panelRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button:not([data-sheet-close])',
    );
    first?.focus();
    return () => {
      openSheets.splice(openSheets.indexOf(id), 1);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, titleId]);

  if (!open) return null;

  return (
    <div className="sheet" data-testid="sheet">
      {/* Tap-outside-to-dismiss target; the labelled close button is the accessible path. */}
      <div className="sheet__backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="sheet__header">
          <span className="sheet__grip" aria-hidden="true" />
          <h2 id={titleId} className="sheet__title">
            {title}
          </h2>
          <button
            type="button"
            className="icon-button"
            aria-label={t('common.close')}
            onClick={onClose}
            data-sheet-close
          >
            <CloseIcon />
          </button>
        </header>
        <div className="sheet__body">{children}</div>
        {footer ? <footer className="sheet__footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
