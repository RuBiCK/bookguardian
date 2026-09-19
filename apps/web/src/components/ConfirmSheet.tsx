import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from './Sheet';
import { ShelfPicker } from './ShelfPicker';

interface ConfirmSheetProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: (moveBooksTo?: string) => void;
  /**
   * When the thing being deleted still holds books, ask where they should go.
   * `exclude` lists the shelves that are about to disappear.
   */
  moveBooks?: { count: number; exclude: readonly string[]; hint: string };
  /** A reason the action is impossible (e.g. last library); disables confirm. */
  blockedReason?: string;
}

/** Destructive confirmation as a sheet, with an optional "move books to" picker. */
export function ConfirmSheet({
  open,
  title,
  message,
  confirmLabel,
  onClose,
  onConfirm,
  moveBooks,
  blockedReason,
}: ConfirmSheetProps) {
  const { t } = useTranslation();
  const [target, setTarget] = useState('');
  useEffect(() => {
    if (open) setTarget('');
  }, [open]);

  const needsTarget = Boolean(moveBooks && moveBooks.count > 0);
  const canConfirm = !blockedReason && (!needsTarget || target !== '');

  return (
    <Sheet
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <div className="button-row">
          <button type="button" className="button button--block" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="button button--danger button--block"
            disabled={!canConfirm}
            onClick={() => {
              onConfirm(needsTarget ? target : undefined);
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <p className="sheet__text">{blockedReason ?? message}</p>
      {!blockedReason && needsTarget && moveBooks ? (
        <div className="field">
          <span className="field__label">{moveBooks.hint}</span>
          <ShelfPicker
            value={target}
            onChange={setTarget}
            label={moveBooks.hint}
            exclude={moveBooks.exclude}
          />
        </div>
      ) : null}
    </Sheet>
  );
}
