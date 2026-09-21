import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateLibrary, useLibraries } from '../../api/inventory';
import { BookList } from '../../components/BookList';
import { BookSheet } from '../../components/BookSheet';
import { EmptyState } from '../../components/EmptyState';
import { Fab } from '../../components/Fab';
import { ChevronRightIcon, LibraryIcon, PlusIcon } from '../../components/icons';
import { InstallBanner } from '../../components/InstallBanner';
import { NameSheet } from '../../components/NameSheet';
import { Screen } from '../../components/Screen';
import { SearchBar } from '../../components/SearchBar';
import { CardListSkeleton } from '../../components/Skeleton';
import { showToast } from '../../lib/toast';

export const Route = createFileRoute('/_app/')({
  component: LibraryScreen,
});

/** Library tab: your libraries with counts, a global search, and the add-book FAB. */
function LibraryScreen() {
  const { t } = useTranslation();
  const libraries = useLibraries();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [newLibrary, setNewLibrary] = useState(false);
  const createLibrary = useCreateLibrary({
    onError: () => showToast(t('errors.saveFailed'), 'error'),
  });

  return (
    <Screen
      title={t('library.title')}
      actions={
        <button
          type="button"
          className="button button--ghost button--small"
          onClick={() => setNewLibrary(true)}
        >
          <PlusIcon /> {t('library.addLibrary')}
        </button>
      }
    >
      {query.trim() ? null : <InstallBanner />}
      <SearchBar value={query} onChange={setQuery} placeholder={t('books.searchPlaceholder')} />

      {query.trim() ? (
        <BookList base={{ q: query.trim() }} />
      ) : libraries.isPending ? (
        <CardListSkeleton count={2} />
      ) : libraries.data === undefined ? (
        <EmptyState
          title={t('errors.generic')}
          body={t('errors.network')}
          illustration="offline"
          action={
            <button type="button" className="button" onClick={() => void libraries.refetch()}>
              {t('common.retry')}
            </button>
          }
        />
      ) : libraries.data.length === 0 ? (
        <EmptyState
          title={t('library.empty.title')}
          body={t('library.empty.body')}
          illustration="shelves"
          action={
            <button
              type="button"
              className="button button--primary"
              onClick={() => setNewLibrary(true)}
            >
              {t('library.addLibrary')}
            </button>
          }
        />
      ) : (
        <ul className="cards" data-testid="library-list">
          {libraries.data.map((library, i) => (
            <li key={library.id} style={{ '--i': i } as CSSProperties}>
              <Link
                to="/libraries/$libraryId"
                params={{ libraryId: library.id }}
                className="card card--row"
              >
                <span className="card__icon">
                  <LibraryIcon />
                </span>
                <span className="card__body">
                  <span className="card__title">{library.name}</span>
                  <span className="card__meta">
                    {library.location ? `${library.location} · ` : ''}
                    {t('count.shelves', { count: library.shelfCount })} ·{' '}
                    {t('count.books', { count: library.bookCount })}
                  </span>
                </span>
                <ChevronRightIcon className="card__chevron" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Fab label={t('books.add')} onClick={() => setAdding(true)} />
      <BookSheet open={adding} onClose={() => setAdding(false)} />
      <NameSheet
        open={newLibrary}
        title={t('library.addLibrary')}
        nameLabel={t('library.name')}
        namePlaceholder={t('library.namePlaceholder')}
        withLocation
        onClose={() => setNewLibrary(false)}
        onSubmit={({ name, location }) =>
          createLibrary.mutate({ name, location: location || null })
        }
      />
    </Screen>
  );
}
