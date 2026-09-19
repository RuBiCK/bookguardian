import { asc, eq } from 'drizzle-orm';
import type { CreateShelfInput, Shelf, UpdateShelfInput } from '@bookguardian/shared';
import type { DialectKit } from '../adapters/types';
import type { Tables } from '../schema';
import { allOf, newId, nowIso } from './base';

export interface ShelfRepository {
  findById(ownerId: string, id: string): Promise<Shelf | null>;
  listByLibrary(ownerId: string, libraryId: string): Promise<Shelf[]>;
  create(ownerId: string, input: CreateShelfInput & { id?: string }): Promise<Shelf>;
  update(ownerId: string, id: string, input: UpdateShelfInput): Promise<Shelf | null>;
  delete(ownerId: string, id: string): Promise<void>;
}

export function createShelfRepository(kit: DialectKit, tables: Tables): ShelfRepository {
  const { shelves } = tables;
  const owned = (ownerId: string, id: string) =>
    allOf(eq(shelves.ownerId, ownerId), eq(shelves.id, id));

  return {
    async findById(ownerId, id) {
      const [row] = await kit.select(shelves, { where: owned(ownerId, id), limit: 1 });
      return row ?? null;
    },
    async listByLibrary(ownerId, libraryId) {
      return kit.select(shelves, {
        where: allOf(eq(shelves.ownerId, ownerId), eq(shelves.libraryId, libraryId)),
        orderBy: [asc(shelves.sortOrder), asc(shelves.createdAt)],
      });
    },
    async create(ownerId, input) {
      const now = nowIso();
      const row: Shelf = {
        id: input.id ?? newId(),
        ownerId,
        libraryId: input.libraryId,
        name: input.name,
        sortOrder: input.sortOrder ?? 0,
        createdAt: now,
        updatedAt: now,
      };
      await kit.insert(shelves, row);
      return row;
    },
    async update(ownerId, id, input) {
      await kit.update(shelves, { ...input, updatedAt: nowIso() }, owned(ownerId, id));
      return this.findById(ownerId, id);
    },
    async delete(ownerId, id) {
      await kit.delete(shelves, owned(ownerId, id));
    },
  };
}
