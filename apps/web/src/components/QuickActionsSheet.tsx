import type { Book } from '@bookguardian/shared';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSetReadStatus } from '../api/inventory';
import { showToast } from '../lib/toast';
import { LendingIcon, MoveIcon, UndoIcon } from './icons';
import { ReadingPanel } from './ReadingPanel';
import { Sheet } from './Sheet';

interface QuickActionsSheetProps {
  /** The book whose cover was long-pressed; `null` keeps the sheet closed. */
  book: Book | null;
  /** The book is currently lent out: offer "Returned" instead of "Lend". */
  lent?: boolean;
  onClose: () => void;
  onLend?: (book: Book) => void;
  onMove?: (book: Book) => void;
}

/**
 * Long-press on a cover (or the row's "more" button): rate, change status and
 * dates, lend or move — without leaving the list.
 */
export function QuickActionsSheet({
  book,
  lent = false,
  onClose,
  onLend,
  onMove,
}: QuickActionsSheetProps) {
  const { t } = useTranslation();
  const actions = useSetReadStatus({ onError: () => showToast(t('errors.saveFailed'), 'error') });
  // Keep the last book while closing, so the sheet slides away over it.
  const [shown, setShown] = useState(book);
  if (book && book !== shown) setShown(book);
  if (!shown) return null;
  const open = book !== null;
  const authors = shown.authors.length > 0 ? shown.authors.join(', ') : t('books.unknownAuthor');
  return (
    <Sheet
      open={open}
      title={shown.title}
      onClose={onClose}
      footer={
        <Link
          to="/books/$bookId"
          params={{ bookId: shown.id }}
          className="button button--block"
          onClick={onClose}
        >
          {t('books.openPage')}
        </Link>
      }
    >
      <p className="sheet__text muted">{authors}</p>
      <ReadingPanel book={shown} actions={actions} compact />
      {onLend || onMove ? (
        <div className="quick-actions">
          {onLend ? (
            <button type="button" className="button" onClick={() => onLend(shown)}>
              {lent ? <UndoIcon /> : <LendingIcon />}
              {lent ? t('quick.return') : t('quick.lend')}
            </button>
          ) : null}
          {onMove ? (
            <button type="button" className="button" onClick={() => onMove(shown)}>
              <MoveIcon /> {t('quick.move')}
            </button>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}
