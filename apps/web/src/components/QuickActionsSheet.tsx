import type { Book } from '@bookguardian/shared';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useSetReading } from '../api/inventory';
import { showToast } from '../lib/toast';
import { ReadingPanel } from './ReadingPanel';
import { Sheet } from './Sheet';

interface QuickActionsSheetProps {
  /** The book whose cover was long-pressed; `null` keeps the sheet closed. */
  book: Book | null;
  onClose: () => void;
}

/** Long-press on a cover: rate, change status and dates without leaving the grid. */
export function QuickActionsSheet({ book, onClose }: QuickActionsSheetProps) {
  const { t } = useTranslation();
  const actions = useSetReading({ onError: () => showToast(t('errors.saveFailed'), 'error') });
  if (!book) return null;
  const authors = book.authors.length > 0 ? book.authors.join(', ') : t('books.unknownAuthor');
  return (
    <Sheet
      open
      title={book.title}
      onClose={onClose}
      footer={
        <Link
          to="/books/$bookId"
          params={{ bookId: book.id }}
          className="button button--block"
          onClick={onClose}
        >
          {t('books.openPage')}
        </Link>
      }
    >
      <p className="sheet__text muted">{authors}</p>
      <ReadingPanel
        book={book}
        actions={actions}
        compact
        onInvalidDates={() => showToast(t('errors.readingDates'), 'error')}
      />
    </Sheet>
  );
}
