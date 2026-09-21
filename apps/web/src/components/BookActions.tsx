import type { Book } from '@bookguardian/shared';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSetReadStatus } from '../api/inventory';
import { useActiveLendings, useReturnLending } from '../api/lending';
import { haptic, withViewTransition } from '../lib/motion';
import { showToast } from '../lib/toast';
import { LendSheet } from './LendSheet';
import { MoveBookSheet } from './MoveBookSheet';
import { QuickActionsSheet } from './QuickActionsSheet';

import { BookActionsContext, type BookActionKind, type BookActionsApi } from './useBookActions';

/**
 * One host for everything a book list can do to a book without leaving it:
 * the long-press quick actions, "Lend" and "Move to shelf". Grid tiles and
 * list rows share it, so a gesture on either reaches the same sheets. The
 * sheets follow the live copy of the book, so they reflect optimistic edits.
 */
export function BookActionsProvider({ books, children }: { books: Book[]; children: ReactNode }) {
  const { t } = useTranslation();
  // The book stays after a sheet closes so the sheet can animate out over it.
  const [state, setState] = useState<{ kind: BookActionKind | null; book: Book } | null>(null);
  const lendings = useActiveLendings();
  const reading = useSetReadStatus({ onError: () => showToast(t('errors.saveFailed'), 'error') });
  const giveBack = useReturnLending({ onError: () => showToast(t('errors.saveFailed'), 'error') });

  const lent = useMemo(() => new Set(lendings.data?.map((l) => l.bookId)), [lendings.data]);
  const current = state ? (books.find((b) => b.id === state.book.id) ?? state.book) : null;
  const close = () => setState((s) => (s ? { ...s, kind: null } : s));

  const api: BookActionsApi = {
    open: (kind, book) => setState({ kind, book }),
    lendOrReturn: (book) => {
      const active = lendings.data?.find((l) => l.bookId === book.id);
      if (active) {
        withViewTransition(() => giveBack.mutate(active));
        showToast(t('lending.returnedToast', { title: book.title }));
      } else {
        setState({ kind: 'lend', book });
      }
    },
    toggleRead: (book) => {
      haptic();
      withViewTransition(() => reading.set(book, book.readStatus === 'read' ? 'to_read' : 'read'));
    },
    lent,
  };

  return (
    <BookActionsContext.Provider value={api}>
      {children}
      <QuickActionsSheet
        book={state?.kind === 'quick' ? current : null}
        lent={current ? lent.has(current.id) : false}
        onClose={close}
        onLend={(book) => {
          close();
          api.lendOrReturn(book);
        }}
        onMove={(book) => setState({ kind: 'move', book })}
      />
      {current ? (
        <>
          <LendSheet open={state?.kind === 'lend'} book={current} onClose={close} />
          <MoveBookSheet open={state?.kind === 'move'} book={current} onClose={close} />
        </>
      ) : null}
    </BookActionsContext.Provider>
  );
}
