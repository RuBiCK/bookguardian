import type { DatabaseAdapter } from './db/adapters';
import type { Repositories } from './db/repositories';

/** Everything a route handler may need, injected per request via `c.get('services')`. */
export interface Services {
  adapter: DatabaseAdapter;
  repos: Repositories;
  version: string;
}

export interface AppEnv {
  Variables: {
    services: Services;
    /** Id of the user whose data this request may touch (see `owner.ts`). */
    ownerId: string;
  };
}
