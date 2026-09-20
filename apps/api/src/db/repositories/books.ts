import { asc, desc, eq, gte, inArray, isNull, or, type SQL } from 'drizzle-orm';
import {
  readStatusSchema,
  type Book,
  type BookSort,
  type CreateBookInput,
  type ReadStatus,
  type UpdateBookInput,
} from '@bookguardian/shared';
import type { DialectKit } from '../adapters/types';
import type { Tables } from '../schema';
import { allOf, newId, nowIso } from './base';

export interface BookSearch {
  /** Case-insensitive substring match across title, subtitle, authors, publisher and ISBNs. */
  q?: string;
  /** Restrict to these shelves (already resolved from a library filter, for instance). */
  shelfIds?: string[];
  readStatus?: ReadStatus;
  /** Only books rated at least this many stars. */
  minRating?: number;
  /** Exact category (matched against the stored JSON array). */
  category?: string;
  sort?: BookSort;
  limit?: number;
  offset?: number;
}

export interface BookPageResult {
  items: Book[];
  total: number;
}

export interface BookRepository {
  findById(ownerId: string, id: string): Promise<Book | null>;
  /** The books with these ids that belong to the owner (order unspecified). */
  findByIds(ownerId: string, ids: string[]): Promise<Book[]>;
  listByOwner(ownerId: string, options?: { limit?: number; offset?: number }): Promise<Book[]>;
  listByShelf(ownerId: string, shelfId: string): Promise<Book[]>;
  /** Filtered, paginated listing plus the total number of matches. */
  search(ownerId: string, search: BookSearch): Promise<BookPageResult>;
  /** The book added most recently, used to pre-select "the shelf you last used". */
  findMostRecent(ownerId: string): Promise<Book | null>;
  /** Books per shelf id (shelves without books are absent from the map). */
  countByShelf(ownerId: string, shelfIds?: string[]): Promise<Map<string, number>>;
  create(ownerId: string, input: CreateBookInput & { shelfId: string; id?: string }): Promise<Book>;
  update(ownerId: string, id: string, input: UpdateBookInput): Promise<Book | null>;
  /** Re-shelve every book on `fromShelfId`; returns how many moved. */
  moveAll(ownerId: string, fromShelfIds: string[], toShelfId: string): Promise<number>;
  delete(ownerId: string, id: string): Promise<void>;
}

type BookRow = Tables['books']['$inferSelect'];

/** The DB stores read_status as plain text; narrow it back to the enum. */
function toBook(row: BookRow): Book {
  return { ...row, readStatus: readStatusSchema.parse(row.readStatus) };
}

export function createBookRepository(kit: DialectKit, tables: Tables): BookRepository {
  const { books } = tables;

  // `NULLS LAST` is not portable (MySQL lacks it), so sort on `IS NULL` first:
  // false/0 before true/1 in every dialect puts the books that have a value first.
  const sortOrder = (sort: BookSort): SQL[] => {
    switch (sort) {
      case 'title':
        return [asc(books.title), desc(books.addedAt)];
      case 'read':
        return [asc(isNull(books.readAt)), desc(books.readAt), desc(books.addedAt)];
      case 'rating':
        return [asc(isNull(books.rating)), desc(books.rating), desc(books.addedAt)];
      case 'added':
        return [desc(books.addedAt), asc(books.title)];
    }
  };
  const owned = (ownerId: string, id: string) =>
    allOf(eq(books.ownerId, ownerId), eq(books.id, id));

  return {
    async findById(ownerId, id) {
      const [row] = await kit.select(books, { where: owned(ownerId, id), limit: 1 });
      return row ? toBook(row) : null;
    },
    async findByIds(ownerId, ids) {
      if (ids.length === 0) return [];
      const rows = await kit.select(books, {
        where: allOf(eq(books.ownerId, ownerId), inArray(books.id, ids)),
      });
      return rows.map(toBook);
    },
    async listByOwner(ownerId, options = {}) {
      const rows = await kit.select(books, {
        where: eq(books.ownerId, ownerId),
        orderBy: [desc(books.addedAt)],
        limit: options.limit,
        offset: options.offset,
      });
      return rows.map(toBook);
    },
    async listByShelf(ownerId, shelfId) {
      const rows = await kit.select(books, {
        where: allOf(eq(books.ownerId, ownerId), eq(books.shelfId, shelfId)),
        orderBy: [desc(books.addedAt)],
      });
      return rows.map(toBook);
    },
    async search(ownerId, search) {
      if (search.shelfIds?.length === 0) return { items: [], total: 0 };

      const conditions: SQL[] = [eq(books.ownerId, ownerId)];
      if (search.shelfIds) conditions.push(inArray(books.shelfId, search.shelfIds));
      if (search.readStatus) conditions.push(eq(books.readStatus, search.readStatus));
      if (search.minRating) conditions.push(gte(books.rating, search.minRating));
      // Categories are a JSON array; an exact element match is the encoded string in quotes.
      if (search.category) {
        conditions.push(kit.contains(books.categories, JSON.stringify(search.category)));
      }
      if (search.q) {
        conditions.push(
          or(
            kit.contains(books.title, search.q),
            kit.contains(books.subtitle, search.q),
            kit.contains(books.authors, search.q),
            kit.contains(books.publisher, search.q),
            kit.contains(books.isbn13, search.q),
            kit.contains(books.isbn10, search.q),
          )!,
        );
      }
      const where = allOf(conditions[0]!, ...conditions.slice(1));
      const orderBy = sortOrder(search.sort ?? 'added');

      const [rows, total] = await Promise.all([
        kit.select(books, { where, orderBy, limit: search.limit, offset: search.offset }),
        kit.count(books, where),
      ]);
      return { items: rows.map(toBook), total };
    },
    async findMostRecent(ownerId) {
      const [row] = await kit.select(books, {
        where: eq(books.ownerId, ownerId),
        orderBy: [desc(books.addedAt), desc(books.createdAt)],
        limit: 1,
      });
      return row ? toBook(row) : null;
    },
    async countByShelf(ownerId, shelfIds) {
      if (shelfIds?.length === 0) return new Map();
      const where = shelfIds
        ? allOf(eq(books.ownerId, ownerId), inArray(books.shelfId, shelfIds))
        : eq(books.ownerId, ownerId);
      const groups = await kit.countBy(books, books.shelfId, where);
      return new Map(groups.map((g) => [g.key, g.count]));
    },
    async create(ownerId, input) {
      const now = nowIso();
      const row: Book = {
        id: input.id ?? newId(),
        ownerId,
        shelfId: input.shelfId,
        isbn10: input.isbn10 ?? null,
        isbn13: input.isbn13 ?? null,
        title: input.title,
        subtitle: input.subtitle ?? null,
        authors: input.authors ?? [],
        publisher: input.publisher ?? null,
        publishedDate: input.publishedDate ?? null,
        pages: input.pages ?? null,
        language: input.language ?? null,
        coverUrl: input.coverUrl ?? null,
        categories: input.categories ?? [],
        description: input.description ?? null,
        notes: input.notes ?? null,
        rating: input.rating ?? null,
        readStatus: input.readStatus ?? 'to_read',
        readAt: input.readAt ?? null,
        addedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      await kit.insert(books, row);
      return row;
    },
    async update(ownerId, id, input) {
      await kit.update(books, { ...input, updatedAt: nowIso() }, owned(ownerId, id));
      return this.findById(ownerId, id);
    },
    async moveAll(ownerId, fromShelfIds, toShelfId) {
      if (fromShelfIds.length === 0) return 0;
      const where = allOf(eq(books.ownerId, ownerId), inArray(books.shelfId, fromShelfIds));
      const moving = await kit.count(books, where);
      if (moving > 0) await kit.update(books, { shelfId: toShelfId, updatedAt: nowIso() }, where);
      return moving;
    },
    async delete(ownerId, id) {
      await kit.delete(books, owned(ownerId, id));
    },
  };
}
