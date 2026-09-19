import { desc, eq } from 'drizzle-orm';
import {
  readStatusSchema,
  type Book,
  type CreateBookInput,
  type UpdateBookInput,
} from '@bookguardian/shared';
import type { DialectKit } from '../adapters/types';
import type { Tables } from '../schema';
import { allOf, newId, nowIso } from './base';

export interface BookRepository {
  findById(ownerId: string, id: string): Promise<Book | null>;
  listByOwner(ownerId: string, options?: { limit?: number; offset?: number }): Promise<Book[]>;
  listByShelf(ownerId: string, shelfId: string): Promise<Book[]>;
  create(ownerId: string, input: CreateBookInput & { shelfId: string; id?: string }): Promise<Book>;
  update(ownerId: string, id: string, input: UpdateBookInput): Promise<Book | null>;
  delete(ownerId: string, id: string): Promise<void>;
}

type BookRow = Tables['books']['$inferSelect'];

/** The DB stores read_status as plain text; narrow it back to the enum. */
function toBook(row: BookRow): Book {
  return { ...row, readStatus: readStatusSchema.parse(row.readStatus) };
}

export function createBookRepository(kit: DialectKit, tables: Tables): BookRepository {
  const { books } = tables;
  const owned = (ownerId: string, id: string) =>
    allOf(eq(books.ownerId, ownerId), eq(books.id, id));

  return {
    async findById(ownerId, id) {
      const [row] = await kit.select(books, { where: owned(ownerId, id), limit: 1 });
      return row ? toBook(row) : null;
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
    async delete(ownerId, id) {
      await kit.delete(books, owned(ownerId, id));
    },
  };
}
