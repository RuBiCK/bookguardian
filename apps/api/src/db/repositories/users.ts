import { eq, isNull } from 'drizzle-orm';
import type { User } from '@bookguardian/shared';
import type { DialectKit } from '../adapters/types';
import type { Tables } from '../schema';
import { newId, nowIso } from './base';

export interface CreateUserData {
  id?: string;
  displayName: string;
  /** Must already be normalised (see `normalizeEmail` in `auth/account.ts`). */
  email?: string | null;
  emailVerified?: boolean;
  avatarUrl?: string | null;
  lastLoginAt?: string | null;
}

export type UserPatch = Partial<
  Pick<User, 'displayName' | 'email' | 'emailVerified' | 'avatarUrl' | 'lastLoginAt'>
>;

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findFirst(): Promise<User | null>;
  /** Exact match on the stored (lower-cased) email. */
  findByEmail(email: string): Promise<User | null>;
  /** Users that predate accounts: no email yet (see `claimLocalUser` in `auth/account.ts`). */
  listWithoutEmail(): Promise<User[]>;
  create(data: CreateUserData): Promise<User>;
  update(id: string, patch: UserPatch): Promise<User | null>;
  /** Remove the user; the schema cascades to everything they own (see `auth/account.ts`). */
  delete(id: string): Promise<void>;
}

export function createUserRepository(kit: DialectKit, tables: Tables): UserRepository {
  const { users } = tables;
  return {
    async findById(id) {
      const [row] = await kit.select(users, { where: eq(users.id, id), limit: 1 });
      return row ?? null;
    },
    async findFirst() {
      const [row] = await kit.select(users, { limit: 1 });
      return row ?? null;
    },
    async findByEmail(email) {
      const [row] = await kit.select(users, { where: eq(users.email, email), limit: 1 });
      return row ?? null;
    },
    async listWithoutEmail() {
      return kit.select(users, { where: isNull(users.email) });
    },
    async create(data) {
      const now = nowIso();
      const row: User = {
        id: data.id ?? newId(),
        displayName: data.displayName,
        email: data.email ?? null,
        emailVerified: data.emailVerified ?? false,
        avatarUrl: data.avatarUrl ?? null,
        lastLoginAt: data.lastLoginAt ?? null,
        createdAt: now,
        updatedAt: now,
      };
      await kit.insert(users, row);
      return row;
    },
    async update(id, patch) {
      await kit.update(users, { ...patch, updatedAt: nowIso() }, eq(users.id, id));
      return this.findById(id);
    },
    async delete(id) {
      await kit.delete(users, eq(users.id, id));
    },
  };
}
