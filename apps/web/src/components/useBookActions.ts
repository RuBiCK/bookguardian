import type { Book } from '@bookguardian/shared';
import { createContext, useContext } from 'react';

export type BookActionKind = 'quick' | 'lend' | 'move';

export interface BookActionsApi {
  /** Open one of the sheets for a book. */
  open: (kind: BookActionKind, book: Book) => void;
  /** Lend it, or take it back when it is out. */
  lendOrReturn: (book: Book) => void;
  /** Read ↔ to read, in one tap. */
  toggleRead: (book: Book) => void;
  /** Ids of the books currently out. */
  lent: ReadonlySet<string>;
}

export const BookActionsContext = createContext<BookActionsApi | null>(null);

/** The sheets and one-tap actions provided by the nearest `<BookActionsProvider>`. */
export function useBookActions(): BookActionsApi {
  const api = useContext(BookActionsContext);
  if (!api) throw new Error('useBookActions must be used inside <BookActionsProvider>');
  return api;
}
