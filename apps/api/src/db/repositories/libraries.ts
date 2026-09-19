import { asc, eq } from 'drizzle-orm';
import type { CreateLibraryInput, Library, UpdateLibraryInput } from '@bookguardian/shared';
import type { DialectKit } from '../adapters/types';
import type { Tables } from '../schema';
import { allOf, newId, nowIso } from './base';

export interface LibraryRepository {
  findById(ownerId: string, id: string): Promise<Library | null>;
  listByOwner(ownerId: string): Promise<Library[]>;
  create(ownerId: string, input: CreateLibraryInput & { id?: string }): Promise<Library>;
  update(ownerId: string, id: string, input: UpdateLibraryInput): Promise<Library | null>;
  delete(ownerId: string, id: string): Promise<void>;
}

export function createLibraryRepository(kit: DialectKit, tables: Tables): LibraryRepository {
  const { libraries } = tables;
  const owned = (ownerId: string, id: string) =>
    allOf(eq(libraries.ownerId, ownerId), eq(libraries.id, id));

  return {
    async findById(ownerId, id) {
      const [row] = await kit.select(libraries, { where: owned(ownerId, id), limit: 1 });
      return row ?? null;
    },
    async listByOwner(ownerId) {
      return kit.select(libraries, {
        where: eq(libraries.ownerId, ownerId),
        orderBy: [asc(libraries.createdAt)],
      });
    },
    async create(ownerId, input) {
      const now = nowIso();
      const row: Library = {
        id: input.id ?? newId(),
        ownerId,
        name: input.name,
        location: input.location ?? null,
        createdAt: now,
        updatedAt: now,
      };
      await kit.insert(libraries, row);
      return row;
    },
    async update(ownerId, id, input) {
      await kit.update(libraries, { ...input, updatedAt: nowIso() }, owned(ownerId, id));
      return this.findById(ownerId, id);
    },
    async delete(ownerId, id) {
      await kit.delete(libraries, owned(ownerId, id));
    },
  };
}
