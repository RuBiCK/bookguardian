/**
 * `isbn_covers`: which shared cover asset an ISBN-13 resolved to, so the
 * second user adding the same edition links the existing file instead of
 * asking Open Library / Google Books again. A miss (no provider had a cover)
 * is a row with a null asset and `missUntil`, after which it is retried.
 */
import { eq, inArray, isNotNull } from 'drizzle-orm';
import { coverSourceSchema, type CoverSource } from '@bookguardian/shared';
import type { DialectKit } from '../adapters/types';
import type { Tables } from '../schema';

export interface IsbnCover {
  isbn13: string;
  coverAssetId: string | null;
  source: CoverSource | null;
  fetchedAt: string;
  missUntil: string | null;
}

export interface IsbnCoverRepository {
  find(isbn13: string): Promise<IsbnCover | null>;
  /** Rows for any of these ISBNs, keyed by ISBN (absent = never resolved). */
  findMany(isbn13s: string[]): Promise<Map<string, IsbnCover>>;
  /** Insert or overwrite the row for `row.isbn13`. */
  save(row: IsbnCover): Promise<IsbnCover>;
  /** Distinct asset ids some ISBN still points at (the GC keeps these). */
  referencedAssetIds(): Promise<Set<string>>;
  count(): Promise<number>;
}

type Row = Tables['isbnCovers']['$inferSelect'];

function fromRow(row: Row): IsbnCover {
  const source = coverSourceSchema.safeParse(row.source);
  return { ...row, source: source.success ? source.data : null };
}

const CHUNK = 200;

export function createIsbnCoverRepository(kit: DialectKit, tables: Tables): IsbnCoverRepository {
  const { isbnCovers } = tables;

  async function findRow(isbn13: string): Promise<Row | null> {
    const [row] = await kit.select(isbnCovers, { where: eq(isbnCovers.isbn13, isbn13), limit: 1 });
    return row ?? null;
  }

  return {
    async find(isbn13) {
      const row = await findRow(isbn13);
      return row ? fromRow(row) : null;
    },
    async findMany(isbn13s) {
      const out = new Map<string, IsbnCover>();
      const unique = [...new Set(isbn13s)];
      for (let i = 0; i < unique.length; i += CHUNK) {
        const rows = await kit.select(isbnCovers, {
          where: inArray(isbnCovers.isbn13, unique.slice(i, i + CHUNK)),
        });
        for (const row of rows) out.set(row.isbn13, fromRow(row));
      }
      return out;
    },
    async save(row) {
      const { isbn13, ...values } = row;
      if (await findRow(isbn13)) {
        await kit.update(isbnCovers, values, eq(isbnCovers.isbn13, isbn13));
        return row;
      }
      try {
        await kit.insert(isbnCovers, row);
      } catch (error) {
        // Two jobs for one ISBN can land together; the later writer overwrites.
        if (!(await findRow(isbn13))) throw error;
        await kit.update(isbnCovers, values, eq(isbnCovers.isbn13, isbn13));
      }
      return row;
    },
    async referencedAssetIds() {
      const groups = await kit.countBy(
        isbnCovers,
        isbnCovers.coverAssetId,
        isNotNull(isbnCovers.coverAssetId),
      );
      return new Set(groups.map((g) => g.key));
    },
    count() {
      return kit.count(isbnCovers);
    },
  };
}
