/**
 * Content-addressed cover files: `<dir>/<sha256[0:2]>/<sha256>.webp` and
 * `<sha256>-thumb.webp`. The two-character prefix keeps any one directory
 * small; the name is the hash, so a file never changes once written and
 * clients may cache it forever.
 */
import { mkdirSync } from 'node:fs';
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { coverFileName, type CoverVariant } from '@bookguardian/shared';
import type { ProcessedCover } from './image';

export interface CoverStore {
  readonly dir: string;
  pathFor(assetId: string, variant?: CoverVariant): string;
  /** Write both variants unless the full one already exists (same hash = same bytes). */
  write(cover: ProcessedCover): Promise<void>;
  /** `null` when the file is gone (the row outlived it, or the volume was wiped). */
  read(assetId: string, variant?: CoverVariant): Promise<Buffer | null>;
  exists(assetId: string): Promise<boolean>;
  /** Remove both variants; missing files are not an error. */
  remove(assetId: string): Promise<void>;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Write through a temp file so a crash never leaves a half-written cover under its final name. */
async function writeAtomic(path: string, data: Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, data);
  await rename(tmp, path);
}

export function createCoverStore(dir: string): CoverStore {
  // Created eagerly so a missing volume fails at boot, not on the first cover.
  mkdirSync(dir, { recursive: true });
  const pathFor = (assetId: string, variant: CoverVariant = 'full') =>
    join(dir, assetId.slice(0, 2), coverFileName(assetId, variant));

  return {
    dir,
    pathFor,
    async write(cover) {
      if (await fileExists(pathFor(cover.id))) return;
      await writeAtomic(pathFor(cover.id, 'thumb'), cover.thumb);
      await writeAtomic(pathFor(cover.id), cover.full);
    },
    async read(assetId, variant = 'full') {
      try {
        return await readFile(pathFor(assetId, variant));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    },
    exists(assetId) {
      return fileExists(pathFor(assetId));
    },
    async remove(assetId) {
      await rm(pathFor(assetId), { force: true });
      await rm(pathFor(assetId, 'thumb'), { force: true });
    },
  };
}
