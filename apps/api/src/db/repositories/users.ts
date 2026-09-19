import { eq } from 'drizzle-orm';
import type { User } from '@bookguardian/shared';
import type { DialectKit } from '../adapters/types';
import type { Tables } from '../schema';
import { newId, nowIso } from './base';

export interface CreateUserData {
  id?: string;
  displayName: string;
  email?: string | null;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findFirst(): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
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
    async create(data) {
      const now = nowIso();
      const row: User = {
        id: data.id ?? newId(),
        displayName: data.displayName,
        email: data.email ?? null,
        createdAt: now,
        updatedAt: now,
      };
      await kit.insert(users, row);
      return row;
    },
  };
}
