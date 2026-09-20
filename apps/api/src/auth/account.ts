/**
 * Account resolution: which `users` row a verified provider identity maps to.
 *
 * One account per email (ADR 0005). In order:
 *   1. the (provider, subject) identity is known → that user;
 *   2. a user already has that email → link the identity to it, never a
 *      second user with the same email;
 *   3. the very first sign-in of an instance seeded before accounts existed
 *      (no identity anywhere, exactly one email-less user) → that user is
 *      claimed: it gets the email and profile and keeps its libraries;
 *   4. otherwise, when the allow-list is set and the email is not on it →
 *      `AccountNotAllowedError`, nothing is written;
 *   5. otherwise create the user and the identity.
 *
 * Whatever the outcome, the user leaves with somewhere to put a book:
 * `provisionUser` (idempotent) creates "My Library / Default" for an account
 * that has no library yet, in the same transaction.
 *
 * Everything runs in one transaction. Two concurrent sign-ins with the same
 * new email are serialised by the SQLite adapter; on engines that are not,
 * the UNIQUE index on `users.email` is the safety net and the loser retries
 * once, landing on step 2.
 */
import type { User } from '@bookguardian/shared';
import type { DatabaseAdapter } from '../db/adapters';
import { createRepositories, type Repositories } from '../db/repositories';
import { provisionUser } from '../provisioning';

/** What a provider asserted about the person signing in (already verified upstream). */
export interface ProviderProfile {
  provider: string;
  /** The provider's stable id for this account (`sub` for OIDC). */
  subject: string;
  email: string;
  emailVerified: boolean;
  name?: string | null;
  picture?: string | null;
}

export interface ResolveAccountOptions {
  /** Normalised emails allowed to create an account; `null`/undefined = anyone. */
  allowedEmails?: ReadonlySet<string> | null;
  now?: () => Date;
}

export type AccountOutcome = 'existing' | 'linked' | 'claimed' | 'created';

export interface ResolvedAccount {
  user: User;
  outcome: AccountOutcome;
}

export class AccountNotAllowedError extends Error {
  constructor(public readonly email: string) {
    super(`${email} is not allowed to create an account`);
    this.name = 'AccountNotAllowedError';
  }
}

export class EmailNotVerifiedError extends Error {
  constructor(public readonly email: string) {
    super(`${email} is not verified by the provider`);
    this.name = 'EmailNotVerifiedError';
  }
}

/** Emails are compared case-insensitively: stored and looked up lower-cased and trimmed. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Parse `AUTH_ALLOWED_EMAILS` into a normalised set; empty → `null` (no
 * list). Commas are the documented separator, but a value pasted into a
 * dashboard often arrives with spaces, semicolons or newlines instead, so
 * any run of those splits too; blanks are dropped and case is folded.
 */
export function parseAllowedEmails(value: string | undefined): Set<string> | null {
  const emails = (value ?? '')
    .split(/[\s,;]+/)
    .map(normalizeEmail)
    .filter((email) => email.length > 0);
  return emails.length > 0 ? new Set(emails) : null;
}

/** Display name when the provider sends none: the part before `@`. */
function fallbackName(email: string): string {
  const at = email.indexOf('@');
  return at > 0 ? email.slice(0, at) : email;
}

/** Profile fields worth refreshing on an existing user: only what is still empty. */
function profilePatch(user: User, profile: ProviderProfile, now: string) {
  return {
    displayName: user.displayName.trim()
      ? user.displayName
      : (profile.name ?? fallbackName(profile.email)),
    avatarUrl: user.avatarUrl ?? profile.picture ?? null,
    lastLoginAt: now,
  };
}

function isUniqueViolation(error: unknown): boolean {
  for (let e: unknown = error; e instanceof Error; e = e.cause) {
    if (/unique|duplicate/i.test(e.message)) return true;
  }
  return false;
}

async function resolveOnce(
  repos: Repositories,
  profile: ProviderProfile,
  options: ResolveAccountOptions,
): Promise<ResolvedAccount> {
  const resolved = await resolveUser(repos, profile, options);
  // Cheap for a returning user (one indexed read), and a new or claimed
  // account lands in a library that is ready for its first book.
  await provisionUser(repos, resolved.user.id);
  return resolved;
}

async function resolveUser(
  repos: Repositories,
  profile: ProviderProfile,
  options: ResolveAccountOptions,
): Promise<ResolvedAccount> {
  const now = (options.now ?? (() => new Date()))().toISOString();
  const email = normalizeEmail(profile.email);
  const { authIdentities, users } = repos;

  // 1. Known identity.
  const identity = await authIdentities.findByProviderSubject(profile.provider, profile.subject);
  if (identity) {
    const current = await users.findById(identity.userId);
    if (!current) throw new Error(`auth identity ${identity.id} points at a missing user`);
    const user = await users.update(current.id, profilePatch(current, profile, now));
    return { user: user ?? current, outcome: 'existing' };
  }

  // 2. Same email → link, never a second user.
  const byEmail = await users.findByEmail(email);
  if (byEmail) {
    await authIdentities.create({
      userId: byEmail.id,
      provider: profile.provider,
      providerSubject: profile.subject,
      emailAtLink: email,
    });
    const user = await users.update(byEmail.id, {
      ...profilePatch(byEmail, profile, now),
      emailVerified: true,
    });
    return { user: user ?? byEmail, outcome: 'linked' };
  }

  // 4 (checked before 3 too: an allow-list also guards the claim).
  if (options.allowedEmails && !options.allowedEmails.has(email)) {
    throw new AccountNotAllowedError(email);
  }

  // 3. First sign-in ever on a database that predates accounts.
  if ((await authIdentities.count()) === 0) {
    const orphans = await users.listWithoutEmail();
    const orphan = orphans.length === 1 ? orphans[0] : undefined;
    if (orphan) {
      await authIdentities.create({
        userId: orphan.id,
        provider: profile.provider,
        providerSubject: profile.subject,
        emailAtLink: email,
      });
      const user = await users.update(orphan.id, {
        email,
        emailVerified: true,
        displayName: profile.name ?? fallbackName(email),
        avatarUrl: profile.picture ?? null,
        lastLoginAt: now,
      });
      return { user: user ?? orphan, outcome: 'claimed' };
    }
  }

  // 5. New account.
  const user = await users.create({
    displayName: profile.name ?? fallbackName(email),
    email,
    emailVerified: true,
    avatarUrl: profile.picture ?? null,
    lastLoginAt: now,
  });
  await authIdentities.create({
    userId: user.id,
    provider: profile.provider,
    providerSubject: profile.subject,
    emailAtLink: email,
  });
  return { user, outcome: 'created' };
}

export async function resolveAccount(
  adapter: DatabaseAdapter,
  profile: ProviderProfile,
  options: ResolveAccountOptions = {},
): Promise<ResolvedAccount> {
  if (!profile.emailVerified) throw new EmailNotVerifiedError(profile.email);
  const run = () =>
    adapter.kit.transaction((tx) =>
      resolveOnce(createRepositories({ ...adapter, kit: tx }), profile, options),
    );
  try {
    return await run();
  } catch (error) {
    // Lost a race on `users.email` / the identity: the other sign-in created
    // the row, so a second pass links to it (step 1 or 2).
    if (!isUniqueViolation(error)) throw error;
    return run();
  }
}

export interface DeletedAccount {
  /** Private cover assets that went with the user; their files still need removing. */
  privateCoverAssetIds: string[];
}

/**
 * Delete a user and everything they own. The schema cascades from `users`
 * to sessions, identities, libraries, shelves, books, lendings, library
 * shares and the user's *private* cover assets; shared covers (no owner) and
 * the ISBN catalogue are untouched because they belong to nobody. The caller
 * removes the files of the returned assets (rows are already gone, so the
 * GC cannot find them).
 */
export async function deleteAccount(
  adapter: DatabaseAdapter,
  userId: string,
): Promise<DeletedAccount | null> {
  return adapter.kit.transaction(async (tx) => {
    const repos = createRepositories({ ...adapter, kit: tx });
    const user = await repos.users.findById(userId);
    if (!user) return null;
    const privateCoverAssetIds = (await repos.coverAssets.listByOwner(userId)).map((a) => a.id);
    await repos.users.delete(userId);
    return { privateCoverAssetIds };
  });
}
