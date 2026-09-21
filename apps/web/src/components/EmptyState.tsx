import type { ReactNode } from 'react';
import {
  BooksIllustration,
  LendingIllustration,
  OfflineIllustration,
  SearchIllustration,
  ShelvesIllustration,
  StatsIllustration,
} from './illustrations';

const ILLUSTRATIONS = {
  books: BooksIllustration,
  shelves: ShelvesIllustration,
  lending: LendingIllustration,
  stats: StatsIllustration,
  search: SearchIllustration,
  offline: OfflineIllustration,
} as const;

export type Illustration = keyof typeof ILLUSTRATIONS;

interface EmptyStateProps {
  title: string;
  body?: string;
  /** One of the built-in line drawings; the default is the book shelf. */
  illustration?: Illustration;
  /** A custom icon instead of an illustration (small inline states). */
  icon?: ReactNode;
  /** The one thing to do next — a primary button or link. */
  action?: ReactNode;
}

/**
 * Every list's "nothing here" moment: an illustration, a short title, one
 * line of help and the primary action that fills the list.
 */
export function EmptyState({ title, body, illustration = 'books', icon, action }: EmptyStateProps) {
  const Illustration = ILLUSTRATIONS[illustration];
  return (
    <div className="empty" role="status">
      {icon ? <span className="empty__icon">{icon}</span> : <Illustration />}
      <h2 className="empty__title">{title}</h2>
      {body ? <p className="empty__body">{body}</p> : null}
      {action ?? null}
    </div>
  );
}
