import type { BookDraft } from '@bookguardian/shared';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFallbackCover } from '../api/covers';
import { useCreateBook, useDefaults } from '../api/inventory';
import { useShelfLabel } from '../api/shelf-label';
import { draftToInput } from '../lib/book-form';
import { showToast } from '../lib/toast';
import { BookSheet } from './BookSheet';
import { DraftCard } from './DraftCard';
import { Sheet } from './Sheet';

interface CaptureResultSheetProps {
  draft: BookDraft | null;
  onClose: () => void;
  /** Called after the book was (optimistically) added. */
  onAdded?: () => void;
  /** The cover photo this result came from; kept as the cover if the catalogue has none. */
  fallbackPhoto?: File | null;
}

/**
 * The one-tap finish line of a scan: the catalogue result as a bottom sheet
 * with "Add to <default shelf>" in thumb reach, or "Edit details" to review
 * every field in the regular add form first.
 */
export function CaptureResultSheet({
  draft,
  onClose,
  onAdded,
  fallbackPhoto,
}: CaptureResultSheetProps) {
  const { t } = useTranslation();
  const defaults = useDefaults();
  const shelfId = defaults.data?.shelfId ?? '';
  const shelfLabel = useShelfLabel(shelfId);
  const [editing, setEditing] = useState(false);
  // The sheet closes (and its props reset) before the server answers, so
  // remember which photo went with this add.
  const keepPhoto = useFallbackCover();
  const savedPhoto = useRef<File | null>(null);
  const create = useCreateBook({
    onSuccess: (book) => keepPhoto(book, savedPhoto.current),
    onError: () => showToast(t('errors.saveFailed'), 'error'),
  });

  const add = () => {
    if (!draft || !shelfId) return;
    savedPhoto.current = fallbackPhoto ?? null;
    create.mutate({ ...draftToInput(draft), shelfId });
    showToast(t('books.added', { shelf: shelfLabel }));
    onAdded?.();
    onClose();
  };

  if (editing && draft) {
    return (
      <BookSheet
        open
        draft={draft}
        fallbackPhoto={fallbackPhoto}
        onClose={() => {
          setEditing(false);
          onClose();
        }}
        onSaved={onAdded}
      />
    );
  }

  return (
    <Sheet
      open={draft !== null}
      onClose={onClose}
      title={t('scan.result.title')}
      footer={
        <div className="stack">
          <button
            type="button"
            className="button button--primary button--block"
            disabled={!shelfId || create.isPending}
            onClick={add}
            data-testid="add-draft"
          >
            {shelfId ? t('scan.result.addTo', { shelf: shelfLabel }) : t('common.loading')}
          </button>
          <button
            type="button"
            className="button button--ghost button--block"
            onClick={() => setEditing(true)}
          >
            {t('scan.result.edit')}
          </button>
        </div>
      }
    >
      {draft ? <DraftCard draft={draft} /> : null}
    </Sheet>
  );
}
