import { eq } from 'drizzle-orm';
import {
  shareRoleSchema,
  type CreateLibraryShareInput,
  type LibraryShare,
} from '@bookguardian/shared';
import type { DialectKit } from '../adapters/types';
import type { Tables } from '../schema';
import { allOf, newId, nowIso } from './base';

export interface LibraryShareRepository {
  listByLibrary(libraryId: string): Promise<LibraryShare[]>;
  listByGrantee(granteeId: string): Promise<LibraryShare[]>;
  create(input: CreateLibraryShareInput & { id?: string }): Promise<LibraryShare>;
  delete(libraryId: string, granteeId: string): Promise<void>;
}

type ShareRow = Tables['libraryShares']['$inferSelect'];

function toShare(row: ShareRow): LibraryShare {
  return { ...row, role: shareRoleSchema.parse(row.role) };
}

export function createLibraryShareRepository(
  kit: DialectKit,
  tables: Tables,
): LibraryShareRepository {
  const { libraryShares } = tables;
  return {
    async listByLibrary(libraryId) {
      const rows = await kit.select(libraryShares, {
        where: eq(libraryShares.libraryId, libraryId),
      });
      return rows.map(toShare);
    },
    async listByGrantee(granteeId) {
      const rows = await kit.select(libraryShares, {
        where: eq(libraryShares.granteeId, granteeId),
      });
      return rows.map(toShare);
    },
    async create(input) {
      const now = nowIso();
      const row: LibraryShare = {
        id: input.id ?? newId(),
        libraryId: input.libraryId,
        granteeId: input.granteeId,
        role: input.role ?? 'viewer',
        createdAt: now,
        updatedAt: now,
      };
      await kit.insert(libraryShares, row);
      return row;
    },
    async delete(libraryId, granteeId) {
      await kit.delete(
        libraryShares,
        allOf(eq(libraryShares.libraryId, libraryId), eq(libraryShares.granteeId, granteeId)),
      );
    },
  };
}
