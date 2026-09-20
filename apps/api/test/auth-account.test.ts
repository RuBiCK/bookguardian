import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AccountNotAllowedError,
  EmailNotVerifiedError,
  normalizeEmail,
  parseAllowedEmails,
  resolveAccount,
  type ProviderProfile,
} from '../src/auth';
import type { DatabaseAdapter } from '../src/db/adapters';
import { createRepositories, type Repositories } from '../src/db/repositories';
import { seedLocalUser } from '../src/db/seed';
import { describeEachAdapter, type TestDb } from './adapters';

const ana: ProviderProfile = {
  provider: 'google',
  subject: 'sub-ana',
  email: 'Ana@Example.com',
  emailVerified: true,
  name: 'Ana',
  picture: 'https://img.test/ana.png',
};

describe('normalizeEmail / parseAllowedEmails', () => {
  it('lower-cases and trims', () => {
    expect(normalizeEmail('  Ana@Example.COM ')).toBe('ana@example.com');
  });
  it('parses a comma-separated allow-list, ignoring blanks; empty → null', () => {
    expect(parseAllowedEmails(' A@x.io, b@y.io ,, ')).toEqual(new Set(['a@x.io', 'b@y.io']));
    expect(parseAllowedEmails('')).toBeNull();
    expect(parseAllowedEmails('  ,, ')).toBeNull();
    expect(parseAllowedEmails(undefined)).toBeNull();
  });

  it('also accepts spaces, semicolons and newlines as separators (pasted into a dashboard)', () => {
    const expected = new Set(['rubick@gmail.com', 'marisaontur@gmail.com']);
    expect(parseAllowedEmails('rubick@gmail.com marisaontur@gmail.com')).toEqual(expected);
    expect(parseAllowedEmails('rubick@gmail.com, Marisaontur@gmail.com')).toEqual(expected);
    expect(parseAllowedEmails('rubick@gmail.com;marisaontur@gmail.com')).toEqual(expected);
    expect(parseAllowedEmails('rubick@gmail.com\nmarisaontur@gmail.com\n')).toEqual(expected);
    expect(parseAllowedEmails('rubick@gmail.com , \r\n  marisaontur@gmail.com')).toEqual(expected);
    expect(parseAllowedEmails('rubick@gmail.com rubick@gmail.com')).toEqual(
      new Set(['rubick@gmail.com']),
    );
  });
});

describeEachAdapter('resolveAccount', (adapterCase) => {
  let db: TestDb;
  let repos: Repositories;
  beforeEach(async () => {
    db = await adapterCase.create();
    repos = createRepositories(db.adapter);
  });
  afterEach(async () => {
    await db.cleanup();
  });

  it('creates the user and the identity for a new email', async () => {
    const { user, outcome } = await resolveAccount(db.adapter, ana);
    expect(outcome).toBe('created');
    expect(user).toMatchObject({
      displayName: 'Ana',
      email: 'ana@example.com',
      emailVerified: true,
      avatarUrl: 'https://img.test/ana.png',
    });
    expect(user.lastLoginAt).not.toBeNull();
    const identities = await repos.authIdentities.listByUser(user.id);
    expect(identities).toHaveLength(1);
    expect(identities[0]).toMatchObject({
      provider: 'google',
      providerSubject: 'sub-ana',
      emailAtLink: 'ana@example.com',
    });
  });

  it('falls back to the local part of the email as display name', async () => {
    const { user } = await resolveAccount(db.adapter, { ...ana, name: null });
    expect(user.displayName).toBe('ana');
  });

  it('returns the same user for a known identity and only fills what is empty', async () => {
    const first = await resolveAccount(db.adapter, ana);
    await repos.users.update(first.user.id, { displayName: 'Ana Renamed', avatarUrl: null });
    const again = await resolveAccount(db.adapter, {
      ...ana,
      email: 'other@example.com', // Google may report a changed email; the identity wins
      name: 'Ana From Google',
      picture: 'https://img.test/new.png',
    });
    expect(again.outcome).toBe('existing');
    expect(again.user.id).toBe(first.user.id);
    expect(again.user.displayName).toBe('Ana Renamed');
    expect(again.user.avatarUrl).toBe('https://img.test/new.png');
    expect(again.user.email).toBe('ana@example.com');
    expect(await repos.users.findByEmail('other@example.com')).toBeNull();
  });

  it('links a new identity to the user that already has the email (case-insensitive)', async () => {
    const existing = await repos.users.create({
      displayName: 'Ana (invited)',
      email: 'ana@example.com',
    });
    const { user, outcome } = await resolveAccount(db.adapter, {
      ...ana,
      email: 'ANA@example.com',
      subject: 'sub-ana-2',
    });
    expect(outcome).toBe('linked');
    expect(user.id).toBe(existing.id);
    expect(user.emailVerified).toBe(true);
    expect(user.displayName).toBe('Ana (invited)');
    expect(await repos.authIdentities.findByProviderSubject('google', 'sub-ana-2')).toMatchObject({
      userId: existing.id,
    });
    // Never a second user with that email.
    expect(await db.adapter.kit.count(db.adapter.tables.users)).toBe(1);
  });

  it('a second provider identity with the same email joins the same user', async () => {
    const a = await resolveAccount(db.adapter, ana);
    const b = await resolveAccount(db.adapter, {
      ...ana,
      provider: 'test',
      subject: 'ana@example.com',
    });
    expect(b.outcome).toBe('linked');
    expect(b.user.id).toBe(a.user.id);
    expect(await repos.authIdentities.listByUser(a.user.id)).toHaveLength(2);
  });

  it('refuses an unverified email without touching the database', async () => {
    await expect(resolveAccount(db.adapter, { ...ana, emailVerified: false })).rejects.toThrow(
      EmailNotVerifiedError,
    );
    expect(await repos.users.findFirst()).toBeNull();
  });

  describe('allow-list', () => {
    const allowedEmails = new Set(['ana@example.com']);

    it('lets a listed email create an account', async () => {
      const { outcome } = await resolveAccount(db.adapter, ana, { allowedEmails });
      expect(outcome).toBe('created');
    });

    it('rejects an unlisted email and creates nothing', async () => {
      await expect(
        resolveAccount(
          db.adapter,
          { ...ana, email: 'x@example.com', subject: 's' },
          { allowedEmails },
        ),
      ).rejects.toThrow(AccountNotAllowedError);
      expect(await repos.users.findFirst()).toBeNull();
      expect(await repos.authIdentities.count()).toBe(0);
    });

    it('still admits an existing user even if the list changed', async () => {
      await resolveAccount(db.adapter, ana);
      const { outcome } = await resolveAccount(db.adapter, ana, {
        allowedEmails: new Set(['z@z.io']),
      });
      expect(outcome).toBe('existing');
    });

    it('also guards the claim of the local user', async () => {
      await seedLocalUser(db.adapter);
      await expect(
        resolveAccount(db.adapter, ana, { allowedEmails: new Set(['z@z.io']) }),
      ).rejects.toThrow(AccountNotAllowedError);
      expect(await repos.users.listWithoutEmail()).toHaveLength(1);
    });
  });

  describe('claiming the local user', () => {
    it('the first sign-in takes over the email-less local user and its library', async () => {
      const base = await seedLocalUser(db.adapter);
      const { user, outcome } = await resolveAccount(db.adapter, ana);
      expect(outcome).toBe('claimed');
      expect(user.id).toBe(base.userId);
      expect(user).toMatchObject({
        email: 'ana@example.com',
        emailVerified: true,
        displayName: 'Ana',
        avatarUrl: 'https://img.test/ana.png',
      });
      const libraries = await repos.libraries.listByOwner(base.userId);
      expect(libraries.map((l) => l.name)).toEqual(['My Library']);
      expect(await repos.authIdentities.listByUser(base.userId)).toHaveLength(1);
    });

    it('only the first sign-in claims; the next email gets its own user', async () => {
      const base = await seedLocalUser(db.adapter);
      await resolveAccount(db.adapter, ana);
      const bob = await resolveAccount(db.adapter, {
        ...ana,
        subject: 'sub-bob',
        email: 'bob@example.com',
        name: 'Bob',
      });
      expect(bob.outcome).toBe('created');
      expect(bob.user.id).not.toBe(base.userId);
      expect(await repos.libraries.listByOwner(bob.user.id)).toHaveLength(0);
    });

    it('does not claim when an identity already exists, even with an orphan around', async () => {
      await resolveAccount(db.adapter, ana);
      const orphan = await repos.users.create({ displayName: 'Ghost' });
      const bob = await resolveAccount(db.adapter, {
        ...ana,
        subject: 'sub-bob',
        email: 'bob@example.com',
      });
      expect(bob.outcome).toBe('created');
      expect(bob.user.id).not.toBe(orphan.id);
      expect((await repos.users.findById(orphan.id))?.email).toBeNull();
    });

    it('does not guess between several email-less users', async () => {
      await repos.users.create({ displayName: 'One' });
      await repos.users.create({ displayName: 'Two' });
      const { outcome } = await resolveAccount(db.adapter, ana);
      expect(outcome).toBe('created');
      expect(await repos.users.listWithoutEmail()).toHaveLength(2);
    });
  });

  describe('concurrency', () => {
    it('two simultaneous sign-ins with the same account end in one user and one identity', async () => {
      const results = await Promise.all([
        resolveAccount(db.adapter, ana),
        resolveAccount(db.adapter, ana),
      ]);
      const ids = new Set(results.map((r) => r.user.id));
      expect(ids.size).toBe(1);
      expect(results.map((r) => r.outcome).sort()).toEqual(['created', 'existing']);
      expect(await repos.authIdentities.count()).toBe(1);
    });

    it('two simultaneous sign-ins with the same email from different subjects share the user', async () => {
      const results = await Promise.all([
        resolveAccount(db.adapter, ana),
        resolveAccount(db.adapter, { ...ana, provider: 'test', subject: 'ana@example.com' }),
      ]);
      expect(new Set(results.map((r) => r.user.id)).size).toBe(1);
      expect(results.map((r) => r.outcome).sort()).toEqual(['created', 'linked']);
    });

    it('a lost race on the unique email index is retried and links instead', async () => {
      // First attempt: someone else commits the same email and our insert
      // trips the UNIQUE index. The retry must find that user and link.
      let attempts = 0;
      const racing: DatabaseAdapter = {
        ...db.adapter,
        kit: {
          ...db.adapter.kit,
          async transaction(fn) {
            attempts += 1;
            if (attempts === 1) {
              await repos.users.create({ displayName: 'Winner', email: 'ana@example.com' });
              throw new Error('UNIQUE constraint failed: users.email');
            }
            return db.adapter.kit.transaction(fn);
          },
        },
      };
      const { user, outcome } = await resolveAccount(racing, ana);
      expect(attempts).toBe(2);
      expect(outcome).toBe('linked');
      expect(user.displayName).toBe('Winner');
      expect(await repos.users.findByEmail('ana@example.com')).toMatchObject({ id: user.id });
    });

    it('does not retry other failures', async () => {
      const broken: DatabaseAdapter = {
        ...db.adapter,
        kit: {
          ...db.adapter.kit,
          async transaction() {
            throw new Error('disk I/O error');
          },
        },
      };
      await expect(resolveAccount(broken, ana)).rejects.toThrow('disk I/O error');
    });
  });
});
