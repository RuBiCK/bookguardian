import type { CoverService } from './covers';
import type { DatabaseAdapter } from './db/adapters';
import type { Repositories } from './db/repositories';
import type { LookupService } from './lookup';

/** Everything a route handler may need, injected per request via `c.get('services')`. */
export interface Services {
  adapter: DatabaseAdapter;
  repos: Repositories;
  lookup: LookupService;
  covers: CoverService;
  version: string;
}

export interface AppEnv {
  Variables: {
    services: Services;
    /** Id of the user whose data this request may touch (see `owner.ts`). */
    ownerId: string;
  };
}
