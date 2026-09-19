import { loadConfig } from '../config';
import { createAdapter } from '../db/adapters';
import { seed } from '../db/seed';

const adapter = createAdapter(loadConfig().db);
try {
  const result = await seed(adapter);
  console.log(
    `[db:seed] driver=${adapter.driver} ${result.created ? 'seeded' : 'already seeded'} user=${result.userId}`,
  );
} catch (error) {
  console.error('[db:seed] failed:', error);
  process.exitCode = 1;
} finally {
  await adapter.close();
}
