import { and, eq } from 'drizzle-orm';
import type { DialectKit } from '../adapters/types';
import type { Tables } from '../schema';
import { newId, nowIso } from './base';

export interface AuthIdentity {
  id: string;
  userId: string;
  provider: string;
  providerSubject: string;
  emailAtLink: string | null;
  createdAt: string;
}

export interface CreateAuthIdentityData {
  userId: string;
  provider: string;
  providerSubject: string;
  emailAtLink?: string | null;
}

export interface AuthIdentityRepository {
  findByProviderSubject(provider: string, subject: string): Promise<AuthIdentity | null>;
  listByUser(userId: string): Promise<AuthIdentity[]>;
  /** Total number of linked identities (zero = nobody has ever signed in). */
  count(): Promise<number>;
  create(data: CreateAuthIdentityData): Promise<AuthIdentity>;
}

export function createAuthIdentityRepository(
  kit: DialectKit,
  tables: Tables,
): AuthIdentityRepository {
  const { authIdentities } = tables;
  return {
    async findByProviderSubject(provider, subject) {
      const [row] = await kit.select(authIdentities, {
        where: and(
          eq(authIdentities.provider, provider),
          eq(authIdentities.providerSubject, subject),
        ),
        limit: 1,
      });
      return row ?? null;
    },
    async listByUser(userId) {
      return kit.select(authIdentities, { where: eq(authIdentities.userId, userId) });
    },
    async count() {
      return kit.count(authIdentities);
    },
    async create(data) {
      const row: AuthIdentity = {
        id: newId(),
        userId: data.userId,
        provider: data.provider,
        providerSubject: data.providerSubject,
        emailAtLink: data.emailAtLink ?? null,
        createdAt: nowIso(),
      };
      await kit.insert(authIdentities, row);
      return row;
    },
  };
}
