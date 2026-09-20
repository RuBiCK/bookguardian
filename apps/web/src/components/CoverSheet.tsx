import type { Book } from '@bookguardian/shared';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useRemoveCover, useUploadCover } from '../api/covers';
import { showToast } from '../lib/toast';
import { BookCover } from './BookCover';
import { CameraIcon, ImageIcon } from './icons';
import { Sheet } from './Sheet';

interface CoverSheetProps {
  open: boolean;
  book: Book;
  onClose: () => void;
}

/**
 * Change a book's cover from its page: take or pick a photo (stored as the
 * user's own cover, private to them), or go back to the catalogue cover
 * after a photo replaced it.
 */
export function CoverSheet({ open, book, onClose }: CoverSheetProps) {
  const { t } = useTranslation();
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUploadCover({
    onSuccess: () => showToast(t('books.cover.uploaded')),
    onError: () => showToast(t('books.cover.uploadFailed'), 'error'),
  });
  const remove = useRemoveCover({
    onSuccess: () => showToast(t('books.cover.removed')),
    onError: () => showToast(t('errors.saveFailed'), 'error'),
  });
  const busy = upload.isPending || remove.isPending;

  const pick = (ref: React.RefObject<HTMLInputElement | null>) => () => ref.current?.click();
  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    upload.mutate({ bookId: book.id, file });
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('books.cover.title')}>
      <div className="cover-sheet">
        <div className="cover-sheet__preview">
          <BookCover book={book} sizes="120px" />
          {book.coverOverride ? <span className="pill">{t('books.cover.own')}</span> : null}
        </div>
        <div className="stack">
          <button
            type="button"
            className="button button--primary"
            disabled={busy}
            onClick={pick(cameraRef)}
          >
            <CameraIcon /> {t('books.cover.takePhoto')}
          </button>
          <button type="button" className="button" disabled={busy} onClick={pick(fileRef)}>
            <ImageIcon /> {t('books.cover.choosePhoto')}
          </button>
          {book.coverOverride ? (
            <button
              type="button"
              className="button button--ghost"
              disabled={busy}
              onClick={() => {
                remove.mutate(book.id);
                onClose();
              }}
            >
              {t('books.cover.useCatalogue')}
            </button>
          ) : null}
        </div>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="visually-hidden"
        tabIndex={-1}
        data-testid="cover-sheet-camera"
        onChange={onFile}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="visually-hidden"
        tabIndex={-1}
        data-testid="cover-sheet-file"
        onChange={onFile}
      />
    </Sheet>
  );
}
