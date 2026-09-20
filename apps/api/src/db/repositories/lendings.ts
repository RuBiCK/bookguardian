import { desc, eq, inArray, isNotNull, isNull, type SQL } from 'drizzle-orm';
import type { Borrower, CreateLendingInput, Lending } from '@bookguardian/shared';
import type { DialectKit } from '../adapters/types';
import type { Tables } from '../schema';
import { allOf, newId, nowIso } from './base';

export interface LendingFilter {
  /** `true` keeps only open lendings, `false` only returned ones; omit for both. */
  active?: boolean;
  bookId?: string;
}

export interface LendingRepository {
  findById(ownerId: string, id: string): Promise<Lending | null>;
  /** Newest first (by `lentAt`), optionally narrowed to open/returned ones or one book. */
  list(ownerId: string, filter?: LendingFilter): Promise<Lending[]>;
  listOpen(ownerId: string): Promise<Lending[]>;
  listByBook(ownerId: string, bookId: string): Promise<Lending[]>;
  /** The lending that currently keeps the book out, if any (at most one by rule). */
  findActiveByBook(ownerId: string, bookId: string): Promise<Lending | null>;
  /** Open lendings for these books only (badges on covers). */
  listOpenByBooks(ownerId: string, bookIds: string[]): Promise<Lending[]>;
  /** Distinct borrowers, the one lent to most recently first, with their last contact. */
  listBorrowers(ownerId: string): Promise<Borrower[]>;
  create(ownerId: string, input: CreateLendingInput & { id?: string }): Promise<Lending>;
  markReturned(ownerId: string, id: string, returnedAt?: string): Promise<Lending | null>;
  delete(ownerId: string, id: string): Promise<void>;
}

export function createLendingRepository(kit: DialectKit, tables: Tables): LendingRepository {
  const { lendings } = tables;
  const owned = (ownerId: string, id: string) =>
    allOf(eq(lendings.ownerId, ownerId), eq(lendings.id, id));
  const newestFirst = [desc(lendings.lentAt), desc(lendings.createdAt)];

  const list: LendingRepository['list'] = (ownerId, filter = {}) => {
    const conditions: SQL[] = [eq(lendings.ownerId, ownerId)];
    if (filter.active === true) conditions.push(isNull(lendings.returnedAt));
    if (filter.active === false) conditions.push(isNotNull(lendings.returnedAt));
    if (filter.bookId) conditions.push(eq(lendings.bookId, filter.bookId));
    return kit.select(lendings, {
      where: allOf(conditions[0]!, ...conditions.slice(1)),
      orderBy: newestFirst,
    });
  };

  return {
    async findById(ownerId, id) {
      const [row] = await kit.select(lendings, { where: owned(ownerId, id), limit: 1 });
      return row ?? null;
    },
    list,
    listOpen: (ownerId) => list(ownerId, { active: true }),
    listByBook: (ownerId, bookId) => list(ownerId, { bookId }),
    async findActiveByBook(ownerId, bookId) {
      const [row] = await kit.select(lendings, {
        where: allOf(
          eq(lendings.ownerId, ownerId),
          eq(lendings.bookId, bookId),
          isNull(lendings.returnedAt),
        ),
        orderBy: newestFirst,
        limit: 1,
      });
      return row ?? null;
    },
    async listOpenByBooks(ownerId, bookIds) {
      if (bookIds.length === 0) return [];
      return kit.select(lendings, {
        where: allOf(
          eq(lendings.ownerId, ownerId),
          isNull(lendings.returnedAt),
          inArray(lendings.bookId, bookIds),
        ),
        orderBy: newestFirst,
      });
    },
    async listBorrowers(ownerId) {
      // Names are matched case-insensitively so "ana" and "Ana" are one borrower;
      // the most recent spelling and contact win. The lending table is small
      // (one row per loan), so folding in memory keeps the query portable.
      const rows = await list(ownerId);
      const seen = new Map<string, Borrower>();
      for (const row of rows) {
        const key = row.borrowerName.toLocaleLowerCase();
        if (seen.has(key)) continue;
        seen.set(key, {
          name: row.borrowerName,
          contact: row.borrowerContact,
          lastLentAt: row.lentAt,
        });
      }
      return [...seen.values()];
    },
    async create(ownerId, input) {
      const now = nowIso();
      const row: Lending = {
        id: input.id ?? newId(),
        ownerId,
        bookId: input.bookId,
        borrowerName: input.borrowerName,
        borrowerContact: input.borrowerContact ?? null,
        lentAt: input.lentAt ?? now,
        dueAt: input.dueAt ?? null,
        returnedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      await kit.insert(lendings, row);
      return row;
    },
    async markReturned(ownerId, id, returnedAt = nowIso()) {
      await kit.update(lendings, { returnedAt, updatedAt: nowIso() }, owned(ownerId, id));
      return this.findById(ownerId, id);
    },
    async delete(ownerId, id) {
      await kit.delete(lendings, owned(ownerId, id));
    },
  };
}
