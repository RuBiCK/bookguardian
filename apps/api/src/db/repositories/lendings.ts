import { desc, eq, isNull } from 'drizzle-orm';
import type { CreateLendingInput, Lending } from '@bookguardian/shared';
import type { DialectKit } from '../adapters/types';
import type { Tables } from '../schema';
import { allOf, newId, nowIso } from './base';

export interface LendingRepository {
  findById(ownerId: string, id: string): Promise<Lending | null>;
  listOpen(ownerId: string): Promise<Lending[]>;
  listByBook(ownerId: string, bookId: string): Promise<Lending[]>;
  create(ownerId: string, input: CreateLendingInput & { id?: string }): Promise<Lending>;
  markReturned(ownerId: string, id: string, returnedAt?: string): Promise<Lending | null>;
  delete(ownerId: string, id: string): Promise<void>;
}

export function createLendingRepository(kit: DialectKit, tables: Tables): LendingRepository {
  const { lendings } = tables;
  const owned = (ownerId: string, id: string) =>
    allOf(eq(lendings.ownerId, ownerId), eq(lendings.id, id));

  return {
    async findById(ownerId, id) {
      const [row] = await kit.select(lendings, { where: owned(ownerId, id), limit: 1 });
      return row ?? null;
    },
    async listOpen(ownerId) {
      return kit.select(lendings, {
        where: allOf(eq(lendings.ownerId, ownerId), isNull(lendings.returnedAt)),
        orderBy: [desc(lendings.lentAt)],
      });
    },
    async listByBook(ownerId, bookId) {
      return kit.select(lendings, {
        where: allOf(eq(lendings.ownerId, ownerId), eq(lendings.bookId, bookId)),
        orderBy: [desc(lendings.lentAt)],
      });
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
