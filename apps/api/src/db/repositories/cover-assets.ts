/**
 * `cover_assets`: one row per stored cover file, keyed by the SHA-256 of the
 * WebP so identical images collapse into one file. The file itself lives in
 * the cover store (`covers/store.ts`); this table only carries its
 * dimensions, origin and ownership. See ADR 0004.
 */
import { asc, eq, inArray, isNull } from 'drizzle-orm';
import { coverSourceSchema, type CoverAsset, type CoverSource } from '@bookguardian/shared';
import type { DialectKit } from '../adapters/types';
import type { Tables } from '../schema';
import { nowIso } from './base';

export interface NewCoverAsset {
  id: string;
  width: number;
  height: number;
  bytes: number;
  source: CoverSource;
  /** `null` = shared provider cover; a user id = private photo / pasted URL. */
  ownerId: string | null;
  /** Defaults to now; the cover service passes its own clock. */
  createdAt?: string;
}

export interface CoverAssetRepository {
  find(id: string): Promise<CoverAsset | null>;
  /**
   * Insert, or reuse the row that already carries this hash. The same bytes
   * uploaded by two different users, or found by a provider after a user
   * uploaded them, become one *shared* row: a cover image is not a secret,
   * and a private row would 404 for the second reader.
   */
  upsert(asset: NewCoverAsset): Promise<CoverAsset>;
  /** Every asset, oldest first (the GC walks this). */
  listAll(): Promise<CoverAsset[]>;
  /** Shared assets only (`ownerId` NULL). */
  listShared(): Promise<CoverAsset[]>;
  /** One user's private assets (photos / pasted URLs). */
  listByOwner(ownerId: string): Promise<CoverAsset[]>;
  delete(ids: string[]): Promise<void>;
  count(): Promise<number>;
}

type Row = Tables['coverAssets']['$inferSelect'];

function toAsset(row: Row): CoverAsset {
  return { ...row, source: coverSourceSchema.parse(row.source) };
}

export function createCoverAssetRepository(kit: DialectKit, tables: Tables): CoverAssetRepository {
  const { coverAssets } = tables;

  async function findRow(id: string): Promise<Row | null> {
    const [row] = await kit.select(coverAssets, { where: eq(coverAssets.id, id), limit: 1 });
    return row ?? null;
  }

  return {
    async find(id) {
      const row = await findRow(id);
      return row ? toAsset(row) : null;
    },
    async upsert(asset) {
      const existing = await findRow(asset.id);
      if (existing) {
        if (existing.ownerId !== null && existing.ownerId !== asset.ownerId) {
          await kit.update(coverAssets, { ownerId: null }, eq(coverAssets.id, asset.id));
          return toAsset({ ...existing, ownerId: null });
        }
        return toAsset(existing);
      }
      const row: Row = { ...asset, createdAt: asset.createdAt ?? nowIso() };
      try {
        await kit.insert(coverAssets, row);
        return toAsset(row);
      } catch (error) {
        // Lost a race with another writer for the same hash: their row wins.
        const raced = await findRow(asset.id);
        if (!raced) throw error;
        return this.upsert(asset);
      }
    },
    async listAll() {
      const rows = await kit.select(coverAssets, { orderBy: [asc(coverAssets.createdAt)] });
      return rows.map(toAsset);
    },
    async listShared() {
      const rows = await kit.select(coverAssets, {
        where: isNull(coverAssets.ownerId),
        orderBy: [asc(coverAssets.createdAt)],
      });
      return rows.map(toAsset);
    },
    async listByOwner(ownerId) {
      const rows = await kit.select(coverAssets, {
        where: eq(coverAssets.ownerId, ownerId),
        orderBy: [asc(coverAssets.createdAt)],
      });
      return rows.map(toAsset);
    },
    async delete(ids) {
      if (ids.length === 0) return;
      await kit.delete(coverAssets, inArray(coverAssets.id, ids));
    },
    count() {
      return kit.count(coverAssets);
    },
  };
}
