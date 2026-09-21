import { isoDateSchema, readStatusSchema } from '@bookguardian/shared';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { BookList } from '../../components/BookList';
import { BookSheet } from '../../components/BookSheet';
import { Fab } from '../../components/Fab';
import { Screen } from '../../components/Screen';
import { describePeriod, hasBrowseFilter, languageName } from '../../lib/stats';

/** Every filter the Stats tab can drill into; anything malformed is dropped, not an error. */
const searchSchema = z.object({
  readStatus: readStatusSchema.optional().catch(undefined),
  category: z.string().min(1).optional().catch(undefined),
  language: z.string().min(1).optional().catch(undefined),
  author: z.string().min(1).optional().catch(undefined),
  publisher: z.string().min(1).optional().catch(undefined),
  rating: z.coerce.number().int().min(1).max(5).optional().catch(undefined),
  readFrom: isoDateSchema.optional().catch(undefined),
  readTo: isoDateSchema.optional().catch(undefined),
});
export type BookBrowseSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute('/_app/books/')({
  validateSearch: searchSchema,
  component: BrowseBooksScreen,
});

/**
 * Every book, narrowed by whatever the URL says: the list a stats segment
 * opens ("Category · Fantasy", "Read in March 2026"). The status and rating
 * chips work on top of that filter like on any shelf.
 */
function BrowseBooksScreen() {
  const { t, i18n } = useTranslation();
  const search = Route.useSearch();
  const [adding, setAdding] = useState(false);
  const { readStatus, ...base } = search;

  const subtitle = describeFilter(search, t, i18n.language);
  return (
    <Screen title={t('books.all')} subtitle={subtitle} back={{ to: '/stats' }}>
      {hasBrowseFilter(base) ? (
        <p className="filter-note">
          <Link to="/books" search={{}} className="button button--ghost button--small">
            {t('books.filtered.clear')}
          </Link>
        </p>
      ) : null}
      <BookList base={base} searchable initialStatus={readStatus} onAdd={() => setAdding(true)} />
      <Fab label={t('books.add')} onClick={() => setAdding(true)} />
      <BookSheet open={adding} onClose={() => setAdding(false)} />
    </Screen>
  );
}

type Translate = ReturnType<typeof useTranslation>['t'];

/** "Category · Fantasy", "Read in March 2026"… or nothing when the list is unfiltered. */
export function describeFilter(
  search: BookBrowseSearch,
  t: Translate,
  locale: string,
): string | undefined {
  const parts: string[] = [];
  if (search.category) parts.push(t('books.filtered.category', { value: search.category }));
  if (search.language) {
    parts.push(t('books.filtered.language', { value: languageName(search.language, locale) }));
  }
  if (search.author) parts.push(t('books.filtered.author', { value: search.author }));
  if (search.publisher) parts.push(t('books.filtered.publisher', { value: search.publisher }));
  if (search.rating) parts.push(t('books.filtered.rating', { count: search.rating }));
  const period = describePeriod(search.readFrom, search.readTo, locale);
  if (period) parts.push(t('books.filtered.readIn', { period }));
  return parts.length > 0 ? parts.join(' · ') : undefined;
}
