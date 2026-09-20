/**
 * Shared ISBN catalogue (`catalog_books`): what the metadata providers told
 * us about an ISBN-13, kept for the whole instance so every user, process and
 * restart reads it instead of asking Open Library / Google Books again.
 *
 * Rows have no owner. A *hit* carries a full `BookDraft`; a *miss* (no
 * provider knows the ISBN) has a null title and a `missUntil` after which the
 * providers are asked again. See ADR 0003.
 */
import { eq } from 'drizzle-orm';
import {
  bookDraftSchema,
  bookSourceSchema,
  isbn13To10,
  type BookDraft,
  type BookSource,
} from '@bookguardian/shared';
import type { DialectKit } from '../adapters/types';
import type { Tables } from '../schema';

export type CatalogBookRow = Tables['catalogBooks']['$inferSelect'];

export interface CatalogBook {
  isbn13: string;
  /** Derived from the ISBN-13; `null` for 979-prefixed numbers. */
  isbn10: string | null;
  /** `null` for a miss. */
  draft: BookDraft | null;
  /** Provider that produced `draft`; `null` for a miss. */
  source: BookSource | null;
  /** Identifier each provider used for this ISBN (`open_library` edition key, Google volume id…). */
  providerIds: Record<string, string>;
  /** First time a provider answered for this ISBN (hit or miss). */
  fetchedAt: string;
  /** Last time the providers were asked; drives stale-while-revalidate. */
  refreshedAt: string;
  /** Set on a miss: do not ask the providers again before this instant. */
  missUntil: string | null;
}

const EMPTY: Pick<
  CatalogBookRow,
  | 'title'
  | 'subtitle'
  | 'authors'
  | 'publisher'
  | 'publishedDate'
  | 'pages'
  | 'language'
  | 'coverUrl'
  | 'categories'
  | 'description'
  | 'source'
  | 'raw'
> = {
  title: null,
  subtitle: null,
  authors: [],
  publisher: null,
  publishedDate: null,
  pages: null,
  language: null,
  coverUrl: null,
  categories: [],
  description: null,
  source: null,
  raw: null,
};

/**
 * Row for a provider hit. The requested ISBN-13 is the key even when the
 * provider lists sibling editions, and ISBN-10 is always derived from it so
 * both written forms of one number land on one row.
 */
export function hitRow(
  isbn13: string,
  draft: BookDraft,
  at: { fetchedAt: string; refreshedAt: string },
  previousIds: Record<string, string> = {},
): CatalogBookRow {
  const providerIds = { ...previousIds };
  if (draft.sourceId) providerIds[draft.source] = draft.sourceId;
  return {
    isbn13,
    isbn10: isbn13To10(isbn13),
    title: draft.title,
    subtitle: draft.subtitle,
    authors: draft.authors,
    publisher: draft.publisher,
    publishedDate: draft.publishedDate,
    pages: draft.pages,
    language: draft.language,
    coverUrl: draft.coverUrl,
    categories: draft.categories,
    description: draft.description,
    source: draft.source,
    providerIds,
    raw: JSON.stringify(draft),
    fetchedAt: at.fetchedAt,
    refreshedAt: at.refreshedAt,
    missUntil: null,
  };
}

/** Row for a miss: nothing known, retry after `missUntil`. */
export function missRow(
  isbn13: string,
  at: { fetchedAt: string; refreshedAt: string; missUntil: string },
  previousIds: Record<string, string> = {},
): CatalogBookRow {
  return {
    isbn13,
    isbn10: isbn13To10(isbn13),
    ...EMPTY,
    providerIds: previousIds,
    fetchedAt: at.fetchedAt,
    refreshedAt: at.refreshedAt,
    missUntil: at.missUntil,
  };
}

/** Rebuild the `BookDraft` the lookup API serves from a stored row. */
export function fromRow(row: CatalogBookRow): CatalogBook {
  const source = bookSourceSchema.safeParse(row.source);
  const draft =
    row.title !== null && source.success
      ? bookDraftSchema.parse({
          isbn10: row.isbn10,
          isbn13: row.isbn13,
          title: row.title,
          subtitle: row.subtitle,
          authors: row.authors,
          publisher: row.publisher,
          publishedDate: row.publishedDate,
          pages: row.pages,
          language: row.language,
          coverUrl: row.coverUrl,
          categories: row.categories,
          description: row.description,
          source: source.data,
          sourceId: row.providerIds[source.data] ?? null,
        } satisfies BookDraft)
      : null;
  return {
    isbn13: row.isbn13,
    isbn10: row.isbn10,
    draft,
    source: draft ? draft.source : null,
    providerIds: row.providerIds,
    fetchedAt: row.fetchedAt,
    refreshedAt: row.refreshedAt,
    missUntil: row.missUntil,
  };
}

export interface CatalogBookRepository {
  find(isbn13: string): Promise<CatalogBook | null>;
  /**
   * Insert or overwrite the row for `row.isbn13`. An existing row keeps its
   * `fetchedAt` and contributes its `providerIds`, so a refresh from another
   * provider accumulates identifiers instead of dropping them.
   */
  save(row: CatalogBookRow): Promise<CatalogBook>;
  /**
   * Store `row` only when nothing better is known: no row yet, or only a
   * miss. Never downgrades a full record (opportunistic search results are
   * less complete than a direct ISBN fetch). Returns whether it wrote.
   */
  saveIfUnknown(row: CatalogBookRow): Promise<boolean>;
  /** Bump `refreshedAt` without touching the metadata (refresh found nothing new). */
  markRefreshed(isbn13: string, refreshedAt: string): Promise<void>;
  count(): Promise<number>;
}

export function createCatalogBookRepository(
  kit: DialectKit,
  tables: Tables,
): CatalogBookRepository {
  const { catalogBooks } = tables;

  async function findRow(isbn13: string): Promise<CatalogBookRow | null> {
    const [row] = await kit.select(catalogBooks, {
      where: eq(catalogBooks.isbn13, isbn13),
      limit: 1,
    });
    return row ?? null;
  }

  async function update(row: CatalogBookRow, existing: CatalogBookRow): Promise<CatalogBookRow> {
    const merged: CatalogBookRow = {
      ...row,
      fetchedAt: existing.fetchedAt,
      providerIds: { ...existing.providerIds, ...row.providerIds },
    };
    const { isbn13, ...values } = merged;
    await kit.update(catalogBooks, values, eq(catalogBooks.isbn13, isbn13));
    return merged;
  }

  /**
   * Insert, or update when the insert loses a race with another writer for
   * the same ISBN (two search results, a search next to a lookup). There is
   * no portable `INSERT … ON CONFLICT` in the kit, so retry on the PK error.
   */
  async function upsert(row: CatalogBookRow): Promise<CatalogBookRow> {
    const existing = await findRow(row.isbn13);
    if (existing) return update(row, existing);
    try {
      await kit.insert(catalogBooks, row);
      return row;
    } catch (error) {
      const raced = await findRow(row.isbn13);
      if (!raced) throw error;
      return update(row, raced);
    }
  }

  return {
    async find(isbn13) {
      const row = await findRow(isbn13);
      return row ? fromRow(row) : null;
    },
    async save(row) {
      return fromRow(await upsert(row));
    },
    async saveIfUnknown(row) {
      const existing = await findRow(row.isbn13);
      if (existing?.title !== null && existing !== null) return false;
      await upsert(row);
      return true;
    },
    async markRefreshed(isbn13, refreshedAt) {
      await kit.update(catalogBooks, { refreshedAt }, eq(catalogBooks.isbn13, isbn13));
    },
    count() {
      return kit.count(catalogBooks);
    },
  };
}
