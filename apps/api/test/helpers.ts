import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSqliteAdapter } from '../src/db/adapters/sqlite';
import type { DatabaseAdapter } from '../src/db/adapters/types';
import { migrate } from '../src/db/migrate';

export interface TestDb {
  adapter: DatabaseAdapter;
  path: string;
  cleanup(): Promise<void>;
}

/** A migrated, file-backed SQLite database in a temp dir (so a second connection can inspect it). */
export async function createTestDb(): Promise<TestDb> {
  const dir = mkdtempSync(join(tmpdir(), 'bookguardian-'));
  const path = join(dir, 'test.db');
  const adapter = createSqliteAdapter({ path });
  await migrate(adapter);
  return {
    adapter,
    path,
    async cleanup() {
      await adapter.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
