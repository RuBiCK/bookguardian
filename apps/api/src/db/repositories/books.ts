import { asc, desc, eq, gte, inArray, isNotNull, isNull, or, type SQL } from 'drizzle-orm';
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

/**
 * A book as stored. The API adds the computed `coverUrl` / `coverPending`
 * before it becomes the shared `Book` DTO (see `inventory.ts`).
 */
export type BookRecord = Omit<Book, 'coverUrl' | 'coverPending'>;

/** `coverUrl` on the wire is an instruction for the cover service, not a column. */
export type NewBookRecord = Omit<CreateBookInput, 'coverUrl'> & {
  shelfId: string;
  id?: string;
  coverAssetId?: string | null;
  coverOverride?: boolean;
};
export type BookRecordPatch = Omit<UpdateBookInput, 'coverUrl'> & {
  coverAssetId?: string | null;
  coverOverride?: boolean;
};

export interface BookPageResult {
  items: BookRecord[];
  total: number;
}

export interface BookRepository {
  findById(ownerId: string, id: string): Promise<BookRecord | null>;
  /** The books with these ids that belong to the owner (order unspecified). */
  findByIds(ownerId: string, ids: string[]): Promise<BookRecord[]>;
  listByOwner(
    ownerId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<BookRecord[]>;
  listByShelf(ownerId: string, shelfId: string): Promise<BookRecord[]>;
  /** Filtered, paginated listing plus the total number of matches. */
  search(ownerId: string, search: BookSearch): Promise<BookPageResult>;
  /** The book added most recently, used to pre-select "the shelf you last used". */
  findMostRecent(ownerId: string): Promise<BookRecord | null>;
  /** Books per shelf id (shelves without books are absent from the map). */
  countByShelf(ownerId: string, shelfIds?: string[]): Promise<Map<string, number>>;
  /**
   * Books the cover cascade can still help: an ISBN, no cover, and no user
   * override. Every owner when `ownerId` is omitted (boot-time backfill).
   */
  listMissingCovers(ownerId?: string): Promise<BookRecord[]>;
  /** Books (of any owner) showing this asset; drives access to private covers. */
  listByCoverAsset(assetId: string): Promise<BookRecord[]>;
  /** Distinct asset ids some book still points at (the GC keeps these). */
  referencedCoverAssetIds(): Promise<Set<string>>;
  create(ownerId: string, input: NewBookRecord): Promise<BookRecord>;
  update(ownerId: string, id: string, input: BookRecordPatch): Promise<BookRecord | null>;
  /** Point the book at an asset (or none) and record whether the user chose it. */
  setCover(
    ownerId: string,
    id: string,
    coverAssetId: string | null,
    coverOverride: boolean,
  ): Promise<BookRecord | null>;
  /** Re-shelve every book on `fromShelfId`; returns how many moved. */
  moveAll(ownerId: string, fromShelfIds: string[], toShelfId: string): Promise<number>;
  delete(ownerId: string, id: string): Promise<void>;
}

type BookRow = Tables['books']['$inferSelect'];

/** The DB stores read_status as plain text; narrow it back to the enum. */
function toBook(row: BookRow): BookRecord {
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
    async listMissingCovers(ownerId) {
      const conditions: SQL[] = [
        isNotNull(books.isbn13),
        isNull(books.coverAssetId),
        eq(books.coverOverride, false),
      ];
      if (ownerId) conditions.push(eq(books.ownerId, ownerId));
      const rows = await kit.select(books, {
        where: allOf(conditions[0]!, ...conditions.slice(1)),
        orderBy: [desc(books.addedAt)],
      });
      return rows.map(toBook);
    },
    async listByCoverAsset(assetId) {
      const rows = await kit.select(books, { where: eq(books.coverAssetId, assetId) });
      return rows.map(toBook);
    },
    async referencedCoverAssetIds() {
      const groups = await kit.countBy(books, books.coverAssetId, isNotNull(books.coverAssetId));
      return new Set(groups.map((g) => g.key));
    },
    async create(ownerId, input) {
      const now = nowIso();
      const row: BookRecord = {
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
        coverAssetId: input.coverAssetId ?? null,
        coverOverride: input.coverOverride ?? false,
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
    async setCover(ownerId, id, coverAssetId, coverOverride) {
      // Not `updatedAt`: a cover arriving in the background is not a user edit.
      await kit.update(books, { coverAssetId, coverOverride }, owned(ownerId, id));
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
