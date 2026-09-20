import { loadConfig } from '../config';
import { createAdapter } from '../db/adapters';
import { seed } from '../db/seed';

// `pnpm db:seed --local-user` creates the email-less local user on an empty
// database (development only; the first Google sign-in claims it). Without
// the flag the seed only provisions "My Library / Default" for an existing
// first user, since real users arrive through sign-in.
const localUser = process.argv.includes('--local-user');

const adapter = createAdapter(loadConfig().db);
try {
  const result = await seed(adapter, { localUser });
  if (!result) {
    console.log(
      `[db:seed] driver=${adapter.driver} no user yet — sign in with Google, or pass --local-user to create the local one`,
    );
  } else {
    console.log(
      `[db:seed] driver=${adapter.driver} ${result.created ? 'seeded' : 'already seeded'} user=${result.userId}`,
    );
  }
} catch (error) {
  console.error('[db:seed] failed:', error);
  process.exitCode = 1;
} finally {
  await adapter.close();
}
