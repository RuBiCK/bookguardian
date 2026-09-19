import { loadConfig } from '../config';
import { createAdapter } from '../db/adapters';
import { migrate } from '../db/migrate';

const adapter = createAdapter(loadConfig().db);
try {
  const result = await migrate(adapter);
  console.log(
    `[db:migrate] driver=${adapter.driver} applied=${result.applied.length} skipped=${result.skipped.length}`,
  );
  for (const file of result.applied) console.log(`  + ${file}`);
} catch (error) {
  console.error('[db:migrate] failed:', error);
  process.exitCode = 1;
} finally {
  await adapter.close();
}
