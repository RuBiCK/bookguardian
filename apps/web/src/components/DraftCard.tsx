import type { BookDraft } from '@bookguardian/shared';
import { useTranslation } from 'react-i18next';
import { BookIcon } from './icons';

interface DraftCardProps {
  draft: BookDraft;
  /** Compact row (candidate lists) instead of the hero layout. */
  compact?: boolean;
}

/** Cover + title + authors + edition line for a catalogue result. */
export function DraftCard({ draft, compact = false }: DraftCardProps) {
  const { t } = useTranslation();
  const authors = draft.authors.length > 0 ? draft.authors.join(', ') : t('books.unknownAuthor');
  const edition = [draft.publisher, draft.publishedDate].filter(Boolean).join(' · ');
  return (
    <div className={`draft${compact ? ' draft--compact' : ''}`} data-testid="draft-card">
      <span className="draft__cover">
        {draft.coverUrl ? (
          <img src={draft.coverUrl} alt="" loading="lazy" />
        ) : (
          <span className="draft__placeholder" aria-hidden="true">
            <BookIcon />
          </span>
        )}
      </span>
      <span className="draft__body">
        <span className="draft__title">{draft.title}</span>
        {draft.subtitle && !compact ? (
          <span className="draft__subtitle">{draft.subtitle}</span>
        ) : null}
        <span className="draft__authors">{authors}</span>
        {edition ? <span className="draft__meta">{edition}</span> : null}
        {!compact ? (
          <span className="draft__meta">
            {t('scan.result.via', { source: t(`scan.result.source.${draft.source}`) })}
          </span>
        ) : null}
      </span>
    </div>
  );
}
