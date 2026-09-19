import type { ReadStatus } from '@bookguardian/shared';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBooks, useLibraries, useShelves } from '../api/inventory';
import { BookGrid } from '../components/BookGrid';
import { BookSheet } from '../components/BookSheet';
import { EmptyState } from '../components/EmptyState';
import { Fab } from '../components/Fab';
import { Screen } from '../components/Screen';
import { SearchBar } from '../components/SearchBar';
import { StatusChips } from '../components/StatusChips';

export const Route = createFileRoute('/shelves/$shelfId')({
  component: ShelfScreen,
});

/** One shelf: cover-first grid with search and read-status filters. */
function ShelfScreen() {
  const { t } = useTranslation();
  const { shelfId } = Route.useParams();
  const shelves = useShelves();
  const libraries = useLibraries();
  const shelf = shelves.data?.find((s) => s.id === shelfId);
  const library = libraries.data?.find((l) => l.id === shelf?.libraryId);

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<ReadStatus | undefined>(undefined);
  const [adding, setAdding] = useState(false);
  const filtering = query.trim() !== '' || status !== undefined;
  const books = useBooks({ shelfId, q: query.trim() || undefined, readStatus: status });
  const items = books.data?.pages.flatMap((p) => p.items) ?? [];
  const total = books.data?.pages[0]?.total ?? 0;

  if (shelves.isPending) {
    return (
      <Screen title={t('common.loading')} back={{ to: '/' }}>
        <p className="muted">{t('common.loading')}</p>
      </Screen>
    );
  }
  if (!shelf) {
    return (
      <Screen title={t('errors.notFound')} back={{ to: '/' }}>
        <EmptyState title={t('errors.notFound')} action={<span />} />
      </Screen>
    );
  }

  return (
    <Screen
      title={shelf.name}
      subtitle={library?.name}
      back={{ to: '/libraries/$libraryId', params: { libraryId: shelf.libraryId } }}
    >
      <SearchBar value={query} onChange={setQuery} placeholder={t('books.searchPlaceholder')} />
      <StatusChips value={status} onChange={setStatus} />

      {books.isPending ? (
        <p className="muted">{t('common.loading')}</p>
      ) : books.isError ? (
        <EmptyState
          title={t('errors.generic')}
          body={t('errors.network')}
          action={
            <button type="button" className="button" onClick={() => void books.refetch()}>
              {t('common.retry')}
            </button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          title={filtering ? t('books.empty.noResults') : t('books.empty.title')}
          body={filtering ? undefined : t('books.empty.body')}
          action={
            filtering ? (
              <span />
            ) : (
              <button
                type="button"
                className="button button--primary"
                onClick={() => setAdding(true)}
              >
                {t('books.add')}
              </button>
            )
          }
        />
      ) : (
        <>
          <BookGrid books={items} />
          <p className="muted">{t('books.showing', { shown: items.length, total })}</p>
          {books.hasNextPage ? (
            <button
              type="button"
              className="button button--block"
              disabled={books.isFetchingNextPage}
              onClick={() => void books.fetchNextPage()}
            >
              {t('books.loadMore')}
            </button>
          ) : null}
        </>
      )}

      <Fab label={t('books.add')} onClick={() => setAdding(true)} />
      <BookSheet open={adding} onClose={() => setAdding(false)} initialShelfId={shelfId} />
    </Screen>
  );
}
