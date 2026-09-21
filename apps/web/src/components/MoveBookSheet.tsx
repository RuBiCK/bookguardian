import type { Book } from '@bookguardian/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMoveBook } from '../api/inventory';
import { useShelfLabel } from '../api/shelf-label';
import { showToast } from '../lib/toast';
import { Sheet } from './Sheet';
import { ShelfPicker } from './ShelfPicker';

interface MoveBookSheetProps {
  open: boolean;
  book: Book;
  onClose: () => void;
}

/** "Move to shelf": a grouped native picker and one button. Optimistic, like every edit. */
export function MoveBookSheet({ open, book, onClose }: MoveBookSheetProps) {
  const { t } = useTranslation();
  const [target, setTarget] = useState(book.shelfId);
  const targetLabel = useShelfLabel(target);
  const moveBook = useMoveBook({ onError: () => showToast(t('errors.saveFailed'), 'error') });

  useEffect(() => {
    if (open) setTarget(book.shelfId);
  }, [open, book.shelfId]);

  return (
    <Sheet
      open={open}
      title={t('books.moveToShelf')}
      onClose={onClose}
      footer={
        <button
          type="button"
          className="button button--primary button--block"
          disabled={!target || target === book.shelfId}
          onClick={() => {
            moveBook.mutate({ id: book.id, shelfId: target });
            showToast(t('books.moved', { shelf: targetLabel }));
            onClose();
          }}
        >
          {t('common.move')}
        </button>
      }
    >
      <div className="field">
        <span className="field__label">{t('books.shelf')}</span>
        <ShelfPicker value={target} onChange={setTarget} label={t('books.shelf')} />
      </div>
    </Sheet>
  );
}
