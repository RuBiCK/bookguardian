/**
 * Server-side sessions behind the `bg_session` cookie. The cookie holds a
 * random 32-byte token; the database holds only its SHA-256, so a leaked
 * `sessions` table cannot be replayed. Sessions slide: a request made past
 * the halfway point of the lifetime pushes `expiresAt` out again.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { User } from '@bookguardian/shared';
import type { Repositories, Session } from '../db/repositories';

export const SESSION_COOKIE = 'bg_session';
const DAY_MS = 24 * 60 * 60 * 1000;
/** `lastSeenAt` is written at most this often, to keep reads from turning into writes. */
const SEEN_THROTTLE_MS = 60 * 1000;

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface SessionServiceOptions {
  repos: Repositories;
  /** Lifetime of a session (and of the cookie); default 30 days. */
  ttlMs?: number;
  now?: () => Date;
}

export interface ValidSession {
  session: Session;
  user: User;
  /** `expiresAt` was pushed out on this request (the cookie should be re-issued). */
  renewed: boolean;
}

export interface SessionService {
  readonly ttlMs: number;
  create(userId: string, userAgent?: string | null): Promise<{ token: string; session: Session }>;
  /** `null` for an unknown, expired or orphaned token (an expired row is deleted on the way). */
  validate(token: string): Promise<ValidSession | null>;
  revoke(token: string): Promise<void>;
  /** Delete every expired session; runs on the daily maintenance timer. */
  purgeExpired(): Promise<number>;
}

export function createSessionService({
  repos,
  ttlMs = 30 * DAY_MS,
  now = () => new Date(),
}: SessionServiceOptions): SessionService {
  return {
    ttlMs,
    async create(userId, userAgent = null) {
      const token = generateSessionToken();
      const createdAt = now();
      const session = await repos.sessions.create({
        userId,
        tokenHash: hashSessionToken(token),
        createdAt: createdAt.toISOString(),
        expiresAt: new Date(createdAt.getTime() + ttlMs).toISOString(),
        userAgent: userAgent ? userAgent.slice(0, 512) : null,
      });
      return { token, session };
    },
    async validate(token) {
      const session = await repos.sessions.findByTokenHash(hashSessionToken(token));
      if (!session) return null;
      const at = now().getTime();
      if (Date.parse(session.expiresAt) <= at) {
        await repos.sessions.deleteById(session.id);
        return null;
      }
      const user = await repos.users.findById(session.userId);
      if (!user) {
        await repos.sessions.deleteById(session.id);
        return null;
      }
      const renewed = Date.parse(session.expiresAt) - at < ttlMs / 2;
      const seenStale = at - Date.parse(session.lastSeenAt) >= SEEN_THROTTLE_MS;
      if (renewed || seenStale) {
        const patch = {
          lastSeenAt: new Date(at).toISOString(),
          ...(renewed ? { expiresAt: new Date(at + ttlMs).toISOString() } : {}),
        };
        await repos.sessions.touch(session.id, patch);
        Object.assign(session, patch);
      }
      return { session, user, renewed };
    },
    async revoke(token) {
      const session = await repos.sessions.findByTokenHash(hashSessionToken(token));
      if (session) await repos.sessions.deleteById(session.id);
    },
    async purgeExpired() {
      return repos.sessions.deleteExpired(now().toISOString());
    },
  };
}

export interface SessionCookieOptions {
  /** Only send over HTTPS (when `AUTH_BASE_URL` is https). */
  secure: boolean;
  maxAgeSeconds: number;
}

/** Cookie attributes for `bg_session`: httpOnly, Lax, whole site, sliding lifetime. */
export function sessionCookieOptions({ secure, maxAgeSeconds }: SessionCookieOptions) {
  return {
    httpOnly: true,
    sameSite: 'Lax' as const,
    secure,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
