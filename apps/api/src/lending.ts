/**
 * Lending use-cases: lend a book, take it back, list who has what. The one
 * rule that matters — a book is out to at most one person at a time — is
 * enforced here inside a transaction, not in the routes.
 */
import {
  isOverdue,
  localDate,
  type Borrower,
  type CreateLendingInput,
  type Lending,
  type LendingWithBook,
  type LentBook,
} from '@bookguardian/shared';
import type { Services } from './app-env';
import type { DatabaseAdapter } from './db/adapters';
import { createRepositories, type Repositories } from './db/repositories';
import type { LendingFilter } from './db/repositories/lendings';
import { ApiHttpError } from './errors';

const notFound = (entity: string) => new ApiHttpError(404, 'not_found', `${entity} not found`);

function transactional<R>(
  adapter: DatabaseAdapter,
  fn: (repos: Repositories) => Promise<R>,
): Promise<R> {
  return adapter.kit.transaction((tx) => fn(createRepositories({ ...adapter, kit: tx })));
}

export interface ListLendingsOptions extends LendingFilter {
  /** Keep only overdue lendings (implies active). */
  overdue?: boolean;
  /** The calendar day "overdue" is judged against; defaults to the server's today. */
  today?: string;
}

/** Attach each lending's book summary and the overdue flag. */
async function withBooks(
  repos: Repositories,
  ownerId: string,
  lendings: Lending[],
  today: string,
): Promise<LendingWithBook[]> {
  const bookIds = [...new Set(lendings.map((l) => l.bookId))];
  const books = new Map<string, LentBook>();
  for (const b of await repos.books.findByIds(ownerId, bookIds)) {
    books.set(b.id, {
      id: b.id,
      title: b.title,
      authors: b.authors,
      coverUrl: b.coverUrl,
      shelfId: b.shelfId,
    });
  }
  return lendings.flatMap((lending) => {
    const book = books.get(lending.bookId);
    // A lending whose book vanished mid-request (cascade) is simply not listed.
    return book ? [{ ...lending, book, overdue: isOverdue(lending, today) }] : [];
  });
}

/**
 * Lendings newest first. Active only by default — the Lending tab — with
 * `active: false` for returned ones and `bookId` for one book's history.
 */
export async function listLendings(
  repos: Repositories,
  ownerId: string,
  { overdue, today = localDate(), ...filter }: ListLendingsOptions = {},
): Promise<LendingWithBook[]> {
  if (filter.bookId && !(await repos.books.findById(ownerId, filter.bookId))) {
    throw notFound('Book');
  }
  const active = overdue ? true : filter.active;
  const items = await withBooks(
    repos,
    ownerId,
    await repos.lendings.list(ownerId, { ...filter, active }),
    today,
  );
  return overdue ? items.filter((l) => l.overdue) : items;
}

export async function getLending(
  repos: Repositories,
  ownerId: string,
  id: string,
  today: string = localDate(),
): Promise<LendingWithBook> {
  const lending = await repos.lendings.findById(ownerId, id);
  const [item] = lending ? await withBooks(repos, ownerId, [lending], today) : [];
  if (!item) throw notFound('Lending');
  return item;
}

export function listBorrowers(repos: Repositories, ownerId: string): Promise<Borrower[]> {
  return repos.lendings.listBorrowers(ownerId);
}

/**
 * Lend a book. The book must exist (422 `unknown_book`) and must not already
 * be out (409 `already_lent`, with the open lending in `details`). The
 * check-then-insert runs in one transaction so two taps cannot both win.
 */
export function lendBook(
  services: Services,
  ownerId: string,
  input: CreateLendingInput,
  today: string = localDate(),
): Promise<LendingWithBook> {
  return transactional(services.adapter, async (repos) => {
    const book = await repos.books.findById(ownerId, input.bookId);
    if (!book) {
      throw new ApiHttpError(422, 'unknown_book', 'Book not found', { bookId: input.bookId });
    }
    const open = await repos.lendings.findActiveByBook(ownerId, book.id);
    if (open) {
      throw new ApiHttpError(409, 'already_lent', `Book is already lent to ${open.borrowerName}`, {
        lendingId: open.id,
        borrowerName: open.borrowerName,
      });
    }
    const lending = await repos.lendings.create(ownerId, input);
    const [item] = await withBooks(repos, ownerId, [lending], today);
    return item!;
  });
}

/**
 * The book came back. 409 `already_returned` if the lending is closed; the
 * return time defaults to now and must not precede the lending itself.
 */
export function returnLending(
  services: Services,
  ownerId: string,
  id: string,
  returnedAt?: string,
  today: string = localDate(),
): Promise<LendingWithBook> {
  return transactional(services.adapter, async (repos) => {
    const lending = await repos.lendings.findById(ownerId, id);
    if (!lending) throw notFound('Lending');
    if (lending.returnedAt !== null) {
      throw new ApiHttpError(409, 'already_returned', 'Book was already returned', {
        returnedAt: lending.returnedAt,
      });
    }
    if (returnedAt !== undefined && returnedAt < lending.lentAt) {
      throw new ApiHttpError(422, 'returned_before_lent', 'Return cannot precede the lending', {
        lentAt: lending.lentAt,
      });
    }
    const returned = await repos.lendings.markReturned(ownerId, id, returnedAt);
    const [item] = returned ? await withBooks(repos, ownerId, [returned], today) : [];
    if (!item) throw notFound('Lending');
    return item;
  });
}
