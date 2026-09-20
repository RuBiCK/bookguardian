import { eq, lt } from 'drizzle-orm';
import type { DialectKit } from '../adapters/types';
import type { Tables } from '../schema';
import { newId } from './base';

export interface Session {
  id: string;
  userId: string;
  /** SHA-256 (hex) of the token the cookie carries; the token itself is never stored. */
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  userAgent: string | null;
}

export interface CreateSessionData {
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  userAgent?: string | null;
}

export interface SessionRepository {
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  listByUser(userId: string): Promise<Session[]>;
  create(data: CreateSessionData): Promise<Session>;
  /** Sliding-window bookkeeping: bump `lastSeenAt` and, when given, `expiresAt`. */
  touch(id: string, patch: { lastSeenAt: string; expiresAt?: string }): Promise<void>;
  deleteById(id: string): Promise<void>;
  deleteByUser(userId: string): Promise<void>;
  /** Drop every session whose `expiresAt` is before `now`; returns how many went. */
  deleteExpired(now: string): Promise<number>;
}

export function createSessionRepository(kit: DialectKit, tables: Tables): SessionRepository {
  const { sessions } = tables;
  return {
    async findByTokenHash(tokenHash) {
      const [row] = await kit.select(sessions, {
        where: eq(sessions.tokenHash, tokenHash),
        limit: 1,
      });
      return row ?? null;
    },
    async listByUser(userId) {
      return kit.select(sessions, { where: eq(sessions.userId, userId) });
    },
    async create(data) {
      const row: Session = {
        id: newId(),
        userId: data.userId,
        tokenHash: data.tokenHash,
        createdAt: data.createdAt,
        expiresAt: data.expiresAt,
        lastSeenAt: data.createdAt,
        userAgent: data.userAgent ?? null,
      };
      await kit.insert(sessions, row);
      return row;
    },
    async touch(id, patch) {
      await kit.update(sessions, patch, eq(sessions.id, id));
    },
    async deleteById(id) {
      await kit.delete(sessions, eq(sessions.id, id));
    },
    async deleteByUser(userId) {
      await kit.delete(sessions, eq(sessions.userId, userId));
    },
    async deleteExpired(now) {
      // ISO-8601 UTC strings sort lexicographically, so `<` compares instants.
      const expired = lt(sessions.expiresAt, now);
      const count = await kit.count(sessions, expired);
      if (count > 0) await kit.delete(sessions, expired);
      return count;
    },
  };
}
