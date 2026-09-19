import type { BookDraft } from '@bookguardian/shared';
import { useTranslation } from 'react-i18next';
import { DraftCard } from './DraftCard';
import { Sheet } from './Sheet';

interface CandidatesSheetProps {
  open: boolean;
  candidates: BookDraft[];
  onPick: (draft: BookDraft) => void;
  onClose: () => void;
  /** Escape hatch when none of the matches is right. */
  onAddManually: () => void;
}

/** Cover OCR is fuzzy: show the top matches and let the user tap the right one. */
export function CandidatesSheet({
  open,
  candidates,
  onPick,
  onClose,
  onAddManually,
}: CandidatesSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('scan.cover.candidates')}
      footer={
        <button type="button" className="button button--block" onClick={onAddManually}>
          {t('scan.result.addManually')}
        </button>
      }
    >
      <ul className="candidates" data-testid="candidates">
        {candidates.map((draft, index) => (
          <li key={`${draft.source}:${draft.sourceId ?? index}`}>
            <button
              type="button"
              className="candidates__item"
              onClick={() => onPick(draft)}
              aria-label={`${draft.title} — ${draft.authors.join(', ')}`}
            >
              <DraftCard draft={draft} compact />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
